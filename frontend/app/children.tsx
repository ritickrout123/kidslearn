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

interface Child {
  child_id: string;
  name: string;
  age: number;
  avatar: string;
  total_stars: number;
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
        <View>
          <Text style={styles.greeting}>Hello, {user?.name}! 👋</Text>
          <Text style={styles.subtitle}>Who's learning today?</Text>
        </View>
        <TouchableOpacity onPress={logout} style={styles.logoutButton}>
          <Ionicons name="log-out-outline" size={24} color="#FF6B6B" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        {children.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="people-outline" size={64} color="#ccc" />
            <Text style={styles.emptyText}>No child profiles yet</Text>
            <Text style={styles.emptySubtext}>Add your first child to get started!</Text>
          </View>
        ) : (
          <View style={styles.childrenGrid}>
            {children.map((child) => (
              <TouchableOpacity
                key={child.child_id}
                style={styles.childCard}
                onPress={() => selectChild(child.child_id)}
              >
                <Text style={styles.childAvatar}>{child.avatar}</Text>
                <Text style={styles.childName}>{child.name}</Text>
                <Text style={styles.childAge}>{child.age} years old</Text>
                <View style={styles.starsContainer}>
                  <Ionicons name="star" size={16} color="#FFD93D" />
                  <Text style={styles.starsText}>{child.total_stars}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>

      <TouchableOpacity
        style={styles.addButton}
        onPress={() => setShowModal(true)}
      >
        <Ionicons name="add" size={32} color="#fff" />
        <Text style={styles.addButtonText}>Add Child</Text>
      </TouchableOpacity>

      <Modal
        visible={showModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add New Child</Text>

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
    padding: 24,
    paddingTop: 16,
  },
  greeting: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginTop: 4,
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
    marginTop: 80,
  },
  emptyText: {
    fontSize: 18,
    color: '#666',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
  },
  childrenGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  childCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    width: '47%',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  childAvatar: {
    fontSize: 48,
    marginBottom: 8,
  },
  childName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  childAge: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  starsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  starsText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFD93D',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FF6B6B',
    marginHorizontal: 24,
    marginBottom: 24,
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
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