import assert from 'node:assert/strict';
import { existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { chromium, expect } from '@playwright/test';

const artifacts = fileURLToPath(new URL('../../artifacts', import.meta.url));
mkdirSync(artifacts, { recursive: true });
const app = express(); app.use(express.static(fileURLToPath(new URL('../../client/dist', import.meta.url)), { extensions: ['html'] }));
const server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const edge = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const browser = await chromium.launch({ ...(existsSync(edge) ? { executablePath: edge } : {}), headless: true });
try {
  const errors = [];
  async function pageFor(role, width, theme = 'light', vehicleType = 'jeepney') {
    const context = await browser.newContext({ viewport: { width, height: 852 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
    const user = { fullName: 'Test User', email: `${role}@example.test`, role, verified: true, approvalStatus: 'approved' };
    await context.addInitScript(({ user, theme }) => {
      if (window.top !== window) return;
      localStorage.setItem('@sakayne_auth', JSON.stringify(user)); localStorage.setItem('@sakayne_token', 'fixture-token');
      localStorage.setItem('@sakayne_language', 'en'); localStorage.setItem('@sakayne_theme', theme);
    }, { user, theme });
    await context.route('**/api/**', async route => {
      const path = new URL(route.request().url()).pathname;
      let data = {};
      if (path.endsWith('/auth/me')) data = { user };
      else if (path.endsWith('/drivers/me')) data = { driver: { id: 'driver-fixture', fullName: 'Driver Fixture', vehicleType, plateNo: 'TEST 123', isAvailable: false, capacity: 16 } };
      else if (path.endsWith('/rides/active')) data = { ride: null };
      else if (path.endsWith('/rides')) data = { rides: [] };
      else if (path.endsWith('/drivers')) data = { drivers: [] };
      else if (path.includes('/notifications')) data = { notifications: [], unread: 0 };
      else if (path.includes('/tokens')) data = { tokens: 0, balance: 0 };
      await route.fulfill({ json: data });
    });
    const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
    return page;
  }
  for (const [width, theme] of [[320, 'light'], [393, 'dark']]) {
    const passenger = await pageFor('passenger', width, theme);
    await passenger.goto(origin + '/(passenger)/home');
    await passenger.getByRole('button', { name: 'Bus, coming soon', exact: true }).click();
    await expect(passenger.getByText('Coming soon', { exact: true }).last()).toBeVisible();
    await expect(passenger.getByText('Bus service', { exact: true })).toBeVisible();
    await passenger.getByRole('button', { name: 'Back to Home', exact: true }).click();
    await passenger.getByRole('tab', { name: 'Community, coming soon', exact: true }).click();
    await expect(passenger.getByText('Coming soon', { exact: true }).last()).toBeVisible();
    const labelSize = await passenger.getByRole('tab', { name: 'Community, coming soon', exact: true }).getByText('Community', { exact: true }).evaluate(node => ({ content: node.scrollWidth, width: node.clientWidth, font: getComputedStyle(node).fontSize, html: node.outerHTML }));
    assert.equal(labelSize.content <= labelSize.width + 1, true, 'Community label fits the tab');
    await passenger.screenshot({ path: artifacts + `/community-${width}-${theme}.png`, fullPage: true });
    assert.equal(await passenger.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
    await passenger.goto(origin + '/journey-search');
    await expect(passenger.getByRole('button', { name: 'Bus, coming soon', exact: true })).toBeDisabled();
    await expect(passenger.getByRole('button', { name: 'Jeepney', exact: true })).toBeEnabled();
    await passenger.goto(origin + '/route-map?routeId=bus-cabanatuan-manila&fromId=gapan&toId=manila');
    await expect(passenger.getByText('Coming soon', { exact: true }).last()).toBeVisible();
    const driver = await pageFor('driver', width, theme, 'bus');
    await driver.goto(origin + '/(driver)');
    await expect(driver.getByText('Bus service', { exact: true })).toBeVisible();
    await expect(driver.getByRole('button', { name: 'View existing trips', exact: true })).toBeVisible();
    await driver.getByRole('tab', { name: 'Community, coming soon', exact: true }).click();
    await expect(driver.getByText('Coming soon', { exact: true }).last()).toBeVisible();
    assert.equal(await driver.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
  }
  // View the vehicle step without creating or emailing any account.
  const signup = await browser.newPage({ viewport: { width: 393, height: 852 } });
  signup.on('pageerror', error => errors.push(error.message));
  await signup.goto(origin + '/driver-register');
  for (const [placeholder, value] of [['Juan Dela Cruz', 'Driver Fixture'], ['0912 345 6789', '09123456789'], ['juan@email.com', 'fixture@example.test'], ['DD', '01'], ['MM', '01'], ['YYYY', '1990'], ['Tirahan', 'Fixture address'], ['8+ characters', 'TestPassword123'], ['I-ulit', 'TestPassword123']]) await signup.getByPlaceholder(placeholder, { exact: true }).fill(value);
  await signup.getByText('Susunod', { exact: true }).click();
  await expect(signup.getByRole('button', { name: 'Bus registration, coming soon', exact: true })).toBeDisabled();
  await expect(signup.getByRole('button', { name: 'jeepney', exact: true })).toBeEnabled();
  await signup.screenshot({ path: artifacts + '/bus-registration-coming-soon.png', fullPage: true });
  assert.deepEqual(errors, []);
  console.log('PASS: bus coming soon in home, trip search, direct booking links, driver dashboard and registration; Community tabs for passengers/drivers at 320px light and 393px dark.');
} finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
