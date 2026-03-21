import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  Animated,
  Modal,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

interface Question {
  question_id: string;
  question_text: string;
  options: string[];
  difficulty: number;
}

interface Answer {
  is_correct: boolean;
  correct_answer: string;
  stars_earned: number;
  new_difficulty: number;
  difficulty_changed: boolean;
  hint: string | null;
  total_stars: number;
}

export default function LearnScreen() {
  const [loading, setLoading] = useState(true);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [childData, setChildData] = useState<any>(null);
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [questionStartTime, setQuestionStartTime] = useState<number>(0);
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackData, setFeedbackData] = useState<Answer | null>(null);
  const [totalStars, setTotalStars] = useState(0);
  const [questionsAnswered, setQuestionsAnswered] = useState(0);
  const [starAnimation] = useState(new Animated.Value(0));

  useEffect(() => {
    initializeSession();
  }, []);

  const initializeSession = async () => {
    try {
      const childId = await AsyncStorage.getItem('current_child_id');
      const sessionToken = await AsyncStorage.getItem('session_token');

      if (!childId) {
        router.replace('/children');
        return;
      }

      // Get child data
      const childResponse = await axios.get(
        `${BACKEND_URL}/api/child/${childId}`,
        { headers: { Authorization: `Bearer ${sessionToken}` } }
      );
      setChildData(childResponse.data);

      // Start session
      const sessionResponse = await axios.post(
        `${BACKEND_URL}/api/session/start?child_id=${childId}&subject=math`,
        {},
        { headers: { Authorization: `Bearer ${sessionToken}` } }
      );
      setSessionId(sessionResponse.data.session_id);

      // Get first question
      await generateQuestion(childId, sessionResponse.data.difficulty);
    } catch (error) {
      console.error('Failed to initialize session:', error);
      router.replace('/children');
    } finally {
      setLoading(false);
    }
  };

  const generateQuestion = async (childId: string, difficulty: number) => {
    try {
      const sessionToken = await AsyncStorage.getItem('session_token');
      const response = await axios.post(
        `${BACKEND_URL}/api/question/generate`,
        {
          child_id: childId,
          subject: 'math',
          difficulty: difficulty,
        },
        { headers: { Authorization: `Bearer ${sessionToken}` } }
      );

      setCurrentQuestion(response.data);
      setSelectedAnswer(null);
      setQuestionStartTime(Date.now());
    } catch (error) {
      console.error('Failed to generate question:', error);
    }
  };

  const submitAnswer = async () => {
    if (!selectedAnswer || !currentQuestion || !sessionId) return;

    try {
      const timeTaken = Math.floor((Date.now() - questionStartTime) / 1000);
      const sessionToken = await AsyncStorage.getItem('session_token');

      const response = await axios.post(
        `${BACKEND_URL}/api/question/submit`,
        {
          session_id: sessionId,
          question_id: currentQuestion.question_id,
          answer: selectedAnswer,
          time_taken: timeTaken,
        },
        { headers: { Authorization: `Bearer ${sessionToken}` } }
      );

      setFeedbackData(response.data);
      setTotalStars(response.data.total_stars);
      setQuestionsAnswered((prev) => prev + 1);
      setShowFeedback(true);

      // Animate stars
      if (response.data.is_correct) {
        starAnimation.setValue(0);
        Animated.spring(starAnimation, {
          toValue: 1,
          useNativeDriver: true,
          tension: 50,
          friction: 3,
        }).start();
      }
    } catch (error) {
      console.error('Failed to submit answer:', error);
    }
  };

  const nextQuestion = async () => {
    setShowFeedback(false);
    setFeedbackData(null);

    if (feedbackData) {
      const childId = await AsyncStorage.getItem('current_child_id');
      if (childId) {
        await generateQuestion(childId, feedbackData.new_difficulty);
      }
    }
  };

  const endSession = async () => {
    try {
      const sessionToken = await AsyncStorage.getItem('session_token');
      await axios.post(
        `${BACKEND_URL}/api/session/end?session_id=${sessionId}`,
        {},
        { headers: { Authorization: `Bearer ${sessionToken}` } }
      );

      router.push('/dashboard');
    } catch (error) {
      console.error('Failed to end session:', error);
      router.push('/children');
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#FF6B6B" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.childName}>
            {childData?.avatar} {childData?.name}
          </Text>
          <Text style={styles.difficulty}>
            Level {currentQuestion?.difficulty || 1}
          </Text>
        </View>
        <View style={styles.headerRight}>
          <View style={styles.starsBox}>
            <Ionicons name="star" size={20} color="#FFD93D" />
            <Text style={styles.starsCount}>{totalStars}</Text>
          </View>
          <TouchableOpacity onPress={endSession} style={styles.exitButton}>
            <Ionicons name="close" size={24} color="#666" />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.content}>
        <View style={styles.questionBox}>
          <Text style={styles.questionNumber}>
            Question {questionsAnswered + 1}
          </Text>
          <Text style={styles.questionText}>
            {currentQuestion?.question_text}
          </Text>
        </View>

        <View style={styles.optionsContainer}>
          {currentQuestion?.options.map((option, index) => (
            <TouchableOpacity
              key={index}
              style={[
                styles.optionButton,
                selectedAnswer === option && styles.optionButtonSelected,
              ]}
              onPress={() => setSelectedAnswer(option)}
            >
              <Text
                style={[
                  styles.optionText,
                  selectedAnswer === option && styles.optionTextSelected,
                ]}
              >
                {option}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          style={[
            styles.submitButton,
            !selectedAnswer && styles.submitButtonDisabled,
          ]}
          onPress={submitAnswer}
          disabled={!selectedAnswer}
        >
          <Text style={styles.submitButtonText}>Submit Answer</Text>
        </TouchableOpacity>
      </View>

      {/* Feedback Modal */}
      <Modal
        visible={showFeedback}
        animationType="fade"
        transparent={true}
        onRequestClose={nextQuestion}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.feedbackModal}>
            {feedbackData?.is_correct ? (
              <>
                <Animated.View
                  style={{
                    transform: [
                      {
                        scale: starAnimation.interpolate({
                          inputRange: [0, 0.5, 1],
                          outputRange: [0, 1.2, 1],
                        }),
                      },
                    ],
                  }}
                >
                  <Ionicons name="checkmark-circle" size={80} color="#6BCB77" />
                </Animated.View>
                <Text style={styles.feedbackTitle}>Awesome! 🎉</Text>
                <Text style={styles.feedbackText}>You got it right!</Text>

                <View style={styles.starsEarned}>
                  {Array.from({ length: feedbackData.stars_earned }).map(
                    (_, i) => (
                      <Ionicons key={i} name="star" size={32} color="#FFD93D" />
                    )
                  )}
                </View>

                {feedbackData.difficulty_changed && (
                  <Text style={styles.levelUp}>
                    🎓 Level up! Now trying harder questions!
                  </Text>
                )}
              </>
            ) : (
              <>
                <Ionicons name="close-circle" size={80} color="#FF6B6B" />
                <Text style={styles.feedbackTitle}>Oops! 🤔</Text>
                <Text style={styles.feedbackText}>
                  The correct answer was: {feedbackData?.correct_answer}
                </Text>

                {feedbackData?.hint && (
                  <View style={styles.hintBox}>
                    <Ionicons name="bulb" size={20} color="#FFD93D" />
                    <Text style={styles.hintText}>{feedbackData.hint}</Text>
                  </View>
                )}

                {feedbackData?.difficulty_changed && (
                  <Text style={styles.levelDown}>
                    👶 Let's try easier questions for now!
                  </Text>
                )}
              </>
            )}

            <TouchableOpacity style={styles.nextButton} onPress={nextQuestion}>
              <Text style={styles.nextButtonText}>Next Question</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={endSession}>
              <Text style={styles.finishText}>Finish Session</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF5E1',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  headerLeft: {
    flex: 1,
  },
  childName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  difficulty: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  starsBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF5E1',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 4,
  },
  starsCount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  exitButton: {
    padding: 4,
  },
  content: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
  },
  questionBox: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 32,
    marginBottom: 32,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  questionNumber: {
    fontSize: 14,
    color: '#FF6B6B',
    fontWeight: '600',
    marginBottom: 12,
  },
  questionText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    lineHeight: 32,
  },
  optionsContainer: {
    gap: 12,
    marginBottom: 32,
  },
  optionButton: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    borderWidth: 2,
    borderColor: '#E5E5E5',
  },
  optionButtonSelected: {
    borderColor: '#4ECDC4',
    backgroundColor: '#E8F8F7',
  },
  optionText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
  },
  optionTextSelected: {
    color: '#4ECDC4',
  },
  submitButton: {
    backgroundColor: '#FF6B6B',
    borderRadius: 16,
    paddingVertical: 20,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    backgroundColor: '#ccc',
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  feedbackModal: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 32,
    width: '85%',
    maxWidth: 400,
    alignItems: 'center',
  },
  feedbackTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 16,
  },
  feedbackText: {
    fontSize: 16,
    color: '#666',
    marginTop: 8,
    textAlign: 'center',
  },
  starsEarned: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 24,
  },
  levelUp: {
    fontSize: 14,
    color: '#6BCB77',
    marginTop: 16,
    textAlign: 'center',
    fontWeight: '600',
  },
  levelDown: {
    fontSize: 14,
    color: '#FF6B6B',
    marginTop: 16,
    textAlign: 'center',
    fontWeight: '600',
  },
  hintBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF5E1',
    padding: 16,
    borderRadius: 12,
    marginTop: 16,
    gap: 8,
  },
  hintText: {
    fontSize: 14,
    color: '#666',
    flex: 1,
  },
  nextButton: {
    backgroundColor: '#4ECDC4',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 48,
    marginTop: 24,
  },
  nextButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  finishText: {
    fontSize: 14,
    color: '#999',
    marginTop: 16,
    textDecorationLine: 'underline',
  },
});