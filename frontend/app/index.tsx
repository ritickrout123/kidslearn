import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from './context/AuthContext';
import { Ionicons } from '@expo/vector-icons';

export default function LandingScreen() {
  const { user, loading } = useAuth();

  React.useEffect(() => {
    if (!loading && user) {
      router.replace('/children');
    }
  }, [loading, user]);

  const handleLogin = () => {
    // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
    if (typeof window !== 'undefined') {
      const redirectUrl = window.location.origin + '/auth-callback';
      window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
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
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.header}>
          <Ionicons name="school" size={80} color="#FF6B6B" />
          <Text style={styles.title}>KidLearn</Text>
          <Text style={styles.subtitle}>AI-Powered Learning for Kids</Text>
        </View>

        <View style={styles.features}>
          <View style={styles.feature}>
            <Ionicons name="sparkles" size={32} color="#4ECDC4" />
            <Text style={styles.featureText}>Adaptive Difficulty</Text>
          </View>
          <View style={styles.feature}>
            <Ionicons name="star" size={32} color="#FFD93D" />
            <Text style={styles.featureText}>Earn Rewards</Text>
          </View>
          <View style={styles.feature}>
            <Ionicons name="stats-chart" size={32} color="#6BCB77" />
            <Text style={styles.featureText}>Track Progress</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.loginButton} onPress={handleLogin}>
          <Ionicons name="logo-google" size={24} color="#fff" />
          <Text style={styles.loginButtonText}>Sign in with Google</Text>
        </TouchableOpacity>

        <Text style={styles.disclaimer}>For parents of kids aged 4-10</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF5E1',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 48,
  },
  title: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#FF6B6B',
    marginTop: 16,
  },
  subtitle: {
    fontSize: 18,
    color: '#666',
    marginTop: 8,
    textAlign: 'center',
  },
  features: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 24,
    marginBottom: 48,
  },
  feature: {
    alignItems: 'center',
    width: 120,
  },
  featureText: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
    textAlign: 'center',
  },
  loginButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF6B6B',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    gap: 12,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  loginButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  disclaimer: {
    fontSize: 12,
    color: '#999',
    marginTop: 24,
    textAlign: 'center',
  },
});