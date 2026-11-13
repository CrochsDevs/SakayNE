import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useSyncExternalStore } from 'react';

export const MAP_STYLE_CHOICES = ['auto', 'light', 'streets', 'bright', 'dark', 'terrain', '3d'] as const;
export type MapStyleChoice = typeof MAP_STYLE_CHOICES[number];
export type ResolvedMapStyle = Exclude<MapStyleChoice, 'auto'>;
export interface MapStyleStatus { id: ResolvedMapStyle; status: 'loading' | 'ready' | 'error'; }
const key = '@sakayne_map_style';
const listeners = new Set<() => void>();
let selected: MapStyleChoice = 'auto';
let version = 0;
let restored: Promise<void> | undefined;
const valid = (value: unknown): value is MapStyleChoice => MAP_STYLE_CHOICES.includes(value as MapStyleChoice);
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
const snapshot = () => selected;
const serverSnapshot = (): MapStyleChoice => 'auto';
export const resolveMapStyle = (choice: MapStyleChoice, isDark: boolean): ResolvedMapStyle => choice === 'auto' ? isDark ? 'dark' : 'light' : choice;

async function restore() {
  const current = version;
  try {
    const value = await AsyncStorage.getItem(key);
    if (version === current && valid(value)) { selected = value; listeners.forEach(listener => listener()); }
  } catch { /* A readable map remains available without storage. */ }
}
export async function selectMapStyle(choice: MapStyleChoice) {
  if (!valid(choice)) return;
  ++version;
  await AsyncStorage.setItem(key, choice);
  selected = choice;
  listeners.forEach(listener => listener());
}
export function useMapStyle() {
  const choice = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  useEffect(() => { restored ??= restore(); }, []);
  return choice;
}
