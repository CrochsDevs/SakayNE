import assert from 'node:assert/strict';
import { existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { chromium, expect } from '@playwright/test';

// Browser integration fixtures; no live API, account, or database is used.
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
  const base = `http://127.0.0.1:${server.address().port}`;
  const ride = { id: 'fixture-ride', driverName: 'Test Driver', passengerName: 'Test Passenger', routeId: 'jeep-cabanatuan-palayan',
    fromId: 'cabanatuan', toId: 'palayan', fromName: 'Cabanatuan City', toName: 'Palayan City', type: 'jeep', vehicle: 'TEST123', seats: 1, fare: 30, status: 'accepted' };
  const messages = [], errors = [];
  let hasBooking = true;
  async function pageFor(role) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await context.addInitScript(role => {
      if (window !== window.top) return;
      localStorage.setItem('@sakayne_auth', JSON.stringify({ role, fullName: 'Test ' + role, verified: true, approvalStatus: 'approved' }));
      localStorage.setItem('@sakayne_token', 'fixture');
    }, role);
    await context.route('**/api/**', async route => {
      const req = route.request(), path = new URL(req.url()).pathname;
      let body = {};
      if (path.endsWith('/messages')) {
        if (req.method() === 'POST') {
          messages.push({ _id: String(messages.length + 1), role, text: req.postDataJSON().text, createdAt: new Date().toISOString() });
          body = { success: true };
        } else body = { messages: messages.map(message => ({ ...message, mine: message.role === role })) };
      } else if (path.endsWith('/rides')) body = { rides: hasBooking ? [ride] : [] };
      else if (path.endsWith('/rides/active')) body = { ride: null };
      else if (path.endsWith('/rides/fixture-ride')) body = { ride };
      else if (path.endsWith('/drivers/me')) body = { driver: { id: 'driver', fullName: 'Test Driver', vehicleType: 'jeepney', plateNo: 'TEST123', isAvailable: false } };
      else if (path.endsWith('/auth/me')) body = { user: { role, fullName: 'Test ' + role, verified: true, approvalStatus: 'approved' } };
      else if (path.endsWith('/drivers')) body = { drivers: [] };
      else if (path.includes('/notifications')) body = { notifications: [] };
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify(body) });
    });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(base + (role === 'driver' ? '/(driver)' : '/home'));
    const icon = page.getByRole('tab', { name: /Messages/ });
    await expect(icon).toBeVisible();
    await expect(page.getByRole('button', { name: 'Notifications', exact: true })).toBeVisible();
    await icon.click();
    await page.getByLabel('Search conversations').fill('no matching person');
    await expect(page.getByText('No matching conversations', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Clear search', exact: true }).click();
    await page.getByRole('button', { name: 'Active bookings', exact: true }).click();
    await expect(page.getByRole('button', { name: /Message Test/ })).toBeVisible();
    if (role === 'passenger') await page.screenshot({ path: artifacts + '/messages-inbox.png', fullPage: true });
    await page.getByRole('button', { name: /Message Test/ }).click();
    await expect(page.getByRole('button', { name: /Message Test/ })).toHaveCount(0);
    await expect(page.getByText(role === 'driver' ? 'Test Passenger' : 'Test Driver', { exact: true }).last()).toBeVisible();
    return page;
  }
  const passenger = await pageFor('passenger');
  await passenger.getByLabel('Booking message').fill('Nasa sakayan na po ako.');
  await passenger.getByRole('button', { name: 'Send message', exact: true }).click();
  const driver = await pageFor('driver');
  await expect(driver.getByText('Nasa sakayan na po ako.', { exact: true })).toBeVisible();
  await driver.getByLabel('Booking message').fill('Papunta na po ako.');
  await driver.getByRole('button', { name: 'Send message', exact: true }).click();
  await expect(passenger.getByText('Papunta na po ako.', { exact: true })).toBeVisible({ timeout: 10000 });
  const outgoing = await passenger.getByText('Nasa sakayan na po ako.', { exact: true }).boundingBox();
  const incoming = await passenger.getByText('Papunta na po ako.', { exact: true }).boundingBox();
  assert.ok(outgoing.x > incoming.x, 'Outgoing messages align right; incoming messages align left');
  const sendButton = await passenger.getByRole('button', { name: 'Send message', exact: true }).boundingBox();
  assert.ok(sendButton.y > 700 && sendButton.y + sendButton.height <= 844, 'Composer remains at the bottom of the viewport');
  await passenger.screenshot({ path: artifacts + '/booking-messages.png', fullPage: true });
  ride.status = 'completed';
  await expect(passenger.getByLabel('Booking message')).toHaveCount(0, { timeout: 10000 });
  await expect(passenger.getByText('Papunta na po ako.', { exact: true })).toBeVisible();
  hasBooking = false;
  await passenger.goto(base + '/messages');
  await expect(passenger.getByText('No conversations yet', { exact: true })).toBeVisible();
  assert.equal(messages.length, 2);
  assert.deepEqual(errors, []);
  console.log('PASS: Messages navigation and notifications, booking-specific chat, passenger/driver replies, closed chat, and empty inbox.');
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
}
