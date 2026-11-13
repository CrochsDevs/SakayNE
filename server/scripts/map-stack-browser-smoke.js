import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { chromium, expect } from '@playwright/test';

const dist = fileURLToPath(new URL('../../client/dist', import.meta.url));
const artifacts = fileURLToPath(new URL('../../artifacts', import.meta.url));
assert.ok(existsSync(dist + '/index.html'), 'Run npm --prefix client run build:web first');
mkdirSync(artifacts, { recursive: true });
const app = express(); app.use(express.static(dist, { extensions: ['html'] }));
const server = app.listen(0, '127.0.0.1');
await new Promise(resolve => server.once('listening', resolve));
const base = 'http://127.0.0.1:' + server.address().port;
const edge = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const browser = await chromium.launch({ ...(existsSync(edge) ? { executablePath: edge } : {}), headless: true, args: ['--enable-unsafe-swiftshader'] });
const routeId = 'jeep-san-jose-cabanatuan';
const user = { id: 'driver-fixture', role: 'driver', fullName: 'Angelo Castro', verified: true, approvalStatus: 'approved' };
const profile = { ...user, vehicleType: 'jeepney', plateNo: 'ABC 123', routeId, capacity: 16, isAvailable: true, availableSeats: 16, location: { latitude: 15.7161, longitude: 120.9025, accuracy: 8, updatedAt: new Date().toISOString() } };
const vehicle = { id: user.id, name: user.fullName, vehicle: profile.plateNo, type: 'jeep', routeId, seats: 16, rating: 'New', etaMin: null };
const road = coordinates => ({ coordinates, durationMin: 30, distanceKm: 17, source: 'OSRM', trafficAware: false });
const place = { id: 'fixture-place', label: 'Central Luzon State University, Science City of Muñoz', latitude: 15.7161, longitude: 120.9025, stopId: 'munoz', stopName: 'Science City of Muñoz' };
const seed = async (context, theme, lang, account) => context.addInitScript(({ theme, lang, account }) => {
  if (window.top !== window) return;
  localStorage.setItem('@sakayne_auth', JSON.stringify(account)); localStorage.setItem('@sakayne_token', 'fixture-only');
  localStorage.setItem('@sakayne_theme', theme); localStorage.setItem('@sakayne_language', lang);
}, { theme, lang, account });

