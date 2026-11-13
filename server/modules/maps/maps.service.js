import { HttpError, requireValue } from '../../shared/errors.js';
import { towns, validLocation } from '../../shared/transit.js';
import { findPickupArea } from '../../../client/src/data/pickup-area.mjs';

export function parseCoordinates(value) {
  requireValue(typeof value === 'string' && value.length <= 1600, 'Provide valid route coordinates');
  const points = value.split(';').map(pair => {
    const parts = pair.split(',');
    requireValue(parts.length === 2 && parts.every(part => part.trim() !== ''), 'Invalid route coordinate');
    const point = { longitude: Number(parts[0]), latitude: Number(parts[1]) };
    requireValue(validLocation(point), 'Invalid route coordinate');
    return [Number(point.longitude.toFixed(5)), Number(point.latitude.toFixed(5))];
  });
  requireValue(points.length >= 2 && points.length <= 25, 'Choose 2 to 25 route points');
  return points;
}

export function createMapServices({ fetchImpl = fetch, now = Date.now, intervalMs = 1100, timeoutMs = 8000,
  osrmUrl, photonUrl } = {}) {
  const cache = new Map(), inflight = new Map();
  const nextRequest = { osrm: 0, photon: 0 };
  const remember = (key, value, ttl) => {
    if (cache.size >= 256) cache.delete(cache.keys().next().value);
    cache.set(key, { value, expires: now() + ttl });
    return value;
  };
  async function cached(key, ttl, loader) {
    const entry = cache.get(key);
    if (entry && entry.expires > now()) return entry.value;
    if (inflight.has(key)) return inflight.get(key);
    const pending = loader().then(value => remember(key, value, ttl)).finally(() => inflight.delete(key));
    inflight.set(key, pending);
    return pending;
  }
  async function provider(name, url) {
    const wait = Math.max(0, nextRequest[name] - now());
    requireValue(wait <= 4000, 'Map service is busy. Please retry shortly.', 503);
    nextRequest[name] = now() + wait + intervalMs;
    if (wait) await new Promise(resolve => setTimeout(resolve, wait));
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(url.toString(), { signal: controller.signal, headers: {
        'User-Agent': 'Sakay/1.0 (open-source transit planning)', Accept: 'application/json',
        ...(process.env.MAP_APP_REFERER ? { Referer: process.env.MAP_APP_REFERER } : {}),
      } });
      if (!response.ok) throw new Error('Upstream service unavailable');
      return await response.json();
    } catch { throw new HttpError(503, 'Map service is temporarily unavailable'); }
    finally { clearTimeout(timeout); }
  }
  function normalizePlace(feature) {
    const coords = feature?.geometry?.coordinates;
    if (feature?.geometry?.type !== 'Point' || !Array.isArray(coords) || !validLocation({ longitude: coords[0], latitude: coords[1] })) return null;
    const properties = feature.properties || {};
    const names = [properties.name, [properties.housenumber, properties.street].filter(Boolean).join(' '), properties.city || properties.town || properties.village, properties.state, properties.country];
    const label = [...new Set(names.filter(value => typeof value === 'string' && value.trim()).map(value => value.trim()))].join(', ').slice(0, 500);
    if (!label) return null;
    const position = { longitude: coords[0], latitude: coords[1] };
    const stop = findPickupArea(position, towns);
    return { id: String(properties.osm_type || '') + ':' + String(properties.osm_id || coords.join(',')), label, ...position, stopId: stop?.id || null, stopName: stop?.name || null };
  }
  return {
    async route(coordinates) {
      const points = parseCoordinates(coordinates);
      const key = 'route:' + points.map(point => point.join(',')).join(';');
      return cached(key, 3600000, async () => {
        const url = new URL((osrmUrl || process.env.OSRM_URL || 'https://routing.openstreetmap.de/routed-car').replace(/\/$/, '') + '/route/v1/driving/' + points.map(point => point.join(',')).join(';'));
        url.search = new URLSearchParams({ overview: 'full', geometries: 'geojson', steps: 'false', alternatives: 'false', generate_hints: 'false' }).toString();
        const data = await provider('osrm', url);
        const route = data?.routes?.[0];
        requireValue(data?.code === 'Ok' && route?.geometry?.type === 'LineString' && Array.isArray(route.geometry.coordinates)
          && route.geometry.coordinates.length >= 2 && route.geometry.coordinates.length <= 50000
          && route.geometry.coordinates.every(coord => Array.isArray(coord) && validLocation({ longitude: coord[0], latitude: coord[1] }))
          && Number.isFinite(route.duration) && route.duration >= 0 && Number.isFinite(route.distance) && route.distance >= 0,
        'No road route is available for these points', 503);
        return { coordinates: route.geometry.coordinates.map(coord => coord.slice(0, 2)), durationMin: route.duration / 60, distanceKm: route.distance / 1000, source: 'OSRM', trafficAware: false };
      });
    },
    async search(query) {
      requireValue(typeof query === 'string' && query.trim().length >= 3 && query.trim().length <= 120, 'Enter 3 to 120 characters');
      const text = query.trim();
      return cached('search:' + text.toLowerCase(), 300000, async () => {
        const url = new URL((photonUrl || process.env.PHOTON_URL || 'https://photon.komoot.io').replace(/\/$/, '') + '/api/');
        url.search = new URLSearchParams({ q: text, limit: '6', countrycode: 'PH', bbox: '116,4,127,22', lat: '15.5781', lon: '120.9756', lang: 'en' }).toString();
        const data = await provider('photon', url);
        requireValue(Array.isArray(data?.features), 'Place search is unavailable', 503);
        return data.features.slice(0, 6).map(normalizePlace).filter(Boolean);
      });
    },
    async reverse(latitude, longitude) {
      requireValue(validLocation({ latitude, longitude }), 'Invalid location');
      const lat = Number(latitude.toFixed(5)), lng = Number(longitude.toFixed(5));
      return cached('reverse:' + lat + ',' + lng, 300000, async () => {
        const url = new URL((photonUrl || process.env.PHOTON_URL || 'https://photon.komoot.io').replace(/\/$/, '') + '/reverse');
        url.search = new URLSearchParams({ lat: String(lat), lon: String(lng), limit: '1', lang: 'en' }).toString();
        const data = await provider('photon', url);
        requireValue(Array.isArray(data?.features), 'Place lookup is unavailable', 503);
        return normalizePlace(data.features[0]);
      });
    },
  };
}

export const mapServices = createMapServices();
