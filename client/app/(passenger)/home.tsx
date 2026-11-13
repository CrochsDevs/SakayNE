import { useInterfaceText } from '@/src/i18n/useInterfaceText';
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image, Modal, Pressable, StyleSheet, TextInput, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { getCurrentUser, getNotifications } from '@/src/auth/auth.service';
import { getTokenBalance } from '@/src/token/token.service';
import { User } from '@/src/types';
import { router, useFocusEffect } from 'expo-router';
import Avatar from '@/src/components/ui/Avatar';
import PickupAccuracyNotice from '@/src/components/PickupAccuracyNotice';
import TravelTimeEstimate from '@/src/components/TravelTimeEstimate';
import { useTheme } from '@/src/store/theme';
import { type BrandPalette } from '@/src/constants/Colors';
import BrandMark from '@/src/components/ui/BrandMark';
import CommuteScene from '@/src/components/ui/CommuteScene';
import { showError } from '@/src/utils/toast';
import { getActiveRide, isActiveRide, RideBooking } from '@/src/ride/ride.store';
import {
  SakayDriver,
  getRoute,
  getTownName,
  getDestinationOptions,
  TOWNS,
} from '@/src/data/sakay';
import { findRoutePickupArea, nearestPickupArea } from '@/src/data/pickup-area.mjs';
import { getPickupPosition, type PickupLocation } from '@/src/ride/location';
import { reversePlace } from '@/src/ride/maps.service';

import { getAvailableDrivers } from '@/src/ride/driver.service';
import { usePolling } from '@/src/ride/usePolling';
import { isServiceAvailable } from '@/src/data/service-availability.mjs';

const TABS = [
  { id: 'bus' as const, label: 'Bus' },
  { id: 'jeep' as const, label: 'Jeepney' },
];

// Keep rewards hidden from the dashboard until they are ready to show again.
const SHOW_TOKEN_WALLET = false;

const subscribeToHydration = () => () => {};
const clientSnapshot = () => true;
const serverSnapshot = () => false;

