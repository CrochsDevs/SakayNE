import { Ionicons } from '@expo/vector-icons';
import { Text, View } from 'react-native';

import { useTheme } from '@/src/store/theme';

export default function BrandMark({ large = false }: { large?: boolean }) {
  const { colors, brand: Brand } = useTheme();
  return <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
    <View style={{ width: large ? 48 : 34, height: large ? 48 : 34, borderRadius: large ? 17 : 12, backgroundColor: Brand.teal, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-7deg' }] }}>
      <Ionicons name="navigate" size={large ? 27 : 19} color={Brand.sunshine} />
    </View>
    <Text style={{ color: colors.text, fontSize: large ? 30 : 22, fontWeight: '900', letterSpacing: -1 }}>Sakay<Text style={{ color: Brand.coral }}>.</Text></Text>
  </View>;
}
