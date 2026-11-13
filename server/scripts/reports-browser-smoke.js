import assert from 'node:assert/strict';
import { existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { ObjectId } from 'mongodb';
import { chromium, expect } from '@playwright/test';
import { connectDB, closeDB, getDB } from '../config/db.js';
import { createSession } from '../shared/session.js';
import api from '../src/app.js';

const artifacts = fileURLToPath(new URL('../../artifacts', import.meta.url));
mkdirSync(artifacts, { recursive: true });
let mongo, apiServer, webServer, browser;
try {
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 }, binary: { downloadDir: fileURLToPath(new URL('../.cache/mongodb', import.meta.url)) } });
  process.env.MONGO_URI = mongo.getUri(); process.env.DB_NAME = 'sakay_reports_browser_tests';
  await connectDB();
  const db = getDB(), accounts = {};
  for (const role of ['passenger', 'admin']) {
    const user = { id: new ObjectId().toString(), fullName: role === 'admin' ? 'Admin Fixture' : 'Passenger Fixture', email: `${role}@example.test`, role, verified: true };
    await db.collection('auth').insertOne({ email: user.email, role, verified: true });
    await db.collection('users').insertOne({ _id: new ObjectId(user.id), email: user.email, fullName: user.fullName });
    accounts[role] = { user, token: await createSession(user.email, role) };
  }
  const driverId = new ObjectId(), rideId = new ObjectId();
  await db.collection('drivers').insertOne({ _id: driverId, email: 'driver@example.test', fullName: 'Driver Fixture', plateNo: 'TEST 123', vehicleType: 'jeepney' });
  await db.collection('rides').insertOne({ _id: rideId, driverId: driverId.toString(), passengerEmail: accounts.passenger.user.email, passengerName: 'Passenger Fixture', driverEmail: 'driver@example.test', driverName: 'Driver Fixture', vehicle: 'TEST 123', routeId: 'jeep-san-jose-cabanatuan', fromId: 'san-jose', toId: 'cabanatuan', fromName: 'San Jose City', toName: 'Cabanatuan City', type: 'jeep', status: 'completed', fare: 100, minutes: 60, seats: 1, createdAt: new Date().toISOString() });
  apiServer = api.listen(0, '127.0.0.1'); await new Promise(resolve => apiServer.once('listening', resolve));
  const web = express(); web.use(express.static(fileURLToPath(new URL('../../client/dist', import.meta.url)), { extensions: ['html'] }));
  webServer = web.listen(0, '127.0.0.1'); await new Promise(resolve => webServer.once('listening', resolve));
  const origin = `http://127.0.0.1:${webServer.address().port}`;
  const edge = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
  browser = await chromium.launch({ ...(existsSync(edge) ? { executablePath: edge } : {}), headless: true });
  const errors = [];
  async function pageFor(role, width = 393, theme = 'light') {
    const context = await browser.newContext({ viewport: { width, height: 852 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
    await context.addInitScript(({ account, theme }) => {
      if (window.top !== window) return;
      localStorage.setItem('@sakayne_auth', JSON.stringify(account.user)); localStorage.setItem('@sakayne_token', account.token);
      localStorage.setItem('@sakayne_language', 'en'); localStorage.setItem('@sakayne_theme', theme);
    }, { account: accounts[role], theme });
    await context.route('**/api/**', async route => {
      const url = new URL(route.request().url());
      const response = await route.fetch({ url: `http://127.0.0.1:${apiServer.address().port}${url.pathname}${url.search}` });
      await route.fulfill({ response });
    });
    const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
    return page;
  }
  const passenger = await pageFor('passenger', 320);
  await passenger.goto(origin + '/my-reports'); await expect(passenger.getByText('No reports yet', { exact: true })).toBeVisible();
  await passenger.goto(origin + '/ride-tracking?rideId=' + rideId);
  await passenger.getByRole('button', { name: 'Report driver', exact: true }).click();
  await expect(passenger.getByRole('button', { name: 'Submit report', exact: true })).toBeDisabled();
  await passenger.getByRole('radio', { name: 'Unsafe driving', exact: true }).click();
  await passenger.getByRole('textbox', { name: 'Incident details', exact: true }).fill('The driver drove dangerously near our agreed drop-off.');
  await passenger.screenshot({ path: artifacts + '/report-driver-mobile.png', fullPage: true });
  await passenger.getByRole('button', { name: 'Submit report', exact: true }).click();
  await expect(passenger.getByText('Unsafe driving', { exact: true })).toBeVisible();
  await expect(passenger.getByText('Open', { exact: true })).toBeVisible();
  const admin = await pageFor('admin');
  await admin.goto(origin + '/admin');
  await expect(admin.getByText('Passenger reports', { exact: true })).toBeVisible();
  await admin.getByRole('radio', { name: 'In review', exact: true }).click();
  await admin.getByRole('textbox', { name: 'Response to passenger', exact: true }).fill('We have received your report and are reviewing this incident.');
  await admin.getByRole('button', { name: 'Save review', exact: true }).click();
  await expect(admin.getByText('In review', { exact: true }).first()).toBeVisible();
  await passenger.getByRole('button', { name: 'Refresh reports', exact: true }).click();
  await expect(passenger.getByText('We have received your report and are reviewing this incident.', { exact: true })).toBeVisible();
  await expect(passenger.getByText('In review', { exact: true })).toBeVisible();
  await passenger.screenshot({ path: artifacts + '/my-reports-mobile.png', fullPage: true });
  await admin.getByRole('radio', { name: 'Resolved', exact: true }).click();
  await admin.getByRole('textbox', { name: 'Response to passenger', exact: true }).fill('The incident was reviewed and the driver was contacted.');
  await admin.getByRole('button', { name: 'Save review', exact: true }).click();
  await expect(admin.getByText('Resolved', { exact: true }).first()).toBeVisible();
  await admin.screenshot({ path: artifacts + '/admin-reports-mobile.png', fullPage: true });
  await passenger.goto(origin + '/report-driver?rideId=' + rideId);
  await expect(passenger.getByText('You already reported this booking.', { exact: true })).toBeVisible();
  await passenger.goto(origin + '/(passenger)/settings');
  await passenger.getByText('My reports', { exact: true }).click();
  await expect(passenger.getByText('Resolved', { exact: true })).toBeVisible();
  for (const page of [passenger, admin]) assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true, 'No horizontal overflow');
  const dark = await pageFor('passenger', 393, 'dark');
  await dark.goto(origin + '/my-reports'); await expect(dark.getByText('Resolved', { exact: true })).toBeVisible();
  await dark.screenshot({ path: artifacts + '/my-reports-dark.png', fullPage: true });
  assert.equal(await db.collection('driver_reports').countDocuments({}), 1);
  assert.equal(await db.collection('audit_logs').countDocuments({ action: 'driver_report_review' }), 2);
  assert.deepEqual(errors, []);
  console.log('PASS: real local API report submission, duplicate prevention, settings entry, admin reviews, passenger updates and light/dark mobile layouts.');
} finally {
  await browser?.close();
  if (webServer) await new Promise(resolve => webServer.close(resolve));
  if (apiServer) await new Promise(resolve => apiServer.close(resolve));
  await closeDB(); await mongo?.stop();
}
