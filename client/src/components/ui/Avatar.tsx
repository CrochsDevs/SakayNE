import { View, Text, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface AvatarProps {
  name: string;
  size?: number;
  avatar?: string;
  onPress?: () => void;
  editable?: boolean;
}

export default function Avatar({ name, size = 48, avatar, onPress, editable }: AvatarProps) {
  const initial = name?.trim()?.charAt(0)?.toUpperCase() || '?';
  const colors = ['#3F8451', '#5AA06D', '#2E6B3F', '#1C4D2E', '#7BAE8A'];
  const colorIndex = name?.length ? name.charCodeAt(0) % colors.length : 0;

  const content = (
    <View style={{
      width: size, height: size, borderRadius: size / 2,
      backgroundColor: avatar ? 'transparent' : colors[colorIndex],
      justifyContent: 'center', alignItems: 'center',
      position: 'relative', overflow: 'hidden',
    }}>
      {avatar ? (
        <Image source={{ uri: avatar }} style={{ width: size, height: size, borderRadius: size / 2 }} resizeMode="cover" />
      ) : (
        <Text style={{ fontSize: size * 0.42, fontWeight: '700', color: '#fff' }}>{initial}</Text>
      )}
      {editable && (
        <View style={{
          position: 'absolute', bottom: -2, right: -2,
          width: size * 0.36, height: size * 0.36, borderRadius: size * 0.18,
          backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center',
          shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 4, elevation: 3,
        }}>
          <Ionicons name="camera" size={size * 0.18} color="#3F8451" />
        </View>
      )}
    </View>
  );

  if (onPress) return <TouchableOpacity onPress={onPress}>{content}</TouchableOpacity>;
  return content;
}
