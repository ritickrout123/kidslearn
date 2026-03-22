import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  SafeAreaView,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

const SUBJECTS = [
  {
    id: 'math',
    icon: 'calculator',
    color: '#FF6B6B',
    gradient: ['#FF6B6B', '#FF8E53'],
  },
  {
    id: 'phonics',
    icon: 'book',
    color: '#4ECDC4',
    gradient: ['#4ECDC4', '#44A08D'],
  },
  {
    id: 'gk',
    icon: 'earth',
    color: '#6BCB77',
    gradient: ['#6BCB77', '#4D96A9'],
  },
];

export default function SubjectsScreen() {
  const { t, i18n } = useTranslation();
  const [child, setChild] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadChild();
  }, []);

  const loadChild = async () => {
    try {
      const childId = await AsyncStorage.getItem('current_child_id');
      const sessionToken = await AsyncStorage.getItem('session_token');

      if (!childId) {
        router.replace('/children');
        return;
      }

      const response = await axios.get(`${BACKEND_URL}/api/child/${childId}`, {
        headers: { Authorization: `Bearer ${sessionToken}` },
      });

      setChild(response.data);
      // Set app language to child's preferred language
      i18n.changeLanguage(response.data.language || 'en');
    } catch (error) {
      console.error('Failed to load child:', error);
      router.replace('/children');
    } finally {
      setLoading(false);
    }
  };

  const selectSubject = async (subjectId: string) => {
    await AsyncStorage.setItem('current_subject', subjectId);
    router.push('/learn');
  };

  const goBack = () => {
    router.back();
  };

  const changeLanguage = async (lang: string) => {
    try {
      i18n.changeLanguage(lang);
      const childId = await AsyncStorage.getItem('current_child_id');
      const sessionToken = await AsyncStorage.getItem('session_token');

      // Update child's language in backend
      await axios.patch(
        `${BACKEND_URL}/api/child/${childId}`,
        { language: lang },
        { headers: { Authorization: `Bearer ${sessionToken}` } }
      );

      setChild({ ...child, language: lang });
    } catch (error) {
      console.error('Failed to change language:', error);
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
        <TouchableOpacity onPress={goBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.childName}>
            {child?.avatar} {child?.name}
          </Text>
          <View style={styles.streakContainer}>
            <Ionicons name="flame" size={16} color="#FF6B6B" />
            <Text style={styles.streakText}>
              {child?.streak?.current || 0} {t('dashboard.streak')}
            </Text>
          </View>
        </View>
        <View style={styles.placeholder} />
      </View>

      {/* Language Selector */}
      <View style={styles.languageSelector}>
        <Text style={styles.languageLabel}>{t('language')}:</Text>
        <View style={styles.languageButtons}>
          {['en', 'hi', 'pa'].map((lang) => (
            <TouchableOpacity
              key={lang}
              style={[
                styles.langButton,
                child?.language === lang && styles.langButtonActive,
              ]}
              onPress={() => changeLanguage(lang)}
            >
              <Text
                style={[
                  styles.langButtonText,
                  child?.language === lang && styles.langButtonTextActive,
                ]}
              >
                {lang === 'en' ? 'EN' : lang === 'hi' ? 'हि' : 'ਪੰ'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <ScrollView style={styles.content}>
        <Text style={styles.title}>{t('chooseSubject')}</Text>

        <View style={styles.subjectsContainer}>
          {SUBJECTS.map((subject) => {
            const progress = child?.subjects_progress?.[subject.id] || {};
            return (
              <TouchableOpacity
                key={subject.id}
                style={[styles.subjectCard, { borderColor: subject.color }]}
                onPress={() => selectSubject(subject.id)}
              >
                <View
                  style={[
                    styles.subjectIconContainer,
                    { backgroundColor: subject.color },
                  ]}
                >
                  <Ionicons name={subject.icon as any} size={48} color="#fff" />
                </View>

                <Text style={styles.subjectName}>{t(subject.id)}</Text>
                <Text style={styles.subjectDesc}>
                  {t(`${subject.id}Desc`)}
                </Text>

                <View style={styles.progressInfo}>
                  <View style={styles.levelBadge}>
                    <Text style={styles.levelText}>
                      {t('level')} {progress.level || 1}
                    </Text>
                  </View>
                  <View style={styles.accuracyBadge}>
                    <Ionicons name="checkmark-circle" size={16} color="#6BCB77" />
                    <Text style={styles.accuracyText}>
                      {progress.accuracy || 0}%
                    </Text>
                  </View>
                </View>

                <TouchableOpacity style={styles.startButton}>
                  <Text style={styles.startButtonText}>{t('startLearning')}</Text>
                  <Ionicons name="arrow-forward" size={20} color="#fff" />
                </TouchableOpacity>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
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
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  childName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  streakContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  streakText: {
    fontSize: 14,
    color: '#FF6B6B',
    fontWeight: '600',
  },
  placeholder: {
    width: 40,
  },
  languageSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    backgroundColor: '#fff',
    gap: 12,
  },
  languageLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  languageButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  langButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F5F5F5',
    borderWidth: 2,
    borderColor: '#E5E5E5',
  },
  langButtonActive: {
    backgroundColor: '#4ECDC4',
    borderColor: '#4ECDC4',
  },
  langButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  langButtonTextActive: {
    color: '#fff',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
    textAlign: 'center',
  },
  subjectsContainer: {
    gap: 16,
  },
  subjectCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    borderWidth: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  subjectIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginBottom: 16,
  },
  subjectName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 8,
  },
  subjectDesc: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 16,
  },
  progressInfo: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 16,
  },
  levelBadge: {
    backgroundColor: '#FFD93D',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  levelText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
  },
  accuracyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F8F7',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 4,
  },
  accuracyText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6BCB77',
  },
  startButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FF6B6B',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  startButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});