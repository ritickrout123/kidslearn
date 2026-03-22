import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;
const { width: SCREEN_WIDTH } = Dimensions.get('window');

const ZONES = {
  math: {
    id: 'math',
    title: 'Number Kingdom',
    subtitle: 'Conquer math challenges',
    bg: '#FF6B6B',
    emoji: '🚀',
    locked: false,
  },
  phonics: {
    id: 'phonics',
    title: 'Word Jungle',
    subtitle: 'Master letters and sounds',
    bg: '#4ECDC4',
    emoji: '🦜',
    locked: false,
  },
  gk: {
    id: 'gk',
    title: 'World Explorer',
    subtitle: 'Discover amazing facts',
    bg: '#6BCB77',
    emoji: '🌍',
    locked: false,
  },
};

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
      <LinearGradient colors={['#0F0C29', '#302B63']} style={styles.container}>
        <ActivityIndicator size="large" color="#fff" />
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={['#0F0C29', '#302B63', '#24243E']} style={styles.container}>
      {/* Language Selector Bar */}
      <View style={styles.languageBar}>
        <TouchableOpacity onPress={goBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>

        <View style={styles.languageButtons}>
          {['en', 'hi', 'pa'].map((lang) => (
            <TouchableOpacity
              key={lang}
              style={[
                styles.langPill,
                child?.language === lang && styles.langPillActive,
              ]}
              onPress={() => changeLanguage(lang)}
            >
              <Text
                style={[
                  styles.langPillText,
                  child?.language === lang && styles.langPillTextActive,
                ]}
              >
                {lang === 'en' ? 'EN' : lang === 'hi' ? 'हि' : 'ਪੰ'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Hero Header */}
      <View style={styles.hero}>
        <Text style={styles.heroAvatar}>{child?.avatar}</Text>
        <View style={styles.heroInfo}>
          <View style={styles.heroNameRow}>
            <Text style={styles.heroName}>{child?.name}</Text>
            {child?.streak?.current > 0 && (
              <View style={styles.streakBadge}>
                <Text style={styles.streakEmoji}>🔥</Text>
                <Text style={styles.streakNumber}>{child.streak.current}</Text>
              </View>
            )}
          </View>
          <Text style={styles.heroSubtitle}>Choose your adventure</Text>
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {Object.values(ZONES).map((zone, index) => {
          const progress = child?.subjects_progress?.[zone.id] || {};
          const rotation = index % 2 === 0 ? -1 : 1;

          return (
            <TouchableOpacity
              key={zone.id}
              style={[
                styles.zoneCard,
                { backgroundColor: zone.bg },
                { transform: [{ rotate: `${rotation}deg` }] },
              ]}
              onPress={() => selectSubject(zone.id)}
              activeOpacity={0.9}
            >
              <View style={styles.zoneLeft}>
                <Text style={styles.zoneEmoji}>{zone.emoji}</Text>
              </View>

              <View style={styles.zoneRight}>
                <Text style={styles.zoneTitle}>{zone.title}</Text>
                <Text style={styles.zoneSubtitle}>{zone.subtitle}</Text>

                <View style={styles.zoneBadges}>
                  <View style={styles.zoneBadge}>
                    <Text style={styles.zoneBadgeText}>
                      Level {progress.level || 1}
                    </Text>
                  </View>
                  <View style={styles.zoneBadge}>
                    <Ionicons name="checkmark-circle" size={14} color="#fff" />
                    <Text style={styles.zoneBadgeText}>
                      {progress.accuracy || 0}%
                    </Text>
                  </View>
                </View>

                <TouchableOpacity
                  style={styles.playButton}
                  onPress={() => selectSubject(zone.id)}
                >
                  <Text style={[styles.playButtonText, { color: zone.bg }]}>
                    PLAY
                  </Text>
                  <Ionicons name="arrow-forward" size={18} color={zone.bg} />
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Stars Display */}
      <View style={styles.footer}>
        <View style={styles.starsDisplay}>
          <Ionicons name="star" size={28} color="#FFD93D" />
          <Text style={styles.starsCount}>{child?.total_stars || 0}</Text>
          <Text style={styles.starsLabel}>Total Stars</Text>
        </View>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  languageBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 16,
  },
  backButton: {
    padding: 8,
  },
  languageButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  langPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  langPillActive: {
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderColor: '#fff',
  },
  langPillText: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.7)',
  },
  langPillTextActive: {
    color: '#fff',
  },
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  heroAvatar: {
    fontSize: 56,
    marginRight: 16,
  },
  heroInfo: {
    flex: 1,
  },
  heroNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 4,
  },
  heroName: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
  },
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,107,107,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,107,107,0.3)',
    gap: 4,
  },
  streakEmoji: {
    fontSize: 16,
  },
  streakNumber: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FF6B6B',
  },
  heroSubtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.7)',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  zoneCard: {
    flexDirection: 'row',
    borderRadius: 24,
    padding: 20,
    marginBottom: 20,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  zoneLeft: {
    justifyContent: 'center',
    marginRight: 16,
  },
  zoneEmoji: {
    fontSize: 64,
  },
  zoneRight: {
    flex: 1,
  },
  zoneTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  zoneSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 12,
  },
  zoneBadges: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  zoneBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    gap: 4,
  },
  zoneBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  playButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    paddingVertical: 10,
    borderRadius: 12,
    gap: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: 20,
  },
  playButtonText: {
    fontSize: 15,
    fontWeight: 'bold',
  },
  footer: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  starsDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  starsCount: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  starsLabel: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
  },
});
