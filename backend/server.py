from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Cookie
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
import httpx
from emergentintegrations.llm.chat import LlmChat, UserMessage

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# ============= MODELS =============

class User(BaseModel):
    user_id: str
    email: str
    name: str
    picture: Optional[str] = None
    created_at: datetime

class Child(BaseModel):
    child_id: str
    user_id: str
    name: str
    age: int
    avatar: str
    language: str = "en"  # "en", "hi", "pa"
    total_stars: int = 0
    current_streak: int = 0
    subjects_unlocked: List[str] = Field(default_factory=lambda: ["math"])
    subjects_progress: dict = Field(default_factory=dict)
    streak: dict = Field(default_factory=lambda: {"current": 0, "longest": 0, "last_date": ""})
    badges: List[str] = Field(default_factory=list)
    daily_goal_minutes: int = 15
    created_at: datetime

class ChildCreate(BaseModel):
    name: str
    age: int
    avatar: str
    language: str = "en"

class SessionData(BaseModel):
    session_id: str
    child_id: str
    subject: str
    language: str = "en"
    difficulty: int
    questions_attempted: int = 0
    correct_answers: int = 0
    consecutive_correct: int = 0
    consecutive_wrong: int = 0
    voice_used: bool = False
    start_time: datetime
    end_time: Optional[datetime] = None
    stars_earned: int = 0

class QuestionRequest(BaseModel):
    child_id: str
    subject: str
    language: str = "en"
    difficulty: int

class AnswerSubmit(BaseModel):
    session_id: str
    question_id: str
    answer: str
    time_taken: int

class QuestionRecord(BaseModel):
    question_id: str
    session_id: str
    question_text: str
    options: List[str]
    correct_answer: str
    child_answer: Optional[str] = None
    difficulty: int
    time_taken: Optional[int] = None
    is_correct: Optional[bool] = None
    created_at: datetime

# ============= AUTH HELPER =============

async def get_current_user(request: Request) -> str:
    """Extract user_id from session token (cookie or Authorization header)"""
    session_token = request.cookies.get("session_token")
    
    if not session_token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            session_token = auth_header.replace("Bearer ", "")
    
    if not session_token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    session_doc = await db.user_sessions.find_one(
        {"session_token": session_token},
        {"_id": 0}
    )
    
    if not session_doc:
        raise HTTPException(status_code=401, detail="Invalid session")
    
    # Check expiry
    expires_at = session_doc["expires_at"]
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    
    if expires_at < datetime.now(timezone.utc):
        await db.user_sessions.delete_one({"session_token": session_token})
        raise HTTPException(status_code=401, detail="Session expired")
    
    return session_doc["user_id"]

# ============= AUTH ROUTES =============

@api_router.post("/auth/session")
async def create_session(request: Request, response: Response):
    """Exchange session_id for user data and create persistent session"""
    body = await request.json()
    session_id = body.get("session_id")
    
    if not session_id:
        raise HTTPException(status_code=400, detail="session_id required")
    
    # Call Emergent Auth API
    async with httpx.AsyncClient() as client:
        auth_response = await client.get(
            "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
            headers={"X-Session-ID": session_id}
        )
        
        if auth_response.status_code != 200:
            raise HTTPException(status_code=401, detail="Invalid session_id")
        
        user_data = auth_response.json()
    
    # Check if user exists
    user_doc = await db.users.find_one(
        {"email": user_data["email"]},
        {"_id": 0}
    )
    
    if not user_doc:
        # Create new user
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        user_doc = {
            "user_id": user_id,
            "email": user_data["email"],
            "name": user_data["name"],
            "picture": user_data.get("picture"),
            "created_at": datetime.now(timezone.utc)
        }
        await db.users.insert_one(user_doc)
    else:
        user_id = user_doc["user_id"]
    
    # Create session
    session_token = user_data["session_token"]
    expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    
    await db.user_sessions.insert_one({
        "user_id": user_id,
        "session_token": session_token,
        "expires_at": expires_at,
        "created_at": datetime.now(timezone.utc)
    })
    
    # Set cookie
    response.set_cookie(
        key="session_token",
        value=session_token,
        httponly=True,
        secure=True,
        samesite="none",
        max_age=7*24*60*60,
        path="/"
    )
    
    return {
        "user_id": user_id,
        "email": user_data["email"],
        "name": user_data["name"],
        "picture": user_data.get("picture")
    }

