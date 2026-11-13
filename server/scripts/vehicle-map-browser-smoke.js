import assert from 'node:assert/strict';
import { existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { chromium, expect } from '@playwright/test';
import { isServiceAvailable } from '../../client/src/data/service-availability.mjs';

// Isolated API fixtures; never connects to the application database.
const dist = fileURLToPath(new URL('../../client/dist', import.meta.url));
const artifacts = fileURLToPath(new URL('../../artifacts', import.meta.url));
mkdirSync(artifacts, { recursive: true });
const app = express(); app.use(express.static(dist, { extensions: ['html'] }));
const server = app.listen(0, '127.0.0.1');
await new Promise(resolve => server.once('listening', resolve));
const edge = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
let browser;
try {
  browser = await chromium.launch({ ...(existsSync(edge) ? { executablePath: edge } : {}), headless: true, args: ['--enable-unsafe-swiftshader'] });
  for (const type of ['jeep', 'bus']) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce', permissions: ['geolocation'], geolocation: { latitude: 15.65, longitude: 120.82, accuracy: 5 } });
    const user = { id: 'passenger', role: 'passenger', fullName: 'Test Passenger', email: 'test@example.test' };
    await context.addInitScript(user => {
      if (window.top !== window) return;
      localStorage.setItem('@sakayne_auth', JSON.stringify(user));
      localStorage.setItem('@sakayne_token', 'fixture');
      localStorage.setItem('@sakayne_language', 'en');
    }, user);
    const driver = { id: 'test-driver', type, name: 'Test Driver', vehicle: 'TEST123', seats: 0, rating: 'New', etaMin: null,
      routeId: type === 'bus' ? 'bus-cabanatuan-manila' : 'jeep-cabanatuan-palayan', location: null };
    let online = true, fail = false;
    await context.route('**/api/**', async request => {
      const url = new URL(request.request().url());
      let result = {};
      if (url.pathname.endsWith('/auth/me')) result = { user };
      else if (url.pathname.endsWith('/drivers')) {
        if (fail) return request.fulfill({ status: 503, json: { error: 'Fixture offline' } });
        result = { drivers: online ? [driver] : [] };
      } else if (url.pathname.endsWith('/rides/active')) result = { ride: null };
      else if (url.pathname.endsWith('/notifications')) result = { notifications: [] };
      else if (url.pathname.endsWith('/maps/route')) result = { route: null };
      await request.fulfill({ json: result });
    });
    const page = await context.newPage(), errors = [], warnings = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (/deprecated|Content Security Policy|escape its sandboxing|could not be loaded|Expected value to be of type number/.test(message.text())) warnings.push(message.text()); });
    const webBase = process.argv.includes('--dev') ? 'http://localhost:8081' : `http://127.0.0.1:${server.address().port}`;
    const response = await page.goto(`${webBase}/home`, { timeout: 300000, waitUntil: 'domcontentloaded' });
    assert.ok(!response.headers()['content-security-policy']?.includes("script-src 'none'"));
    assert.equal(await page.locator('meta[http-equiv="Content-Security-Policy"][content*="script-src \'none\'"]').count(), 0);
    if (!isServiceAvailable(type)) {
      await expect(page.getByRole('button', { name: 'View on map: Test Driver', exact: true })).toHaveCount(0);
      await page.getByRole('button', { name: 'Bus, coming soon', exact: true }).click();
      await expect(page.getByText('Bus service', { exact: true })).toBeVisible();
      await expect(page.getByText('Coming soon', { exact: true }).last()).toBeVisible();
      assert.deepEqual(errors, []); assert.deepEqual(warnings, []);
      await context.close(); continue;
    }
    await expect(page.getByRole('button', { name: 'This vehicle is full', exact: true })).toBeDisabled();
    await page.getByRole('button', { name: 'View on map: Test Driver', exact: true }).click();
    await expect(page.getByText('Waiting for driver GPS.', { exact: true })).toBeVisible();
    const map = page.frameLocator('iframe');
    assert.ok(!(await page.locator('iframe').getAttribute('sandbox')).includes('allow-same-origin'), 'Map iframe does not combine script and same-origin permissions');
    await map.locator('#map[data-map-ready="true"]').waitFor({ timeout: 45000 });
    await expect(map.locator('.user-location')).toBeVisible({ timeout: 15000 });
    await expect(map.locator('.car')).toHaveCount(0);
    // Driver is outside the displayed catalog route, as happens before reaching
    // its first stop. A marker in the DOM alone does not mean it is on screen.
    const position = latitude => ({ latitude, longitude: 120.815939, accuracy: 4, capturedAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    const centered = async () => expect.poll(async () => {
      const frame = page.frames().find(frame => frame.parentFrame());
      return frame?.evaluate(() => !!car && map.getBounds().contains(car.getLngLat()) && Math.abs(map.getCenter().lng - car.getLngLat().lng) < 0.0001);
    }, { timeout: 15000 }).toBe(true);
    const bothVisible = async () => expect.poll(async () => {
      const frame = page.frames().find(frame => frame.parentFrame());
      return frame?.evaluate(() => !!car && !!userMarker && map.getBounds().contains(car.getLngLat()) && map.getBounds().contains(userMarker.getLngLat()));
    }, { timeout: 15000 }).toBe(true);
    driver.location = position(15.487);
    await expect(page.getByText('Driver GPS updated', { exact: false })).toBeVisible({ timeout: 15000 });
    await expect(map.locator('.car')).toBeVisible();
    await bothVisible();
    const frame = page.frames().find(frame => frame.parentFrame());
    await frame.evaluate(() => window.dispatchEvent(new MessageEvent('message', { source: window.parent, data: { type: 'setRoadRoute', value: { coordinates: [[120.9734, 15.4868], [121.0853, 15.5414]], durationMin: 25, distanceKm: 17 }, status: 'ready' } })));
    await bothVisible();
    assert.ok(await frame.evaluate(() => routeDetailsEnabled === false && roadRoute === null && servicePath.length === 0 && stops.length === 0), 'Unconfigured routes retain GPS markers and reject route lines and stop pins');
    await frame.evaluate(() => { map.fire('dragstart'); map.jumpTo({ center: [121.5, 16.5] }); });
    await page.getByRole('button', { name: 'Center on driver', exact: true }).click();
    await centered();
    driver.location = position(15.49);
    await expect.poll(async () => {
      const frame = page.frames().find(frame => frame.parentFrame());
      return frame?.evaluate(() => car?.getLngLat().lat);
    }, { timeout: 15000 }).toBe(15.49);
    await expect(map.locator(`.car svg[data-vehicle-type="${type}"]`)).toBeVisible();
    assert.equal(await map.locator('.vehicle-shell').evaluate(el => getComputedStyle(el).transform), 'none', 'Vehicle icon remains upright while its heading changes');
    await page.getByRole('button', { name: 'Show both locations', exact: true }).click();
    await bothVisible();
    await page.getByRole('button', { name: 'Open map in full screen', exact: true }).click();
    await expect(map.locator('.car')).toBeVisible({ timeout: 45000 });
    await expect(map.locator('.user-location')).toBeVisible();
    await bothVisible();
    await page.getByRole('button', { name: 'Exit full screen map', exact: true }).click();
    await expect(map.locator('.car')).toBeVisible({ timeout: 45000 });
    driver.location = { ...position(15.49), capturedAt: new Date(Date.now() - 90000).toISOString(), updatedAt: new Date(Date.now() - 90000).toISOString() };
    await expect(page.getByText('Driver location is outdated. Waiting for a fresh GPS update.', { exact: true })).toBeVisible({ timeout: 15000 });
    fail = true;
    await expect(page.getByText('Unable to update vehicle location. Tap to retry.', { exact: true })).toBeVisible({ timeout: 15000 });
    await expect(map.locator('.car')).toHaveCount(0);
    fail = false; driver.location = position(15.491);
    await page.getByRole('button', { name: 'Try again', exact: true }).click();
    await expect(map.locator('.car')).toBeVisible({ timeout: 15000 });
    await page.screenshot({ path: `${artifacts}/${type}-vehicle-map.png` });
    online = false;
    await expect(page.getByText('This vehicle is no longer online. Location sharing has stopped.', { exact: true })).toBeVisible({ timeout: 15000 });
    await expect(map.locator('.car')).toHaveCount(0);
    assert.deepEqual(errors, []);
    assert.deepEqual(warnings, [], 'Application console warnings');
    // Permission denial leaves the driver map usable and offers an explicit
    // retry; it must never invent the passenger's position.
    online = true;
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'geolocation', { configurable: true, value: {
        getCurrentPosition: (success, error) => {
          if (window.fixtureLocationAllowed) success({ coords: { latitude: 15.65, longitude: 120.82, accuracy: 5 }, timestamp: Date.now() });
          else error({ code: 1 });
        },
      } });
    });
    await page.reload();
    await expect(page.getByText('Allow location access to show your location on the map.', { exact: false })).toBeVisible({ timeout: 15000 });
    await expect(map.locator('.car')).toBeVisible({ timeout: 45000 });
    await expect(map.locator('.user-location')).toHaveCount(0);
    await page.evaluate(() => { window.fixtureLocationAllowed = true; });
    await page.getByRole('button', { name: 'Retry my location', exact: true }).click();
    await expect(map.locator('.user-location')).toBeVisible({ timeout: 15000 });
    await page.getByRole('button', { name: 'Show both locations', exact: true }).click();
    await bothVisible();
    assert.deepEqual(errors, []);
    assert.deepEqual(warnings, []);
    await context.close();
  }
  console.log('PASS: jeepney GPS, permission retry, fullscreen, missing/stale GPS, connection recovery, offline marker removal, bus coming soon and clean browser console.');
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
}
