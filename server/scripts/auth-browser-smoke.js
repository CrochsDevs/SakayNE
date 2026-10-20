import assert from 'node:assert/strict';
import express from 'express';
import { existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { mock } from 'node:test';
import { v2 as cloudinary } from 'cloudinary';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { chromium, expect } from '@playwright/test';
import app from '../src/app.js';
import { connectDB, closeDB } from '../config/db.js';
import { startTestSmtp } from '../test-support/smtp.js';

const artifacts = fileURLToPath(new URL('../../artifacts', import.meta.url));
const dist = fileURLToPath(new URL('../../client/dist', import.meta.url));
mkdirSync(artifacts, { recursive: true });
let mongo, smtp, apiServer, webServer, browser, upload;
try {
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 }, binary: { downloadDir: fileURLToPath(new URL('../.cache/mongodb', import.meta.url)) } });
  process.env.MONGO_URI = mongo.getUri(); process.env.DB_NAME = 'sakayne_auth_browser_test';
  process.env.CLOUDINARY_CLOUD_NAME = 'local-fixture'; process.env.CLOUDINARY_API_KEY = 'fixture-key'; process.env.CLOUDINARY_API_SECRET = 'fixture-secret';
  const db = await connectDB();
  smtp = await startTestSmtp(); Object.assign(process.env, smtp.environment);
  let inFlight = 0, maxInFlight = 0;
  upload = mock.method(cloudinary.uploader, 'upload', async () => {
    inFlight++; maxInFlight = Math.max(maxInFlight, inFlight);
    // Longer than the old client timeout: verification must remain pending and
    // finish successfully, including the authenticated driver document uploads.
    await new Promise(resolve => setTimeout(resolve, 17000));
    inFlight--;
    return { public_id: 'fixture/document', format: 'png' };
  });
  apiServer = app.listen(0, '127.0.0.1'); await new Promise(resolve => apiServer.once('listening', resolve));
  const apiBase = `http://127.0.0.1:${apiServer.address().port}`;
  const staticApp = express(); staticApp.use(express.static(dist, { extensions: ['html'] }));
  staticApp.get('*', (req, res) => res.sendFile(dist + '/index.html'));
  webServer = staticApp.listen(0, '127.0.0.1'); await new Promise(resolve => webServer.once('listening', resolve));
  const webBase = `http://127.0.0.1:${webServer.address().port}`;
  const edge = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  browser = await chromium.launch(existsSync(edge) ? { executablePath: edge, headless: true } : { headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await context.route('**/api/**', async route => {
    const request = route.request();
    const response = await fetch(apiBase + new URL(request.url()).pathname, {
      method: request.method(), headers: { 'Content-Type': 'application/json', ...(request.headers().authorization ? { Authorization: request.headers().authorization } : {}) },
      ...(request.postData() ? { body: request.postData() } : {}),
    });
    await route.fulfill({ status: response.status, contentType: 'application/json', body: await response.text() });
  });
  async function signup(email, driver = false) {
    const response = await fetch(apiBase + '/api/auth/signup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
      fullName: 'OTP Browser Test', email, phone: '09999999999', password: 'TestPassword123', role: driver ? 'driver' : 'passenger',
      ...(driver ? { licenseNo: 'TEST01', plateNo: 'OTP123', vehicleType: 'bus', documents: Object.fromEntries(['licenseFront', 'licenseBack', 'vehicleReg', 'selfie'].map(key => [key, { base64: 'fixture', mimeType: 'image/png' }])) } : {}),
    }) });
    assert.equal(response.status, 200, await response.text());
    const otp = await db.collection('otps').findOne({ email });
    assert.ok(smtp.messages.at(-1).includes(otp.otp));
    return otp.otp;
  }
  const email = 'driver@example.test', code = await signup(email, true);
  const page = await context.newPage(), errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(webBase + '/verify-otp?email=' + encodeURIComponent(email));
  await page.getByLabel('Email verification code').fill('000000');
  await page.getByRole('button', { name: 'Verify email', exact: true }).click();
  await page.getByText('Invalid or expired OTP', { exact: true }).first().waitFor();
  await page.getByLabel('Email verification code').fill(code);
  await page.getByRole('button', { name: 'Verify email', exact: true }).click();
  await page.getByText(/Verifying your email and saving your registration/).waitFor();
  await page.getByText('Email verified. Sign in with the password you created during registration.', { exact: true }).waitFor({ timeout: 90000 });
  assert.equal(await page.locator('input').nth(0).inputValue(), email);
  assert.equal(maxInFlight, 4);
  assert.equal(Object.keys((await db.collection('drivers').findOne({ email })).documents).length, 4);
  await page.screenshot({ path: artifacts + '/otp-verified.png', fullPage: true });
  // A repeat submission points to login instead of falsely saying the code is bad.
  await page.goto(webBase + '/verify-otp?email=' + encodeURIComponent(email));
  await page.getByLabel('Email verification code').fill(code);
  await page.getByRole('button', { name: 'Verify email', exact: true }).click();
  await page.getByRole('button', { name: 'Go to sign in', exact: true }).click();
  await page.getByText('Sign In', { exact: true }).waitFor();
  await page.locator('input').nth(1).fill('TestPassword123');
  await page.getByText('Sign In', { exact: true }).click();
  await page.getByText('Account Status', { exact: true }).waitFor({ timeout: 30000 });
  await page.getByText('pending', { exact: true }).waitFor();
  await page.screenshot({ path: artifacts + '/otp-driver-pending.png', fullPage: true });

  const passengerEmail = 'passenger@example.test'; await signup(passengerEmail);
  const passengerContext = await browser.newContext();
  // Copy only the fixture API routing, never sessions or user identity.
  await passengerContext.route('**/api/**', async route => {
    const request = route.request();
    const response = await fetch(apiBase + new URL(request.url()).pathname, { method: request.method(), headers: { 'Content-Type': 'application/json' }, ...(request.postData() ? { body: request.postData() } : {}) });
    await route.fulfill({ status: response.status, contentType: 'application/json', body: await response.text() });
  });
  const passenger = await passengerContext.newPage(); passenger.on('pageerror', error => errors.push(error.message));
  await passenger.clock.install();
  await passenger.goto(webBase + '/verify-otp?email=' + encodeURIComponent(passengerEmail));
  await passenger.getByLabel('Email verification code').waitFor();
  await passenger.clock.fastForward(301000);
  await expect(passenger.getByRole('button', { name: 'Verify email', exact: true })).toBeDisabled();
  await passenger.getByText('Resend Code', { exact: true }).click();
  await expect(passenger.getByRole('button', { name: 'Verify email', exact: true })).toBeEnabled();
  await passenger.clock.fastForward(2000);
  await passenger.getByText(/4:5[789]/).waitFor();
  assert.ok(smtp.messages.at(-1).includes((await db.collection('otps').findOne({ email: passengerEmail })).otp));
  assert.deepEqual(errors, []);
  console.log('PASS: mailed OTP, wrong-code rejection, verification beyond 15 seconds, repeat verification, driver login/pending approval, and resend countdown restart.');
} finally {
  upload?.mock.restore(); await browser?.close();
  if (webServer) await new Promise(resolve => webServer.close(resolve));
  if (apiServer) await new Promise(resolve => apiServer.close(resolve));
  await smtp?.close(); await closeDB(); await mongo?.stop();
}
