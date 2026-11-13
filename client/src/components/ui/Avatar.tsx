import { View, Text, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/src/store/theme';

interface AvatarProps {
  name: string;
  size?: number;
  avatar?: string;
  onPress?: () => void;
  editable?: boolean;
}

export default function Avatar({ name, size = 48, avatar, onPress, editable }: AvatarProps) {
  const { colors: themeColors } = useTheme();
  const initial = name?.trim()?.charAt(0)?.toUpperCase() || '?';
  const colors = ['#087F8C', '#08707D', '#06626D', '#064851', '#38686C'];
  const colorIndex = name?.length ? name.charCodeAt(0) % colors.length : 0;

  const content = (
    <View style={{ width: size, height: size, position: 'relative' }}>
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
      </View>
      {editable && (
        <View style={{
          position: 'absolute', bottom: -2, right: -2,
          width: size * 0.36, height: size * 0.36, borderRadius: size * 0.18,
          backgroundColor: themeColors.surface, borderWidth: 2, borderColor: themeColors.card, justifyContent: 'center', alignItems: 'center',
          boxShadow: '0 2px 4px rgba(0,0,0,0.15)', elevation: 3,
        }}>
          <Ionicons name="camera" size={size * 0.18} color={themeColors.primaryLight} />
        </View>
      )}
    </View>
  );

  if (onPress) return <TouchableOpacity onPress={onPress}>{content}</TouchableOpacity>;
  return content;
}
