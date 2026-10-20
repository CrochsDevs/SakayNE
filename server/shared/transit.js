import { readFileSync } from 'node:fs';
import { requireValue } from './errors.js';

// One catalog for the API and Expo app. Times and fares are planning estimates.
export const { towns, routes } = JSON.parse(readFileSync(new URL('../../client/src/data/transit.json', import.meta.url), 'utf8'));
export const activeStatuses = ['pending', 'accepted', 'arrived', 'ongoing'];
export function tripQuote(routeId, fromId, toId, seats = 1) {
  const route = routes.find(r => r.id === routeId);
  requireValue(route, 'Route not found');
  const from = route.stops.findIndex(s => s.townId === fromId);
  const to = route.stops.findIndex(s => s.townId === toId);
  requireValue(from >= 0 && to > from, 'Choose a pickup and a later stop on this route');
  requireValue(Number.isInteger(seats) && seats >= 1 && seats <= 10, 'Reserve 1 to 10 seats');
  const minutes = route.stops[to].minutes - route.stops[from].minutes;
  const base = route.type === 'bus' ? 25 : 12;
  const km = minutes / 60 * (route.type === 'bus' ? 45 : 30);
  const unitFare = Math.round(base + km * (route.type === 'bus' ? 1.6 : 1.2));
  return { route, minutes, unitFare, fare: unitFare * seats,
    fromName: towns.find(t => t.id === fromId).name, toName: towns.find(t => t.id === toId).name };
}
export function canTransition(role, from, to) {
  if (role === 'passenger') return ['pending', 'accepted', 'arrived'].includes(from) && to === 'cancelled';
  if (role !== 'driver') return false;
  return ({ pending: ['accepted', 'cancelled'], accepted: ['arrived', 'cancelled'], arrived: ['ongoing', 'cancelled'], ongoing: ['completed'] })[from]?.includes(to) || false;
}
export function validLocation(location) {
  return location && Number.isFinite(location.latitude) && Math.abs(location.latitude) <= 90
    && Number.isFinite(location.longitude) && Math.abs(location.longitude) <= 180;
}
