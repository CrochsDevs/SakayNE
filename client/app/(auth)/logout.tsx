import { useEffect } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { logout } from '@/src/auth/auth.service';
import DotLoader from '@/src/components/ui/DotLoader';

export default function LogoutScreen() {
  useEffect(() => {
    const doLogout = async () => {
      try { await logout(); } finally { router.replace('/welcome'); }
    };
    void doLogout().catch(() => {});
  }, []);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center' }}>
      <DotLoader color="#3F8451" size={12} />
    </SafeAreaView>
  );
}