export default function DashboardHome() {
  const { isDark, colors, brand: Brand } = useTheme();
  const translate = useInterfaceText();
  const styles = createStyles(Brand, isDark);
  const ready = useSyncExternalStore(subscribeToHydration, clientSnapshot, serverSnapshot);
  const [user, setUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<'bus' | 'jeep'>('jeep');
  const [unread, setUnread] = useState(0);
  const [tokens, setTokens] = useState(0);
  const ridePoll = usePolling(getActiveRide, null as RideBooking | null);
  const activeRide = ridePoll.data;

  const [sheetDriver, setSheetDriver] = useState<SakayDriver | null>(null);
  const [fromId, setFromId] = useState('');
  const [toId, setToId] = useState('');
  const [openDropdown, setOpenDropdown] = useState<'to' | null>(null);
  const [pickupLocation, setPickupLocation] = useState<PickupLocation | null>(null);
  const [pickupAddress, setPickupAddress] = useState('');
  const [pickupError, setPickupError] = useState('');
  const [locating, setLocating] = useState(false);
  const [locationAttempt, setLocationAttempt] = useState(0);

  useFocusEffect(useCallback(() => {
    getCurrentUser().then(async (u) => {
      setUser(u);
      if (u?.email) {
        const notifs = await getNotifications(u.email).catch(() => []);
        setUnread(notifs.filter((n: any) => !n.read).length);
        if (SHOW_TOKEN_WALLET) {
          getTokenBalance(u.email).then((b) => setTokens(b.tokens)).catch(() => {});
        }
      }
    });
  }, []));

  const fleet = usePolling(getAvailableDrivers, [] as SakayDriver[]);
  const drivers = fleet.data.filter(d => d.type === activeTab && isServiceAvailable(d.type));
  const [query, setQuery] = useState('');
  const filteredDrivers = drivers.filter(d => (getRoute(d.routeId)?.label + ' ' + d.name).toLowerCase().includes(query.toLowerCase()));

  const sheetRoute = sheetDriver ? getRoute(sheetDriver.routeId) : undefined;

  useEffect(() => {
    if (!sheetDriver) return;
    let current = true;
    const locate = async () => {
      try {
        const position = await getPickupPosition();
        if (!current) return;
        if (position.accuracy !== null && (!Number.isFinite(position.accuracy) || position.accuracy < 0)) throw new Error('Could not get your location. Turn on GPS and try again.');
        setPickupLocation(position);
        void reversePlace(position).then(place => { if (current && place?.label) setPickupAddress(place.label); }).catch(() => {});
        const route = getRoute(sheetDriver.routeId);
        const area = findRoutePickupArea(position, TOWNS, route);
        const index = route?.stops.findIndex(stop => stop.townId === area?.id) ?? -1;
        if (!area || !route || index < 0) throw new Error('This route is too far from the location reported by your phone. Refresh your GPS or choose a nearer ride.');
        if (index === route.stops.length - 1) throw new Error('You are at the end of this route. Choose a ride in the other direction.');
        setFromId(area.id); setPickupLocation(position);
      } catch (error) { if (current) setPickupError(error instanceof Error ? error.message : 'Could not get your location. Turn on GPS and try again.'); }
      finally { if (current) setLocating(false); }
    };
    void locate();
    return () => { current = false; };
  }, [sheetDriver, locationAttempt]);

  const retryPickup = () => {
    setLocating(true); setPickupError(''); setFromId(''); setToId(''); setPickupLocation(null); setPickupAddress(''); setOpenDropdown(null);
    setLocationAttempt(value => value + 1);
  };

  const toOptions = useMemo(() => {
    if (!sheetRoute || !fromId) return [];
    return getDestinationOptions(sheetRoute, fromId);
  }, [sheetRoute, fromId]);

  const openSheet = (driver: SakayDriver) => {
    if (activeRide && isActiveRide(activeRide)) { router.push('/ride-tracking'); return; }
    if (driver.seats < 1) { showError(translate("This vehicle is full")); return; }
    setFromId(''); setPickupLocation(null); setPickupAddress(''); setPickupError(''); setLocating(true);
    setToId('');
    setOpenDropdown(null);
    setSheetDriver(driver);
  };

  const selectTo = (id: string) => {
    setToId(id);
    setOpenDropdown(null);
  };

  const handleContinue = () => {
    if (!fromId || !pickupLocation || locating || pickupError) {
      showError(translate('Allow location access to use your current pickup.'));
      return;
    }
    if (!toId) {
      showError(translate("Choose where you will get off"));
      return;
    }
    const driverId = sheetDriver?.id;
    const routeId = sheetDriver?.routeId;
    setSheetDriver(null);
    router.push({ pathname: '/route-map', params: { routeId, driverId, fromId, toId, pickupLat: String(pickupLocation.latitude), pickupLng: String(pickupLocation.longitude), pickupAccuracy: String(pickupLocation.accuracy), pickupCapturedAt: pickupLocation.capturedAt } });
  };

  const bg = colors.background;
  const cardBg = colors.card;
  const cardBorder = colors.border;
  const textMain = colors.text;
  const textMuted = colors.textSecondary;
  const fieldBg = colors.mintSurface;
  const accentColor = colors.primaryLight;

  const fromName = getTownName(fromId);
  const detected = pickupLocation ? nearestPickupArea(pickupLocation, TOWNS) : null;
  const routeNearby = pickupLocation && sheetRoute ? nearestPickupArea(pickupLocation, TOWNS.filter(town => sheetRoute.stops.some(stop => stop.townId === town.id))) : null;
  const detectedLabel = pickupAddress || (detected && detected.distanceMeters <= 15000 ? detected.town.name : pickupLocation ? `${pickupLocation.latitude.toFixed(4)}, ${pickupLocation.longitude.toFixed(4)}` : '');
  const toName = toOptions.find((o) => o.townId === toId)?.name || '';

  // The exported page has no session or live fleet; hydrate a stable shell first.
  if (!ready) return <SafeAreaView style={{ flex: 1, backgroundColor: bg, justifyContent: 'center' }}><ActivityIndicator color={accentColor} /></SafeAreaView>;

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: bg }}>
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <BrandMark />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <TouchableOpacity accessibilityRole="button" accessibilityLabel={translate("Notifications")} onPress={() => router.push('/notifications-list')}>
                <View style={[styles.iconButton, { backgroundColor: cardBg, borderColor: cardBorder }]}>
                  <Ionicons name="notifications-outline" size={21} color={textMain} />
                  {unread > 0 && <View style={{ position: 'absolute', top: 2, right: 2, width: 16, height: 16, borderRadius: 8, backgroundColor: '#EF4444', justifyContent: 'center', alignItems: 'center' }}>
                    <Text style={{ fontSize: 9, fontWeight: '800', color: '#fff' }}>{unread > 9 ? '9+' : unread}</Text>
                  </View>}
                </View>
              </TouchableOpacity>
            </View>
          </View>
          <View style={styles.greetingRow}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ fontSize: 13, color: textMuted, marginBottom: 4 }}>{translate("Hello, ka-biyahe!")}</Text>
              <Text numberOfLines={2} style={[styles.greeting, { color: textMain }]}>{user?.fullName || translate("Rider")}</Text>
            </View>
            <View accessible accessibilityRole="button" accessibilityLabel={translate("Open your profile")} onAccessibilityTap={() => router.push('/(passenger)/settings')}>
              <Avatar name={user?.fullName || translate("Rider")} size={44} avatar={user?.avatar} onPress={() => router.push('/(passenger)/settings')} />
            </View>
          </View>
        </View>

        {/* Active ride banner */}
        {activeRide && isActiveRide(activeRide) && (
          <View style={{ paddingHorizontal: 24, marginBottom: 20 }}>
            <TouchableOpacity onPress={() => router.push('/ride-tracking')} activeOpacity={0.85}
              style={{ backgroundColor: colors.primary, borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' }}>
                <Ionicons name="car" size={22} color="#fff" />
              </View>
              <View style={{ flex: 1, marginLeft: 14 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: '#fff' }} />
                  <Text style={{ fontSize: 12, fontWeight: '700', color: 'rgba(255,255,255,0.9)', marginLeft: 6, letterSpacing: 0.5 }}>{translate(activeRide.status.charAt(0).toUpperCase() + activeRide.status.slice(1)).toUpperCase()}</Text>
                </View>
                <Text numberOfLines={1} style={{ fontSize: 15, fontWeight: '700', color: '#fff', marginTop: 4 }}>{activeRide.fromName} → {activeRide.toName}</Text>
                <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 2 }}>{translate("Tap to view booking")} • {activeRide.driverName}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.section}>
          <View style={[styles.heroShadow, { backgroundColor: colors.heroStart }]}>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel={translate("Find transportation by pickup and destination")} onPress={() => router.push('/journey-search')}
            activeOpacity={0.9} style={styles.hero}>
            <LinearGradient colors={[colors.heroStart, colors.heroEnd]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.heroInner}>
              <View style={[styles.heroCircle, { pointerEvents: 'none' }]} />
              <View style={styles.eyebrowRow}>
                <Ionicons name="sparkles" size={13} color={colors.heroText} />
                <Text style={[styles.eyebrow, { color: colors.heroText }]}>{translate("A GOOD DAY TO GO PLACES")}</Text>
              </View>
              <View style={styles.heroRow}>
                <View style={{ flex: 1, minWidth: 0, zIndex: 1 }}>
                  <Text style={[styles.heroTitle, { color: colors.heroText }]}>Tara,{ '\n' }biyahe na!</Text>
                  <Text style={[styles.heroDescription, { color: colors.heroSubtext }]}>{translate("Your next stop starts here.")}</Text>
                </View>
                <View style={styles.heroArt}><CommuteScene compact /></View>
              </View>
              <View style={styles.heroSearch}>
                <Ionicons name="search-outline" size={20} color="#FFFFFF" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.heroSearchText}>{translate("Where are you going?")}</Text>
                  <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 10, marginTop: 3 }}>{translate("Choose your pickup & destination")}</Text>
                </View>
                <View style={styles.heroArrow}><Ionicons name="arrow-forward" size={18} color={Brand.ink} /></View>
              </View>
            </LinearGradient>
          </TouchableOpacity>
          </View>
        </View>
        {SHOW_TOKEN_WALLET && <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Token balance: ${tokens}. Open wallet`} onPress={() => router.push('/token')} activeOpacity={0.8}
          style={[styles.wallet, { backgroundColor: colors.mintSurface, borderColor: isDark ? cardBorder : '#CBE5DA' }]}>
          <View style={[styles.walletIcon, { backgroundColor: Brand.sunshine }]}>
            <Image source={require('../../assets/token/SakayNE Token.png')} style={{ width: 28, height: 28 }} resizeMode="contain" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: textMuted, fontSize: 12, marginBottom: 3 }}>Your token balance</Text>
            <Text style={{ color: textMain, fontSize: 18, fontWeight: '800' }}>{tokens} <Text style={{ fontSize: 12, fontWeight: '500', color: textMuted }}>tokens</Text></Text>
          </View>
          <Text style={{ color: accentColor, fontSize: 13, fontWeight: '700' }}>My wallet</Text>
          <Ionicons name="chevron-forward" size={17} color={accentColor} />
        </TouchableOpacity>}
        {/* Vehicle Tabs */}
        <View style={styles.section}>
          <View style={styles.sectionHeading}><Text style={[styles.sectionTitle, { color: textMain }]}>{translate("Pick your ride")}</Text><Text style={{ color: textMuted, fontSize: 12 }}>{translate("Your way, every day")}</Text></View>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            {TABS.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <TouchableOpacity key={tab.id} accessibilityRole="button" accessibilityLabel={isServiceAvailable(tab.id) ? tab.label : 'Bus, coming soon'} accessibilityState={{ selected: isActive }} onPress={() => isServiceAvailable(tab.id) ? setActiveTab(tab.id) : router.push('/bus-coming-soon')} activeOpacity={0.8}
                  style={[styles.vehicleTab, { borderColor: isActive ? Brand.teal : 'transparent', backgroundColor: isActive ? Brand.teal : tab.id === 'bus' ? colors.coralSurface : colors.mintSurface }]}>
                  <View style={styles.vehicleTabTop}>
                    <View style={{ width: 54, height: 45, borderRadius: 15, backgroundColor: isActive ? 'rgba(255,255,255,0.15)' : isDark ? (tab.id === 'bus' ? '#75380F' : '#245842') : tab.id === 'bus' ? '#F9BA9E' : '#BDE8D7', alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-6deg' }] }}>
                      {tab.id === 'bus' ? <Ionicons name="bus" size={32} color={isActive ? Brand.sunshine : isDark ? colors.text : Brand.ink} /> :
                        <Image source={require('../../assets/icon/jeepney.png')} resizeMode="contain" tintColor={isActive ? Brand.sunshine : isDark ? colors.text : Brand.ink} style={{ width: 42, height: 42 }} />}
                    </View>
                    <Ionicons name={isActive ? 'checkmark-circle' : 'arrow-forward'} size={19} color={isActive ? Brand.sunshine : textMain} />
                  </View>
                  <Text style={{ fontSize: 18, fontWeight: '800', color: isActive ? '#FFFFFF' : textMain, marginTop: 12 }}>{tab.label}</Text>
                  <Text style={{ fontSize: 11, color: isActive ? '#E0E0E0' : textMuted, marginTop: 4 }}>{!isServiceAvailable(tab.id) ? 'Coming soon' : translate("The local favorite")}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={styles.section}>
          <View style={[styles.searchField, { backgroundColor: cardBg, borderColor: cardBorder }]}>
            <Ionicons name="search-outline" size={19} color={textMuted} />
            <TextInput accessibilityLabel={translate("Search route or driver")} placeholder={translate("Search a route or driver")} placeholderTextColor={textMuted} value={query} onChangeText={setQuery} returnKeyType="search" style={{ flex: 1, minWidth: 0, color: textMain, paddingVertical: 15, fontSize: 14 }} />
            {!!query && <TouchableOpacity accessibilityRole="button" accessibilityLabel={translate("Clear search")} onPress={() => setQuery('')} style={styles.clearSearch}><Ionicons name="close-circle" size={19} color={textMuted} /></TouchableOpacity>}
          </View>
          {!!fleet.error && filteredDrivers.length > 0 && <TouchableOpacity accessibilityRole="button" onPress={fleet.refresh} style={{ paddingVertical: 12 }}><Text style={{ color: isDark ? '#FFB4A9' : '#AA3528' }}>{translate("Unable to update vehicles. Tap to retry.")}</Text></TouchableOpacity>}
        </View>
        {/* Driver Cards */}
        <View style={{ paddingHorizontal: 20 }}>
          <View style={styles.fleetHeading}>
            <Text style={{ fontSize: 18, fontWeight: '700', color: textMain }}>{translate("Available rides")}</Text>
            <View style={[styles.countBadge, { backgroundColor: fieldBg }]}><Text style={{ color: textMuted, fontSize: 12, fontWeight: '600' }}>{fleet.loading ? translate("Finding rides…") : translate(activeTab === "bus" ? "{{count}} buses" : "{{count}} jeepneys", { count: filteredDrivers.length })}</Text></View>
          </View>

          {filteredDrivers.length === 0 ? (
            <View style={[styles.emptyCard, { backgroundColor: cardBg, borderColor: cardBorder }]} accessibilityLiveRegion="polite">
              <View style={[styles.emptyIcon, { backgroundColor: colors.accentSurface }]}>
                {fleet.loading ? <ActivityIndicator color={accentColor} /> : <Ionicons name={fleet.error ? 'cloud-offline-outline' : query ? 'search-outline' : 'bus-outline'} size={30} color={accentColor} />}
              </View>
              <Text style={[styles.emptyTitle, { color: textMain }]}>{fleet.loading ? translate("Finding your next ride") : fleet.error ? translate("Let’s reconnect") : query ? translate("No matching rides") : translate("No rides just yet")}</Text>
              <Text style={[styles.emptyDescription, { color: textMuted }]}>{fleet.loading ? translate("Checking for available vehicles.") : fleet.error ? translate("We couldn’t load available rides. Check your connection and try again.") : query ? translate("Try another route or driver name to find a match.") : translate("No {{vehicle}} are online right now. Check the other vehicle type or come back soon.", { vehicle: translate(activeTab === "bus" ? "buses" : "jeepneys") })}</Text>
              {!fleet.loading && <TouchableOpacity accessibilityRole="button" accessibilityLabel={fleet.error ? translate("Try again") : query ? translate("Clear search") : 'Plan a trip'} onPress={fleet.error ? fleet.refresh : query ? () => setQuery('') : () => router.push('/journey-search')}
                style={[styles.emptyAction, { backgroundColor: fieldBg }]}>
                <Text style={{ color: accentColor, fontSize: 13, fontWeight: '700' }}>{fleet.error ? translate("Try again") : query ? translate("Clear search") : 'Plan a trip'}</Text>
                <Ionicons name={fleet.error ? 'refresh' : 'arrow-forward'} size={16} color={accentColor} />
              </TouchableOpacity>}
            </View>
          ) : filteredDrivers.map((driver) => {
            const route = getRoute(driver.routeId);
            const availableSeats = Math.max(0, Math.floor(driver.seats));
            const full = availableSeats < 1;
            return (
              <View key={driver.id} style={[styles.driverCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
                <Text style={[styles.driverRoute, { color: textMain }]}>{route ? `${getTownName(route.originId)} → ${getTownName(route.destinationId)}` : translate("Route unavailable")}</Text>
                <View style={[styles.driverProfile, { borderColor: colors.borderLight }]}>
                  <View style={[styles.driverAvatar, { backgroundColor: colors.mintSurface, borderColor: colors.borderFocused }]}>
                    <Avatar name={driver.name} size={60} />
                  </View>
                  <View style={styles.driverDetails}>
                    <Text style={[styles.driverName, { color: textMain }]}>{driver.name}</Text>
                    <Text style={[styles.driverVehicle, { color: textMuted }]}>{driver.vehicle}</Text>
                    <View style={styles.driverBadges}>
                      <View style={[styles.driverRating, { backgroundColor: colors.accentSurface }]}>
                        <Ionicons name="star" size={12} color={colors.onAccent} />
                        <Text style={{ fontSize: 11, fontWeight: '700', color: colors.onAccent }}>{driver.rating}</Text>
                      </View>
                      <View style={styles.driverPresence}>
                        <Ionicons name={driver.etaMin == null ? 'radio-button-on' : 'time-outline'} size={12} color={accentColor} />
                        <Text style={{ fontSize: 12, color: textMuted }}>{driver.etaMin == null ? translate("Online") : translate("{{count}} min", { count: driver.etaMin })}</Text>
                      </View>
                    </View>
                  </View>
                </View>
                <View accessibilityLiveRegion="polite" style={{ flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, backgroundColor: full ? colors.coralSurface : colors.mintSurface }}>
                  <Ionicons name="people-outline" size={23} color={full ? colors.error : accentColor} />
                  <Text style={{ flex: 1, color: full ? colors.error : accentColor, fontSize: 15, fontWeight: '800' }}>{full ? translate('Full') : availableSeats === 1 ? translate('1 seat available') : translate('{{count}} seats available', { count: availableSeats })}</Text>
                  <Ionicons name={full ? 'close-circle-outline' : 'checkmark-circle'} size={20} color={full ? colors.error : accentColor} />
                </View>
                <TouchableOpacity accessibilityRole="button" accessibilityLabel={translate('View on map') + ': ' + driver.name} onPress={() => router.push({ pathname: '/vehicle-map', params: { driverId: driver.id, routeId: driver.routeId } })} style={[styles.driverBook, { backgroundColor: colors.mintSurface }]}>
                  <Ionicons name="map-outline" size={20} color={accentColor} />
                  <Text style={{ fontSize: 15, fontWeight: '700', color: accentColor }}>{translate('View on map')}</Text>
                </TouchableOpacity>
                <TouchableOpacity accessibilityRole="button" accessibilityLabel={full ? translate('This vehicle is full') : `Book ${driver.type === 'bus' ? 'bus' : 'jeepney'} with ${driver.name}`} accessibilityState={{ disabled: full }} disabled={full} onPress={() => openSheet(driver)} style={[styles.driverBook, { backgroundColor: full ? colors.backgroundAlt : colors.primary }]}>
                  <Text style={{ fontSize: 16, fontWeight: '700', color: full ? textMuted : colors.onPrimary }}>{translate(full ? 'Full' : 'Book')}</Text>
                  {!full && <Ionicons name="arrow-forward" size={19} color={colors.onPrimary} />}
                </TouchableOpacity>
              </View>
            );
          })}
        </View>
        <View style={styles.quickLinks}>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel={translate("View my rides")} onPress={() => router.push('/(passenger)/rides')} style={[styles.quickLink, { backgroundColor: colors.accentSurface }]}>
            <Ionicons name="ticket-outline" size={22} color={colors.onAccent} /><Text style={{ color: colors.onAccent, fontSize: 13, fontWeight: '700' }}>{translate("My rides")}</Text><Ionicons name="arrow-forward" size={16} color={colors.onAccent} />
          </TouchableOpacity>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel={translate("Open help center")} onPress={() => router.push('/help-center')} style={[styles.quickLink, { backgroundColor: colors.coralSurface }]}>
            <Ionicons name="chatbubbles-outline" size={22} color={colors.textSecondary} /><Text style={{ color: colors.textSecondary, fontSize: 13, fontWeight: '700' }}>{translate("Need help?")}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Booking Bottom Sheet */}
      <Modal visible={!!sheetDriver} transparent animationType="slide" onRequestClose={() => setSheetDriver(null)}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }} onPress={() => setSheetDriver(null)} />
        <View style={[styles.sheet, { backgroundColor: cardBg }]}>
          <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: isDark ? 'rgba(255,255,255,0.2)' : '#E5E7EB', alignSelf: 'center', marginBottom: 16 }} />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 22, fontWeight: '800', color: textMain }}>{translate("2. Choose your trip")}</Text>
              <Text style={{ fontSize: 12, color: textMuted, marginTop: 2 }}>
                {sheetDriver?.name} • {sheetDriver?.type === 'bus' ? 'Bus' : 'Jeepney'} • {sheetRoute?.label}
              </Text>
            </View>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel={translate("Close booking")} onPress={() => setSheetDriver(null)} style={{ width: 48, height: 48, borderRadius: 17, backgroundColor: fieldBg, justifyContent: 'center', alignItems: 'center' }}>
              <Ionicons name="close" size={18} color={textMain} />
            </TouchableOpacity>
          </View>

          <ScrollView style={{ flexShrink: 1 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <Text style={[styles.fieldLabel, { color: textMain }]}>{translate('Pickup')}</Text>
            <View accessibilityLiveRegion="polite" style={[styles.select, { backgroundColor: fieldBg, borderColor: 'transparent', gap: 11 }]}>
              {locating ? <ActivityIndicator size="small" color={accentColor} /> : <Ionicons name="locate" size={23} color={accentColor} />}
              <View style={{ flex: 1, gap: 4 }}><Text style={{ fontSize: 17, lineHeight: 23, fontWeight: '700', color: textMain }}>{translate(locating ? 'Finding your location…' : 'Current location')}</Text><Text style={{ fontSize: 12, lineHeight: 18, color: textMuted }}>{pickupLocation ? translate('Detected location: {{name}}', { name: detectedLabel }) : translate('Use GPS to set your pickup automatically.')}</Text>{!!fromId && <Text style={{ fontSize: 12, lineHeight: 18, color: textMuted }}>{translate('Pickup area: {{name}}', { name: fromName })}</Text>}</View>
              {!locating && <TouchableOpacity accessibilityRole="button" accessibilityLabel={translate('Refresh pickup location')} onPress={retryPickup} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="refresh" size={21} color={accentColor} /></TouchableOpacity>}
            </View>
            {pickupLocation && !!fromId && <View style={{ marginTop: 10 }}><PickupAccuracyNotice accuracy={pickupLocation.accuracy} /></View>}
            {!!pickupError && routeNearby && <Text style={{ marginTop: 10, fontSize: 12, lineHeight: 19, color: textMuted }}>{translate('Nearest route area: {{name}} · {{distance}} km from the reported location.', { name: routeNearby.town.name, distance: (routeNearby.distanceMeters / 1000).toFixed(1) })}</Text>}
            {!!pickupError && <View style={{ marginTop: 10, gap: 4 }}><Text accessibilityRole="alert" style={{ fontSize: 13, lineHeight: 20, color: colors.error }}>{translate(pickupError)}</Text><TouchableOpacity accessibilityRole="button" onPress={retryPickup} style={{ minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' }}><Text style={{ fontWeight: '700', color: accentColor }}>{translate('Try again')}</Text></TouchableOpacity></View>}

            {/* To dropdown */}
            <Text style={[styles.fieldLabel, { marginTop: 20, color: textMain }]}>{translate("Where will you get off?")}</Text>
            <TouchableOpacity
              accessibilityRole="button" accessibilityLabel={translate("Get off: {{name}}", { name: toName || translate("Choose a place") })} accessibilityState={{ expanded: openDropdown === 'to', disabled: !fromId }} disabled={!fromId}
              onPress={() => fromId && setOpenDropdown(openDropdown === 'to' ? null : 'to')}
              style={[styles.select, { backgroundColor: fieldBg, borderColor: openDropdown === 'to' ? accentColor : 'transparent', opacity: fromId ? 1 : 0.5 }]}>
              <Ionicons name="location" size={16} color="#EF4444" />
              <Text style={{ flex: 1, fontSize: 18, fontWeight: '600', color: toName ? textMain : (textMuted), marginLeft: 10 }}>
                {toName || (fromId ? translate("Select destination") : translate('Waiting for your location'))}
              </Text>
              <Ionicons name={openDropdown === 'to' ? 'chevron-up' : 'chevron-down'} size={18} color={textMuted} />
            </TouchableOpacity>
            {openDropdown === 'to' && (
              <View style={[styles.dropdown, { backgroundColor: cardBg, borderColor: cardBorder }]}>
                {toOptions.map((opt) => {
                  const active = toId === opt.townId;
                  return (
                    <TouchableOpacity key={opt.townId} accessibilityRole="button" accessibilityState={{ selected: active }} onPress={() => selectTo(opt.townId)}
                      style={[styles.dropdownItem, { backgroundColor: active ? (colors.mintSurface) : 'transparent' }]}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 18, fontWeight: active ? '700' : '500', color: active ? accentColor : textMain }}>
                          {opt.name}{opt.isOutside ? translate(" (outside N.E.)") : ''}
                        </Text>
                        <Text style={{ fontSize: 15, color: textMuted, marginTop: 4 }}>{opt.isTerminus ? translate("End of this route") : translate("About {{count}} minutes from boarding", { count: opt.minutes })}</Text>
                      </View>
                      {active && <Ionicons name="checkmark" size={16} color={accentColor} />}
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            {!!toId && <View style={{ marginTop: 14 }}><TravelTimeEstimate minutes={toOptions.find(option => option.townId === toId)?.minutes ?? 0} compact /></View>}
            <Text style={{ fontSize: 13, lineHeight: 20, color: textMuted, marginTop: 16 }}>{translate('Your GPS pickup pin will be shared with this driver when you confirm. Choose only your drop-off ahead on this route.')}</Text>
          </ScrollView>

          <TouchableOpacity accessibilityRole="button" accessibilityState={{ disabled: !fromId || !toId }} disabled={!fromId || !toId} onPress={handleContinue} style={{ minHeight: 56, padding: 14, opacity: fromId && toId ? 1 : 0.45, borderRadius: 14, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.primary, marginTop: 12 }}>
            <Text style={{ fontSize: 16, fontWeight: '700', color: '#fff' }}>{translate("Next: choose seats")}</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const createStyles = (Brand: BrandPalette, isDark: boolean) => StyleSheet.create({
  page: { paddingBottom: 28, width: '100%', maxWidth: 640, alignSelf: 'center' },
  header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 20 },
  headerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  iconButton: { width: 44, height: 44, borderRadius: 16, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  greetingRow: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 24 },
  greeting: { fontSize: 25, lineHeight: 32, fontWeight: '800', letterSpacing: -0.7 },
  section: { paddingHorizontal: 20, marginBottom: 20 },
  heroShadow: { borderRadius: 26, boxShadow: isDark ? '0 2px 6px rgba(0,0,0,0.18)' : '0 3px 10px -4px rgba(0,0,0,0.14)' },
  hero: { borderRadius: 26, overflow: 'hidden' },
  heroInner: { padding: 20, overflow: 'hidden' },
  heroCircle: { position: 'absolute', width: 180, height: 180, borderRadius: 90, borderWidth: 26, borderColor: 'rgba(255,255,255,0.18)', top: -85, right: -65 },
  eyebrowRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 8 },
  eyebrow: { fontSize: 9, fontWeight: '800', letterSpacing: 1.2, color: Brand.deepTeal },
  heroRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, minHeight: 120 },
  heroArt: { width: '42%', maxWidth: 180, marginRight: -6, marginLeft: 2 },
  heroTitle: { fontSize: 30, lineHeight: 33, fontWeight: '900', letterSpacing: -1.1, color: Brand.ink },
  heroDescription: { fontSize: 12, lineHeight: 18, color: '#68582E', marginTop: 8, maxWidth: 150 },
  heroSearch: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: Brand.teal, borderRadius: 16, paddingHorizontal: 13, paddingVertical: 13 },
  heroSearchText: { fontSize: 14, lineHeight: 19, fontWeight: '700', color: '#FFFFFF' },
  heroArrow: { width: 30, height: 30, backgroundColor: Brand.sunshine, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  wallet: { marginHorizontal: 20, marginBottom: 24, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 20, borderWidth: 1 },
  walletIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 5, marginBottom: 14 },
  sectionTitle: { fontSize: 19, fontWeight: '800', letterSpacing: -0.5 },
  vehicleTab: { flex: 1, padding: 15, borderRadius: 22, borderWidth: 1.5 },
  vehicleTabTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  searchField: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 15, paddingHorizontal: 14, minHeight: 52 },
  clearSearch: { minWidth: 32, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  fleetHeading: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 14 },
  countBadge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20 },
  driverCard: { borderRadius: 22, padding: 16, marginBottom: 12, borderWidth: 1 },
  driverRoute: { fontSize: 17, lineHeight: 24, fontWeight: '700', letterSpacing: -0.3 },
  driverProfile: { flexDirection: 'row', alignItems: 'center', gap: 13, paddingVertical: 16, marginTop: 13, marginBottom: 15, borderTopWidth: 1 },
  driverAvatar: { width: 68, height: 68, borderRadius: 34, padding: 3, borderWidth: 1, flexShrink: 0, alignItems: 'center', justifyContent: 'center' },
  driverDetails: { flex: 1, minWidth: 0, gap: 5 },
  driverName: { fontSize: 16, lineHeight: 22, fontWeight: '700' },
  driverVehicle: { fontSize: 13, lineHeight: 19 },
  driverBadges: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 9, marginTop: 2 },
  driverRating: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 7, paddingVertical: 4, borderRadius: 8 },
  driverPresence: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  driverBook: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, minHeight: 48, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 12 },
  emptyCard: { alignItems: 'center', paddingHorizontal: 24, paddingVertical: 26, borderWidth: 1, borderRadius: 24 },
  emptyIcon: { width: 64, height: 64, borderRadius: 22, justifyContent: 'center', alignItems: 'center', marginBottom: 15 },
  emptyTitle: { fontSize: 17, fontWeight: '700', textAlign: 'center' },
  emptyDescription: { fontSize: 13, lineHeight: 21, textAlign: 'center', marginTop: 7, maxWidth: 270 },
  emptyAction: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 18, minHeight: 44, borderRadius: 12, marginTop: 18 },
  quickLinks: { paddingHorizontal: 20, flexDirection: 'row', gap: 12, marginTop: 20 },
  quickLink: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', gap: 8, borderRadius: 18, paddingHorizontal: 12, paddingVertical: 18 },
  sheet: { maxHeight: '88%', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 34 },
  fieldLabel: { fontSize: 18, fontWeight: '700', marginBottom: 10 },
  select: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 15, borderRadius: 14, borderWidth: 1.5 },
  dropdown: { marginTop: 8, borderRadius: 14, borderWidth: 1, paddingVertical: 6 },
  dropdownItem: { minHeight: 56, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderRadius: 10, marginHorizontal: 6 },
});
