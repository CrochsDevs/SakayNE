import assert from 'node:assert/strict';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { performance, monitorEventLoopDelay } from 'node:perf_hooks';
import { ObjectId } from 'mongodb';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import app from '../src/app.js';
import { connectDB, closeDB, getDB, ensureIndexes } from '../config/db.js';
import { createSession } from '../shared/session.js';

let mongo, server;
const lag = monitorEventLoopDelay({ resolution: 20 });
try {
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 }, binary: { downloadDir: fileURLToPath(new URL('../.cache/mongodb', import.meta.url)) } });
  process.env.MONGO_URI = mongo.getUri(); process.env.DB_NAME = 'sakay_performance_fixture';
  await connectDB(); const db = getDB();
  const email = 'passenger@example.test', driverId = new ObjectId();
  await db.collection('users').insertOne({ email, fullName: 'Performance fixture' });
  await db.collection('auth').insertOne({ email, role: 'passenger', verified: true });
  const token = await createSession(email, 'passenger');
  await db.collection('drivers').insertMany([
    ...Array.from({ length: 5000 }, (_, i) => ({ email: `inactive-${i}@example.test`, isAvailable: false, verified: true, approvalStatus: 'approved', routeId: 'jeep-cabanatuan-palayan' })),
    { _id: driverId, email: 'driver@example.test', fullName: 'Driver fixture', vehicleType: 'jeepney', plateNo: 'FIXTURE', routeId: 'jeep-cabanatuan-palayan', isAvailable: true, verified: true, approvalStatus: 'approved', onlineUntil: new Date(Date.now() + 3600000), reservedSeats: 1, capacity: 16 },
  ]);
  await db.collection('rides').insertMany([
    ...Array.from({ length: 10000 }, (_, i) => ({ passengerEmail: i % 1000 ? `other-${i % 1000}@example.test` : email, driverEmail: `driver-${i % 200}@example.test`, driverId: new ObjectId().toString(), status: i > 0 && i < 1000 ? 'ongoing' : 'completed', createdAt: new Date(1700000000000 + i * 1000).toISOString(), fromName: 'Fixture A', toName: 'Fixture B', seats: 1, fare: 20 })),
    { passengerEmail: email, driverEmail: 'driver@example.test', driverId: driverId.toString(), status: 'ongoing', createdAt: new Date().toISOString(), fromName: 'Fixture A', toName: 'Fixture B', seats: 1, fare: 20 },
  ]);
  await db.collection('notifications').insertMany(Array.from({ length: 10000 }, (_, i) => ({ email: i % 1000 ? `other-${i % 1000}@example.test` : email, createdAt: new Date(1700000000000 + i * 1000).toISOString(), read: false })));
  const checks = [
    { name: 'driver profile', collection: 'drivers', index: 'email_1', query: { email: 'driver@example.test' } },
    { name: 'online fleet', collection: 'drivers', index: 'isAvailable_1_verified_1_approvalStatus_1_onlineUntil_1', query: { isAvailable: true, verified: true, approvalStatus: 'approved', onlineUntil: { $gt: new Date() } } },
    { name: 'driver occupancy', collection: 'rides', index: 'driverId_1_status_1', query: { driverId: driverId.toString(), status: 'ongoing', occupancyStatus: { $ne: 'alighted' }, seatsReleasedAt: { $exists: false } } },
    { name: 'passenger history', collection: 'rides', index: 'passengerEmail_1_createdAt_-1', query: { passengerEmail: email, status: { $nin: ['pending', 'accepted', 'arrived', 'ongoing'] } }, sort: { createdAt: -1 } },
    { name: 'notifications', collection: 'notifications', index: 'email_1_createdAt_-1', query: { email }, sort: { createdAt: -1 } },
  ];
  // Only this disposable fixture loses indexes for a controlled baseline comparison.
  for (const check of checks) await db.collection(check.collection).dropIndex(check.index);
  async function plans() {
    return Promise.all(checks.map(async check => {
      const plan = await db.collection(check.collection).find(check.query).sort(check.sort || {}).limit(100).explain('executionStats');
      return { query: check.name, examined: plan.executionStats.totalDocsExamined, returned: plan.executionStats.nReturned, databaseMs: plan.executionStats.executionTimeMillis };
    }));
  }
  const before = await plans(); await ensureIndexes(db); const after = await plans();
  for (let i = 0; i < checks.length; i++) assert.ok(after[i].examined < before[i].examined, checks[i].name + ' must examine fewer documents');
  server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api`, paths = ['/drivers', '/rides/active', '/notifications', '/rides'];
  const samples = []; let next = 0; lag.enable(); const started = performance.now();
  await Promise.all(Array.from({ length: 10 }, async () => {
    while (next < 120) {
      const number = next++, start = performance.now();
      const response = await fetch(base + paths[number % paths.length], { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(15000) });
      assert.equal(response.status, 200); await response.json(); samples.push(performance.now() - start);
    }
  }));
  const elapsed = performance.now() - started; lag.disable(); samples.sort((a, b) => a - b);
  const report = { fixture: { drivers: 5001, rides: 10001, notifications: 10000 }, before, after, requests: samples.length, concurrency: 10, elapsedMs: Math.round(elapsed), p50Ms: Math.round(samples[Math.floor(samples.length * 0.5)]), p95Ms: Math.round(samples[Math.floor(samples.length * 0.95)]), maxMs: Math.round(samples.at(-1)), eventLoopP95Ms: Math.round(lag.percentile(95) / 1e6), errors: 0, scope: 'Local isolated fixture; not production capacity or a mobile network benchmark.' };
  const dir = fileURLToPath(new URL('../../artifacts', import.meta.url)); mkdirSync(dir, { recursive: true }); writeFileSync(dir + '/api-performance.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally {
  lag.disable(); if (server) await new Promise(resolve => server.close(resolve)); await closeDB(); await mongo?.stop();
}
