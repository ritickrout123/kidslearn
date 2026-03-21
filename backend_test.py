#!/usr/bin/env python3
"""
KidLearn Backend API Testing Suite
Tests all backend endpoints following the auth testing playbook
"""

import requests
import json
import time
import uuid
from datetime import datetime, timezone, timedelta

# Configuration
BACKEND_URL = "https://kidlearn-plus.preview.emergentagent.com/api"
TEST_USER_EMAIL = f"test.user.{int(time.time())}@example.com"
TEST_USER_NAME = "Test Parent User"

class KidLearnTester:
    def __init__(self):
        self.session_token = None
        self.user_id = None
        self.child_id = None
        self.session_id = None
        self.question_id = None
        self.correct_answer = None
        
    def log(self, message, status="INFO"):
        timestamp = datetime.now().strftime("%H:%M:%S")
        print(f"[{timestamp}] {status}: {message}")
        
    def test_health_check(self):
        """Test 1: Basic Health Check"""
        self.log("Testing basic health check...")
        try:
            response = requests.get(f"{BACKEND_URL}/")
            if response.status_code == 200:
                data = response.json()
                self.log(f"✅ Health check passed: {data}")
                return True
            else:
                self.log(f"❌ Health check failed: {response.status_code}", "ERROR")
                return False
        except Exception as e:
            self.log(f"❌ Health check error: {str(e)}", "ERROR")
            return False
    
    def create_test_user_session(self):
        """Test 2: Create test user and session in MongoDB"""
        self.log("Creating test user and session in MongoDB...")
        try:
            import subprocess
            
            # Generate unique IDs
            user_id = f"test-user-{int(time.time())}"
            session_token = f"test_session_{int(time.time())}"
            
            # MongoDB command to create test user and session
            mongo_cmd = f'''
            mongosh --eval "
            use('kidlearn_db');
            var userId = '{user_id}';
            var sessionToken = '{session_token}';
            db.users.insertOne({{
              user_id: userId,
              email: '{TEST_USER_EMAIL}',
              name: '{TEST_USER_NAME}',
              picture: 'https://via.placeholder.com/150',
              created_at: new Date()
            }});
            db.user_sessions.insertOne({{
              user_id: userId,
              session_token: sessionToken,
              expires_at: new Date(Date.now() + 7*24*60*60*1000),
              created_at: new Date()
            }});
            print('Session token: ' + sessionToken);
            print('User ID: ' + userId);
            "
            '''
            
            result = subprocess.run(mongo_cmd, shell=True, capture_output=True, text=True)
            
            if "Session token:" in result.stdout:
                self.session_token = session_token
                self.user_id = user_id
                self.log(f"✅ Test user created: {user_id}")
                self.log(f"✅ Session token: {session_token}")
                return True
            else:
                self.log(f"❌ Failed to create test user: {result.stderr}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Error creating test user: {str(e)}", "ERROR")
            return False
    
    def test_auth_me(self):
        """Test 3: Authentication Flow - GET /api/auth/me"""
        self.log("Testing authentication endpoint...")
        try:
            headers = {"Authorization": f"Bearer {self.session_token}"}
            response = requests.get(f"{BACKEND_URL}/auth/me", headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                if data.get("user_id") == self.user_id and data.get("email") == TEST_USER_EMAIL:
                    self.log(f"✅ Auth test passed: {data}")
                    return True
                else:
                    self.log(f"❌ Auth data mismatch: {data}", "ERROR")
                    return False
            else:
                self.log(f"❌ Auth test failed: {response.status_code} - {response.text}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Auth test error: {str(e)}", "ERROR")
            return False
    
    def test_child_create(self):
        """Test 4: Child Profile Creation"""
        self.log("Testing child profile creation...")
        try:
            headers = {
                "Authorization": f"Bearer {self.session_token}",
                "Content-Type": "application/json"
            }
            
            child_data = {
                "name": "Test Kid",
                "age": 7,
                "avatar": "🦁"
            }
            
            response = requests.post(f"{BACKEND_URL}/child/create", 
                                   headers=headers, 
                                   json=child_data)
            
            if response.status_code == 200:
                data = response.json()
                self.child_id = data.get("child_id")
                self.log(f"✅ Child created: {data}")
                return True
            else:
                self.log(f"❌ Child creation failed: {response.status_code} - {response.text}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Child creation error: {str(e)}", "ERROR")
            return False
    
    def test_child_list(self):
        """Test 5: List Children"""
        self.log("Testing child list endpoint...")
        try:
            headers = {"Authorization": f"Bearer {self.session_token}"}
            response = requests.get(f"{BACKEND_URL}/child/list", headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                if len(data) > 0 and any(child.get("child_id") == self.child_id for child in data):
                    self.log(f"✅ Child list test passed: Found {len(data)} children")
                    return True
                else:
                    self.log(f"❌ Child not found in list: {data}", "ERROR")
                    return False
            else:
                self.log(f"❌ Child list failed: {response.status_code} - {response.text}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Child list error: {str(e)}", "ERROR")
            return False
    
    def test_child_get(self):
        """Test 6: Get Specific Child"""
        self.log("Testing get specific child...")
        try:
            headers = {"Authorization": f"Bearer {self.session_token}"}
            response = requests.get(f"{BACKEND_URL}/child/{self.child_id}", headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                if (data.get("child_id") == self.child_id and 
                    data.get("name") == "Test Kid" and
                    "subjects_progress" in data and
                    "math" in data["subjects_progress"]):
                    self.log(f"✅ Get child test passed: {data}")
                    return True
                else:
                    self.log(f"❌ Child data incomplete: {data}", "ERROR")
                    return False
            else:
                self.log(f"❌ Get child failed: {response.status_code} - {response.text}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Get child error: {str(e)}", "ERROR")
            return False
    
    def test_session_start(self):
        """Test 7: Start Learning Session"""
        self.log("Testing session start...")
        try:
            headers = {"Authorization": f"Bearer {self.session_token}"}
            params = {"child_id": self.child_id, "subject": "math"}
            
            response = requests.post(f"{BACKEND_URL}/session/start", 
                                   headers=headers, 
                                   params=params)
            
            if response.status_code == 200:
                data = response.json()
                self.session_id = data.get("session_id")
                difficulty = data.get("difficulty")
                self.log(f"✅ Session started: {data}")
                return True
            else:
                self.log(f"❌ Session start failed: {response.status_code} - {response.text}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Session start error: {str(e)}", "ERROR")
            return False
    
    def test_question_generate(self):
        """Test 8: Question Generation with Claude Sonnet"""
        self.log("Testing question generation with Claude Sonnet...")
        try:
            headers = {
                "Authorization": f"Bearer {self.session_token}",
                "Content-Type": "application/json"
            }
            
            question_data = {
                "child_id": self.child_id,
                "subject": "math",
                "difficulty": 1
            }
            
            response = requests.post(f"{BACKEND_URL}/question/generate", 
                                   headers=headers, 
                                   json=question_data)
            
            if response.status_code == 200:
                data = response.json()
                required_fields = ["question_id", "question_text", "options", "difficulty"]
                
                if all(field in data for field in required_fields):
                    self.question_id = data.get("question_id")
                    self.log(f"✅ Question generated: {data}")
                    
                    # Store correct answer by checking MongoDB
                    self.get_correct_answer()
                    return True
                else:
                    self.log(f"❌ Question missing fields: {data}", "ERROR")
                    return False
            else:
                self.log(f"❌ Question generation failed: {response.status_code} - {response.text}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Question generation error: {str(e)}", "ERROR")
            return False
    
    def get_correct_answer(self):
        """Helper: Get correct answer from MongoDB"""
        try:
            import subprocess
            
            mongo_cmd = f'''
            mongosh --eval "
            use('kidlearn_db');
            var question = db.questions.findOne({{'question_id': '{self.question_id}'}});
            if (question) {{
                print('CORRECT_ANSWER:' + question.correct_answer);
            }}
            "
            '''
            
            result = subprocess.run(mongo_cmd, shell=True, capture_output=True, text=True)
            
            if "CORRECT_ANSWER:" in result.stdout:
                self.correct_answer = result.stdout.split("CORRECT_ANSWER:")[1].strip()
                self.log(f"✅ Retrieved correct answer: {self.correct_answer}")
            else:
                self.log("❌ Could not retrieve correct answer", "ERROR")
                
        except Exception as e:
            self.log(f"❌ Error getting correct answer: {str(e)}", "ERROR")
    
    def test_answer_submit_correct(self):
        """Test 9: Submit Correct Answer"""
        self.log("Testing correct answer submission...")
        try:
            headers = {
                "Authorization": f"Bearer {self.session_token}",
                "Content-Type": "application/json"
            }
            
            answer_data = {
                "session_id": self.session_id,
                "question_id": self.question_id,
                "answer": self.correct_answer,
                "time_taken": 5
            }
            
            response = requests.post(f"{BACKEND_URL}/question/submit", 
                                   headers=headers, 
                                   json=answer_data)
            
            if response.status_code == 200:
                data = response.json()
                if (data.get("is_correct") == True and 
                    data.get("stars_earned") > 0):
                    self.log(f"✅ Correct answer submitted: {data}")
                    return True
                else:
                    self.log(f"❌ Answer submission data incorrect: {data}", "ERROR")
                    return False
            else:
                self.log(f"❌ Answer submission failed: {response.status_code} - {response.text}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Answer submission error: {str(e)}", "ERROR")
            return False
    
    def test_adaptive_logic_level_up(self):
        """Test 10: Adaptive Logic - Level Up (3 consecutive correct)"""
        self.log("Testing adaptive logic - level up after 3 correct answers...")
        try:
            # Submit 2 more correct answers to trigger level up
            for i in range(2):
                # Generate new question
                if not self.test_question_generate():
                    return False
                
                # Submit correct answer
                if not self.test_answer_submit_correct():
                    return False
                
                time.sleep(1)  # Small delay between requests
            
            # Check if difficulty increased
            headers = {"Authorization": f"Bearer {self.session_token}"}
            response = requests.get(f"{BACKEND_URL}/child/{self.child_id}", headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                math_level = data.get("subjects_progress", {}).get("math", {}).get("level", 1)
                if math_level > 1:
                    self.log(f"✅ Adaptive logic working - level increased to: {math_level}")
                    return True
                else:
                    self.log(f"❌ Level did not increase: {math_level}", "ERROR")
                    return False
            else:
                self.log(f"❌ Could not check level: {response.status_code}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Adaptive logic test error: {str(e)}", "ERROR")
            return False
    
    def test_answer_submit_wrong(self):
        """Test 11: Submit Wrong Answers for Level Down"""
        self.log("Testing wrong answer submission for level down...")
        try:
            # Submit 2 wrong answers to trigger level down
            for i in range(2):
                # Generate new question
                if not self.test_question_generate():
                    return False
                
                # Submit wrong answer
                headers = {
                    "Authorization": f"Bearer {self.session_token}",
                    "Content-Type": "application/json"
                }
                
                answer_data = {
                    "session_id": self.session_id,
                    "question_id": self.question_id,
                    "answer": "wrong_answer",
                    "time_taken": 15
                }
                
                response = requests.post(f"{BACKEND_URL}/question/submit", 
                                       headers=headers, 
                                       json=answer_data)
                
                if response.status_code == 200:
                    data = response.json()
                    if data.get("is_correct") == False:
                        self.log(f"✅ Wrong answer submitted: {data}")
                        if i == 1 and data.get("hint"):  # Second wrong answer should provide hint
                            self.log(f"✅ Hint provided: {data.get('hint')}")
                    else:
                        self.log(f"❌ Wrong answer not processed correctly: {data}", "ERROR")
                        return False
                else:
                    self.log(f"❌ Wrong answer submission failed: {response.status_code}", "ERROR")
                    return False
                
                time.sleep(1)
            
            return True
                
        except Exception as e:
            self.log(f"❌ Wrong answer test error: {str(e)}", "ERROR")
            return False
    
    def test_session_end(self):
        """Test 12: End Session"""
        self.log("Testing session end...")
        try:
            headers = {"Authorization": f"Bearer {self.session_token}"}
            params = {"session_id": self.session_id}
            
            response = requests.post(f"{BACKEND_URL}/session/end", 
                                   headers=headers, 
                                   params=params)
            
            if response.status_code == 200:
                data = response.json()
                if "stars_earned" in data:
                    self.log(f"✅ Session ended: {data}")
                    return True
                else:
                    self.log(f"❌ Session end data incomplete: {data}", "ERROR")
                    return False
            else:
                self.log(f"❌ Session end failed: {response.status_code} - {response.text}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Session end error: {str(e)}", "ERROR")
            return False
    
    def test_progress_analytics(self):
        """Test 13: Progress Analytics"""
        self.log("Testing progress analytics...")
        try:
            headers = {"Authorization": f"Bearer {self.session_token}"}
            response = requests.get(f"{BACKEND_URL}/progress/{self.child_id}", headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                required_fields = ["child", "recent_sessions", "total_time_minutes", "subjects_progress"]
                
                if all(field in data for field in required_fields):
                    child_data = data.get("child", {})
                    sessions = data.get("recent_sessions", [])
                    subjects = data.get("subjects_progress", {})
                    
                    if (child_data.get("child_id") == self.child_id and
                        len(sessions) > 0 and
                        "math" in subjects):
                        self.log(f"✅ Progress analytics working: {data}")
                        return True
                    else:
                        self.log(f"❌ Progress data incomplete: {data}", "ERROR")
                        return False
                else:
                    self.log(f"❌ Progress missing required fields: {data}", "ERROR")
                    return False
            else:
                self.log(f"❌ Progress analytics failed: {response.status_code} - {response.text}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Progress analytics error: {str(e)}", "ERROR")
            return False
    
    def cleanup_test_data(self):
        """Cleanup: Remove test data"""
        self.log("Cleaning up test data...")
        try:
            import subprocess
            
            mongo_cmd = f'''
            mongosh --eval "
            use('kidlearn_db');
            db.users.deleteMany({{email: /test\\.user\\./}});
            db.user_sessions.deleteMany({{session_token: /test_session/}});
            db.children.deleteMany({{user_id: '{self.user_id}'}});
            db.sessions.deleteMany({{child_id: '{self.child_id}'}});
            db.questions.deleteMany({{session_id: '{self.session_id}'}});
            print('Test data cleaned up');
            "
            '''
            
            subprocess.run(mongo_cmd, shell=True, capture_output=True, text=True)
            self.log("✅ Test data cleaned up")
            
        except Exception as e:
            self.log(f"❌ Cleanup error: {str(e)}", "ERROR")
    
    def run_all_tests(self):
        """Run complete test suite"""
        self.log("=" * 60)
        self.log("STARTING KIDLEARN BACKEND API TESTS")
        self.log("=" * 60)
        
        tests = [
            ("Health Check", self.test_health_check),
            ("Create Test User & Session", self.create_test_user_session),
            ("Authentication Flow", self.test_auth_me),
            ("Child Profile Creation", self.test_child_create),
            ("Child List", self.test_child_list),
            ("Get Specific Child", self.test_child_get),
            ("Start Learning Session", self.test_session_start),
            ("Question Generation (Claude)", self.test_question_generate),
            ("Submit Correct Answer", self.test_answer_submit_correct),
            ("Adaptive Logic - Level Up", self.test_adaptive_logic_level_up),
            ("Submit Wrong Answers", self.test_answer_submit_wrong),
            ("End Session", self.test_session_end),
            ("Progress Analytics", self.test_progress_analytics)
        ]
        
        results = {}
        
        for test_name, test_func in tests:
            self.log(f"\n--- Running: {test_name} ---")
            try:
                result = test_func()
                results[test_name] = result
                if not result:
                    self.log(f"❌ {test_name} FAILED - stopping test suite", "ERROR")
                    break
            except Exception as e:
                self.log(f"❌ {test_name} CRASHED: {str(e)}", "ERROR")
                results[test_name] = False
                break
        
        # Cleanup
        self.cleanup_test_data()
        
        # Summary
        self.log("\n" + "=" * 60)
        self.log("TEST RESULTS SUMMARY")
        self.log("=" * 60)
        
        passed = sum(1 for result in results.values() if result)
        total = len(results)
        
        for test_name, result in results.items():
            status = "✅ PASS" if result else "❌ FAIL"
            self.log(f"{status}: {test_name}")
        
        self.log(f"\nOVERALL: {passed}/{total} tests passed")
        
        if passed == total:
            self.log("🎉 ALL TESTS PASSED! Backend is working correctly.")
        else:
            self.log("⚠️  Some tests failed. Check logs above for details.")
        
        return results

if __name__ == "__main__":
    tester = KidLearnTester()
    results = tester.run_all_tests()