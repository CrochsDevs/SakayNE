import test from 'node:test';
import assert from 'node:assert/strict';
import { createMapServices, parseCoordinates } from '../modules/maps/maps.service.js';

const routePayload = { code: 'Ok', routes: [{ geometry: { type: 'LineString', coordinates: [[120.9734, 15.4868], [121.0853, 15.5414]] }, duration: 1800, distance: 13500 }] };
const feature = { geometry: { type: 'Point', coordinates: [120.9734, 15.4868] }, properties: { osm_type: 'N', osm_id: 1, name: 'Test terminal', city: 'Cabanatuan City', country: 'Philippines' } };
const response = value => ({ ok: true, json: async () => value });

test('routing validates longitude/latitude ordering and coordinate limits before contacting a provider', async () => {
  assert.deepEqual(parseCoordinates('120.9734,15.4868;121.0853,15.5414'), [[120.9734, 15.4868], [121.0853, 15.5414]]);
  let calls = 0;
  const services = createMapServices({ fetchImpl: async () => { calls++; return response(routePayload); }, intervalMs: 0 });
  for (const coords of [undefined, '', '120,15', '190,15;120,16', ',15;120,16', '120,NaN;120,16', Array(26).fill('120,15').join(';')]) await assert.rejects(services.route(coords), error => error.status === 400);
  assert.equal(calls, 0);
});

test('OSRM requests are deduplicated and cached with route geometry, duration and source attribution', async () => {
  const requests = [];
  const services = createMapServices({ osrmUrl: 'https://router.test/custom', intervalMs: 0, fetchImpl: async (url, options) => { requests.push({ url, options }); return response(routePayload); } });
  const [first, second] = await Promise.all([services.route('120.9734,15.4868;121.0853,15.5414'), services.route('120.9734,15.4868;121.0853,15.5414')]);
  await services.route('120.9734,15.4868;121.0853,15.5414');
  assert.equal(requests.length, 1);
  assert.deepEqual(first, second);
  assert.equal(first.durationMin, 30); assert.equal(first.distanceKm, 13.5); assert.equal(first.source, 'OSRM'); assert.equal(first.trafficAware, false);
  const url = new URL(requests[0].url);
  assert.equal(url.pathname, '/custom/route/v1/driving/120.9734,15.4868;121.0853,15.5414');
  assert.equal(url.searchParams.get('geometries'), 'geojson');
  assert.match(requests[0].options.headers['User-Agent'], /Sakay/);
});

test('routing failures and malformed geometry do not produce invented lines or cached successes', async () => {
  let calls = 0;
  const services = createMapServices({ intervalMs: 0, fetchImpl: async () => { calls++; return response(calls === 1 ? { code: 'NoRoute', routes: [] } : routePayload); } });
  await assert.rejects(services.route('120,15;121,16'), error => error.status === 503);
  assert.equal((await services.route('120,15;121,16')).source, 'OSRM');
  assert.equal(calls, 2);
  const invalid = createMapServices({ intervalMs: 0, fetchImpl: async () => response({ code: 'Ok', routes: [{ ...routePayload.routes[0], geometry: { type: 'LineString', coordinates: [[900, 15], [121, 16]] } }] }) });
  await assert.rejects(invalid.route('120,15;121,16'), error => error.status === 503);
});

test('provider requests time out and queue pressure is bounded', async () => {
  const timeout = createMapServices({ intervalMs: 0, timeoutMs: 10, fetchImpl: (_url, { signal }) => new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(new Error('aborted')))) });
  await assert.rejects(timeout.route('120,15;121,16'), error => error.status === 503);
  const limited = createMapServices({ now: () => 100, intervalMs: 5000, fetchImpl: async () => response(routePayload) });
  await limited.route('120,15;121,16');
  await assert.rejects(limited.route('120,15;122,16'), error => error.status === 503);
});

test('Photon search and reverse are cached and return labels mapped to known booking stops', async () => {
  const urls = [];
  const services = createMapServices({ photonUrl: 'https://photon.test', intervalMs: 0, fetchImpl: async url => { urls.push(new URL(url)); return response({ features: [feature, { geometry: { type: 'Point', coordinates: [999, 999] } }] }); } });
  const places = await services.search('Terminal');
  await services.search('terminal');
  assert.equal(places.length, 1); assert.equal(places[0].stopId, 'cabanatuan');
  assert.equal(places[0].label, 'Test terminal, Cabanatuan City, Philippines');
  assert.equal(urls.length, 1); assert.equal(urls[0].searchParams.get('countrycode'), 'PH');
  const place = await services.reverse(15.4868, 120.9734);
  await services.reverse(15.4868, 120.9734);
  assert.equal(urls.length, 2); assert.equal(place.id, 'N:1');
  await assert.rejects(services.search('a'), error => error.status === 400);
  await assert.rejects(services.reverse(95, 120), error => error.status === 400);
});
