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
import { BUS_SERVICE_ENABLED } from '../../client/src/data/service-availability.mjs';

const bus = process.argv.includes('--bus');
if (bus && !BUS_SERVICE_ENABLED) {
  await import('./coming-soon-browser-smoke.js');
  process.exit(0);
}
const vehicleType = bus ? 'bus' : 'jeepney';
const destination = bus ? 'Manila' : 'Palayan City';
const artifacts = fileURLToPath(new URL(bus ? '../../artifacts/bus' : '../../artifacts/jeepney', import.meta.url));
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
  await db.collection('drivers').insertOne({ _id: driverId, email: 'driver@example.test', fullName: 'Test Driver', phone: '09123456789', vehicleType, plateNo: 'TEST123', verified: true, approvalStatus: 'approved', isAvailable: false, capacity: 3, reservedSeats: 0 });
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
      const url = new URL(request.url());
      const path = url.pathname + url.search;
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
  await driver.getByRole('button', { name: 'Go online', exact: true }).waitFor();
  await driver.screenshot({ path: artifacts + '/driver-route-home.png', fullPage: true });
  await driver.getByRole('button', { name: 'Route and vehicle capacity', exact: true }).click();
  await driver.getByRole('button', { name: `Cabanatuan City → ${destination}`, exact: true }).click();
  await driver.getByRole('button', { name: 'Done', exact: true }).click();
  await driver.getByRole('button', { name: 'Go online', exact: true }).click();
  await driver.getByText('ONLINE · accepting bookings', { exact: false }).waitFor();
  const passenger = await login(passengerContext, 'passenger');
  await passenger.getByText('Test Passenger', { exact: true }).waitFor();
  if (bus) await passenger.getByRole('button', { name: 'Bus', exact: true }).click();
  await passenger.getByRole('button', { name: 'View on map: Test Driver', exact: true }).click();
  await passenger.getByRole('heading', { name: bus ? 'Bus location' : 'Jeepney location', exact: true }).waitFor();
  await passenger.getByText('Driver GPS updated', { exact: false }).waitFor({ timeout: 35000 });
  await passenger.frameLocator('iframe').locator('.car').waitFor({ timeout: 45000 });
  await passenger.screenshot({ path: artifacts + '/vehicle-live-map.png', fullPage: true });
  await passenger.getByRole('button', { name: 'Go back', exact: true }).click();
  await passenger.getByRole('button', { name: 'Find transportation by pickup and destination' }).click();
  await passenger.getByRole('button', { name: 'Pickup: Choose a stop', exact: true }).click();
  await passenger.getByLabel('Search stops').fill('Cabanatuan');
  await passenger.getByRole('button', { name: 'Cabanatuan City', exact: true }).click();
  await passenger.getByRole('button', { name: 'Destination: Choose a stop', exact: true }).click();
  await passenger.getByLabel('Search stops').fill(destination);
  await passenger.getByRole('button', { name: destination, exact: true }).click();
  await passenger.getByRole('button', { name: 'Add seat', exact: true }).click();
  await passenger.getByRole('button', { name: 'Find transportation', exact: true }).click();
  await passenger.getByRole('button', { name: 'Review trip with Test Driver', exact: true }).waitFor();
  await passenger.screenshot({ path: artifacts + '/journey-search.png', fullPage: true });
  assert.equal(await passenger.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false, 'Journey search should fit a phone viewport');
  await passenger.getByRole('button', { name: 'Review trip with Test Driver', exact: true }).click();
  await passenger.getByLabel('2 seat(s)', { exact: true }).waitFor();
  await passenger.getByRole('button', { name: 'View route map', exact: true }).click();
  await passenger.locator('iframe').scrollIntoViewIfNeeded();
  const map = passenger.frameLocator('iframe');
  await map.locator('#map[data-map-ready="true"]').waitFor({ timeout: 45000 });
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
  await driver.getByRole('button', { name: 'View active trips', exact: true }).click();
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
  await driver.getByRole('button', { name: 'Go back to messages', exact: true }).click();
  await passenger.goto(webBase + '/ride-tracking');
  await passenger.getByText('You are on board. Enjoy your trip!', { exact: true }).waitFor();
  await driver.getByRole('button', { name: 'Complete trip', exact: true }).click();
  await passenger.getByText('Trip completed. Thank you for riding.', { exact: true }).waitFor({ timeout: 15000 });
  await passenger.getByRole('button', { name: '5★', exact: true }).click();
  await passenger.getByText('Your rating: 5 / 5', { exact: true }).waitFor();
  await passenger.evaluate(() => { for (const el of document.querySelectorAll('*')) if (el.scrollTop) el.scrollTop = 0; });
  await passenger.screenshot({ path: artifacts + '/completed-booking.png', fullPage: true });
  await driver.getByRole('tab', { name: /Trips/ }).click();
  await driver.getByRole('tab', { name: 'Completed', exact: true }).click();
  await driver.getByText('Test Passenger', { exact: true }).waitFor();
  await driver.screenshot({ path: artifacts + '/driver-trips.png', fullPage: true });
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
  await passenger.getByRole('button', { name: 'Booking details', exact: true }).waitFor();
  await passenger.goto(webBase + '/app-information?topic=terms');
  await passenger.getByText('Booking rules', { exact: true }).waitFor();
  const adminContext = await context(), admin = await login(adminContext, 'admin');
  await admin.getByText('Driver applications', { exact: true }).waitFor();
  await admin.getByText('Operations ·', { exact: false }).waitFor();
  await admin.screenshot({ path: artifacts + '/operator-overview.png', fullPage: true });
  // A second booking exercises the actual client GPS publishers and automatic seat detection.
  await passenger.goto(webBase + '/home');
  if (bus) await passenger.getByRole('button', { name: 'Bus', exact: true }).click();
  await passenger.getByRole('button', { name: `Book ${vehicleType} with Test Driver`, exact: true }).click();
  await passenger.getByText('Pickup area: Cabanatuan City', { exact: true }).waitFor();
  await passenger.getByText('Select destination', { exact: true }).click();
  await passenger.getByText(bus ? 'Manila (outside N.E.)' : destination, { exact: true }).click();
  await passenger.getByRole('button', { name: 'Next: choose seats', exact: true }).click();
  await passenger.getByText('Confirm Booking', { exact: true }).click();
  await passenger.getByText('Waiting for your driver to accept', { exact: true }).waitFor();
  await driver.goto(webBase + '/(driver)');
  await driver.getByRole('button', { name: 'Accept booking', exact: true }).click({ timeout: 15000 });
  await driver.getByRole('button', { name: 'Route and vehicle capacity', exact: true }).click();
  await passenger.getByRole('switch', { name: 'Enable automatic seat detection', exact: true }).click();
  await passenger.getByText('Boarding detected. Your seats are occupied.', { exact: true }).waitFor({ timeout: 45000 });
  await expect(driver.getByText('On board', { exact: true }).locator('..')).toHaveText(/1[\s\S]*On board/, { timeout: 15000 });
  await expect(driver.getByText('Available', { exact: true }).locator('..')).toHaveText(/2[\s\S]*Available/, { timeout: 15000 });
  const automaticRide = await db.collection('rides').findOne({ passengerEmail: 'passenger@example.test', status: 'ongoing' });
  assert.equal(automaticRide.boardingSource, 'geolocation');
  passengerLatitude = 15.487 + 30 / 111195;
  await updateGps();
  await passenger.getByText('You have alighted. Your seats were released.', { exact: true }).waitFor({ timeout: 45000 });
  await expect(driver.getByText('On board', { exact: true }).locator('..')).toHaveText(/0[\s\S]*On board/, { timeout: 15000 });
  await expect(driver.getByText('Available', { exact: true }).locator('..')).toHaveText(/3[\s\S]*Available/, { timeout: 15000 });
  const alightedRide = await db.collection('rides').findOne({ _id: automaticRide._id });
  assert.equal(alightedRide.paymentStatus, 'unpaid'); assert.equal(alightedRide.occupancyStatus, 'alighted');
  await passenger.evaluate(() => { for (const el of document.querySelectorAll('*')) if (el.scrollTop) el.scrollTop = 0; });
  await driver.evaluate(() => { for (const el of document.querySelectorAll('*')) if (el.scrollTop) el.scrollTop = 0; });
  await passenger.screenshot({ path: artifacts + '/gps-alighting.png', fullPage: true });
  await driver.screenshot({ path: artifacts + '/gps-seat-count.png', fullPage: true });
  await driver.getByRole('button', { name: 'Done', exact: true }).click();
  await driver.getByRole('button', { name: 'View active trips', exact: true }).click();
  await driver.getByRole('button', { name: 'Complete trip', exact: true }).click();
  await passenger.getByText('Trip completed. Thank you for riding.', { exact: true }).waitFor({ timeout: 15000 });
  assert.deepEqual(errors, [], 'Browser runtime errors');
  console.log(`PASS (${vehicleType}): live vehicle map, booking, chat, rating, GPS boarding/alighting, occupied/available seats and cash confirmation. Screenshots: ${artifacts}`);
} catch (error) {
  for (const [i, ctx] of (browser?.contexts() || []).entries()) for (const [j, page] of ctx.pages().entries()) {
    console.error('Failure page:', page.url(), (await page.locator('body').innerText()).slice(0, 1500));
    for (const frame of page.frames().filter(frame => frame.parentFrame())) console.error('Map state:', await frame.evaluate(() => ({ body: document.body.innerText.slice(0, 400), mapSize: document.getElementById('map')?.getBoundingClientRect().toJSON(), ready: document.getElementById('map')?.dataset.mapReady, mapError: typeof map !== 'undefined' && map ? map.loaded() : 'no map' })).catch(error => error.message));
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
