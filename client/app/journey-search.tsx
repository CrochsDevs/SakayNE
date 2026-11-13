import { useInterfaceText } from '@/src/i18n/useInterfaceText';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Image, KeyboardAvoidingView, Linking, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Action, Card, Label, Loading } from '@/src/components/ui/Screen';
import { TOWNS, SakayDriver } from '@/src/data/sakay';
import { apiRequest } from '@/src/config/api';
import { useTheme } from '@/src/store/theme';
import { usePolling } from '@/src/ride/usePolling';
import TravelTimeEstimate from '@/src/components/TravelTimeEstimate';
import { searchPlaces, type MapPlace } from '@/src/ride/maps.service';

interface Journey {
  routeId: string; label: string; type: 'bus' | 'jeep'; fromId: string; toId: string;
  fromName: string; toName: string; seats: number; minutes: number; fare: number; drivers: SakayDriver[];
}
interface Search { fromId: string; toId: string; seats: number; type: string }

function Results({ search }: { search: Search }) {
  const { colors } = useTheme();
  const translate = useInterfaceText();
  const query = new URLSearchParams({ fromId: search.fromId, toId: search.toId, seats: String(search.seats), ...(search.type ? { type: search.type } : {}) });
  const result = usePolling(async () => apiRequest<{ journeys: Journey[]; checkedAt: string }>('/drivers/journeys?' + query.toString()), { journeys: [], checkedAt: '' });
  return <View style={styles.results}>
    <Text style={[styles.sectionTitle, { color: colors.text }]}>{translate("Your ride options")}</Text>
    {result.loading && <Loading />}
    {!!result.error && <Card><Label>{translate("Cannot refresh availability. Reconnect before choosing a vehicle.")}</Label><Action title={translate("Retry search")} onPress={result.refresh} /></Card>}
    {!result.loading && !result.error && !result.data.journeys.length && <Card><View style={[styles.resultIcon, { backgroundColor: colors.accentSurface }]}><Ionicons name="map-outline" size={28} color={colors.onAccent} /></View><Label strong>{translate("No direct route found")}</Label><Label>{translate("Try another pickup or destination. Only direct trips are available for now.")}</Label></Card>}
    {result.data.journeys.map(journey => <Card key={journey.routeId}>
      <Label strong>{journey.fromName} → {journey.toName}</Label>
      <Label>{journey.label} · {journey.type === 'bus' ? 'Bus' : 'Jeepney'}</Label>
      <Label strong>{translate('{{count}} seat(s)', { count: journey.seats })}</Label>
      <TravelTimeEstimate minutes={journey.minutes} />
      {!journey.drivers.length && <Label>{translate("This route serves your trip, but no online vehicle has enough seats right now.")}</Label>}
      {journey.drivers.map(driver => <View key={driver.id} style={{ gap: 8, marginTop: 8 }}>
        <Label strong>{driver.name} · {driver.vehicle}</Label>
        <Label>{translate("{{count}} seats available · Rating: {{rating}}", { count: driver.seats, rating: driver.rating })}</Label>
        <Action title={translate("Review trip with {{name}}", { name: driver.name })} disabled={!!result.error || result.loading} onPress={() => router.push({ pathname: '/route-map', params: { routeId: journey.routeId, driverId: driver.id, fromId: journey.fromId, toId: journey.toId, seats: String(search.seats) } })} />
      </View>)}
    </Card>)}
    {!!result.data.checkedAt && <Label>{translate("Availability refreshes every five seconds. Seats are held only after the server accepts your booking.")}</Label>}
  </View>;
}

