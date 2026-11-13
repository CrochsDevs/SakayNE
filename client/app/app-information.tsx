import { Linking } from 'react-native';
import { useSyncExternalStore } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { Screen, Card, Label, Action, Loading } from '@/src/components/ui/Screen';
const subscribeToHydration = () => () => {};
const clientSnapshot = () => true;
const serverSnapshot = () => false;
export default function AppInformation() {
  const { topic } = useLocalSearchParams<{ topic: string }>();
  const ready = useSyncExternalStore(subscribeToHydration, clientSnapshot, serverSnapshot);
  if (!ready) return <Screen title="App information" back><Loading /></Screen>;
  return <Screen title={topic === 'privacy' ? 'Your information' : topic === 'terms' ? 'Booking rules' : 'Open source'} back>
    {topic === 'privacy' ? <>
      <Card><Label strong>Account and booking information</Label><Label>Sakay stores your name, email, phone, profile photo and booking history to manage your account and connect you with your driver.</Label></Card>
      <Card><Label strong>Location and driver documents</Label><Label>Driver GPS is shared during availability and active bookings while the app is open. Passengers can enable location sharing with their assigned driver for automatic boarding and alighting detection, and turn it off from the booking. Passenger sharing stops after alighting or the end of the booking. Driver documents and selfies are used for application review.</Label></Card>
      <Card><Label strong>Booking chat</Label><Label>Messages belong to a booking and can be viewed by its passenger and driver. Chat closes when the booking ends.</Label></Card>
      <Card><Label strong>Map services</Label><Label>OpenFreeMap provides map tiles. Terrain view also requests Mapzen elevation tiles hosted on AWS; the viewed area is visible to these tile providers. Road preview coordinates are sent through our server to OSRM, and place searches or pickup address lookups are sent to Photon. These providers may log requests. Automatic seat detection remains a separate feature that you can turn on or off.</Label></Card>
    </> : topic === 'terms' ? <>
      <Card><Label strong>Seats and stops</Label><Label>Select a pickup stop and a later drop-off on your vehicle&apos;s route. Your seats are reserved while your booking is active. Wait for the driver to accept before boarding.</Label></Card>
      <Card><Label strong>Pickup and cancellation</Label><Label>Show your boarding code at pickup. You can cancel before boarding. Requests that remain unanswered for five minutes expire.</Label></Card>
      <Card><Label strong>Trip completion</Label><Label>Travel times are planning estimates. The driver completes your booking after you alight.</Label></Card>
    </> : <>
      <Label>Sakay uses these open source projects. View their project licenses and attribution below.</Label>
      <Action title="MapLibre GL JS license" onPress={() => { void Linking.openURL('https://github.com/maplibre/maplibre-gl-js/blob/main/LICENSE.txt'); }} />
      <Action title="OpenFreeMap attribution" onPress={() => { void Linking.openURL('https://openfreemap.org/'); }} />
      <Action title="Mapzen terrain data attribution" onPress={() => { void Linking.openURL('https://github.com/tilezen/joerd/blob/master/docs/attribution.md'); }} />
      <Action title="OSRM license" onPress={() => { void Linking.openURL('https://github.com/Project-OSRM/osrm-backend/blob/master/LICENSE.TXT'); }} />
      <Action title="Photon license" onPress={() => { void Linking.openURL('https://github.com/komoot/photon/blob/master/LICENSE'); }} />
      <Action title="Expo license" onPress={() => { void Linking.openURL('https://github.com/expo/expo/blob/main/LICENSE'); }} />
      <Action title="React Native license" onPress={() => { void Linking.openURL('https://github.com/facebook/react-native/blob/main/LICENSE'); }} />
      <Action title="OpenStreetMap attribution" onPress={() => { void Linking.openURL('https://www.openstreetmap.org/copyright'); }} />
    </>}
  </Screen>;
}
