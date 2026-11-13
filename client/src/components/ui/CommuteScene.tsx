import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { type BrandPalette } from '@/src/constants/Colors';
import { useTheme } from '@/src/store/theme';

// Native shapes keep the illustration crisp without a remote image dependency.
export default function CommuteScene({ compact = false }: { compact?: boolean }) {
  const { brand: Brand, isDark } = useTheme();
  const styles = createStyles(Brand, isDark);
  return <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[[styles.scene, compact && { height: 105 }], { pointerEvents: 'none' }]}>
    <View style={styles.sun} />
    <View style={[styles.cloud, { top: 19, left: 22 }]} />
    <View style={[styles.cloud, { top: 39, right: 13, width: 32 }]} />
    <View style={styles.skyline}>
      {[46, 65, 36, 53, 78, 44].map((height, index) => <View key={index} style={{ width: 22 + index % 2 * 8, height, borderTopLeftRadius: 5, borderTopRightRadius: 5, backgroundColor: isDark ? (index % 2 ? '#416E50' : '#658452') : index % 2 ? '#9FD4C0' : '#C5E5CF', alignItems: 'center', paddingTop: 9, gap: 6 }}>
        <View style={styles.window} /><View style={styles.window} />
      </View>)}
    </View>
    <View style={styles.road}><View style={styles.lane} /></View>
    <View style={styles.bus}>
      <View style={styles.busStripe}><Text style={styles.busLabel}>SAKAY</Text></View>
      <View style={styles.busWindows}>{[0, 1, 2].map(i => <View key={i} style={styles.busWindow} />)}</View>
      <View style={styles.busBumper}><View style={styles.headlight} /><View style={styles.grille} /><View style={styles.headlight} /></View>
      <View style={[styles.wheel, { left: 11 }]} /><View style={[styles.wheel, { right: 11 }]} />
    </View>
    <View style={styles.pin}><Ionicons name="location" size={26} color={Brand.coral} /></View>
  </View>;
}

const createStyles = (Brand: BrandPalette, isDark: boolean) => StyleSheet.create({
  scene: { width: '100%', height: 130, overflow: 'hidden' },
  sun: { position: 'absolute', width: 48, height: 48, borderRadius: 24, backgroundColor: isDark ? '#80631C' : '#FFE6A0', right: 32, top: 0 },
  cloud: { position: 'absolute', width: 44, height: 10, borderRadius: 8, backgroundColor: isDark ? '#BAA875' : '#FFFAE9' },
  skyline: { position: 'absolute', bottom: 22, left: 2, right: 2, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  window: { width: 7, height: 6, borderRadius: 1, backgroundColor: isDark ? '#B8CD9F' : '#EAF7DF' },
  road: { position: 'absolute', bottom: 10, left: 0, right: 0, height: 20, backgroundColor: isDark ? '#997512' : '#E5B951', borderRadius: 10 },
  lane: { height: 2, backgroundColor: isDark ? '#D6B950' : '#FFF4CD', width: '90%', position: 'absolute', left: '5%', top: 9 },
  bus: { position: 'absolute', bottom: 23, left: '28%', width: 94, height: 74, borderRadius: 13, backgroundColor: Brand.teal, borderWidth: 3, borderColor: Brand.deepTeal, transform: [{ rotate: '-5deg' }] },
  busStripe: { backgroundColor: Brand.sunshine, borderTopLeftRadius: 8, borderTopRightRadius: 8, alignItems: 'center', paddingVertical: 3 },
  busLabel: { fontSize: 7, fontWeight: '900', color: Brand.ink, letterSpacing: 1.5 },
  busWindows: { flexDirection: 'row', paddingHorizontal: 6, gap: 4, marginTop: 5 },
  busWindow: { flex: 1, height: 23, backgroundColor: isDark ? '#ADDDCC' : '#D2F1E6', borderRadius: 3 },
  busBumper: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 7 },
  headlight: { width: 9, height: 6, borderRadius: 3, backgroundColor: Brand.sunshine },
  grille: { width: 24, height: 4, backgroundColor: Brand.deepTeal, borderRadius: 2 },
  wheel: { position: 'absolute', bottom: -9, width: 13, height: 12, borderRadius: 4, backgroundColor: Brand.ink },
  pin: { position: 'absolute', right: 5, bottom: 40, transform: [{ rotate: '10deg' }] },
});
