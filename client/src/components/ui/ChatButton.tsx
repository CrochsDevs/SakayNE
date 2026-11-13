import { useState, useEffect } from 'react';
import { TouchableOpacity, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { getActiveRide } from '@/src/ride/ride.store';
import { showError } from '@/src/utils/toast';

const HIDDEN_KEY = '@sakayne_chat_hidden';

export default function ChatButton() {
  const insets = useSafeAreaInsets();
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(HIDDEN_KEY).then((v) => setHidden(v === 'yes'));
  }, []);

  const toggle = () => {
    setHidden(!hidden);
    AsyncStorage.setItem(HIDDEN_KEY, hidden ? 'no' : 'yes');
  };

  if (hidden) {
    return (
      <TouchableOpacity onPress={toggle} activeOpacity={0.7}
        style={[styles.tabOnly, { bottom: 110 + insets.bottom }]}>
        <Ionicons name="chevron-back" size={20} color="#fff" />
      </TouchableOpacity>
    );
  }

  return (
    <View style={[styles.container, { bottom: 110 + insets.bottom }]}>
      <TouchableOpacity onPress={() => { void getActiveRide().then(ride => ride ? router.push({ pathname: '/ride-chat', params: { rideId: ride.id } }) : router.push('/help-center')).catch(e => showError(e.message)); }} activeOpacity={0.8} style={styles.fab}>
        <Ionicons name="chatbubble-ellipses" size={24} color="#fff" />
      </TouchableOpacity>
      <TouchableOpacity onPress={toggle} activeOpacity={0.7} style={styles.tab}>
        <Ionicons name="chevron-forward" size={18} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute', right: 0, zIndex: 999,
    flexDirection: 'row', alignItems: 'center',
  },
  fab: {
    width: 54, height: 54, borderRadius: 27,
    backgroundColor: '#3B82F6', justifyContent: 'center', alignItems: 'center',
    boxShadow: '0 4px 8px rgba(0,0,0,0.3)', elevation: 8,
    borderWidth: 2, borderColor: '#fff',
  },
  tab: {
    width: 24, height: 54,
    borderTopLeftRadius: 12, borderBottomLeftRadius: 12,
    backgroundColor: '#3B82F6', justifyContent: 'center', alignItems: 'center',
    boxShadow: '0 4px 8px rgba(0,0,0,0.3)', elevation: 8,
  },
  tabOnly: {
    position: 'absolute', right: 0, zIndex: 999,
    width: 36, height: 58,
    borderTopLeftRadius: 16, borderBottomLeftRadius: 16,
    backgroundColor: '#3B82F6', justifyContent: 'center', alignItems: 'center',
    boxShadow: '0 4px 10px rgba(0,0,0,0.35)', elevation: 10,
    borderWidth: 2, borderColor: '#fff',
    borderRightWidth: 0,
  },
});
