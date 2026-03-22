import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Modal,
  ActivityIndicator,
  SafeAreaView,
} from 'react-native';
import { router } from 'expo-router';
import { useAuth } from './context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

const AVATARS = ['🦁', '🐯', '🐻', '🐼', '🐨', '🐸', '🦊', '🐰', '🐵', '🦄'];

const CARD_COLORS = ['#FF6B6B', '#4ECDC4', '#FFD93D', '#6BCB77', '#9B59B6', '#E67E22'];

interface Child {
  child_id: string;
  name: string;
  age: number;
  avatar: string;
  total_stars: number;
  streak?: {
    current: number;
    longest: number;
    last_date: string;
  };
  badges?: string[];
}

export default function ChildrenScreen() {
  const { user, logout } = useAuth();
  const [children, setChildren] = useState<Child[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [newChildName, setNewChildName] = useState('');
  const [newChildAge, setNewChildAge] = useState('7');
  const [selectedAvatar, setSelectedAvatar] = useState(AVATARS[0]);

  useEffect(() => {
    if (!user) {
      router.replace('/');
      return;
    }
    loadChildren();
  }, [user]);

  const loadChildren = async () => {
    try {
      const sessionToken = await AsyncStorage.getItem('session_token');
      const response = await axios.get(`${BACKEND_URL}/api/child/list`, {
        headers: { Authorization: `Bearer ${sessionToken}` },
      });
      setChildren(response.data);
    } catch (error) {
      console.error('Failed to load children:', error);
    } finally {
      setLoading(false);
    }
  };

  const createChild = async () => {
    if (!newChildName.trim()) return;

    try {
      const sessionToken = await AsyncStorage.getItem('session_token');
      await axios.post(
        `${BACKEND_URL}/api/child/create`,
        {
          name: newChildName.trim(),
          age: parseInt(newChildAge),
          avatar: selectedAvatar,
        },
        {
          headers: { Authorization: `Bearer ${sessionToken}` },
        }
      );

      setShowModal(false);
      setNewChildName('');
      setNewChildAge('7');
      setSelectedAvatar(AVATARS[0]);
      loadChildren();
    } catch (error) {
      console.error('Failed to create child:', error);
    }
  };

  const selectChild = async (childId: string) => {
    await AsyncStorage.setItem('current_child_id', childId);
    router.push('/subjects');
  };

  const goToDashboard = () => {
    router.push('/dashboard');
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
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.greeting}>Hello, {user?.name?.split(' ')[0]}! 👋</Text>
          <Text style={styles.subtitle}>Who's learning today?</Text>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity onPress={goToDashboard} style={styles.dashboardButton}>
            <Ionicons name="bar-chart" size={24} color="#FF6B6B" />
          </TouchableOpacity>
          <TouchableOpacity onPress={logout} style={styles.logoutButton}>
            <Ionicons name="log-out-outline" size={24} color="#666" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.content}>
        {children.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <Ionicons name="trophy" size={80} color="#FFD93D" />
            </View>
            <Text style={styles.emptyText}>No learners yet</Text>
            <Text style={styles.emptySubtext}>Start building your trophy room!</Text>
            <TouchableOpacity
              style={styles.emptyButton}
              onPress={() => setShowModal(true)}
            >
              <Ionicons name="add-circle" size={24} color="#fff" />
              <Text style={styles.emptyButtonText}>Add your first learner!</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.cardsContainer}>
            {children.map((child, index) => {
              const borderColor = CARD_COLORS[index % CARD_COLORS.length];
              const lastBadge = child.badges && child.badges.length > 0 
                ? child.badges[child.badges.length - 1] 
                : null;

              return (
                <TouchableOpacity
                  key={child.child_id}
                  style={[styles.trophyCard, { borderLeftColor: borderColor }]}
                  onPress={() => selectChild(child.child_id)}
                  activeOpacity={0.7}
                >
                  {/* Left: Avatar */}
                  <View style={styles.cardLeft}>
                    <Text style={styles.cardAvatar}>{child.avatar}</Text>
                  </View>

                  {/* Right: Info */}
                  <View style={styles.cardRight}>
                    <Text style={styles.cardName}>{child.name}</Text>
                    
                    <View style={styles.statsRow}>
                      {/* Streak */}
                      <View style={styles.statBadge}>
                        <Text style={styles.fireEmoji}>🔥</Text>
                        <Text style={styles.streakNumber}>
                          {child.streak?.current || 0}
                        </Text>
                        <Text style={styles.statLabel}>day streak</Text>
                      </View>

                      {/* Stars */}
                      <View style={styles.statBadge}>
                        <Ionicons name="star" size={20} color="#FFD93D" />
                        <Text style={styles.starsNumber}>{child.total_stars}</Text>
                        <Text style={styles.statLabel}>stars</Text>
                      </View>
                    </View>

                    {/* Last Badge */}
                    {lastBadge && (
                      <View style={styles.badgeContainer}>
                        <Ionicons name="ribbon" size={16} color="#9B59B6" />
                        <Text style={styles.badgeText}>Latest: {lastBadge}</Text>
                      </View>
                    )}

                    {/* Continue Journey Button */}
                    <TouchableOpacity
                      style={[styles.continueButton, { backgroundColor: borderColor }]}
                      onPress={() => selectChild(child.child_id)}
                    >
                      <Text style={styles.continueButtonText}>Continue Journey</Text>
                      <Ionicons name="arrow-forward" size={18} color="#fff" />
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Add Child Floating Button */}
      {children.length > 0 && (
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setShowModal(true)}
        >
          <Ionicons name="add" size={28} color="#fff" />
        </TouchableOpacity>
      )}

      {/* Add Child Modal */}
      <Modal
        visible={showModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add New Learner</Text>

            <Text style={styles.label}>Name</Text>
            <TextInput
              style={styles.input}
              value={newChildName}
              onChangeText={setNewChildName}
              placeholder="Enter child's name"
              placeholderTextColor="#999"
            />

            <Text style={styles.label}>Age</Text>
            <View style={styles.ageButtons}>
              {[4, 5, 6, 7, 8, 9, 10].map((age) => (
                <TouchableOpacity
                  key={age}
                  style={[
                    styles.ageButton,
                    newChildAge === age.toString() && styles.ageButtonActive,
                  ]}
                  onPress={() => setNewChildAge(age.toString())}
                >
                  <Text
                    style={[
                      styles.ageButtonText,
                      newChildAge === age.toString() && styles.ageButtonTextActive,
                    ]}
                  >
                    {age}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Choose Avatar</Text>
            <View style={styles.avatarGrid}>
              {AVATARS.map((avatar) => (
                <TouchableOpacity
                  key={avatar}
                  style={[
                    styles.avatarOption,
                    selectedAvatar === avatar && styles.avatarOptionActive,
                  ]}
                  onPress={() => setSelectedAvatar(avatar)}
                >
                  <Text style={styles.avatarEmoji}>{avatar}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setShowModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.createButton}
                onPress={createChild}
              >
                <Text style={styles.createButtonText}>Create</Text>
              </TouchableOpacity>
            </View>
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
    padding: 20,
    paddingTop: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  headerLeft: {
    flex: 1,
  },
  greeting: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#333',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginTop: 4,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  dashboardButton: {
    padding: 8,
    backgroundColor: '#FFF5E1',
    borderRadius: 8,
  },
  logoutButton: {
    padding: 8,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  emptyState: {
    alignItems: 'center',
    marginTop: 100,
    paddingHorizontal: 32,
  },
  emptyIcon: {
    marginBottom: 24,
  },
  emptyText: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 16,
    color: '#666',
    marginBottom: 32,
    textAlign: 'center',
  },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF6B6B',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    gap: 8,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  emptyButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  cardsContainer: {
    gap: 16,
  },
  trophyCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 16,
    borderLeftWidth: 6,
    padding: 20,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
  },
  cardLeft: {
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 20,
  },
  cardAvatar: {
    fontSize: 72,
  },
  cardRight: {
    flex: 1,
    justifyContent: 'space-between',
  },
  cardName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 12,
  },
  statBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F8F8',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    gap: 6,
  },
  fireEmoji: {
    fontSize: 18,
  },
  streakNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FF6B6B',
  },
  starsNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFD93D',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
  },
  badgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3E5F5',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 6,
    alignSelf: 'flex-start',
    marginBottom: 12,
  },
  badgeText: {
    fontSize: 13,
    color: '#9B59B6',
    fontWeight: '600',
  },
  continueButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    gap: 6,
  },
  continueButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  addButton: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    backgroundColor: '#FF6B6B',
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    width: '90%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 24,
    textAlign: 'center',
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    marginBottom: 20,
    color: '#333',
  },
  ageButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
  },
  ageButton: {
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    minWidth: 48,
    alignItems: 'center',
  },
  ageButtonActive: {
    backgroundColor: '#FF6B6B',
  },
  ageButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  ageButtonTextActive: {
    color: '#fff',
  },
  avatarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 24,
  },
  avatarOption: {
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    padding: 12,
    width: 60,
    height: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarOptionActive: {
    backgroundColor: '#FFD93D',
  },
  avatarEmoji: {
    fontSize: 32,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  createButton: {
    flex: 1,
    backgroundColor: '#FF6B6B',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  createButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});
