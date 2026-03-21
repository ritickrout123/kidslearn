import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

interface User {
  user_id: string;
  email: string;
  name: string;
  picture?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (sessionId: string) => Promise<User>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const checkAuth = useCallback(async () => {
    try {
      const sessionToken = await AsyncStorage.getItem('session_token');
      if (!sessionToken) {
        setLoading(false);
        return;
      }

      const response = await axios.get(`${BACKEND_URL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${sessionToken}` }
      });

      setUser(response.data);
    } catch (error) {
      console.error('Auth check failed:', error);
      await AsyncStorage.removeItem('session_token');
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const login = async (sessionId: string): Promise<User> => {
    try {
      const response = await axios.post(`${BACKEND_URL}/api/auth/session`, {
        session_id: sessionId
      });

      const userData = response.data;
      
      // Store session token from response headers or data
      if (response.headers['set-cookie']) {
        // Extract session token from cookie
        const cookieStr = response.headers['set-cookie'][0];
        const tokenMatch = cookieStr.match(/session_token=([^;]+)/);
        if (tokenMatch) {
          await AsyncStorage.setItem('session_token', tokenMatch[1]);
        }
      }

      setUser(userData);
      return userData;
    } catch (error) {
      console.error('Login failed:', error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      const sessionToken = await AsyncStorage.getItem('session_token');
      if (sessionToken) {
        await axios.post(`${BACKEND_URL}/api/auth/logout`, {}, {
          headers: { Authorization: `Bearer ${sessionToken}` }
        });
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      await AsyncStorage.removeItem('session_token');
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, checkAuth }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}