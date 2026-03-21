import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

interface Session {
  session_id: string;
  subject: string;
  questions_attempted: number;
  correct_answers: number;
  stars_earned: number;
  start_time: string;
  end_time: string | null;
}

interface ProgressData {
  child: {
    child_id: string;
    name: string;
    age: number;
    avatar: string;
    total_stars: number;
    subjects_progress: {
      math: {
        level: number;
        questions_answered: number;
        accuracy: number;
      };
    };
  };
  recent_sessions: Session[];
  total_time_minutes: number;
}

export default function DashboardScreen() {
  const [loading, setLoading] = useState(true);
  const [progressData, setProgressData] = useState<ProgressData | null>(null);

  useEffect(() => {
    loadProgress();
  }, []);

  const loadProgress = async () => {
    try {
      const childId = await AsyncStorage.getItem('current_child_id');
      const sessionToken = await AsyncStorage.getItem('session_token');

      if (!childId) {
        router.replace('/children');
        return;
      }

      const response = await axios.get(
        `${BACKEND_URL}/api/progress/${childId}`,
        { headers: { Authorization: `Bearer ${sessionToken}` } }
      );

      setProgressData(response.data);
    } catch (error) {
      console.error('Failed to load progress:', error);
    } finally {
      setLoading(false);
    }
  };

  const goBack = () => {
    router.back();
  };

  const startNewSession = () => {
    router.push('/learn');
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#FF6B6B" />
      </View>
    );
  }

  if (!progressData) {
    return (
      <View style={styles.container}>
        <Text>No progress data available</Text>
      </View>
    );
  }

  const { child, recent_sessions, total_time_minutes } = progressData;
  const mathProgress = child.subjects_progress?.math || {
    level: 1,
    questions_answered: 0,
    accuracy: 0,
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={goBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Progress Report</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content}>
        {/* Child Info Card */}
        <View style={styles.childCard}>
          <Text style={styles.childAvatar}>{child.avatar}</Text>
          <Text style={styles.childName}>{child.name}</Text>
          <Text style={styles.childAge}>{child.age} years old</Text>
          <View style={styles.totalStars}>
            <Ionicons name="star" size={32} color="#FFD93D" />
            <Text style={styles.totalStarsText}>{child.total_stars}</Text>
            <Text style={styles.totalStarsLabel}>Total Stars</Text>
          </View>
        </View>

        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Ionicons name="time" size={32} color="#4ECDC4" />
            <Text style={styles.statValue}>{Math.round(total_time_minutes)}</Text>
            <Text style={styles.statLabel}>Minutes</Text>
          </View>

          <View style={styles.statCard}>
            <Ionicons name="help-circle" size={32} color="#FF6B6B" />
            <Text style={styles.statValue}>{mathProgress.questions_answered}</Text>
            <Text style={styles.statLabel}>Questions</Text>
          </View>

          <View style={styles.statCard}>
            <Ionicons name="trophy" size={32} color="#FFD93D" />
            <Text style={styles.statValue}>{mathProgress.accuracy}%</Text>
            <Text style={styles.statLabel}>Accuracy</Text>
          </View>

          <View style={styles.statCard}>
            <Ionicons name="trending-up" size={32} color="#6BCB77" />
            <Text style={styles.statValue}>Level {mathProgress.level}</Text>
            <Text style={styles.statLabel}>Difficulty</Text>
          </View>
        </View>

        {/* Subject Progress */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Subject Progress</Text>
          <View style={styles.subjectCard}>
            <View style={styles.subjectHeader}>
              <View style={styles.subjectInfo}>
                <Ionicons name="calculator" size={24} color="#FF6B6B" />
                <Text style={styles.subjectName}>Math</Text>
              </View>
              <Text style={styles.subjectLevel}>Level {mathProgress.level}</Text>
            </View>
            <View style={styles.progressBar}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${(mathProgress.level / 3) * 100}%` },
                ]}
              />
            </View>
            <Text style={styles.progressText}>
              {mathProgress.questions_answered} questions answered
            </Text>
          </View>
        </View>

        {/* Recent Sessions */}
        {recent_sessions.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Recent Sessions</Text>
            {recent_sessions.slice(0, 5).map((session) => {
              const accuracy =
                session.questions_attempted > 0
                  ? Math.round(
                      (session.correct_answers / session.questions_attempted) *
                        100
                    )
                  : 0;

              return (
                <View key={session.session_id} style={styles.sessionCard}>
                  <View style={styles.sessionHeader}>
                    <Text style={styles.sessionSubject}>
                      {session.subject.charAt(0).toUpperCase() +
                        session.subject.slice(1)}
                    </Text>
                    <View style={styles.sessionStars}>
                      <Ionicons name="star" size={16} color="#FFD93D" />
                      <Text style={styles.sessionStarsText}>
                        {session.stars_earned}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.sessionStats}>
                    <Text style={styles.sessionStat}>
                      {session.questions_attempted} questions
                    </Text>
                    <Text style={styles.sessionDot}>•</Text>
                    <Text style={styles.sessionStat}>{accuracy}% correct</Text>
                  </View>
                  <Text style={styles.sessionDate}>
                    {new Date(session.start_time).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </Text>
                </View>
              );
            })}
          </View>
        )}

        {/* Insights */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Insights</Text>
          <View style={styles.insightCard}>
            {mathProgress.accuracy >= 80 ? (
              <>
                <Ionicons name="trophy" size={32} color="#6BCB77" />
                <Text style={styles.insightText}>
                  🎉 Excellent work! {child.name} is doing great with {mathProgress.accuracy}% accuracy!
                </Text>
              </>
            ) : mathProgress.accuracy >= 60 ? (
              <>
                <Ionicons name="thumbs-up" size={32} color="#4ECDC4" />
                <Text style={styles.insightText}>
                  😊 Good progress! Keep practicing to improve accuracy.
                </Text>
              </>
            ) : (
              <>
                <Ionicons name="bulb" size={32} color="#FFD93D" />
                <Text style={styles.insightText}>
                  💪 Keep going! Every question helps {child.name} learn and grow.
                </Text>
              </>
            )}
          </View>

          <View style={styles.insightCard}>
            <Ionicons name="time" size={32} color="#FF6B6B" />
            <Text style={styles.insightText}>
              {total_time_minutes >= 30
                ? `🔥 Amazing! ${child.name} spent ${Math.round(total_time_minutes)} minutes learning!`
                : `📚 ${child.name} has practiced for ${Math.round(total_time_minutes)} minutes so far. Great start!`}
            </Text>
          </View>
        </View>
      </ScrollView>

      <TouchableOpacity style={styles.continueButton} onPress={startNewSession}>
        <Text style={styles.continueButtonText}>Continue Learning</Text>
        <Ionicons name="arrow-forward" size={20} color="#fff" />
      </TouchableOpacity>
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
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  childCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  childAvatar: {
    fontSize: 64,
    marginBottom: 12,
  },
  childName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  childAge: {
    fontSize: 16,
    color: '#666',
    marginBottom: 16,
  },
  totalStars: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  totalStarsText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFD93D',
  },
  totalStarsLabel: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
  },
  statCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    flex: 1,
    minWidth: '47%',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  subjectCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  subjectHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  subjectInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  subjectName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  subjectLevel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6BCB77',
  },
  progressBar: {
    height: 8,
    backgroundColor: '#F5F5F5',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#6BCB77',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 12,
    color: '#666',
  },
  sessionCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  sessionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sessionSubject: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  sessionStars: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  sessionStarsText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFD93D',
  },
  sessionStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  sessionStat: {
    fontSize: 14,
    color: '#666',
  },
  sessionDot: {
    fontSize: 14,
    color: '#ccc',
  },
  sessionDate: {
    fontSize: 12,
    color: '#999',
  },
  insightCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  insightText: {
    fontSize: 14,
    color: '#666',
    flex: 1,
    lineHeight: 20,
  },
  continueButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FF6B6B',
    marginHorizontal: 16,
    marginBottom: 16,
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  continueButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
});