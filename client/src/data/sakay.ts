import { VehicleType } from '@/src/types';
import catalog from './transit.json';

export interface Town {
  id: string;
  name: string;
  lat: number;
  lng: number;
  outside?: boolean;
}

export interface RouteStop {
  townId: string;
  minutes: number;
}

export interface RouteDef {
  id: string;
  type: 'jeep' | 'bus';
  label: string;
  originId: string;
  destinationId: string;
  destinationLabel: string;
  stops: RouteStop[];
  mapDetailsEnabled?: boolean;
  // Road junctions used instead of town centers for intermediate routing only.
  // These guide the preview corridor; they are not boarding or drop-off pins.
  roadViaOverrides?: Record<string, { latitude: number; longitude: number }>;
  // Ordered road points before and after a mapped stop, in this route's direction.
  roadApproaches?: Record<string, {
    before?: { latitude: number; longitude: number }[];
    after?: { latitude: number; longitude: number }[];
  }>;
  terminalPoints?: Record<string, { name: string; latitude: number; longitude: number; source: string }>;
  // Direction-specific boarding points, independent of municipality centers.
  // Add only when the operator's stop location and source have been verified.
  serviceStops?: { id: string; townId?: string; name: string; lat: number; lng: number; source: string }[];
  servicePath?: { source: string; points: { latitude: number; longitude: number }[] };
}

export function getServiceStops(route?: RouteDef) {
  return (route?.serviceStops || []).filter(stop => stop.source.trim()
    && Number.isFinite(stop.lat) && Math.abs(stop.lat) <= 90
    && Number.isFinite(stop.lng) && Math.abs(stop.lng) <= 180);
}

export function isRouteMapEnabled(route?: RouteDef | null) {
  return route?.mapDetailsEnabled === true;
}

export const NE_CENTER = { lat: 15.5781, lng: 120.9756 };

export const TOWNS = catalog.towns as Town[];

export const ROUTES = catalog.routes as RouteDef[];

export interface SakayDriver {
  id: string;
  name: string;
  rating: string;
  vehicle: string;
  type: 'jeep' | 'bus';
  routeId: string;
  seats: number;
  etaMin: number | null;
  location?: { latitude: number; longitude: number; accuracy?: number | null; capturedAt?: string; updatedAt: string } | null;
}



export const JEEP_TOWN_IDS = [
  'cabanatuan', 'palayan', 'gapan', 'sanjose', 'munoz', 'talavera',
  'bitas', 'sta_rosa', 'penaranda', 'baloc', 'licab', 'sto_domingo', 'lupao',
];

export const BUS_DESTINATIONS = [
  { id: 'manila', name: 'Manila', routeId: 'bus-cabanatuan-manila' },
  { id: 'baguio', name: 'Baguio City', routeId: 'bus-cabanatuan-baguio' },
  { id: 'tuguegarao', name: 'Tuguegarao', routeId: 'bus-cabanatuan-tuguegarao' },
];

export function getTown(id?: string | null): Town | undefined {
  return TOWNS.find((t) => t.id === id);
}

export function getRoute(id?: string | null): RouteDef | undefined {
  return ROUTES.find((r) => r.id === id);
}

export function getTownName(id?: string | null): string {
  return getTown(id)?.name || '';
}

export function getRouteMapTown(route: RouteDef | null | undefined, townId: string): Town | undefined {
  const town = getTown(townId);
  const terminal = route?.terminalPoints?.[townId];
  if (town && terminal) return { ...town, name: terminal.name, lat: terminal.latitude, lng: terminal.longitude };
  const stop = getServiceStops(route || undefined).find(stop => stop.townId === townId);
  return town && stop ? { ...town, name: stop.name, lat: stop.lat, lng: stop.lng } : town;
}

export function getServiceMapStops(route?: RouteDef | null, fromId?: string, toId?: string) {
  if (!route) return [];
  const from = fromId || route.originId, to = toId || route.destinationId;
  const towns = new Set(buildSegment(route, from, to).map(stop => stop.townId));
  return getServiceStops(route).filter(stop => !stop.townId || towns.has(stop.townId)).map((stop, index, all) => ({
    label: stop.name,
    coord: { latitude: stop.lat, longitude: stop.lng },
    isOrigin: stop.townId ? stop.townId === from : index === 0,
    isDestination: stop.townId ? stop.townId === to : index === all.length - 1,
  }));
}

