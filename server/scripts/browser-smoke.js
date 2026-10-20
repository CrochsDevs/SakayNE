import assert from 'node:assert/strict';
import { mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { chromium, expect } from '@playwright/test';
import express from 'express';
import bcrypt from 'bcrypt';
import { ObjectId } from 'mongodb';
import app from '../src/app.js';
import { connectDB, closeDB, getDB } from '../config/db.js';

const artifacts = fileURLToPath(new URL('../../artifacts', import.meta.url));
const dist = fileURLToPath(new URL('../../client/dist', import.meta.url));
mkdirSync(artifacts, { recursive: true });
let mongo, apiServer, webServer, browser;
let gpsTimer;
try {
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 }, binary: { downloadDir: fileURLToPath(new URL('../.cache/mongodb', import.meta.url)) } });
  process.env.MONGO_URI = mongo.getUri(); process.env.DB_NAME = 'sakayne_browser_test';
  const db = await connectDB();
  const password = await bcrypt.hash('TestPassword123', 4);
  for (const [email, fullName, role] of [['passenger@example.test','Test Passenger','passenger'], ['driver@example.test','Test Driver','driver'], ['admin@example.test','Test Admin','admin']]) {
    await db.collection('auth').insertOne({ email, password, role, verified: true });
    await db.collection('users').insertOne({ email, fullName, phone: '09123456789' });
  }
  const driverId = new ObjectId();
  await db.collection('drivers').insertOne({ _id: driverId, email: 'driver@example.test', fullName: 'Test Driver', phone: '09123456789', vehicleType: 'jeepney', plateNo: 'TEST123', verified: true, approvalStatus: 'approved', isAvailable: false, capacity: 3, reservedSeats: 0 });
  apiServer = app.listen(0, '127.0.0.1'); await new Promise(resolve => apiServer.once('listening', resolve));
  const apiBase = `http://127.0.0.1:${apiServer.address().port}`;
  const staticApp = express(); staticApp.use(express.static(dist, { extensions: ['html'] }));
  staticApp.get('*', (req,res) => res.sendFile(dist + '/index.html'));
  webServer = staticApp.listen(0, '127.0.0.1'); await new Promise(resolve => webServer.once('listening', resolve));
  const webBase = `http://127.0.0.1:${webServer.address().port}`;
  const edge = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  browser = await chromium.launch(existsSync(edge) ? { executablePath: edge, headless: true } : { headless: true });
  const errors = [];
  async function context() {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, geolocation: { latitude: 15.487, longitude: 120.974 }, permissions: ['geolocation'] });
    // All application API traffic is redirected to the isolated fixture database.
    await ctx.route('**/api/**', async route => {
      const request = route.request();
      const path = new URL(request.url()).pathname;
      const response = await fetch(apiBase + path, { method: request.method(), headers: { 'Content-Type': 'application/json', ...(request.headers().authorization ? { Authorization: request.headers().authorization } : {}) }, ...(request.postData() ? { body: request.postData() } : {}) });
      await route.fulfill({ status: response.status, contentType: 'application/json', body: await response.text() });
    });
    return ctx;
  }
  async function login(ctx, role) {
    const page = await ctx.newPage(); page.on('pageerror', error => errors.push(page.url() + ': ' + error.message));
    await page.goto(webBase + '/login');
    await page.locator('input').nth(0).fill(role + '@example.test');
    await page.locator('input').nth(1).fill('TestPassword123');
    await page.getByText('Sign In', { exact: true }).click();
    return page;
  }
  const driverContext = await context(), passengerContext = await context();
  // Refresh the simulated sensors throughout the run; Chromium's fixed mock
  // otherwise retains the original capture timestamp and correctly fails freshness checks.
  let passengerLatitude = 15.487;
  const updateGps = async () => {
    await Promise.all([driverContext.setGeolocation({ latitude: 15.487, longitude: 120.974, accuracy: 1 }),
      passengerContext.setGeolocation({ latitude: passengerLatitude, longitude: 120.974, accuracy: 1 })]);
  };
  await updateGps(); gpsTimer = setInterval(() => { void updateGps().catch(() => {}); }, 4000);
  const driver = await login(driverContext, 'driver');
  await driver.getByText('Driver trips', { exact: true }).waitFor();
  await driver.screenshot({ path: artifacts + '/driver-route-home.png', fullPage: true });
  await driver.getByRole('button', { name: /Cabanatuan.*Palayan/ }).click();
  await driver.getByRole('button', { name: 'Go online', exact: true }).click();
  await driver.getByText('ONLINE · accepting bookings', { exact: false }).waitFor();
  const passenger = await login(passengerContext, 'passenger');
  await passenger.getByText('Test Passenger', { exact: true }).waitFor();
  await passenger.getByText('Book', { exact: true }).click();
  await passenger.getByText('Select destination', { exact: true }).click();
  await passenger.getByText('Palayan City', { exact: true }).click();
  await passenger.getByRole('button', { name: 'Next: seats and fare', exact: true }).click();
  await passenger.getByRole('button', { name: 'Add seat', exact: true }).click();
  await passenger.getByText('2 seats', { exact: true }).waitFor();
  await passenger.getByRole('button', { name: 'View route map', exact: true }).click();
  const map = passenger.frameLocator('iframe');
  await map.locator('.leaflet-container').waitFor({ timeout: 30000 });
  await map.locator('.leaflet-tile-loaded').first().waitFor({ timeout: 30000 });
  assert.equal(await passenger.locator('iframe').evaluate(frame => {
    try { void frame.contentWindow.document; return false; }
    catch (error) { return error.name === 'SecurityError'; }
  }), true, 'Map iframe must remain isolated from the application origin');
  await passenger.locator('iframe').evaluate(frame => frame.scrollIntoView());
  await passenger.evaluate(() => { for (const el of document.querySelectorAll('*')) if (el.scrollTop) el.scrollTop = 0; });
  await passenger.screenshot({ path: artifacts + '/booking-preview.png', fullPage: true });
  await passenger.getByText('Confirm Booking', { exact: true }).click();
  await passenger.getByText('Waiting for your driver to accept', { exact: true }).waitFor();
  const ride = await getDB().collection('rides').findOne({ passengerEmail: 'passenger@example.test' });
  assert.equal(ride.seats, 2);
  await driver.getByRole('button', { name: 'Accept booking', exact: true }).click({ timeout: 15000 });
  await driver.getByRole('button', { name: 'Arrived at pickup', exact: true }).click();
  await passenger.getByText('Driver is at pickup. Show your boarding code.', { exact: true }).waitFor({ timeout: 15000 });
  await driver.getByLabel('Passenger boarding code').fill(ride.boardingCode);
  await driver.getByRole('button', { name: 'Verify code & board passenger', exact: true }).click();
  await passenger.getByText('You are on board. Enjoy your trip!', { exact: true }).waitFor({ timeout: 15000 });
  await expect.poll(async () => (await db.collection('drivers').findOne({ _id: driverId })).location?.latitude, { timeout: 35000 }).toBe(15.487);
  await passenger.frameLocator('iframe').locator('.car').waitFor({ timeout: 15000 });
  await passenger.getByRole('button', { name: 'Message driver', exact: true }).click();
  await passenger.getByLabel('Booking message').fill('I am at the pickup stop.');
  await passenger.getByRole('button', { name: 'Send message', exact: true }).click();
  await passenger.getByText('I am at the pickup stop.', { exact: true }).waitFor();
  await driver.getByRole('button', { name: 'Message passenger', exact: true }).click();
  await driver.getByText('I am at the pickup stop.', { exact: true }).waitFor();
  await driver.getByText('← Back', { exact: true }).click();
  await passenger.goto(webBase + '/ride-tracking');
  await passenger.getByText('You are on board. Enjoy your trip!', { exact: true }).waitFor();
  await driver.getByRole('button', { name: 'Passenger alighted · Confirm cash', exact: true }).click();
  await passenger.getByText('Trip completed. Thank you for riding.', { exact: true }).waitFor({ timeout: 15000 });
  await passenger.getByRole('button', { name: '5★', exact: true }).click();
  await passenger.getByText('Your rating: 5 / 5', { exact: true }).waitFor();
  await passenger.evaluate(() => { for (const el of document.querySelectorAll('*')) if (el.scrollTop) el.scrollTop = 0; });
  await passenger.screenshot({ path: artifacts + '/completed-booking.png', fullPage: true });
  await driver.goto(webBase + '/(driver)/earnings');
  await driver.getByText('1 completed bookings', { exact: true }).waitFor();
  await driver.screenshot({ path: artifacts + '/driver-earnings.png', fullPage: true });
  assert.equal((await db.collection('drivers').findOne({ _id: driverId })).reservedSeats, 0);
  await passenger.goto(webBase + '/account-info');
  await passenger.getByText('Edit Profile', { exact: true }).click();
  await passenger.locator('input').nth(0).fill('Updated Passenger');
  await passenger.getByText('Save Changes', { exact: true }).click();
  await passenger.getByText('Updated Passenger', { exact: true }).waitFor();
  await passenger.goto(webBase + '/token');
  await passenger.getByRole('button', { name: /Claim Day 1/ }).click();
  await passenger.getByText('0.10 tokens', { exact: true }).waitFor();
  await passenger.goto(webBase + '/notifications-list');
  await passenger.getByText('Booking update', { exact: true }).first().waitFor();
  await passenger.goto(webBase + '/(passenger)/rides');
  await passenger.getByText('Booking details', { exact: true }).waitFor();
  await passenger.goto(webBase + '/app-information?topic=terms');
  await passenger.getByText('Booking rules', { exact: true }).waitFor();
  const adminContext = await context(), admin = await login(adminContext, 'admin');
  await admin.getByText('Driver applications', { exact: true }).waitFor();
  // A second booking exercises the actual client GPS publishers and automatic seat detection.
  await passenger.goto(webBase + '/home');
  await passenger.getByText('Book', { exact: true }).click();
  await passenger.getByText('Select destination', { exact: true }).click();
  await passenger.getByText('Palayan City', { exact: true }).click();
  await passenger.getByRole('button', { name: 'Next: seats and fare', exact: true }).click();
  await passenger.getByText('Confirm Booking', { exact: true }).click();
  await passenger.getByText('Waiting for your driver to accept', { exact: true }).waitFor();
  await driver.goto(webBase + '/(driver)');
  await driver.getByRole('button', { name: 'Accept booking', exact: true }).click({ timeout: 15000 });
  await passenger.getByRole('button', { name: 'Enable automatic seat detection', exact: true }).click();
  await passenger.getByText('Boarding detected. Your seats are occupied.', { exact: true }).waitFor({ timeout: 45000 });
  await driver.getByText('1 occupied · 0 waiting · 2 available', { exact: true }).waitFor({ timeout: 15000 });
  const automaticRide = await db.collection('rides').findOne({ passengerEmail: 'passenger@example.test', status: 'ongoing' });
  assert.equal(automaticRide.boardingSource, 'geolocation');
  passengerLatitude = 15.487 + 30 / 111195;
  await updateGps();
  await passenger.getByText('You have alighted. Your seats were released. Settle cash with your driver.', { exact: true }).waitFor({ timeout: 45000 });
  await driver.getByText('0 occupied · 0 waiting · 3 available', { exact: true }).waitFor({ timeout: 15000 });
  const alightedRide = await db.collection('rides').findOne({ _id: automaticRide._id });
  assert.equal(alightedRide.paymentStatus, 'unpaid'); assert.equal(alightedRide.occupancyStatus, 'alighted');
  await passenger.evaluate(() => { for (const el of document.querySelectorAll('*')) if (el.scrollTop) el.scrollTop = 0; });
  await driver.evaluate(() => { for (const el of document.querySelectorAll('*')) if (el.scrollTop) el.scrollTop = 0; });
  await passenger.screenshot({ path: artifacts + '/gps-alighting.png', fullPage: true });
  await driver.screenshot({ path: artifacts + '/gps-seat-count.png', fullPage: true });
  await driver.getByRole('button', { name: 'Passenger alighted · Confirm cash', exact: true }).click();
  await passenger.getByText('Trip completed. Thank you for riding.', { exact: true }).waitFor({ timeout: 15000 });
  assert.deepEqual(errors, [], 'Browser runtime errors');
  console.log('PASS: booking modules plus GPS automatic boarding/alighting, occupied/available seats and cash confirmation. Screenshots: artifacts/');
} catch (error) {
  for (const [i, ctx] of (browser?.contexts() || []).entries()) for (const [j, page] of ctx.pages().entries()) {
    console.error('Failure page:', page.url(), (await page.locator('body').innerText()).slice(0, 1500));
    await page.screenshot({ path: artifacts + `/failure-${i}-${j}.png`, fullPage: true }).catch(() => {});
  }
  throw error;
} finally {
  clearInterval(gpsTimer);
  await browser?.close();
  if (webServer) await new Promise(resolve => webServer.close(resolve));
  if (apiServer) await new Promise(resolve => apiServer.close(resolve));
  await closeDB(); await mongo?.stop();
}
