import { Stack } from 'expo-router';
import { AuthProvider } from './context/AuthContext';

export default function RootLayout() {
  return (
    <AuthProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="auth-callback" />
        <Stack.Screen name="children" />
        <Stack.Screen name="learn" />
        <Stack.Screen name="dashboard" />
      </Stack>
    </AuthProvider>
  );
}