function StopPicker({ selecting, selectedId, excludeId, onSelect, onClose }: {
  selecting: 'from' | 'to'; selectedId: string; excludeId: string; onSelect: (id: string) => void; onClose: () => void;
}) {
  const { colors } = useTheme();
  const translate = useInterfaceText();
  const { height } = useWindowDimensions();
  const [query, setQuery] = useState('');
  const [placeResult, setPlaceResult] = useState<{ query: string; places: MapPlace[]; failed?: boolean } | null>(null);
  const placeQuery = query.trim();
  useEffect(() => {
    if (placeQuery.length < 3) return;
    let current = true;
    const timer = setTimeout(() => {
      searchPlaces(placeQuery).then(places => { if (current) setPlaceResult({ query: placeQuery, places }); }).catch(() => { if (current) setPlaceResult({ query: placeQuery, places: [], failed: true }); });
    }, 450);
    return () => { current = false; clearTimeout(timer); };
  }, [placeQuery]);
  const places = placeResult?.query === placeQuery ? placeResult.places.filter(place => place.stopId && place.stopId !== excludeId) : [];
  const towns = TOWNS.filter(town => town.id !== excludeId && town.name.toLowerCase().includes(query.trim().toLowerCase()));
  return <Modal transparent animationType="slide" onRequestClose={onClose}>
    <View style={styles.modalBackdrop}>
      <Pressable accessibilityLabel={translate("Dismiss stop selection")} onPress={onClose} style={StyleSheet.absoluteFill} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.pickerKeyboard}>
        <SafeAreaView edges={['bottom']} style={[styles.picker, { backgroundColor: colors.card }]}>
          <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />
          <View style={styles.pickerHeading}>
            <View style={{ flex: 1 }}><Text style={[styles.sectionTitle, { color: colors.text }]}>{selecting === 'from' ? translate("Where do we pick you up?") : translate("Where are you headed?")}</Text><Text style={[styles.caption, { color: colors.textSecondary, marginTop: 5 }]}>{translate("Choose a town or stop for your trip.")}</Text></View>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel={translate("Close stop selection")} onPress={onClose} style={[styles.smallButton, { backgroundColor: colors.backgroundAlt }]}><Ionicons name="close" size={22} color={colors.text} /></TouchableOpacity>
          </View>
          <View style={[styles.pickerSearch, { backgroundColor: colors.backgroundAlt, borderColor: colors.border }]}>
            <Ionicons name="search-outline" size={20} color={colors.textSecondary} />
            <TextInput accessibilityLabel={translate("Search stops")} autoFocus value={query} onChangeText={setQuery} placeholder={translate("Search town or stop")} placeholderTextColor={colors.textTertiary} style={[styles.searchInput, { color: colors.text }]} />
            {!!query && <TouchableOpacity accessibilityRole="button" accessibilityLabel={translate("Clear stop search")} onPress={() => setQuery('')} style={styles.clearSearch}><Ionicons name="close-circle" size={19} color={colors.textSecondary} /></TouchableOpacity>}
          </View>
          <FlatList data={towns} keyExtractor={town => town.id} keyboardShouldPersistTaps="handled" style={{ maxHeight: Math.min(420, height * 0.48) }} showsVerticalScrollIndicator={false}
            ListFooterComponent={placeQuery.length >= 3 ? <View style={{ gap: 9, marginTop: 12, paddingBottom: 8 }}>
              {placeResult?.query !== placeQuery ? <ActivityIndicator color={colors.primaryLight} /> : placeResult.failed ? <Text style={{ color: colors.textSecondary, fontSize: 12, lineHeight: 19 }}>{translate('Place search is unavailable. You can still choose a listed stop.')}</Text> : places.length > 0 ? <><Text style={{ color: colors.text, fontSize: 13, fontWeight: '700' }}>{translate('Nearby place matches')}</Text><Text style={{ color: colors.textSecondary, fontSize: 11, lineHeight: 17 }}>{translate('Select the supported stop shown below.')}</Text>{places.map(place => <TouchableOpacity key={place.id} accessibilityRole="button" accessibilityLabel={translate('Select {{name}} stop', { name: place.stopName || '' })} onPress={() => onSelect(place.stopId!)} style={[styles.stopOption, { borderColor: colors.borderLight }]}><Ionicons name="search-outline" size={20} color={colors.primaryLight} /><View style={{ flex: 1, minWidth: 0, marginLeft: 10 }}><Text style={{ color: colors.text, fontSize: 14, fontWeight: '600' }}>{place.stopName}</Text><Text numberOfLines={2} style={{ color: colors.textSecondary, fontSize: 11, lineHeight: 17, marginTop: 4 }}>{place.label}</Text></View><Ionicons name="chevron-forward" size={17} color={colors.textSecondary} /></TouchableOpacity>)}</> : null}
              <TouchableOpacity accessibilityRole="link" accessibilityLabel={translate('Place search attribution')} onPress={() => { void Linking.openURL('https://photon.komoot.io/'); }} style={{ minHeight: 44, justifyContent: 'center' }}><Text style={{ color: colors.textTertiary, fontSize: 10 }}>Photon · © OpenStreetMap</Text></TouchableOpacity>
            </View> : null}
            ListEmptyComponent={placeQuery.length >= 3 && (placeResult?.query !== placeQuery || places.length > 0) ? null : <View style={styles.noStops}><Ionicons name="search-outline" size={28} color={colors.textTertiary} /><Text style={{ color: colors.text, fontSize: 16, fontWeight: '700' }}>{translate("No matching stops")}</Text><Text style={{ color: colors.textSecondary, fontSize: 13 }}>{translate("Try another town or stop name.")}</Text></View>}
            renderItem={({ item }) => <TouchableOpacity accessibilityRole="button" accessibilityLabel={item.name} accessibilityState={{ selected: selectedId === item.id }} onPress={() => onSelect(item.id)} style={[styles.stopOption, { borderColor: colors.borderLight }]}>
              <View style={[styles.stopOptionIcon, { backgroundColor: colors.mintSurface }]}><Ionicons name="location-outline" size={19} color={colors.primaryLight} /></View>
              <View style={{ flex: 1 }}><Text style={{ color: colors.text, fontSize: 15, fontWeight: '600' }}>{item.name}</Text><Text style={{ color: colors.textTertiary, fontSize: 12, marginTop: 4 }}>{item.outside ? translate("Outside Nueva Ecija") : 'Nueva Ecija'}</Text></View>
              <Ionicons name={selectedId === item.id ? 'checkmark-circle' : 'chevron-forward'} size={19} color={selectedId === item.id ? colors.primaryLight : colors.textTertiary} />
            </TouchableOpacity>} />
        </SafeAreaView>
      </KeyboardAvoidingView>
    </View>
  </Modal>;
}