@api_router.get("/auth/me")
async def get_me(request: Request):
    """Get current user data"""
    user_id = await get_current_user(request)
    
    user_doc = await db.users.find_one(
        {"user_id": user_id},
        {"_id": 0}
    )
    
    if not user_doc:
        raise HTTPException(status_code=404, detail="User not found")
    
    return user_doc

@api_router.post("/auth/logout")
async def logout(request: Request, response: Response):
    """Logout user and clear session"""
    try:
        user_id = await get_current_user(request)
        session_token = request.cookies.get("session_token")
        
        if session_token:
            await db.user_sessions.delete_one({"session_token": session_token})
        
        response.delete_cookie("session_token", path="/")
        return {"message": "Logged out successfully"}
    except:
        return {"message": "Already logged out"}

# ============= CHILD ROUTES =============

@api_router.post("/child/create")
async def create_child(child_data: ChildCreate, request: Request):
    """Create a new child profile"""
    user_id = await get_current_user(request)
    
    child_id = f"child_{uuid.uuid4().hex[:12]}"
    
    # Initialize all subjects with age-appropriate starting difficulty
    starting_level = max(1, min(3, (child_data.age - 3) // 2))
    
    child_doc = {
        "child_id": child_id,
        "user_id": user_id,
        "name": child_data.name,
        "age": child_data.age,
        "avatar": child_data.avatar,
        "language": child_data.language,
        "total_stars": 0,
        "current_streak": 0,
        "subjects_unlocked": ["math", "phonics", "gk"],  # All subjects unlocked by default
        "subjects_progress": {
            "math": {"level": starting_level, "questions_answered": 0, "accuracy": 0},
            "phonics": {"level": starting_level, "questions_answered": 0, "accuracy": 0},
            "gk": {"level": starting_level, "questions_answered": 0, "accuracy": 0}
        },
        "streak": {"current": 0, "longest": 0, "last_date": ""},
        "badges": [],
        "daily_goal_minutes": 15,
        "created_at": datetime.now(timezone.utc)
    }
    
    await db.children.insert_one(child_doc)
    
    return {"child_id": child_id, "message": "Child profile created"}

@api_router.get("/child/list")
async def list_children(request: Request):
    """Get all children for current user"""
    user_id = await get_current_user(request)
    
    children = await db.children.find(
        {"user_id": user_id},
        {"_id": 0}
    ).to_list(100)
    
    return children

@api_router.get("/child/{child_id}")
async def get_child(child_id: str, request: Request):
    """Get specific child profile"""
    user_id = await get_current_user(request)
    
    child_doc = await db.children.find_one(
        {"child_id": child_id, "user_id": user_id},
        {"_id": 0}
    )
    
    if not child_doc:
        raise HTTPException(status_code=404, detail="Child not found")
    
    return child_doc

# ============= SESSION ROUTES =============

@api_router.post("/session/start")
async def start_session(child_id: str, subject: str, request: Request):
    """Start a new learning session"""
    user_id = await get_current_user(request)
    
    # Verify child belongs to user
    child_doc = await db.children.find_one(
        {"child_id": child_id, "user_id": user_id},
        {"_id": 0}
    )
    
    if not child_doc:
        raise HTTPException(status_code=404, detail="Child not found")
    
    # Get starting difficulty from child's progress
    difficulty = child_doc.get("subjects_progress", {}).get(subject, {}).get("level", 1)
    language = child_doc.get("language", "en")
    
    session_id = f"session_{uuid.uuid4().hex[:12]}"
    
    session_doc = {
        "session_id": session_id,
        "child_id": child_id,
        "subject": subject,
        "language": language,
        "difficulty": difficulty,
        "questions_attempted": 0,
        "correct_answers": 0,
        "consecutive_correct": 0,
        "consecutive_wrong": 0,
        "voice_used": False,
        "start_time": datetime.now(timezone.utc),
        "end_time": None,
        "stars_earned": 0
    }
    
    await db.sessions.insert_one(session_doc)
    
    return {"session_id": session_id, "difficulty": difficulty, "language": language}

@api_router.post("/session/end")
async def end_session(session_id: str, request: Request):
    """End a learning session"""
    user_id = await get_current_user(request)
    
    session_doc = await db.sessions.find_one(
        {"session_id": session_id},
        {"_id": 0}
    )
    
    if not session_doc:
        raise HTTPException(status_code=404, detail="Session not found")
    
    # Verify ownership
    child_doc = await db.children.find_one(
        {"child_id": session_doc["child_id"], "user_id": user_id},
        {"_id": 0}
    )
    
    if not child_doc:
        raise HTTPException(status_code=403, detail="Unauthorized")
    
    # Update session
    await db.sessions.update_one(
        {"session_id": session_id},
        {"$set": {"end_time": datetime.now(timezone.utc)}}
    )
    
    # Update child's total stars
    await db.children.update_one(
        {"child_id": session_doc["child_id"]},
        {"$inc": {"total_stars": session_doc["stars_earned"]}}
    )
    
    return {"message": "Session ended", "stars_earned": session_doc["stars_earned"]}

# ============= QUESTION ROUTES =============

@api_router.post("/question/generate")
async def generate_question(req: QuestionRequest, request: Request):
    """Generate adaptive question using Claude Sonnet (multilingual, multi-subject)"""
    user_id = await get_current_user(request)
    
    # Verify child belongs to user
    child_doc = await db.children.find_one(
        {"child_id": req.child_id, "user_id": user_id},
        {"_id": 0}
    )
    
    if not child_doc:
        raise HTTPException(status_code=404, detail="Child not found")
    
    # Get active session
    session_doc = await db.sessions.find_one(
        {"child_id": req.child_id, "end_time": None},
        {"_id": 0},
        sort=[("start_time", -1)]
    )
    
    if not session_doc:
        raise HTTPException(status_code=400, detail="No active session")
    
    # Language names for prompts
    lang_names = {"en": "English", "hi": "Hindi (हिंदी)", "pa": "Punjabi (ਪੰਜਾਬੀ)"}
    language_name = lang_names.get(req.language, "English")
    
    # Subject-specific prompts
    subject_prompts = {
        "math": f"""Generate a math question for a {child_doc['age']}-year-old child at difficulty level {req.difficulty} (1=easy, 2=medium, 3=hard).

Difficulty {req.difficulty} guidelines:
- Level 1: Single-digit addition/subtraction (e.g., 3+2, 7-4)
- Level 2: Double-digit addition/subtraction, simple multiplication (e.g., 12+8, 3×4)
- Level 3: Mixed operations, division, word problems (e.g., 15÷3, "If you have 10 apples and give away 3...")

Generate the question in {language_name}.""",
        
        "phonics": f"""Generate a phonics/reading question for a {child_doc['age']}-year-old child at difficulty level {req.difficulty} (1=easy, 2=medium, 3=hard).

Difficulty {req.difficulty} guidelines:
- Level 1: Letter sounds, beginning sounds (e.g., "Which letter makes the 'buh' sound?")
- Level 2: Rhyming words, simple word recognition (e.g., "Which word rhymes with 'cat'?")
- Level 3: Sight words, simple sentences (e.g., "What is the missing word: 'The dog ___ running'?")

Generate the question in {language_name}.""",
        
        "gk": f"""Generate a general knowledge question for a {child_doc['age']}-year-old child at difficulty level {req.difficulty} (1=easy, 2=medium, 3=hard).

Difficulty {req.difficulty} guidelines:
- Level 1: Colors, shapes, common animals (e.g., "What color is the sky?", "What shape is a ball?")
- Level 2: Body parts, days of week, seasons (e.g., "How many legs does a dog have?")
- Level 3: World facts, science basics (e.g., "What do plants need to grow?", "What is the sun?")

Generate the question in {language_name}."""
    }
    
    base_prompt = subject_prompts.get(req.subject, subject_prompts["math"])
    
    prompt = f"""{base_prompt}

Return ONLY a JSON object with this exact format:
{{
    "question": "Your question here",
    "options": ["Option 1", "Option 2", "Option 3", "Option 4"],
    "correct_answer": "Option X"
}}

IMPORTANT: 
- All text (question and options) MUST be in {language_name}
- Return ONLY the JSON object, no other text
- Ensure questions are age-appropriate and culturally relevant"""
    
    try:
        chat = LlmChat(
            api_key=os.environ['EMERGENT_LLM_KEY'],
            session_id=session_doc["session_id"],
            system_message=f"You are an experienced teacher for young children aged 4-10. Generate age-appropriate questions in {language_name}."
        ).with_model("anthropic", "claude-sonnet-4-5-20250929")
        
        message = UserMessage(text=prompt)
        response = await chat.send_message(message)
        
        # Parse the response
        import json
        
        # Clean the response - remove markdown code blocks if present
        response_clean = response.strip()
        if response_clean.startswith("```json"):
            response_clean = response_clean[7:]  # Remove ```json
        if response_clean.startswith("```"):
            response_clean = response_clean[3:]   # Remove ```
        if response_clean.endswith("```"):
            response_clean = response_clean[:-3]  # Remove trailing ```
        response_clean = response_clean.strip()
        
        question_data = json.loads(response_clean)
        
        # Create question record
        question_id = f"question_{uuid.uuid4().hex[:12]}"
        
        question_doc = {
            "question_id": question_id,
            "session_id": session_doc["session_id"],
            "subject": req.subject,
            "language": req.language,
            "question_text": question_data["question"],
            "options": question_data["options"],
            "correct_answer": question_data["correct_answer"],
            "child_answer": None,
            "difficulty": req.difficulty,
            "time_taken": None,
            "is_correct": None,
            "created_at": datetime.now(timezone.utc)
        }
        
        await db.questions.insert_one(question_doc)
        
        return {
            "question_id": question_id,
            "question_text": question_data["question"],
            "options": question_data["options"],
            "difficulty": req.difficulty,
            "subject": req.subject,
            "language": req.language
        }
    
    except Exception as e:
        logger.error(f"Error generating question: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to generate question: {str(e)}")

@api_router.post("/question/submit")
async def submit_answer(answer_data: AnswerSubmit, request: Request):
    """Submit answer and get feedback with adaptive difficulty adjustment"""
    user_id = await get_current_user(request)
    
    # Get question
    question_doc = await db.questions.find_one(
        {"question_id": answer_data.question_id},
        {"_id": 0}
    )
    
    if not question_doc:
        raise HTTPException(status_code=404, detail="Question not found")
    
    # Get session
    session_doc = await db.sessions.find_one(
        {"session_id": answer_data.session_id},
        {"_id": 0}
    )
    
    if not session_doc:
        raise HTTPException(status_code=404, detail="Session not found")
    
    # Verify ownership
    child_doc = await db.children.find_one(
        {"child_id": session_doc["child_id"], "user_id": user_id},
        {"_id": 0}
    )
    
    if not child_doc:
        raise HTTPException(status_code=403, detail="Unauthorized")
    
    # Check if correct
    is_correct = answer_data.answer == question_doc["correct_answer"]
    
    # Update question record
    await db.questions.update_one(
        {"question_id": answer_data.question_id},
        {"$set": {
            "child_answer": answer_data.answer,
            "time_taken": answer_data.time_taken,
            "is_correct": is_correct
        }}
    )
    
    # Calculate stars (1-3 based on speed and correctness)
    stars = 0
    if is_correct:
        if answer_data.time_taken < 10:
            stars = 3
        elif answer_data.time_taken < 20:
            stars = 2
        else:
            stars = 1
    
    # Update session with adaptive logic
    new_consecutive_correct = session_doc["consecutive_correct"] + 1 if is_correct else 0
    new_consecutive_wrong = session_doc["consecutive_wrong"] + 1 if not is_correct else 0
    new_correct_answers = session_doc["correct_answers"] + (1 if is_correct else 0)
    new_questions_attempted = session_doc["questions_attempted"] + 1
    new_difficulty = session_doc["difficulty"]
    
    # Adaptive difficulty adjustment
    difficulty_changed = False
    hint = None
    
    if new_consecutive_correct >= 3:
        if new_difficulty < 3:
            new_difficulty += 1
            difficulty_changed = True
        new_consecutive_correct = 0
    
    if new_consecutive_wrong >= 2:
        if new_difficulty > 1:
            new_difficulty -= 1
            difficulty_changed = True
        hint = "Try breaking the problem into smaller parts!"
        new_consecutive_wrong = 0
    
    # Update session
    await db.sessions.update_one(
        {"session_id": answer_data.session_id},
        {"$set": {
            "difficulty": new_difficulty,
            "consecutive_correct": new_consecutive_correct,
            "consecutive_wrong": new_consecutive_wrong,
            "correct_answers": new_correct_answers,
            "questions_attempted": new_questions_attempted
        },
        "$inc": {"stars_earned": stars}}
    )
    
    # Update child progress
    accuracy = (new_correct_answers / new_questions_attempted) * 100 if new_questions_attempted > 0 else 0
    
    await db.children.update_one(
        {"child_id": session_doc["child_id"]},
        {"$set": {
            f"subjects_progress.{session_doc['subject']}.level": new_difficulty,
            f"subjects_progress.{session_doc['subject']}.questions_answered": new_questions_attempted,
            f"subjects_progress.{session_doc['subject']}.accuracy": round(accuracy, 1)
        }}
    )
    
    return {
        "is_correct": is_correct,
        "correct_answer": question_doc["correct_answer"],
        "stars_earned": stars,
        "new_difficulty": new_difficulty,
        "difficulty_changed": difficulty_changed,
        "hint": hint,
        "total_stars": session_doc["stars_earned"] + stars
    }

# ============= PROGRESS ROUTES =============

@api_router.get("/progress/{child_id}")
async def get_progress(child_id: str, request: Request):
    """Get child's learning progress"""
    user_id = await get_current_user(request)
    
    # Verify ownership
    child_doc = await db.children.find_one(
        {"child_id": child_id, "user_id": user_id},
        {"_id": 0}
    )
    
    if not child_doc:
        raise HTTPException(status_code=404, detail="Child not found")
    
    # Get recent sessions
    sessions = await db.sessions.find(
        {"child_id": child_id},
        {"_id": 0}
    ).sort("start_time", -1).limit(10).to_list(10)
    
    # Calculate total time spent (in minutes)
    total_time = 0
    for session in sessions:
        if session.get("end_time"):
            duration = (session["end_time"] - session["start_time"]).total_seconds() / 60
            total_time += duration
    
    return {
        "child": child_doc,
        "recent_sessions": sessions,
        "total_time_minutes": round(total_time, 1),
        "total_stars": child_doc["total_stars"],
        "subjects_progress": child_doc.get("subjects_progress", {})
    }

# ============= BASIC ROUTES =============

@api_router.get("/")
async def root():
    return {"message": "KidLearn API v1.0", "status": "running"}

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
