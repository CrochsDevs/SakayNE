import assert from 'node:assert/strict';
import { existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { chromium, expect } from '@playwright/test';

// Isolated UI fixtures: no live bookings, API, or database access.
const dist = fileURLToPath(new URL('../../client/dist', import.meta.url));
const artifacts = fileURLToPath(new URL('../../artifacts', import.meta.url));
mkdirSync(artifacts, { recursive: true });
const app = express();
app.use(express.static(dist, { extensions: ['html'] }));
app.get('*', (_req, res) => res.sendFile(dist + '/index.html'));
const server = app.listen(0, '127.0.0.1');
await new Promise(resolve => server.once('listening', resolve));
let browser;
try {
  const edge = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  browser = await chromium.launch(existsSync(edge) ? { executablePath: edge, headless: true } : { headless: true });
  const page = await browser.newPage({ viewport: { width: 360, height: 740 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    localStorage.setItem('@sakayne_auth', JSON.stringify({ id: 'fixture', fullName: 'Test Passenger', email: 'test@example.test', role: 'passenger' }));
    localStorage.setItem('@sakayne_token', 'ui-fixture');
  });
  let availableSeats = 3;
  let submitted;
  await page.route('**/api/**', async request => {
    const path = new URL(request.request().url()).pathname;
    let body = {};
    if (path.endsWith('/drivers')) body = { drivers: [{ id: 'fixture-driver', name: 'Test Driver', type: 'jeep', routeId: 'jeep-cabanatuan-palayan', vehicle: 'TEST123', seats: availableSeats, rating: 'New', etaMin: null }] };
    else if (path.endsWith('/rides/active')) body = { ride: null };
    else if (path.includes('/notifications')) body = { notifications: [] };
    else if (path.endsWith('/rides') && request.request().method() === 'POST') {
      submitted = request.request().postDataJSON();
      // Keep the review visible to check the outgoing booking without a live ride.
      await request.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ error: 'Fixture booking checked' }) });
      return;
    }
    await request.fulfill({ contentType: 'application/json', body: JSON.stringify(body) });
  });
  await page.goto(`http://127.0.0.1:${server.address().port}/home`);
  await page.getByRole('button', { name: 'Book jeepney with Test Driver' }).click();
  await expect(page.getByRole('button', { name: 'Next: seats and fare' })).toBeDisabled();
  await page.getByRole('button', { name: /Get off:/ }).click();
  await page.getByRole('button', { name: /Palayan City/ }).click();
  await page.screenshot({ path: artifacts + '/simple-booking-places.png', fullPage: true });
  await page.getByRole('button', { name: 'Next: seats and fare' }).click();
  await expect(page.getByText('2. Choose your trip', { exact: true })).not.toBeVisible();
  await expect(page.getByRole('button', { name: 'Remove seat' })).toBeDisabled();
  await page.getByRole('button', { name: 'Add seat' }).click();
  await expect(page.getByText('2 seats', { exact: true })).toBeVisible();
  await expect(page.locator('iframe')).toHaveCount(0);
  const confirm = page.getByRole('button', { name: 'Confirm Booking', exact: true });
  await expect(confirm).toBeEnabled();
  const bounds = await confirm.boundingBox();
  assert.ok(bounds.y + bounds.height <= 740, 'Confirmation stays visible on a small screen');
  await page.screenshot({ path: artifacts + '/simple-booking-review.png', fullPage: true });
  availableSeats = 1;
  await expect(confirm).toBeDisabled({ timeout: 12000 });
  await page.getByRole('button', { name: 'Remove seat' }).click();
  await expect(confirm).toBeEnabled();
  await confirm.click();
  await expect.poll(() => submitted?.seats).toBe(1);
  assert.equal(submitted.fromId, 'cabanatuan');
  assert.equal(submitted.toId, 'palayan');
  assert.equal(submitted.routeId, 'jeep-cabanatuan-palayan');
  assert.deepEqual(errors, []);
  console.log('PASS: simple booking, seat limits, visible confirmation, and unchanged directional booking payload.');
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
}
