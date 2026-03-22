import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
  Dimensions,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;
const { width: SCREEN_WIDTH } = Dimensions.get('window');

const THEMES = {
  math: { bg: '#1A1A2E', emoji: '🚀', accent: '#FF6B6B', name: 'Math' },
  phonics: { bg: '#1B4332', emoji: '🦜', accent: '#4ECDC4', name: 'Phonics' },
  gk: { bg: '#03045E', emoji: '🌍', accent: '#6BCB77', name: 'General Knowledge' },
};

interface Question {
  question_id: string;
  question_text: string;
  options: string[];
  difficulty: number;
  subject?: string;
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
  const [feedbackData, setFeedbackData] = useState<Answer | null>(null);
  const [totalStars, setTotalStars] = useState(0);
  const [questionsAnswered, setQuestionsAnswered] = useState(0);
  const [currentSubject, setCurrentSubject] = useState('math');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showCorrectAnswer, setShowCorrectAnswer] = useState(false);
  
  // Animations
  const mascotScale = useRef(new Animated.Value(1)).current;
  const mascotShake = useRef(new Animated.Value(0)).current;
  const xpProgress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    initializeSession();
  }, []);

  useEffect(() => {
    // Animate XP bar
    Animated.spring(xpProgress, {
      toValue: (questionsAnswered / 10) * 100,
      useNativeDriver: false,
    }).start();
  }, [questionsAnswered]);

  const initializeSession = async () => {
    try {
      const childId = await AsyncStorage.getItem('current_child_id');
      const sessionToken = await AsyncStorage.getItem('session_token');
      const subject = await AsyncStorage.getItem('current_subject') || 'math';

      setCurrentSubject(subject);

      if (!childId) {
        router.replace('/children');
        return;
      }

      const childResponse = await axios.get(
        `${BACKEND_URL}/api/child/${childId}`,
        { headers: { Authorization: `Bearer ${sessionToken}` } }
      );
      setChildData(childResponse.data);

      const sessionResponse = await axios.post(
        `${BACKEND_URL}/api/session/start?child_id=${childId}&subject=${subject}`,
        {},
        { headers: { Authorization: `Bearer ${sessionToken}` } }
      );
      setSessionId(sessionResponse.data.session_id);

      await generateQuestion(childId, sessionResponse.data.difficulty, subject, childResponse.data.language || 'en');
    } catch (error) {
      console.error('Failed to initialize session:', error);
      router.replace('/children');
    } finally {
      setLoading(false);
    }
  };

  const generateQuestion = async (childId: string, difficulty: number, subject?: string, language?: string) => {
    try {
      const sessionToken = await AsyncStorage.getItem('session_token');
      const currentSubjectVal = subject || await AsyncStorage.getItem('current_subject') || 'math';
      const currentLanguage = language || 'en';
      
      const response = await axios.post(
        `${BACKEND_URL}/api/question/generate`,
        {
          child_id: childId,
          subject: currentSubjectVal,
          language: currentLanguage,
          difficulty: difficulty,
        },
        { headers: { Authorization: `Bearer ${sessionToken}` } }
      );

      setCurrentQuestion(response.data);
      setSelectedAnswer(null);
      setShowCorrectAnswer(false);
      setQuestionStartTime(Date.now());
    } catch (error) {
      console.error('Failed to generate question:', error);
    }
  };

  const handleAnswerTap = async (answer: string) => {
    if (isProcessing || !currentQuestion || !sessionId) return;
    
    setIsProcessing(true);
    setSelectedAnswer(answer);

    try {
      const timeTaken = Math.floor((Date.now() - questionStartTime) / 1000);
      const sessionToken = await AsyncStorage.getItem('session_token');

      const response = await axios.post(
        `${BACKEND_URL}/api/question/submit`,
        {
          session_id: sessionId,
          question_id: currentQuestion.question_id,
          answer: answer,
          time_taken: timeTaken,
        },
        { headers: { Authorization: `Bearer ${sessionToken}` } }
      );

      const result = response.data;
      setFeedbackData(result);
      setTotalStars(result.total_stars);
      setQuestionsAnswered((prev) => prev + 1);
      setShowCorrectAnswer(true);

      // Trigger mascot animation
      if (result.is_correct) {
        triggerMascotBounce();
      } else {
        triggerMascotShake();
      }

      // Auto-advance after 1.5 seconds
      setTimeout(async () => {
        const childId = await AsyncStorage.getItem('current_child_id');
        const subject = await AsyncStorage.getItem('current_subject') || 'math';
        const language = childData?.language || 'en';
        if (childId) {
          await generateQuestion(childId, result.new_difficulty, subject, language);
          setIsProcessing(false);
        }
      }, 1500);

    } catch (error) {
      console.error('Failed to submit answer:', error);
      setIsProcessing(false);
    }
  };

  const triggerMascotBounce = () => {
    Animated.sequence([
      Animated.timing(mascotScale, { toValue: 1.3, duration: 150, useNativeDriver: true }),
      Animated.timing(mascotScale, { toValue: 1, duration: 150, useNativeDriver: true }),
    ]).start();
  };

  const triggerMascotShake = () => {
    Animated.sequence([
      Animated.timing(mascotShake, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(mascotShake, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(mascotShake, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(mascotShake, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
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
      <View style={[styles.container, { backgroundColor: THEMES[currentSubject as keyof typeof THEMES]?.bg || '#1A1A2E' }]}>
        <ActivityIndicator size="large" color="#fff" />
      </View>
    );
  }

  const theme = THEMES[currentSubject as keyof typeof THEMES] || THEMES.math;

  const getButtonStyle = (option: string) => {
    if (!showCorrectAnswer) {
      return styles.answerButton;
    }

    if (option === feedbackData?.correct_answer) {
      return [styles.answerButton, styles.answerButtonCorrect];
    }

    if (option === selectedAnswer && !feedbackData?.is_correct) {
      return [styles.answerButton, styles.answerButtonWrong];
    }

    return styles.answerButton;
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      {/* XP Progress Bar */}
      <View style={styles.xpBarContainer}>
        <Animated.View
          style={[
            styles.xpBarFill,
            {
              width: xpProgress.interpolate({
                inputRange: [0, 100],
                outputRange: ['0%', '100%'],
              }),
              backgroundColor: theme.accent,
            },
          ]}
        />
      </View>

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          {/* Mascot Character */}
          <Animated.Text
            style={[
              styles.mascot,
              {
                transform: [
                  { scale: mascotScale },
                  { translateX: mascotShake },
                ],
              },
            ]}
          >
            {theme.emoji}
          </Animated.Text>

          <View style={styles.headerInfo}>
            <Text style={styles.childName}>{childData?.avatar} {childData?.name}</Text>
            <View style={[styles.levelBadge, { backgroundColor: theme.accent }]}>
              <Text style={styles.levelText}>Level {currentQuestion?.difficulty || 1}</Text>
            </View>
          </View>
        </View>

        <View style={styles.headerRight}>
          <View style={styles.starsBox}>
            <Ionicons name="star" size={20} color="#FFD93D" />
            <Text style={styles.starsCount}>{totalStars}</Text>
          </View>
          <TouchableOpacity onPress={endSession} style={styles.exitButton}>
            <Ionicons name="close" size={28} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Question Card */}
      <View style={styles.content}>
        <View style={styles.questionCard}>
          <Text style={styles.questionNumber}>
            Question {questionsAnswered + 1}
          </Text>
          <Text style={styles.questionText}>
            {currentQuestion?.question_text}
          </Text>
        </View>

        {/* Answer Buttons */}
        <View style={styles.answersContainer}>
          {currentQuestion?.options.map((option, index) => (
            <TouchableOpacity
              key={index}
              style={getButtonStyle(option)}
              onPress={() => handleAnswerTap(option)}
              disabled={isProcessing}
            >
              <Text style={styles.answerText}>{option}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  xpBarContainer: {
    height: 8,
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  xpBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingTop: 48,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  mascot: {
    fontSize: 80,
    marginRight: 12,
  },
  headerInfo: {
    flex: 1,
  },
  childName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  levelBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  levelText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  starsBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 4,
  },
  starsCount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  exitButton: {
    padding: 4,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  questionCard: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 24,
    padding: 32,
    marginBottom: 32,
  },
  questionNumber: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '600',
    marginBottom: 16,
  },
  questionText: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#fff',
    lineHeight: 36,
  },
  answersContainer: {
    gap: 16,
  },
  answerButton: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 20,
    padding: 20,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  answerButtonCorrect: {
    backgroundColor: '#6BCB77',
    borderColor: '#6BCB77',
  },
  answerButtonWrong: {
    backgroundColor: '#FF6B6B',
    borderColor: '#FF6B6B',
  },
  answerText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
    textAlign: 'center',
  },
});
