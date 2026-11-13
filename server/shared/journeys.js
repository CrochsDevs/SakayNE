import { routes, towns, tripQuote } from './transit.js';
import { requireValue } from './errors.js';

// Match ordered stops, never geographic proximity alone. Catalog durations are estimates.
export function matchJourneys({ fromId, toId, seats = 1, type }) {
  requireValue(typeof fromId === 'string' && towns.some(t => t.id === fromId), 'Choose a known pickup');
  requireValue(typeof toId === 'string' && towns.some(t => t.id === toId) && fromId !== toId, 'Choose a different known destination');
  requireValue(Number.isInteger(seats) && seats >= 1 && seats <= 10, 'Reserve 1 to 10 seats');
  requireValue(type === undefined || ['bus', 'jeep'].includes(type), 'Invalid vehicle type');
  return routes.filter(route => {
    const from = route.stops.findIndex(s => s.townId === fromId);
    return (!type || route.type === type) && from >= 0 && route.stops.findIndex(s => s.townId === toId) > from;
  }).map(route => {
    const { minutes, unitFare, fare, fromName, toName } = tripQuote(route.id, fromId, toId, seats);
    return { routeId: route.id, label: route.label, type: route.type, fromId, toId, fromName, toName, seats, minutes, unitFare, fare, estimated: true };
  }).sort((a, b) => a.minutes - b.minutes || a.fare - b.fare || a.routeId.localeCompare(b.routeId));
}
