import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { fileURLToPath } from 'node:url';
import { closeDB, connectDB, getDB } from '../config/db.js';
import { startTestSmtp } from '../test-support/smtp.js';
import app from '../src/app.js';

let mongo, server, base;
before(async () => {
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 }, binary: { downloadDir: fileURLToPath(new URL('../.cache/mongodb', import.meta.url)) } });
  process.env.MONGO_URI = mongo.getUri();
  process.env.DB_NAME = 'sakay_passenger_auth_tests';
  await connectDB();
  server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}/api`;
});
after(async () => {
  if (server) await new Promise(resolve => server.close(resolve));
  await closeDB();
  await mongo?.stop();
});
async function api(path, role, method, body) {
  const res = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  return { status: res.status, body: await res.json() };
}

test('passenger signup, email verification and password reset deliver codes and create only a passenger account', async () => {
  const smtp = await startTestSmtp(); Object.assign(process.env, smtp.environment);
  const email = 'passenger-email-flow@example.test';
  try {
    const signup = await api('/auth/signup', 'anonymous', 'POST', { fullName: 'Passenger Fixture', email, phone: '09123456756', password: '1234567890', role: 'passenger' });
    assert.equal(signup.status, 200, JSON.stringify(signup.body));
    const registration = await getDB().collection('otps').findOne({ email, purpose: 'registration' });
    assert.ok(registration); assert.match(smtp.messages[0], new RegExp(registration.otp));
    assert.equal((await api('/auth/verify-email', 'anonymous', 'POST', { email, otp: registration.otp })).status, 200);
    assert.equal((await getDB().collection('auth').findOne({ email })).role, 'passenger');
    assert.equal(await getDB().collection('drivers').countDocuments({ email }), 0);
    assert.equal((await api('/auth/login', 'anonymous', 'POST', { identifier: email, password: '1234567890' })).status, 200);
    assert.equal((await api('/auth/forgot-password', 'anonymous', 'POST', { email })).status, 200);
    const reset = await getDB().collection('otps').findOne({ email, purpose: 'reset' });
    assert.match(smtp.messages[1], new RegExp(reset.otp));
    assert.equal((await api('/auth/reset-password', 'anonymous', 'POST', { email, otp: reset.otp, newPassword: 'ChangedPassword123' })).status, 200);
    assert.equal((await api('/auth/login', 'anonymous', 'POST', { identifier: email, password: '1234567890' })).status, 401);
    assert.equal((await api('/auth/login', 'anonymous', 'POST', { identifier: email, password: 'ChangedPassword123' })).status, 200);
  } finally { await smtp.close(); }
});

test('bus signup, pending bus verification and OTP resend return coming soon without creating accounts or sending mail', async () => {
  const smtp = await startTestSmtp(); Object.assign(process.env, smtp.environment);
  const email = 'bus-coming-soon@example.test';
  try {
    const signup = await api('/auth/signup', 'anonymous', 'POST', { fullName: 'Bus Fixture', email, phone: '09123456789', password: 'TestPassword123', role: 'driver', vehicleType: 'bus', licenseNo: 'TEST', plateNo: 'TEST 123' });
    assert.equal(signup.status, 409); assert.match(signup.body.error, /coming soon/i);
    assert.equal(await getDB().collection('pending_users').countDocuments({ email }), 0);
    assert.equal(await getDB().collection('otps').countDocuments({ email }), 0);
    await getDB().collection('pending_users').insertOne({ email, data: { role: 'driver', vehicleType: 'bus' }, createdAt: new Date() });
    await getDB().collection('otps').insertOne({ email, otp: '123456', purpose: 'registration', expiresAt: new Date(Date.now() + 300000) });
    for (const path of ['/auth/verify-email', '/otp/verify', '/otp/send']) {
      const result = await api(path, 'anonymous', 'POST', { email, otp: '123456' });
      assert.equal(result.status, 409); assert.match(result.body.error, /coming soon/i);
    }
    assert.equal(await getDB().collection('auth').countDocuments({ email }), 0);
    assert.equal(await getDB().collection('drivers').countDocuments({ email }), 0);
    assert.equal(smtp.messages.length, 0);
  } finally { await smtp.close(); }
});
