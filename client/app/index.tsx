import { router } from 'expo-router';
import { useEffect } from 'react';
import { Image, Text, View } from 'react-native';
import { scale, verticalScale } from '@/src/utils/responsive';
import { getAuth } from '@/src/auth/auth.store';

export default function PreLoader() {
  useEffect(() => {
    let disposed = false;
    const timer = setTimeout(() => { void getAuth().then(({ user, token }) => {
      if (!disposed) router.replace(token && user ? user.role === 'driver' ? '/(driver)' : user.role === 'admin' ? '/admin' : '/(passenger)/home' : '/welcome');
    }); }, 800);
    return () => { disposed = true; clearTimeout(timer); };
  }, []);

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fff', paddingBottom: verticalScale(48) }}>
      <View />
      <View style={{ alignItems: 'center' }}>
        <Image source={require('../assets/logo/SakayNE.png')} style={{ width: scale(144), height: scale(144) }} resizeMode="contain" />
      </View>
      <View style={{ alignItems: 'center' }}>
        <Text style={{ fontSize: scale(12), color: '#9CA3AF' }}>powered by</Text>
        <Text style={{ fontSize: scale(14), fontWeight: '700', color: '#6B7280', marginTop: verticalScale(2), letterSpacing: 1 }}>Haraya IT Solution</Text>
      </View>
    </View>
  );
}
