import assert from 'node:assert/strict';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium, expect } from '@playwright/test';
import express from 'express';

const web = express(); web.use(express.static(fileURLToPath(new URL('../../client/dist', import.meta.url)), { extensions: ['html'] }));
web.get('*', (_req, res) => res.sendFile(fileURLToPath(new URL('../../client/dist/index.html', import.meta.url))));
const server = web.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
const webBase = process.env.BROWSER_WEB_URL || `http://127.0.0.1:${server.address().port}`;

const browser = await chromium.launch({ ...(existsSync('C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe') ? { executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' } : {}), headless: true, args: ['--enable-unsafe-swiftshader'] });
try {
  const context = await browser.newContext({ viewport: { width: 393, height: 852 }, permissions: ['geolocation'], geolocation: { latitude: 15.6, longitude: 120.92, accuracy: 5 } });
  const user = { id: 'polling-fixture', email: 'fixture@example.test', role: 'driver', fullName: 'Polling fixture', verified: true, approvalStatus: 'approved' };
  const driver = { ...user, vehicleType: 'jeepney', plateNo: 'TEST', routeId: 'jeep-cabanatuan-palayan', capacity: 16, reservedSeats: 0, isAvailable: true, availableSeats: 16, location: null };
  await context.addInitScript(user => {
    if (window.top !== window) return;
    localStorage.setItem('@sakayne_auth', JSON.stringify(user)); localStorage.setItem('@sakayne_token', 'fixture');
    localStorage.setItem('@sakayne_theme', 'light'); localStorage.setItem('@sakayne_language', 'en');
  }, user);
  const counts = {}; let uploads = 0, activeUploads = 0, peakUploads = 0;
  await context.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname; counts[path] = (counts[path] || 0) + 1;
    let json = {};
    if (path.endsWith('/auth/me')) json = { user };
    else if (path.endsWith('/drivers/me')) json = { driver };
    else if (path.endsWith('/rides')) json = { rides: [] };
    else if (path.endsWith('/drivers/location')) {
      uploads++; peakUploads = Math.max(peakUploads, ++activeUploads);
      try { await new Promise(resolve => setTimeout(resolve, 6500)); } finally { activeUploads--; }
    }
    await route.fulfill({ json }).catch(() => {});
  });
  const page = await context.newPage(), errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto(webBase + '/(driver)', { waitUntil: 'domcontentloaded', timeout: 180000 });
  await expect(page.getByRole('button', { name: 'Go offline', exact: true })).toBeVisible({ timeout: 45000 });
  await expect.poll(() => uploads, { timeout: 30000 }).toBeGreaterThanOrEqual(2);
  assert.equal(peakUploads, 1, 'Slow GPS uploads must never overlap');
  const visibility = state => page.evaluate(state => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state });
    document.dispatchEvent(new Event('visibilitychange'));
  }, state);
  await visibility('hidden');
  const hiddenCounts = { ...counts };
  await page.waitForTimeout(7500);
  assert.deepEqual(counts, hiddenCounts, 'Hidden tabs must stop dashboard/session polling and presence requests');
  await visibility('visible');
  await expect.poll(() => counts['/api/auth/me'] || 0, { timeout: 10000 }).toBeGreaterThan(hiddenCounts['/api/auth/me'] || 0);
  await expect.poll(() => uploads, { timeout: 10000 }).toBeGreaterThanOrEqual(3);
  assert.equal(peakUploads, 1); assert.deepEqual(errors, []);
  const report = { slowUploadMs: 6500, peakConcurrentGpsUploads: peakUploads, hiddenObservationMs: 7500, hiddenRequests: 0, resumed: true, errors, counts };
  const dir = fileURLToPath(new URL('../../artifacts', import.meta.url)); mkdirSync(dir, { recursive: true }); writeFileSync(dir + '/polling-browser.json', JSON.stringify(report, null, 2));
  console.log('PASS: slow GPS uploads stay sequential, hidden tabs stop API polling, foreground resumes and no browser errors');
} finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
