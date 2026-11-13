import assert from 'node:assert/strict';
import { before, after, beforeEach, test } from 'node:test';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { ObjectId } from 'mongodb';
import { fileURLToPath } from 'node:url';
import { connectDB, closeDB, getDB } from '../config/db.js';
import { createSession } from '../shared/session.js';
import app from '../src/app.js';
import { rateLimit } from '../shared/rate-limit.js';

let mongo, server, base, tokens, rideId;
before(async () => {
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 }, binary: { downloadDir: fileURLToPath(new URL('../.cache/mongodb', import.meta.url)) } });
  process.env.MONGO_URI = mongo.getUri(); process.env.DB_NAME = 'sakay_reports_tests';
  await connectDB();
  server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}/api`;
});
after(async () => { if (server) await new Promise(resolve => server.close(resolve)); await closeDB(); await mongo?.stop(); });
beforeEach(async () => {
  const db = getDB();
  for (const collection of await db.listCollections().toArray()) await db.collection(collection.name).deleteMany({});
  tokens = {};
  for (const [name, role] of [['passenger', 'passenger'], ['other', 'passenger'], ['driver', 'driver'], ['admin', 'admin']]) {
    const email = `${name}@example.test`;
    await db.collection('auth').insertOne({ email, role, verified: true });
    await db.collection('users').insertOne({ email, fullName: name });
    tokens[name] = await createSession(email, role);
  }
  rideId = new ObjectId().toString();
  await db.collection('rides').insertOne({ _id: new ObjectId(rideId), passengerEmail: 'passenger@example.test', passengerName: 'Passenger Fixture', driverId: new ObjectId().toString(), driverEmail: 'driver@example.test', driverName: 'Driver Fixture', vehicle: 'TEST 123', fromName: 'Guimba', toName: 'Cabanatuan', status: 'completed' });
});
async function api(path, role = 'passenger', method = 'GET', body) {
  const res = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...(tokens[role] ? { Authorization: `Bearer ${tokens[role]}` } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  return { status: res.status, body: await res.json() };
}
const input = extra => ({ rideId, reason: 'Unsafe driving', details: 'The driver ignored the agreed drop-off.', ...extra });

test('report rate limits separate authenticated passengers sharing the same network', () => {
  const limit = rateLimit(1, 60000, req => req.auth.userId);
  let passed = 0, rejected = 0;
  const res = { set() {}, status(value) { assert.equal(value, 429); return this; }, json() { rejected++; } };
  for (const userId of ['first', 'first', 'second']) limit({ ip: '127.0.0.1', auth: { userId } }, res, () => { passed++; });
  assert.equal(passed, 2); assert.equal(rejected, 1);
});

test('report creation verifies the passenger booking, rejects spoofing and duplicates, and notifies admins', async () => {
  assert.equal((await api('/reports', 'anonymous')).status, 401);
  for (const role of ['driver', 'admin']) assert.equal((await api('/reports', role, 'POST', input())).status, 403);
  assert.equal((await api('/reports', 'passenger', 'POST', input({ rideId: 'invalid' }))).status, 400);
  assert.equal((await api('/reports', 'passenger', 'POST', input({ reason: 'invented' }))).status, 400);
  assert.equal((await api('/reports', 'passenger', 'POST', input({ details: 'short' }))).status, 400);
  assert.equal((await api('/reports', 'other', 'POST', input())).status, 404);
  const result = await api('/reports', 'passenger', 'POST', input({ passengerEmail: 'other@example.test', driverName: 'Forged', status: 'resolved', adminResponse: 'Forged', email: 'other@example.test' }));
  assert.equal(result.status, 201);
  assert.equal(result.body.report.driverName, 'Driver Fixture'); assert.equal(result.body.report.status, 'open');
  assert.equal(result.body.report.adminResponse, ''); assert.equal(result.body.report.passengerEmail, undefined);
  const stored = await getDB().collection('driver_reports').findOne({ rideId });
  assert.equal(stored.passengerEmail, 'passenger@example.test');
  assert.equal((await api('/reports', 'passenger', 'POST', input())).status, 409);
  assert.equal(await getDB().collection('driver_reports').countDocuments({}), 1);
  assert.equal(await getDB().collection('notifications').countDocuments({ email: 'admin@example.test', type: 'driver_report' }), 1);
  assert.equal(await getDB().collection('notifications').countDocuments({ email: 'driver@example.test' }), 0);
  assert.equal((await api('/reports', 'other')).body.reports.length, 0);
  assert.equal((await api('/reports?rideId=' + rideId)).body.reports.length, 1);
});

test('only admins can review reports and the passenger receives the saved response and status', async () => {
  const created = await api('/reports', 'passenger', 'POST', input());
  const id = created.body.report.id, path = '/admin/reports/' + id;
  for (const role of ['passenger', 'other', 'driver']) {
    assert.equal((await api('/admin/reports', role)).status, 403);
    assert.equal((await api(path, role, 'PATCH', { status: 'resolved', response: 'Forged response' })).status, 403);
  }
  assert.equal((await api(path, 'admin', 'PATCH', { status: 'invalid', response: 'Reviewed' })).status, 400);
  assert.equal((await api(path, 'admin', 'PATCH', { status: 'resolved', response: '' })).status, 400);
  for (const status of ['in_review', 'resolved', 'dismissed', 'open']) {
    const review = await api(path, 'admin', 'PATCH', { status, response: 'We are reviewing this incident.' });
    assert.equal(review.status, 200); assert.equal(review.body.report.status, status);
  }
  const mine = (await api('/reports')).body.reports[0];
  assert.equal(mine.adminResponse, 'We are reviewing this incident.'); assert.equal(mine.reviewedBy, undefined);
  assert.equal(await getDB().collection('audit_logs').countDocuments({ targetId: id }), 4);
  assert.equal(await getDB().collection('notifications').countDocuments({ email: 'passenger@example.test', type: 'driver_report' }), 4);
  const admin = (await api('/admin/reports', 'admin')).body.reports[0];
  assert.equal(admin.passengerEmail, 'passenger@example.test'); assert.equal(admin.passengerName, 'Passenger Fixture');
  assert.equal((await api('/reports', 'other')).body.reports.length, 0);
  assert.equal((await api('/admin/reports/' + new ObjectId(), 'admin', 'PATCH', { status: 'resolved', response: 'Reviewed' })).status, 404);
});

test('reports paginate without leaking other passengers and validate filters and long incident text', async () => {
  assert.equal((await api('/reports', 'passenger', 'POST', input({ details: 'x'.repeat(2001) }))).status, 400);
  await getDB().collection('driver_reports').insertMany(Array.from({ length: 34 }, (_, i) => ({ _id: new ObjectId(), rideId: new ObjectId().toString(), passengerEmail: i === 0 ? 'other@example.test' : 'passenger@example.test', status: 'open', details: 'A test incident', createdAt: new Date().toISOString() })));
  const first = (await api('/reports')).body;
  assert.equal(first.reports.length, 30); assert.ok(first.nextCursor);
  const second = (await api('/reports?cursor=' + first.nextCursor)).body;
  assert.equal(second.reports.length, 3); assert.equal(second.nextCursor, null);
  assert.equal(new Set([...first.reports, ...second.reports].map(report => report.id)).size, 33);
  assert.equal((await api('/admin/reports?status=resolved', 'admin')).body.reports.length, 0);
  for (const query of ['cursor=invalid', 'status=invalid', 'rideId=invalid']) assert.equal((await api('/reports?' + query)).status, 400);
});

test('concurrent reports for the same booking store only one report and admin notification', async () => {
  const results = await Promise.all([api('/reports', 'passenger', 'POST', input()), api('/reports', 'passenger', 'POST', input())]);
  assert.deepEqual(results.map(result => result.status).sort(), [201, 409]);
  assert.equal(await getDB().collection('driver_reports').countDocuments({ rideId }), 1);
  assert.equal(await getDB().collection('notifications').countDocuments({ email: 'admin@example.test', type: 'driver_report' }), 1);
});
