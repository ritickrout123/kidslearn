import { Stack } from 'expo-router';
import { AuthProvider } from './context/AuthContext';
import '../app/i18n'; // Initialize i18next

export default function RootLayout() {
  return (
    <AuthProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="auth-callback" />
        <Stack.Screen name="children" />
        <Stack.Screen name="subjects" />
        <Stack.Screen name="learn" />
        <Stack.Screen name="dashboard" />
      </Stack>
    </AuthProvider>
  );
}