import { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image, Modal, Pressable, StyleSheet, TextInput, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { getCurrentUser, getNotifications } from '@/src/auth/auth.service';
import { getTokenBalance } from '@/src/token/token.service';
import { User } from '@/src/types';
import { router, useFocusEffect } from 'expo-router';
import Avatar from '@/src/components/ui/Avatar';
import { useTheme } from '@/src/store/theme';
import { showError } from '@/src/utils/toast';
import { getActiveRide, isActiveRide, RideBooking } from '@/src/ride/ride.store';
import {
  SakayDriver,
  getRoute,
  getTownName,
  getDestinationOptions,
} from '@/src/data/sakay';

import { getAvailableDrivers } from '@/src/ride/driver.service';
import { usePolling } from '@/src/ride/usePolling';

const TABS = [
  { id: 'bus' as const, label: 'Bus', img: require('../../assets/icon/bus.png') },
  { id: 'jeep' as const, label: 'Jeepney', img: require('../../assets/icon/jeepney.png') },
];

export default function DashboardHome() {
  const { isDark } = useTheme();
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  const [user, setUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<'bus' | 'jeep'>('jeep');
  const [unread, setUnread] = useState(0);
  const [tokens, setTokens] = useState(0);
  const ridePoll = usePolling(getActiveRide, null as RideBooking | null);
  const activeRide = ridePoll.data;

  const [sheetDriver, setSheetDriver] = useState<SakayDriver | null>(null);
  const [fromId, setFromId] = useState('');
  const [toId, setToId] = useState('');
  const [openDropdown, setOpenDropdown] = useState<'from' | 'to' | null>(null);

  useFocusEffect(useCallback(() => {
    getCurrentUser().then(async (u) => {
      setUser(u);
      if (u?.email) {
        const notifs = await getNotifications(u.email).catch(() => []);
        setUnread(notifs.filter((n: any) => !n.read).length);
        getTokenBalance(u.email).then((b) => setTokens(b.tokens)).catch(() => {});
      }
    });
  }, []));

  const fleet = usePolling(getAvailableDrivers, [] as SakayDriver[]);
  const drivers = fleet.data.filter(d => d.type === activeTab);
  const [query, setQuery] = useState('');
  const filteredDrivers = drivers.filter(d => (getRoute(d.routeId)?.label + ' ' + d.name).toLowerCase().includes(query.toLowerCase()));

  const sheetRoute = sheetDriver ? getRoute(sheetDriver.routeId) : undefined;

  const fromOptions = useMemo(() => {
    if (!sheetRoute) return [];
    return sheetRoute.stops.slice(0, -1).map((s) => ({ townId: s.townId, name: getTownName(s.townId) }));
  }, [sheetRoute]);

  const toOptions = useMemo(() => {
    if (!sheetRoute || !fromId) return [];
    return getDestinationOptions(sheetRoute, fromId);
  }, [sheetRoute, fromId]);

  const openSheet = (driver: SakayDriver) => {
    if (activeRide && isActiveRide(activeRide)) { router.push('/ride-tracking'); return; }
    if (driver.seats < 1) { showError('This vehicle is full'); return; }
    const route = getRoute(driver.routeId);
    setFromId(route?.originId || '');
    setToId('');
    setOpenDropdown(null);
    setSheetDriver(driver);
  };

  const selectFrom = (id: string) => {
    setFromId(id);
    setToId('');
    setOpenDropdown(null);
  };

  const selectTo = (id: string) => {
    setToId(id);
    setOpenDropdown(null);
  };

  const handleContinue = () => {
    if (!fromId) {
      showError('Choose where you will get on');
      return;
    }
    if (!toId) {
      showError('Choose where you will get off');
      return;
    }
    const driverId = sheetDriver?.id;
    const routeId = sheetDriver?.routeId;
    setSheetDriver(null);
    router.push({ pathname: '/route-map', params: { routeId, driverId, fromId, toId } });
  };

  const bg = isDark ? '#1A1A2E' : '#fff';
  const cardBg = isDark ? 'rgba(255,255,255,0.06)' : '#F9FAFB';
  const cardBorder = isDark ? 'rgba(255,255,255,0.08)' : '#F0F0F5';
  const textMain = isDark ? '#fff' : '#0D1F16';
  const fieldBg = isDark ? 'rgba(255,255,255,0.06)' : '#F5F7F5';

  const fromName = getTownName(fromId);
  const toName = toOptions.find((o) => o.townId === toId)?.name || '';

  // The exported page has no session or live fleet; hydrate a stable shell first.
  if (!ready) return <SafeAreaView style={{ flex: 1, backgroundColor: '#fff', justifyContent: 'center' }}><ActivityIndicator color="#3F8451" /></SafeAreaView>;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: bg }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
        {/* Header */}
        <View style={{ paddingHorizontal: 24, paddingTop: 12, paddingBottom: 16 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View style={{ flex: 1, minWidth: 0, marginRight: 8 }}>
              <Text style={{ fontSize: 13, color: isDark ? 'rgba(255,255,255,0.4)' : '#9CA3AF' }}>Good day,</Text>
              <Text numberOfLines={1} style={{ fontSize: 24, fontWeight: '800', color: textMain, marginTop: 2 }}>{user?.fullName || 'Rider'}</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <TouchableOpacity onPress={() => router.push('/token')}>
                <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : '#F0F7F1', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16 }}>
                  <Image source={require('../../assets/token/SakayNE Token.png')} style={{ width: 16, height: 16 }} resizeMode="contain" />
                  <Text style={{ fontSize: 13, fontWeight: '700', color: isDark ? '#5AA06D' : '#3F8451', marginLeft: 4 }}>{tokens}</Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity accessibilityRole="button" accessibilityLabel="Messages" onPress={() => router.push('/messages')}
                style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#F5F7F5', justifyContent: 'center', alignItems: 'center' }}>
                <Ionicons name="chatbubble-ellipses-outline" size={22} color={textMain} />
              </TouchableOpacity>
              <TouchableOpacity accessibilityRole="button" accessibilityLabel="Notifications" onPress={() => router.push('/notifications-list')}>
                <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#F5F7F5', justifyContent: 'center', alignItems: 'center' }}>
                  <Ionicons name="notifications-outline" size={20} color={isDark ? 'rgba(255,255,255,0.5)' : '#5A6B5E'} />
                  {unread > 0 && <View style={{ position: 'absolute', top: 2, right: 2, width: 16, height: 16, borderRadius: 8, backgroundColor: '#EF4444', justifyContent: 'center', alignItems: 'center' }}>
                    <Text style={{ fontSize: 9, fontWeight: '800', color: '#fff' }}>{unread > 9 ? '9+' : unread}</Text>
                  </View>}
                </View>
              </TouchableOpacity>
              <Avatar name={user?.fullName || ''} size={42} avatar={user?.avatar} onPress={() => router.push('/(passenger)/settings')} />
            </View>
          </View>
        </View>

        {/* Active ride banner */}
        {activeRide && isActiveRide(activeRide) && (
          <View style={{ paddingHorizontal: 24, marginBottom: 20 }}>
            <TouchableOpacity onPress={() => router.push('/ride-tracking')} activeOpacity={0.85}
              style={{ backgroundColor: '#3F8451', borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' }}>
                <Ionicons name="car" size={22} color="#fff" />
              </View>
              <View style={{ flex: 1, marginLeft: 14 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: '#fff' }} />
                  <Text style={{ fontSize: 12, fontWeight: '700', color: 'rgba(255,255,255,0.9)', marginLeft: 6, letterSpacing: 0.5 }}>{activeRide.status.toUpperCase()}</Text>
                </View>
                <Text numberOfLines={1} style={{ fontSize: 15, fontWeight: '700', color: '#fff', marginTop: 4 }}>{activeRide.fromName} → {activeRide.toName}</Text>
                <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 2 }}>Tap to view booking • {activeRide.driverName}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        )}

        {/* Vehicle Tabs */}
        <View style={{ paddingHorizontal: 24, marginBottom: 20 }}>
          <Text style={{ fontSize: 18, color: textMain, fontWeight: '700', marginBottom: 12 }}>1. Choose a vehicle</Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {TABS.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <TouchableOpacity key={tab.id} accessibilityRole="button" accessibilityState={{ selected: isActive }} onPress={() => setActiveTab(tab.id)} activeOpacity={0.8}
                  style={{ flex: 1, alignItems: 'center', paddingVertical: 14, borderRadius: 14, backgroundColor: isActive ? '#3F8451' : (isDark ? 'rgba(255,255,255,0.06)' : '#F5F7F5') }}>
                  <Image source={tab.img} style={{ width: 28, height: 28, tintColor: isActive ? '#fff' : '#8FA092' }} resizeMode="contain" />
                  <Text style={{ fontSize: 18, fontWeight: '700', color: isActive ? '#fff' : textMain, marginTop: 6 }}>{tab.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={{ paddingHorizontal: 24, marginBottom: 16 }}>
          <TextInput accessibilityLabel="Search route or driver" placeholder="Search your destination" placeholderTextColor="#8FA092" value={query} onChangeText={setQuery} style={{ backgroundColor: fieldBg, color: textMain, padding: 16, borderRadius: 14, fontSize: 17, minHeight: 56 }} />
          {!!fleet.error && <TouchableOpacity onPress={fleet.refresh}><Text style={{ color: '#EF4444', marginTop: 10 }}>{fleet.error} · Tap to retry</Text></TouchableOpacity>}
          {fleet.loading && <Text style={{ color: '#8FA092', marginTop: 10 }}>Finding online vehicles…</Text>}
        </View>
        {/* Driver Cards */}
        <View style={{ paddingHorizontal: 24 }}>
          <Text style={{ fontSize: 16, fontWeight: '700', color: textMain, marginBottom: 14 }}>{filteredDrivers.length} available {activeTab === 'bus' ? 'buses' : 'jeepneys'}</Text>

          {filteredDrivers.length === 0 ? (
            <View style={{ alignItems: 'center', paddingVertical: 32 }}>
              <Ionicons name="car-outline" size={40} color={isDark ? 'rgba(255,255,255,0.15)' : '#D6E4D8'} />
              <Text style={{ fontSize: 14, color: isDark ? 'rgba(255,255,255,0.3)' : '#8FA092', marginTop: 8 }}>No vehicles available right now</Text>
            </View>
          ) : filteredDrivers.map((driver) => {
            const route = getRoute(driver.routeId);
            return (
              <View key={driver.id} style={{ backgroundColor: cardBg, borderRadius: 16, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: cardBorder }}>
                <Text style={{ fontSize: 18, lineHeight: 26, fontWeight: '700', color: textMain, marginBottom: 12 }}>{route ? `${getTownName(route.originId)} → ${getTownName(route.destinationId)}` : 'Route unavailable'}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: '#F0F7F1', justifyContent: 'center', alignItems: 'center' }}>
                    <Text style={{ fontSize: 18, fontWeight: '700', color: '#3F8451' }}>{driver.name.charAt(0)}</Text>
                  </View>
                  <View style={{ marginLeft: 14, flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Text style={{ fontSize: 15, fontWeight: '700', color: textMain }}>{driver.name}</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginLeft: 8, backgroundColor: '#FEF3C7', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}>
                        <Ionicons name="star" size={10} color="#D97706" />
                        <Text style={{ fontSize: 10, fontWeight: '600', color: '#D97706', marginLeft: 2 }}>{driver.rating}</Text>
                      </View>
                    </View>
                    <Text style={{ fontSize: 13, color: isDark ? 'rgba(255,255,255,0.4)' : '#5A6B5E', marginTop: 2 }}>{driver.vehicle} • {driver.seats} seats</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 12 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Ionicons name="time-outline" size={11} color={isDark ? 'rgba(255,255,255,0.3)' : '#8FA092'} />
                        <Text style={{ fontSize: 11, color: isDark ? 'rgba(255,255,255,0.3)' : '#8FA092', marginLeft: 3 }}>{driver.etaMin == null ? 'Online' : `${driver.etaMin} min`}</Text>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                        <Ionicons name="location-outline" size={11} color={isDark ? 'rgba(255,255,255,0.3)' : '#8FA092'} />
                        <Text numberOfLines={1} style={{ fontSize: 11, color: isDark ? 'rgba(255,255,255,0.3)' : '#8FA092', marginLeft: 3 }}>{route?.label}</Text>
                      </View>
                    </View>
                  </View>
                  <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Book ${driver.type === 'bus' ? 'bus' : 'jeepney'} with ${driver.name}`} onPress={() => openSheet(driver)} style={{ backgroundColor: '#3F8451', minHeight: 52, justifyContent: 'center', paddingHorizontal: 18, paddingVertical: 12, borderRadius: 12 }}>
                    <Text style={{ fontSize: 17, fontWeight: '700', color: '#fff' }}>Book</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>

      {/* Booking Bottom Sheet */}
      <Modal visible={!!sheetDriver} transparent animationType="slide" onRequestClose={() => setSheetDriver(null)}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }} onPress={() => setSheetDriver(null)} />
        <View style={[styles.sheet, { backgroundColor: isDark ? '#222240' : '#fff' }]}>
          <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: isDark ? 'rgba(255,255,255,0.2)' : '#E5E7EB', alignSelf: 'center', marginBottom: 16 }} />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 22, fontWeight: '800', color: textMain }}>2. Choose your trip</Text>
              <Text style={{ fontSize: 12, color: isDark ? 'rgba(255,255,255,0.4)' : '#8FA092', marginTop: 2 }}>
                {sheetDriver?.name} • {sheetDriver?.type === 'bus' ? 'Bus' : 'Jeepney'} • {sheetRoute?.label}
              </Text>
            </View>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel="Close booking" onPress={() => setSheetDriver(null)} style={{ width: 48, height: 48, borderRadius: 17, backgroundColor: fieldBg, justifyContent: 'center', alignItems: 'center' }}>
              <Ionicons name="close" size={18} color={textMain} />
            </TouchableOpacity>
          </View>

          <ScrollView style={{ flexShrink: 1 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {/* From dropdown */}
            <Text style={[styles.fieldLabel, { color: textMain }]}>Where will you get on?</Text>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Get on: ${fromName || 'Choose a place'}`} accessibilityState={{ expanded: openDropdown === 'from' }} onPress={() => setOpenDropdown(openDropdown === 'from' ? null : 'from')}
              style={[styles.select, { backgroundColor: fieldBg, borderColor: openDropdown === 'from' ? '#3F8451' : 'transparent' }]}>
              <Ionicons name="navigate" size={16} color="#3F8451" />
              <Text style={{ flex: 1, fontSize: 18, fontWeight: '600', color: fromName ? textMain : (isDark ? 'rgba(255,255,255,0.3)' : '#8FA092'), marginLeft: 10 }}>
                {fromName || 'Select starting point'}
              </Text>
              <Ionicons name={openDropdown === 'from' ? 'chevron-up' : 'chevron-down'} size={18} color="#8FA092" />
            </TouchableOpacity>
            {openDropdown === 'from' && (
              <View style={[styles.dropdown, { backgroundColor: isDark ? '#2D2D44' : '#fff', borderColor: cardBorder }]}>
                {fromOptions.map((opt) => {
                  const active = fromId === opt.townId;
                  return (
                    <TouchableOpacity key={opt.townId} accessibilityRole="button" accessibilityState={{ selected: active }} onPress={() => selectFrom(opt.townId)}
                      style={[styles.dropdownItem, { backgroundColor: active ? (isDark ? 'rgba(63,132,81,0.2)' : '#F0F7F1') : 'transparent' }]}>
                      <Text style={{ flex: 1, fontSize: 18, fontWeight: active ? '700' : '500', color: active ? '#3F8451' : textMain }}>{opt.name}</Text>
                      {active && <Ionicons name="checkmark" size={16} color="#3F8451" />}
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            {/* To dropdown */}
            <Text style={[styles.fieldLabel, { marginTop: 20, color: textMain }]}>Where will you get off?</Text>
            <TouchableOpacity
              accessibilityRole="button" accessibilityLabel={`Get off: ${toName || 'Choose a place'}`} accessibilityState={{ expanded: openDropdown === 'to', disabled: !fromId }} disabled={!fromId}
              onPress={() => fromId && setOpenDropdown(openDropdown === 'to' ? null : 'to')}
              style={[styles.select, { backgroundColor: fieldBg, borderColor: openDropdown === 'to' ? '#3F8451' : 'transparent', opacity: fromId ? 1 : 0.5 }]}>
              <Ionicons name="location" size={16} color="#EF4444" />
              <Text style={{ flex: 1, fontSize: 18, fontWeight: '600', color: toName ? textMain : (isDark ? 'rgba(255,255,255,0.3)' : '#8FA092'), marginLeft: 10 }}>
                {toName || (fromId ? 'Select destination' : 'Select starting point first')}
              </Text>
              <Ionicons name={openDropdown === 'to' ? 'chevron-up' : 'chevron-down'} size={18} color="#8FA092" />
            </TouchableOpacity>
            {openDropdown === 'to' && (
              <View style={[styles.dropdown, { backgroundColor: isDark ? '#2D2D44' : '#fff', borderColor: cardBorder }]}>
                {toOptions.map((opt) => {
                  const active = toId === opt.townId;
                  return (
                    <TouchableOpacity key={opt.townId} accessibilityRole="button" accessibilityState={{ selected: active }} onPress={() => selectTo(opt.townId)}
                      style={[styles.dropdownItem, { backgroundColor: active ? (isDark ? 'rgba(63,132,81,0.2)' : '#F0F7F1') : 'transparent' }]}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 18, fontWeight: active ? '700' : '500', color: active ? '#3F8451' : textMain }}>
                          {opt.name}{opt.isOutside ? ' (outside N.E.)' : ''}
                        </Text>
                        <Text style={{ fontSize: 15, color: isDark ? '#C1CCC5' : '#526259', marginTop: 4 }}>{opt.isTerminus ? 'End of this route' : `About ${opt.minutes} minutes from boarding`}</Text>
                      </View>
                      {active && <Ionicons name="checkmark" size={16} color="#3F8451" />}
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            <Text style={{ fontSize: 16, lineHeight: 24, color: isDark ? '#C1CCC5' : '#526259', marginTop: 16 }}>This is a one-way trip. Choose a destination ahead on this route.</Text>
          </ScrollView>

          <TouchableOpacity accessibilityRole="button" accessibilityState={{ disabled: !fromId || !toId }} disabled={!fromId || !toId} onPress={handleContinue} style={{ minHeight: 56, padding: 14, opacity: fromId && toId ? 1 : 0.45, borderRadius: 14, justifyContent: 'center', alignItems: 'center', backgroundColor: '#3F8451', marginTop: 12 }}>
            <Text style={{ fontSize: 16, fontWeight: '700', color: '#fff' }}>Next: seats and fare</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  sheet: { maxHeight: '88%', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 34 },
  fieldLabel: { fontSize: 18, fontWeight: '700', marginBottom: 10 },
  select: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 15, borderRadius: 14, borderWidth: 1.5 },
  dropdown: { marginTop: 8, borderRadius: 14, borderWidth: 1, paddingVertical: 6 },
  dropdownItem: { minHeight: 56, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderRadius: 10, marginHorizontal: 6 },
});
