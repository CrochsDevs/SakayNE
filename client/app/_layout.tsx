import '@/global.css';
import '@/src/i18n/config';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, Text } from 'react-native';
import Toast from 'react-native-toast-message';
import { ThemeProvider, useTheme } from '@/src/store/theme';
import { ErrorBoundary } from 'react-error-boundary';
import { Button } from '@/src/components/ui/Button';
import AuthGate from '@/src/auth/AuthGate';
import DriverPresence from '@/src/ride/DriverPresence';
import PassengerPresence from '@/src/ride/PassengerPresence';

function ErrorFallback({ error, resetErrorBoundary }: { error: Error; resetErrorBoundary: () => void }) {
  const { isDark } = useTheme();
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: isDark ? '#1A1A2E' : '#fff' }}>
      <Text style={{ fontSize: 16, color: '#EF4444', textAlign: 'center', marginBottom: 16 }}>
        Something went wrong
      </Text>
      <Text style={{ fontSize: 14, color: isDark ? 'rgba(255,255,255,0.5)' : '#8FA092', textAlign: 'center', marginBottom: 24 }}>
        {error?.message || 'Unknown error'}
      </Text>
      <Button title="Try again" onPress={resetErrorBoundary} />
    </View>
  );
}

function App() {
  const { isDark } = useTheme();
  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, animation: 'fade' }} />
      <AuthGate />
      <DriverPresence />
      <PassengerPresence />
      <Toast />
    </>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <ErrorBoundary FallbackComponent={ErrorFallback} onReset={() => {}}>
        <App />
      </ErrorBoundary>
    </ThemeProvider>
  );
}
