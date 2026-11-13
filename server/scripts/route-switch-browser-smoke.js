import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium, expect } from '@playwright/test';

// Run against Metro. All API calls use isolated fixtures, never application data.
const webBase = process.env.BROWSER_WEB_URL || 'http://localhost:8081';
const artifacts = fileURLToPath(new URL('../../artifacts', import.meta.url));
const catalog = JSON.parse(readFileSync(new URL('../../client/src/data/transit.json', import.meta.url), 'utf8'));
mkdirSync(artifacts, { recursive: true });
const edge = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const browser = await chromium.launch({ ...(existsSync(edge) ? { executablePath: edge } : {}), headless: true, args: ['--enable-unsafe-swiftshader'] });
try {
  const user = { id: 'route-switch-fixture', role: 'driver', fullName: 'Route Switch Fixture', verified: true, approvalStatus: 'approved' };
  const driver = { ...user, vehicleType: 'jeepney', plateNo: 'TEST123', routeId: 'jeep-cabanatuan-san-jose', capacity: 16, reservedSeats: 0, isAvailable: true, availableSeats: 16, location: null };
  let active = false, rejectNext = false;
  const writes = [];
  const context = await browser.newContext({ viewport: { width: 393, height: 852 }, reducedMotion: 'reduce', permissions: ['geolocation'], geolocation: { latitude: 15.6, longitude: 120.92, accuracy: 5 } });
  await context.addInitScript(user => {
    if (window.top !== window) return;
    localStorage.setItem('@sakayne_auth', JSON.stringify(user));
    localStorage.setItem('@sakayne_token', 'fixture');
    localStorage.setItem('@sakayne_theme', 'light');
    localStorage.setItem('@sakayne_language', 'en');
  }, user);
  await context.route('**/api/**', async request => {
    const url = new URL(request.request().url()); let result = {};
    if (url.pathname.endsWith('/auth/me')) result = { user };
    else if (url.pathname.endsWith('/drivers/me')) result = { driver };
    else if (url.pathname.endsWith('/drivers/availability')) {
      const body = request.request().postDataJSON(); writes.push(body);
      if (active || rejectNext) {
        rejectNext = false;
        return request.fulfill({ status: 409, json: { error: 'Finish existing bookings before changing route or capacity' } });
      }
      Object.assign(driver, body); result = { driver };
    } else if (url.pathname.endsWith('/rides')) result = { rides: active ? [{ id: 'ongoing-fixture', status: 'ongoing', routeId: driver.routeId, createdAt: Date.now() }] : [] };
    else if (url.pathname.endsWith('/maps/route')) {
      // Test-only geometry isolates UI state changes from external routing availability.
      result = { route: { coordinates: url.searchParams.get('coordinates').split(';').map(pair => pair.split(',').map(Number)), durationMin: 60, distanceKm: 45, source: 'OSRM', trafficAware: false } };
    }
    await request.fulfill({ json: result });
  });
  const page = await context.newPage(), errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const south = 'San Jose City → Cabanatuan City', north = 'Cabanatuan City → San Jose City';
  const direction = name => page.getByRole('button', { name, exact: true });
  const ready = async () => expect.poll(async () => {
    const frame = page.frames().find(frame => frame.parentFrame());
    const details = catalog.routes.find(route => route.id === driver.routeId)?.mapDetailsEnabled === true;
    return frame?.evaluate(details => typeof map !== 'undefined' && styleReady && map.loaded()
      && (details ? roadRoute !== null : roadRoute === null && servicePath.length === 0 && document.querySelectorAll('.stop-marker').length === 0), details).catch(() => false);
  }, { timeout: 45000 }).toBe(true);
  const open = async () => {
    await page.getByRole('button', { name: 'Route and vehicle capacity', exact: true }).click();
    await expect(page.getByText('Route & capacity', { exact: true })).toBeVisible();
  };
  const close = async () => {
    await page.getByRole('button', { name: 'Done', exact: true }).click();
    await expect(page.getByText('Route & capacity', { exact: true })).toHaveCount(0);
    await expect.poll(() => page.evaluate(() => {
      const frame = document.querySelector('iframe'), rect = frame?.getBoundingClientRect();
      return rect && document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2) === frame;
    })).toBe(true);
  };
  await page.goto(webBase + '/(driver)', { waitUntil: 'domcontentloaded', timeout: 300000 });
  await ready(); await open();
  await expect(direction(north)).toHaveCSS('border-color', 'rgb(8, 127, 140)');
  await expect(direction(south)).toBeEnabled();
  await direction(south).click();
  await expect(direction(south)).toHaveCSS('border-color', 'rgb(8, 127, 140)');
  assert.equal(driver.routeId, 'jeep-san-jose-cabanatuan');
  assert.equal(driver.isAvailable, true);
  assert.equal(writes.length, 1);
  await close(); await ready();
  const frame = page.frames().find(frame => frame.parentFrame());
  const scheme = await frame.evaluate(() => getComputedStyle(document.documentElement).colorScheme);
  assert.deepEqual(new Set(scheme.split(/\s+/)), new Set(['only', 'light']));
  assert.equal(await page.locator('iframe').evaluate(element => getComputedStyle(element).opacity), '1');
  await page.screenshot({ path: artifacts + '/route-switch-online.png' });

  await page.reload({ waitUntil: 'domcontentloaded' }); await ready(); await open();
  await expect(direction(south)).toHaveCSS('border-color', 'rgb(8, 127, 140)');
  await direction(north).click();
  await expect(direction(north)).toHaveCSS('border-color', 'rgb(8, 127, 140)');
  assert.equal(driver.routeId, 'jeep-cabanatuan-san-jose');
  assert.equal(writes.length, 2);
  await close(); await ready();
  const northFrame = page.frames().find(frame => frame.parentFrame());
  const endpoint = await northFrame.evaluate(() => roadRoute.coordinates.at(-1));
  assert.ok(Math.abs(endpoint[0] - 120.9940545) < 0.0001 && Math.abs(endpoint[1] - 15.7972918) < 0.0001);

  await open(); rejectNext = true; await direction(south).click();
  await expect(direction(south)).toBeEnabled();
  await expect(direction(north)).toHaveCSS('border-color', 'rgb(8, 127, 140)');
  assert.equal(driver.routeId, 'jeep-cabanatuan-san-jose');
  await close();
  active = true;
  await page.reload({ waitUntil: 'domcontentloaded' }); await ready(); await open();
  await expect(direction(south)).toBeDisabled();
  await expect(direction(north)).toHaveCSS('border-color', 'rgb(8, 127, 140)');
  assert.equal(writes.length, 3);
  await close();
  active = false;
  await page.reload({ waitUntil: 'domcontentloaded' }); await ready();
  await open(); await direction('Cabanatuan City → Palayan City').click();
  await expect(direction('Cabanatuan City → Palayan City')).toHaveCSS('border-color', 'rgb(8, 127, 140)');
  await close(); await ready();
  for (const [label, routeId, endpoint] of [
    ['Cabanatuan City → Guimba', 'jeep-cabanatuan-guimba', [120.764845, 15.659691]],
    ['Guimba → Cabanatuan City', 'jeep-guimba-cabanatuan', [120.9692117, 15.4724483]],
  ]) {
    await open(); await direction(label).click();
    await expect(direction(label)).toHaveCSS('border-color', 'rgb(8, 127, 140)');
    assert.equal(driver.routeId, routeId);
    await close(); await ready();
    const frame = page.frames().find(frame => frame.parentFrame());
    const displayed = await frame.evaluate(() => ({ endpoint: roadRoute.coordinates.at(-1), markers: document.querySelectorAll('.stop-marker').length }));
    assert.equal(displayed.markers, 4);
    assert.ok(Math.abs(displayed.endpoint[0] - endpoint[0]) < 0.0001 && Math.abs(displayed.endpoint[1] - endpoint[1]) < 0.0001);
  }
  assert.deepEqual(errors, []);
  console.log('PASS: online switching, persistence, configured routes visible, other routes cleared, Guimba endpoints, failed-switch recovery, booking lock and no leftover backdrop');
} finally { await browser.close(); }