export function getTerminalMapStops(route?: RouteDef | null, fromId?: string, toId?: string) {
  if (!route) return [];
  const from = fromId || route.originId, to = toId || route.destinationId;
  return Object.entries(route.terminalPoints || {}).flatMap(([townId, terminal]) => townId === from || townId === to ? [{
    label: terminal.name,
    coord: { latitude: terminal.latitude, longitude: terminal.longitude },
    isOrigin: townId === from,
    isDestination: townId === to,
  }] : []);
}

export function getRoadWaypoints(route?: RouteDef | null, fromId?: string, toId?: string, pickup?: { latitude: number; longitude: number }) {
  if (!route) return [];
  const segment = buildSegment(route, fromId, toId);
  return segment.flatMap((stop, index) => {
    const approach = route.roadApproaches?.[stop.townId];
    if (index === 0 && pickup) return [pickup, ...(index < segment.length - 1 ? approach?.after || [] : [])];
    const town = getRouteMapTown(route, stop.townId);
    if (town && approach) return [
      ...(index > 0 ? approach.before || [] : []),
      { latitude: town.lat, longitude: town.lng },
      ...(index < segment.length - 1 ? approach.after || [] : []),
    ];
    const via = route.roadViaOverrides?.[stop.townId];
    if (index > 0 && index < segment.length - 1 && via) return [via];
    return town ? [{ latitude: town.lat, longitude: town.lng }] : [];
  });
}

export interface ReachableStop {
  townId: string;
  name: string;
  minutes: number;
  isTerminus: boolean;
}

export function getRouteStops(route: RouteDef, fromId: string): ReachableStop[] {
 const fromIndex = route.stops.findIndex(s => s.townId === fromId);
 if (fromIndex < 0) return [];
 const base = route.stops[fromIndex].minutes;
 return route.stops.slice(fromIndex + 1).map((s, i, a) => ({ townId: s.townId, name: getTownName(s.townId), minutes: s.minutes - base, isTerminus: i === a.length - 1 }));
}
export interface DestinationOption extends ReachableStop { isOutside?: boolean; }
export function getDestinationOptions(route: RouteDef, fromId: string): DestinationOption[] {
 return getRouteStops(route, fromId).map(s => ({ ...s, isOutside: getTown(s.townId)?.outside }));
}

export function fareForMinutes(type: 'jeep' | 'bus', minutes: number): number {
  const base = type === 'bus' ? 25 : 12;
  const km = (minutes / 60) * (type === 'bus' ? 45 : 30);
  return Math.round(base + km * (type === 'bus' ? 1.6 : 1.2));
}

export interface SegmentStop {
  townId: string;
  name: string;
  minutes: number;
  isOutside?: boolean;
}

export function buildSegment(route: RouteDef, fromId?: string, toId?: string): SegmentStop[] {
 const from = route.stops.findIndex(s => s.townId === (fromId || route.originId));
 const to = route.stops.findIndex(s => s.townId === (toId || route.destinationId));
 if (from < 0 || to <= from) return [];
 const base = route.stops[from].minutes;
 return route.stops.slice(from, to + 1).map(s => ({ townId: s.townId, name: getTownName(s.townId), minutes: s.minutes - base, isOutside: getTown(s.townId)?.outside }));
}

export function toVehicleType(type: 'jeep' | 'bus'): VehicleType {
  return type === 'bus' ? 'bus' : 'jeepney';
}

export function formatArrival(base: Date, addMin: number): string {
  const d = new Date(base.getTime() + addMin * 60000);
  let h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${m.toString().padStart(2, '0')} ${ampm}`;
}

export function totalDuration(route: RouteDef): number {
  return route.stops[route.stops.length - 1]?.minutes || 0;
}

export function estimateFare(route: RouteDef): number {
  const base = route.type === 'bus' ? 25 : 12;
  const km = (totalDuration(route) / 60) * (route.type === 'bus' ? 45 : 30);
  return Math.round(base + km * (route.type === 'bus' ? 1.6 : 1.2));
}
