import { useInterfaceText } from '@/src/i18n/useInterfaceText';
import { type ComponentProps, type ReactNode, useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/src/store/theme';
import RouteMap from './RouteMap';
import MapLayersPicker from './MapLayersPicker';
import { resolveMapStyle, selectMapStyle, useMapStyle, type MapStyleChoice, type MapStyleStatus } from '@/src/store/map-style';

export default function ExpandableRouteMap({ showFullscreen = true, renderControls, ...props }: ComponentProps<typeof RouteMap> & { showFullscreen?: boolean; renderControls?: (layersButton: ReactNode) => ReactNode }) {
  const { colors, isDark } = useTheme();
  const translate = useInterfaceText();
  const [expanded, setExpanded] = useState(false);
  const choice = useMapStyle();
  const [layersOpen, setLayersOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [awaitingStyle, setAwaitingStyle] = useState(false);
  const [layerError, setLayerError] = useState('');
  const [styleState, setStyleState] = useState<MapStyleStatus | null>(null);
  const [styleRevision, setStyleRevision] = useState(0);
  const resolved = resolveMapStyle(choice, isDark);
  const handleStyleStatus = useCallback((status: MapStyleStatus) => {
    if (status.id !== resolved) return;
    setStyleState(status);
    if (status.status === 'ready' && awaitingStyle) { setLayerError(''); setLayersOpen(false); setAwaitingStyle(false); }
    if (status.status === 'error') { setLayerError('Could not load this map style. Choose another or tap it to retry.'); setAwaitingStyle(false); }
  }, [resolved, awaitingStyle]);
  const chooseStyle = async (style: MapStyleChoice) => {
    if (saving) return;
    setSaving(true); setLayerError('');
    try { await selectMapStyle(style); setAwaitingStyle(true); setStyleRevision(value => value + 1); }
    catch { setLayerError('Could not save your map choice. Please try again.'); }
    finally { setSaving(false); }
  };
  const styleBusy = saving || awaitingStyle || styleState?.id === resolved && styleState.status === 'loading';
  const layersButton = <TouchableOpacity accessibilityRole="button" accessibilityLabel={translate('Map layers')} accessibilityState={{ busy: styleBusy }} onPress={() => setLayersOpen(true)} style={[styles.layerButton, { backgroundColor: colors.surface, borderColor: colors.border }]}>{styleBusy ? <ActivityIndicator size="small" color={colors.primaryLight} /> : <Ionicons name="layers-outline" size={22} color={layerError ? colors.error : colors.text} />}</TouchableOpacity>;
  const picker = <MapLayersPicker visible={layersOpen} selected={choice} saving={styleBusy} error={layerError} onSelect={style => { void chooseStyle(style); }} onClose={() => setLayersOpen(false)} />;

  useEffect(() => {
    if (!expanded || Platform.OS !== 'web') return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setExpanded(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [expanded]);

  return <View style={styles.container}>
    {!expanded && <RouteMap {...props} mapStyle={choice} mapStyleRevision={styleRevision} onStyleStatus={handleStyleStatus} />}
    {!expanded && (renderControls ? renderControls(layersButton) : <View style={[styles.layerPosition, !showFullscreen && { top: 12 }]}>{layersButton}</View>)}
    {showFullscreen && <TouchableOpacity accessibilityRole="button" accessibilityLabel={translate("Open map in full screen")} accessibilityHint={translate("Expand the route map to fill the screen")} onPress={() => setExpanded(true)}
      style={[styles.expandButton, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Ionicons name="expand-outline" size={23} color={colors.text} />
    </TouchableOpacity>}
    <Modal visible={expanded} animationType="fade" presentationStyle="fullScreen" onRequestClose={() => setExpanded(false)}>
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { borderColor: colors.border }]}>
          <View style={styles.title}>
            <Ionicons name="map-outline" size={21} color={colors.primaryLight} />
            <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text }}>{translate("Route map")}</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>{layersButton}<TouchableOpacity accessibilityRole="button" accessibilityLabel={translate("Exit full screen map")} onPress={() => setExpanded(false)} style={[styles.closeButton, { backgroundColor: colors.backgroundAlt }]}>
            <Ionicons name="contract-outline" size={23} color={colors.text} />
          </TouchableOpacity></View>
        </View>
        <View style={styles.container}>{expanded && <RouteMap {...props} mapStyle={choice} mapStyleRevision={styleRevision} onStyleStatus={handleStyleStatus} />}</View>
        {expanded && picker}
      </SafeAreaView>
    </Modal>
    {!expanded && picker}
  </View>;
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  layerPosition: { position: 'absolute', top: 66, right: 12, zIndex: 2 },
  layerButton: { width: 44, height: 44, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 6px rgba(0,0,0,0.12)' },
  expandButton: { position: 'absolute', top: 12, right: 12, zIndex: 2, width: 44, height: 44, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 6px rgba(0,0,0,0.12)' },
  header: { minHeight: 66, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1 },
  title: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  closeButton: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
});