try {
  for (const [theme, lang] of [['light', 'en'], ['dark', 'fil']]) {
    const translations = JSON.parse(readFileSync(new URL('../../client/src/i18n/locales/' + lang + '.json', import.meta.url), 'utf8')).ui;
    const t = key => translations[key] || key;
    let rides = [], routeCalls = 0;
    const context = await browser.newContext({ viewport: { width: 393, height: 852 }, permissions: ['geolocation'], geolocation: { latitude: 15.7161, longitude: 120.9025, accuracy: 8 } });
    await seed(context, theme, lang, user);
    await context.route('**/api/**', async request => {
      const req = request.request(), url = new URL(req.url()), path = url.pathname;
      let result = {};
      if (path.endsWith('/auth/me')) result = { user };
      else if (path.endsWith('/drivers/me')) result = { driver: profile };
      else if (path.endsWith('/rides')) result = { rides };
      else if (path.endsWith('/maps/route')) { routeCalls++; result = { route: road(url.searchParams.get('coordinates').split(';').map(pair => pair.split(',').map(Number))) }; }
      else if (path.endsWith('/status')) { const status = req.postDataJSON().status; rides = rides.map(ride => ({ ...ride, status })); result = { ride: rides[0] }; }
      await request.fulfill({ json: result });
    });
    const page = await context.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(base + '/(driver)');
    let frame = page.frameLocator('iframe');
    await frame.locator('#map[data-map-ready="true"]').waitFor({ timeout: 45000 });
    await expect.poll(() => frame.locator('#map').evaluate(() => map.loaded()), { timeout: 45000 }).toBe(true);
    await expect(frame.locator('#route-note')).toHaveText(t('Road route preview') + ' · OSRM');
    await expect(frame.locator('.car')).toBeVisible();
    assert.equal(routeCalls, 1);
    assert.ok(!(await page.locator('iframe').getAttribute('sandbox')).includes('allow-same-origin'));
    await page.screenshot({ path: artifacts + '/map-stack-driver-' + theme + '.png' });
    profile.location = { ...profile.location, latitude: 15.7163, updatedAt: new Date().toISOString() };
    await expect.poll(async () => await page.frames().find(child => child.parentFrame())?.evaluate(() => car?.getLngLat().lat), { timeout: 10000 }).toBe(15.7163);
    assert.equal(routeCalls, 1, 'GPS movement must not trigger rerouting');
    rides = [{ id: 'ride-fixture', routeId, driverId: user.id, driverName: user.fullName, passengerName: 'Lester Rodriguez', vehicle: profile.plateNo, type: 'jeep', fromId: 'munoz', toId: 'talavera', fromName: 'Science City of Muñoz', toName: 'Talavera', seats: 2, minutes: 30, status: 'pending', createdAt: Date.now(), pickupLocation: { latitude: 15.7161, longitude: 120.9025, accuracy: 8, capturedAt: new Date().toISOString() } }];
    await expect(page.getByTestId('incoming-booking-sheet')).toBeVisible({ timeout: 7000 });
    frame = page.frameLocator('iframe');
    await frame.locator('#map[data-map-ready="true"]').waitFor({ timeout: 45000 });
    await page.getByRole('button', { name: t('Accept booking'), exact: true }).click();
    await expect(page.getByTestId('incoming-booking-sheet')).toHaveCount(0);
    await expect(page.getByRole('button', { name: t('View active trips'), exact: true })).toBeVisible();
    assert.equal(rides[0].status, 'accepted');
    assert.equal(routeCalls, 1, 'Fullscreen/remount and incoming requests reuse the route cache');
    assert.deepEqual(errors, []);
    await context.close();
    console.log('PASS: embedded ' + theme + ' MapLibre, authenticated OSRM bridge, GPS cache, sandbox and booking popup');
  }

  const context = await browser.newContext({ viewport: { width: 393, height: 852 }, permissions: ['geolocation'], geolocation: { latitude: 15.7161, longitude: 120.9025, accuracy: 8 } });
  await seed(context, 'light', 'en', { id: 'passenger-fixture', role: 'passenger', fullName: 'Lester Rodriguez', verified: true });
  let searchCalls = 0, failSearch = false;
  await context.route('**/api/**', async request => {
    const url = new URL(request.request().url()), path = url.pathname;
    let result = {};
    if (path.endsWith('/maps/search')) { searchCalls++; if (failSearch) return request.fulfill({ status: 503, json: { error: 'Search unavailable' } }); result = { places: [place] }; }
    else if (path.endsWith('/maps/reverse')) result = { place };
    else if (path.endsWith('/auth/me')) result = { user: { role: 'passenger', verified: true } };
    else if (path.endsWith('/drivers')) result = { drivers: [vehicle] };
    else if (path.endsWith('/rides/active')) result = { ride: null };
    else if (path.includes('notifications')) result = { notifications: [] };
    await request.fulfill({ json: result });
  });
  const page = await context.newPage();
  await page.goto(base + '/journey-search');
  await page.getByRole('button', { name: 'Pickup: Choose a stop', exact: true }).click();
  await page.getByRole('textbox', { name: 'Search stops', exact: true }).fill('Uni');
  await page.getByRole('textbox', { name: 'Search stops', exact: true }).fill('University');
  await expect(page.getByRole('button', { name: 'Select Science City of Muñoz stop', exact: true })).toBeVisible();
  assert.equal(searchCalls, 1, 'Autocomplete is debounced');
  await page.screenshot({ path: artifacts + '/photon-stop-search.png' });
  await page.getByRole('button', { name: 'Select Science City of Muñoz stop', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Pickup: Science City of Muñoz', exact: true })).toBeVisible();
  failSearch = true;
  await page.getByRole('button', { name: 'Pickup: Science City of Muñoz', exact: true }).click();
  await page.getByRole('textbox', { name: 'Search stops', exact: true }).fill('Talavera');
  await expect(page.getByText('Place search is unavailable. You can still choose a listed stop.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Talavera', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Pickup: Talavera', exact: true })).toBeVisible();
  await page.goto(base + '/home');
  await page.getByRole('button', { name: 'Book jeepney with Angelo Castro', exact: true }).click();
  await expect(page.getByText('Detected location: ' + place.label, { exact: true })).toBeVisible();
  await expect(page.getByText('Pickup area: Science City of Muñoz', { exact: true })).toBeVisible();
  await context.close();
  console.log('PASS: Photon autocomplete, supported-stop selection, local fallback and pickup address lookup');
} finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