export default function JourneySearch() {
  const { colors, brand } = useTheme();
  const translate = useInterfaceText();
  const [fromId, setFromId] = useState('');
  const [toId, setToId] = useState('');
  const [selecting, setSelecting] = useState<'from' | 'to' | null>(null);
  const [seats, setSeats] = useState(1);
  const [type, setType] = useState('');
  const [search, setSearch] = useState<Search | null>(null);
  const edit = () => setSearch(null);
  const fromName = TOWNS.find(t => t.id === fromId)?.name;
  const toName = TOWNS.find(t => t.id === toId)?.name;
  const canSearch = !!fromId && !!toId && fromId !== toId && !selecting;

  return <SafeAreaView edges={['top', 'left', 'right']} style={[styles.screen, { backgroundColor: colors.background }]}>
    <View style={[styles.navigation, { borderColor: colors.borderLight }]}>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel={translate("Go back")} onPress={() => router.back()} style={[styles.smallButton, { borderColor: colors.border, borderWidth: 1, backgroundColor: colors.card }]}><Ionicons name="arrow-back" size={21} color={colors.text} /></TouchableOpacity>
      <Text style={{ color: colors.text, fontSize: 16, fontWeight: '700' }}>{translate("Plan your trip")}</Text>
      <View style={[styles.navIcon, { backgroundColor: colors.accentSurface }]}><Ionicons name="map-outline" size={20} color={colors.onAccent} /></View>
    </View>
    <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
      <View style={styles.intro}>
        <View style={styles.introEyebrow}><View style={[styles.eyebrowLine, { backgroundColor: brand.sunshine }]} /><Text style={{ color: colors.primaryLight, fontSize: 10, letterSpacing: 1.5, fontWeight: '800' }}>{translate("LET’S GET YOU THERE")}</Text></View>
        <Text style={[styles.title, { color: colors.text }]}>{translate("Where are you going?")}</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{translate("A jeepney or bus, just a few taps away.")}</Text>
      </View>

      <View style={[styles.routeCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.routeHeading}><Text style={[styles.overline, { color: colors.textSecondary }]}>{translate("YOUR ROUTE")}</Text>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel={translate("Swap pickup and destination")} accessibilityState={{ disabled: !fromId || !toId }} disabled={!fromId || !toId} onPress={() => { setFromId(toId); setToId(fromId); edit(); }} style={[styles.swapButton, { backgroundColor: colors.mintSurface, opacity: fromId && toId ? 1 : 0.4 }]}><Ionicons name="swap-vertical" size={19} color={colors.primaryLight} /></TouchableOpacity>
        </View>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel={translate("Pickup: ") + (fromName || translate("Choose a stop"))} onPress={() => { setSelecting('from'); edit(); }} style={styles.routeField}>
          <View style={[styles.routeIcon, { backgroundColor: colors.mintSurface }]}><Ionicons name="navigate" size={19} color={colors.primaryLight} /></View>
          <View style={styles.fieldText}><Text style={[styles.fieldLabel, { color: colors.textTertiary }]}>{translate("PICKUP")}</Text><Text numberOfLines={2} style={[styles.fieldValue, { color: fromName ? colors.text : colors.textSecondary }]}>{fromName || translate("Choose your starting point")}</Text></View>
          <Ionicons name="chevron-forward" size={17} color={colors.textTertiary} />
        </TouchableOpacity>
        <View style={styles.routeDivider}><View style={[styles.routeConnector, { borderColor: colors.border }]} /><View style={[styles.divider, { backgroundColor: colors.borderLight }]} /></View>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel={translate("Destination: ") + (toName || translate("Choose a stop"))} onPress={() => { setSelecting('to'); edit(); }} style={styles.routeField}>
          <View style={[styles.routeIcon, { backgroundColor: colors.coralSurface }]}><Ionicons name="location" size={20} color={colors.accent} /></View>
          <View style={styles.fieldText}><Text style={[styles.fieldLabel, { color: colors.textTertiary }]}>{translate("DESTINATION")}</Text><Text numberOfLines={2} style={[styles.fieldValue, { color: toName ? colors.text : colors.textSecondary }]}>{toName || translate("Where do you want to go?")}</Text></View>
          <Ionicons name="chevron-forward" size={17} color={colors.textTertiary} />
        </TouchableOpacity>
      </View>

      <View style={[styles.passengerCard, { backgroundColor: colors.backgroundAlt, borderColor: colors.borderLight }]}>
        <View style={[styles.passengerIcon, { backgroundColor: colors.mintSurface }]}><Ionicons name="people-outline" size={22} color={colors.primaryLight} /></View>
        <View style={{ flex: 1, minWidth: 0 }}><Text style={{ color: colors.text, fontSize: 15, fontWeight: '700' }}>{translate("Passengers")}</Text><Text style={[styles.caption, { color: colors.textSecondary, marginTop: 4 }]}>{translate("Including you")}</Text></View>
        <View style={[styles.stepper, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel={translate("Remove seat")} accessibilityState={{ disabled: seats <= 1 }} disabled={seats <= 1} onPress={() => { setSeats(seats - 1); edit(); }} style={[styles.stepperButton, { opacity: seats <= 1 ? 0.3 : 1 }]}><Ionicons name="remove" size={20} color={colors.text} /></TouchableOpacity>
          <Text accessibilityLabel={translate("{{count}} passenger seats", { count: seats })} accessibilityLiveRegion="polite" style={{ color: colors.text, fontSize: 18, fontWeight: '800', minWidth: 20, textAlign: 'center' }}>{seats}</Text>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel={translate("Add seat")} accessibilityState={{ disabled: seats >= 10 }} disabled={seats >= 10} onPress={() => { setSeats(seats + 1); edit(); }} style={[styles.stepperButton, { opacity: seats >= 10 ? 0.3 : 1 }]}><Ionicons name="add" size={20} color={colors.primaryLight} /></TouchableOpacity>
        </View>
      </View>

      <View style={{ gap: 13 }}>
        <View style={styles.vehicleHeading}><Text style={[styles.sectionTitle, { color: colors.text }]}>{translate("Choose your ride")}</Text><Text style={[styles.caption, { color: colors.textSecondary }]}>{translate("Your trip, your way")}</Text></View>
        <View style={styles.vehicleRow}>
          {[['', translate("All rides")], ['jeep', 'Jeepney'], ['bus', 'Bus']].map(([value, label]) => {
            const active = type === value;
            const color = active ? '#FFFFFF' : colors.primaryLight;
            return <TouchableOpacity key={value} accessibilityRole="button" accessibilityLabel={value ? label : translate("All vehicles")} accessibilityState={{ selected: active }} onPress={() => { setType(value); edit(); }} style={[styles.vehicleChoice, { backgroundColor: active ? colors.primary : colors.card, borderColor: active ? colors.primary : colors.border }]}>
              {value === 'jeep' ? <Image source={require('../assets/icon/jeepney.png')} resizeMode="contain" tintColor={color} style={{ width: 42, height: 38 }} /> : <View style={styles.vehicleIcon}><Ionicons name={value === 'bus' ? 'bus-outline' : 'grid-outline'} size={28} color={color} /></View>}
              <Text style={{ color: active ? '#FFFFFF' : colors.text, fontSize: 13, fontWeight: '700' }}>{label}</Text>
              {active && <View style={styles.selectedVehicle}><Ionicons name="checkmark-circle" size={14} color={brand.sunshine} /></View>}
            </TouchableOpacity>;
          })}
        </View>
      </View>
      {search && <Results key={JSON.stringify(search)} search={search} />}
    </ScrollView>
    <SafeAreaView edges={['bottom']} style={[styles.footer, { backgroundColor: colors.background, borderColor: colors.borderLight }]}>
      <View style={styles.footerContent}>
        {!canSearch && <Text style={[styles.footerHint, { color: colors.textSecondary }]}>{translate("Choose your pickup and destination to continue.")}</Text>}
        <TouchableOpacity accessibilityRole="button" accessibilityLabel={translate("Find transportation")} accessibilityState={{ disabled: !canSearch }} disabled={!canSearch} onPress={() => setSearch({ fromId, toId, seats, type })} style={[styles.searchButton, { backgroundColor: canSearch ? colors.primary : colors.mintSurface }]}>
          <Ionicons name="search-outline" size={21} color={canSearch ? '#FFFFFF' : colors.textTertiary} /><Text style={{ color: canSearch ? '#FFFFFF' : colors.textTertiary, fontSize: 16, fontWeight: '700' }}>{translate("Find transportation")}</Text><Ionicons name="arrow-forward" size={19} color={canSearch ? brand.sunshine : colors.textTertiary} />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
    {selecting && <StopPicker key={selecting} selecting={selecting} selectedId={selecting === 'from' ? fromId : toId} excludeId={selecting === 'from' ? toId : fromId} onClose={() => setSelecting(null)} onSelect={id => { if (selecting === 'from') setFromId(id); else setToId(id); setSelecting(null); edit(); }} />}
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  navigation: { minHeight: 68, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: 1 },
  smallButton: { width: 44, height: 44, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  navIcon: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  content: { width: '100%', maxWidth: 600, alignSelf: 'center', padding: 20, paddingBottom: 28, gap: 22 },
  intro: { gap: 9, paddingTop: 2 },
  introEyebrow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  eyebrowLine: { width: 18, height: 4, borderRadius: 2 },
  title: { fontSize: 29, lineHeight: 35, fontWeight: '900', letterSpacing: -1 },
  subtitle: { fontSize: 13, lineHeight: 21 },
  sectionTitle: { fontSize: 18, fontWeight: '800', letterSpacing: -0.4 },
  caption: { fontSize: 12, lineHeight: 18 },
  routeCard: { padding: 17, borderWidth: 1, borderRadius: 24 },
  routeHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  overline: { fontSize: 10, fontWeight: '700', letterSpacing: 1.4 },
  swapButton: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  routeField: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, minHeight: 68 },
  routeIcon: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  fieldText: { flex: 1, minWidth: 0, gap: 5 },
  fieldLabel: { fontSize: 9, fontWeight: '700', letterSpacing: 1.2 },
  fieldValue: { fontSize: 14, lineHeight: 20, fontWeight: '600' },
  routeDivider: { height: 12, flexDirection: 'row', alignItems: 'center', gap: 32, paddingLeft: 19 },
  routeConnector: { height: 18, borderLeftWidth: 1.5, borderStyle: 'dashed' },
  divider: { height: 1, flex: 1 },
  passengerCard: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 10, borderWidth: 1, borderRadius: 20, padding: 14 },
  passengerIcon: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  stepper: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 14 },
  stepperButton: { width: 40, height: 44, alignItems: 'center', justifyContent: 'center' },
  vehicleHeading: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 5 },
  vehicleRow: { flexDirection: 'row', gap: 10 },
  vehicleChoice: { flex: 1, minHeight: 105, paddingVertical: 15, paddingHorizontal: 6, borderWidth: 1.5, borderRadius: 20, alignItems: 'center', justifyContent: 'center', gap: 9 },
  vehicleIcon: { width: 42, height: 38, alignItems: 'center', justifyContent: 'center' },
  selectedVehicle: { position: 'absolute', top: 8, right: 7 },
  footer: { borderTopWidth: 1 },
  footerContent: { width: '100%', maxWidth: 600, alignSelf: 'center', padding: 16, paddingHorizontal: 20, gap: 10 },
  footerHint: { fontSize: 11, lineHeight: 16, textAlign: 'center' },
  searchButton: { minHeight: 54, borderRadius: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14, paddingVertical: 15, gap: 10 },
  results: { gap: 16 },
  resultIcon: { width: 56, height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginBottom: 3 },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
  pickerKeyboard: { width: '100%', maxWidth: 600, alignSelf: 'center' },
  picker: { padding: 20, borderTopLeftRadius: 28, borderTopRightRadius: 28 },
  sheetHandle: { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  pickerHeading: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 18 },
  pickerSearch: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 15, paddingHorizontal: 14, marginBottom: 10 },
  searchInput: { flex: 1, minWidth: 0, fontSize: 15, paddingVertical: 15 },
  clearSearch: { width: 30, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  stopOption: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, borderBottomWidth: 1 },
  stopOptionIcon: { width: 38, height: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  noStops: { alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 36 },
});
