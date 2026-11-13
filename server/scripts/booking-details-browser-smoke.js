import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { chromium, expect } from '@playwright/test';

const dist = fileURLToPath(new URL('../../client/dist', import.meta.url));
const artifacts = fileURLToPath(new URL('../../artifacts', import.meta.url));
mkdirSync(artifacts, { recursive: true });
const app = express(); app.use(express.static(dist, { extensions: ['html'] }));
const server = app.listen(0, '127.0.0.1');
await new Promise(resolve => server.once('listening', resolve));
const edge = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const browser = await chromium.launch({ ...(existsSync(edge) ? { executablePath: edge } : {}), headless: true, args: ['--enable-unsafe-swiftshader'] });
try {
  for (const [theme, lang, width] of [['light', 'en', 393], ['light', 'en', 320], ['dark', 'fil', 393]]) {
    const translations = JSON.parse(readFileSync(new URL('../../client/src/i18n/locales/' + lang + '.json', import.meta.url), 'utf8')).ui;
    const t = key => translations[key] || key;
    const user = { id: 'passenger-fixture', role: 'passenger', fullName: 'Lester Rodriguez', email: 'passenger@example.test', verified: true };
    let ride = { id: 'booking-fixture', routeId: 'jeep-san-jose-cabanatuan', driverId: 'driver-fixture', driverName: 'Angelo Castro', driverPhone: '09170000000', vehicle: 'ABC 123', type: 'jeep', fromId: 'munoz', toId: 'talavera', fromName: 'Science City of Muñoz', toName: 'Talavera', fare: 0, unitFare: 0, minutes: 30, seats: 2, boardingCode: '123456', status: 'accepted', createdAt: Date.now(), geoTrackingEnabled: true, occupancyStatus: 'waiting', geoDetection: { state: 'poor_accuracy', updatedAt: new Date().toISOString() }, driverLocation: { latitude: 15.7161, longitude: 120.9025, updatedAt: new Date().toISOString() } };
    let toggles = 0;
    const context = await browser.newContext({ viewport: { width, height: 852 }, hasTouch: true, isMobile: true, reducedMotion: 'reduce' });
    await context.addInitScript(({ user, theme, lang }) => {
      if (window.top !== window) return;
      localStorage.setItem('@sakayne_auth', JSON.stringify(user)); localStorage.setItem('@sakayne_token', 'fixture');
      localStorage.setItem('@sakayne_theme', theme); localStorage.setItem('@sakayne_language', lang);
    }, { user, theme, lang });
    await context.route('**/api/**', async request => {
      const req = request.request(), url = new URL(req.url()); let result = {};
      if (url.pathname.endsWith('/auth/me')) result = { user };
      else if (url.pathname.endsWith('/geolocation')) { toggles++; const enabled = req.postDataJSON().enabled; ride = { ...ride, geoTrackingEnabled: enabled, geoDetection: { state: enabled ? 'waiting_for_fresh_gps' : 'disabled', updatedAt: new Date().toISOString() } }; result = { ride }; }
      else if (url.pathname.endsWith('/status')) { ride = { ...ride, status: req.postDataJSON().status }; result = { ride }; }
      else if (url.pathname.endsWith('/rides/active') || url.pathname.endsWith('/rides/booking-fixture')) result = { ride };
      else if (url.pathname.endsWith('/maps/route')) result = { route: { coordinates: url.searchParams.get('coordinates').split(';').map(pair => pair.split(',').map(Number)), durationMin: 30, distanceKm: 17, source: 'OSRM', trafficAware: false } };
      await request.fulfill({ json: result });
    });
    const page = await context.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('http://127.0.0.1:' + server.address().port + '/ride-tracking?rideId=booking-fixture');
    await expect(page.getByTestId('booking-driver-card')).toBeVisible();
    await page.getByRole('button', { name: t('Cancel booking'), exact: true }).scrollIntoViewIfNeeded();
    await expect(page.getByRole('button', { name: t('Call driver'), exact: true })).toBeVisible();
    await expect(page.getByRole('switch', { name: t('Disable automatic seat detection'), exact: true })).toBeChecked();
    for (const id of ['booking-driver-card', 'booking-detection-card']) { const bounds = await page.getByTestId(id).boundingBox(); assert.ok(bounds && bounds.x >= 0 && bounds.x + bounds.width <= width, 'Cards fit the phone'); }
    await page.screenshot({ path: artifacts + '/booking-details-' + theme + '-' + width + '.png' });
    await page.getByRole('button', { name: t('How automatic detection works'), exact: true }).tap();
    await expect(page.getByText(t('Keep both apps open. The boarding code remains available when GPS is inaccurate.'), { exact: true })).toBeVisible();
    await page.getByRole('button', { name: t('How automatic detection works'), exact: true }).tap();
    await page.getByRole('switch', { name: t('Disable automatic seat detection'), exact: true }).tap();
    await expect(page.getByRole('switch', { name: t('Enable automatic seat detection'), exact: true })).not.toBeChecked();
    assert.equal(toggles, 1);
    await page.getByRole('switch', { name: t('Enable automatic seat detection'), exact: true }).tap();
    await expect(page.getByRole('switch', { name: t('Disable automatic seat detection'), exact: true })).toBeChecked();
    assert.equal(toggles, 2);
    await page.getByRole('button', { name: t('Cancel booking'), exact: true }).tap();
    await expect(page.getByTestId('booking-detection-card')).toHaveCount(0);
    await expect(page.getByRole('button', { name: t('Book another ride'), exact: true })).toBeVisible();
    assert.deepEqual(errors, []);
    await context.close();
    console.log('PASS: booking details, detection toggle, help, cancellation and ' + theme + '/' + lang + ' at ' + width + 'px');
  }
} finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
