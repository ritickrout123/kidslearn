import React, { useEffect, useRef } from 'react';
import { View, ActivityIndicator, StyleSheet, Text } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useAuth } from './context/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function AuthCallback() {
  const { login } = useAuth();
  const params = useLocalSearchParams();
  const hasProcessed = useRef(false);

  useEffect(() => {
    if (hasProcessed.current) return;
    hasProcessed.current = true;

    const processAuth = async () => {
      try {
        // Extract session_id from URL fragment (web) or params (mobile)
        let sessionId = params.session_id as string;

        if (!sessionId && typeof window !== 'undefined') {
          const hash = window.location.hash;
          const match = hash.match(/session_id=([^&]+)/);
          if (match) {
            sessionId = match[1];
          }
        }

        if (!sessionId) {
          console.error('No session_id found');
          router.replace('/');
          return;
        }

        // Exchange session_id for user data
        const userData = await login(sessionId);
        
        console.log('Login successful:', userData);

        // Navigate to children screen
        router.replace('/children');
      } catch (error) {
        console.error('Auth callback error:', error);
        router.replace('/');
      }
    };

    processAuth();
  }, []);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#FF6B6B" />
      <Text style={styles.text}>Signing you in...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFF5E1',
  },
  text: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
});