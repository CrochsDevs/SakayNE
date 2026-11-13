import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/src/store/theme';
import { useInterfaceText } from '@/src/i18n/useInterfaceText';
import type { MapStyleChoice } from '@/src/store/map-style';

const options: { id: MapStyleChoice; label: string; description: string; background: string; road: string }[] = [
  { id: 'auto', label: 'Automatic', description: 'Match the app’s light or dark mode', background: '#D3E9D6', road: '#F7D477' },
  { id: 'light', label: 'Light', description: 'A clean, simple map', background: '#D3E9D6', road: '#F7D477' },
  { id: 'streets', label: 'Streets', description: 'Street names and landmarks', background: '#C3E0C9', road: '#F7D477' },
  { id: 'bright', label: 'Bright', description: 'More color and road detail', background: '#E5EED1', road: '#F5BD6A' },
  { id: 'dark', label: 'Dark', description: 'Charcoal map with clear labels', background: '#202321', road: '#C6A653' },
  { id: 'terrain', label: 'Terrain', description: 'Elevation and shaded hills', background: '#B9D6B5', road: '#F6D47E' },
  { id: '3d', label: '3D buildings', description: 'Tilted view with mapped building heights', background: '#DED9D0', road: '#F6D47E' },
];

export default function MapLayersPicker({ visible, selected, saving, error, onSelect, onClose }: {
  visible: boolean; selected: MapStyleChoice; saving: boolean; error: string;
  onSelect: (choice: MapStyleChoice) => void; onClose: () => void;
}) {
  const { colors, isDark } = useTheme();
  const translate = useInterfaceText();
  const { height } = useWindowDimensions();
  return <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
    <View style={styles.backdrop}><Pressable accessibilityLabel={translate('Close map layers')} onPress={onClose} style={StyleSheet.absoluteFill} />
      <SafeAreaView edges={['bottom']} style={[styles.sheet, { maxHeight: height * 0.86, backgroundColor: colors.card }]}>
        <View style={[styles.handle, { backgroundColor: colors.border }]} />
        <View style={styles.heading}><View style={[styles.headingIcon, { backgroundColor: colors.mintSurface }]}><Ionicons name="layers-outline" size={23} color={colors.primaryLight} /></View><View style={{ flex: 1 }}><Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>{translate('Map layers')}</Text><Text style={{ color: colors.textSecondary, fontSize: 12, lineHeight: 18, marginTop: 4 }}>{translate('Choose how your map looks')}</Text></View><TouchableOpacity accessibilityRole="button" accessibilityLabel={translate('Close map layers')} onPress={onClose} style={[styles.close, { backgroundColor: colors.backgroundAlt }]}><Ionicons name="close" size={22} color={colors.text} /></TouchableOpacity></View>
        {!!error && <View accessibilityRole="alert" style={[styles.error, { backgroundColor: colors.coralSurface }]}><Ionicons name="information-circle-outline" size={19} color={colors.error} /><Text style={{ flex: 1, color: colors.error, fontSize: 12, lineHeight: 19 }}>{translate(error)}</Text></View>}
        <ScrollView accessibilityRole="radiogroup" showsVerticalScrollIndicator={false} contentContainerStyle={styles.options}>
          {options.map(option => {
            const active = selected === option.id;
            const darkPreview = option.id === 'dark' || option.id === 'auto' && isDark;
            return <TouchableOpacity key={option.id} accessibilityRole="radio" accessibilityLabel={translate(option.label)} accessibilityState={{ checked: active, disabled: saving }} aria-checked={active} disabled={saving} onPress={() => onSelect(option.id)} style={[styles.option, { backgroundColor: active ? colors.mintSurface : colors.card, borderColor: active ? colors.borderFocused : colors.border }]}>
              <View style={[styles.preview, { backgroundColor: darkPreview ? '#202321' : option.background }]}><View style={[styles.street, { backgroundColor: darkPreview ? '#C6A653' : option.road }]} /><View style={[styles.crossStreet, { backgroundColor: darkPreview ? '#414642' : '#FFFFFF' }]} /><View style={[styles.previewPin, { backgroundColor: darkPreview ? '#67C6C2' : '#087F8C' }]} /></View>
              <View style={{ flex: 1, minWidth: 0 }}><Text style={{ color: colors.text, fontSize: 15, fontWeight: active ? '800' : '600' }}>{translate(option.label)}</Text><Text style={{ color: colors.textSecondary, fontSize: 11, lineHeight: 17, marginTop: 4 }}>{translate(option.description)}</Text></View>
              {saving && active ? <ActivityIndicator size="small" color={colors.primaryLight} /> : <Ionicons name={active ? 'checkmark-circle' : 'ellipse-outline'} size={22} color={active ? colors.primaryLight : colors.textTertiary} />}
            </TouchableOpacity>;
          })}
        </ScrollView>
        <Text style={{ color: colors.textSecondary, fontSize: 10, lineHeight: 16, textAlign: 'center' }}>{translate('Your map choice is saved for next time.')}</Text>
      </SafeAreaView>
    </View>
  </Modal>;
}
const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.38)' }, sheet: { width: '100%', maxWidth: 520, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, gap: 14 }, handle: { width: 36, height: 4, borderRadius: 2, alignSelf: 'center' }, heading: { flexDirection: 'row', gap: 11, alignItems: 'center' }, headingIcon: { width: 44, height: 44, borderRadius: 15, alignItems: 'center', justifyContent: 'center' }, title: { fontSize: 22, fontWeight: '800', letterSpacing: -0.4 }, close: { width: 44, height: 44, borderRadius: 15, alignItems: 'center', justifyContent: 'center' }, options: { gap: 10, paddingVertical: 2 }, option: { flexDirection: 'row', gap: 12, alignItems: 'center', padding: 12, minHeight: 78, borderRadius: 18, borderWidth: 1 }, preview: { width: 63, height: 49, borderRadius: 10, overflow: 'hidden' }, street: { position: 'absolute', left: -12, right: -12, top: 19, height: 7, transform: [{ rotate: '-28deg' }] }, crossStreet: { position: 'absolute', width: 6, height: 80, left: 34, top: -14, transform: [{ rotate: '-22deg' }] }, previewPin: { width: 10, height: 10, borderRadius: 5, borderWidth: 2, borderColor: '#FFFFFF', position: 'absolute', top: 19, left: 25 }, error: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', padding: 11, borderRadius: 13 },
});
