import assert from 'node:assert/strict';
import { test, mock } from 'node:test';
import express from 'express';
import { activityLog } from '../shared/activity-log.js';

test('activity logs record actions, outcomes and request IDs without sensitive input or polling noise', async () => {
  const entries = [];
  const spies = ['info', 'warn', 'error'].map(level => mock.method(console, level, line => entries.push(JSON.parse(line))));
  const app = express(); app.use(activityLog); app.use(express.json());
  app.use((req, res, next) => { if (req.path.includes('/reports')) req.auth = { userId: 'fixture-user-id', role: 'passenger', email: 'private@example.test', tokenHash: 'private-token' }; next(); });
  app.post('/api/auth/signup', (req, res) => res.status(503).json({ error: 'Email unavailable' }));
  app.post('/api/auth/login', (req, res) => res.json({ ok: true }));
  app.post('/api/auth/forgot-password', (req, res) => res.status(400).json({ error: 'Invalid request' }));
  app.post('/api/reports', (req, res) => res.status(201).json({ ok: true }));
  app.post('/api/rides', (req, res) => res.status(201).json({ ok: true }));
  app.use((req, res) => res.json({ ok: true }));
  const server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    for (const path of ['/auth/signup', '/auth/login', '/auth/forgot-password', '/reports', '/rides']) {
      const response = await fetch(base + '/api' + path + '?email=private@example.test&otp=654321', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer private-token' }, body: JSON.stringify({ email: 'private@example.test', password: 'private-password', otp: '654321', details: 'private-complaint', latitude: 15.123456 }) });
      await response.json();
      assert.match(response.headers.get('x-request-id'), /^[a-f\d-]{36}$/);
    }
    for (const [path, method] of [['/rides/active', 'GET'], ['/drivers/heartbeat', 'POST'], ['/drivers/location', 'POST'], ['/reports', 'GET']]) {
      const response = await fetch(base + '/api' + path, { method }); await response.json();
    }
    assert.equal(entries.length, 5);
    assert.deepEqual(entries.map(entry => entry.action), ['auth.signup', 'auth.signin', 'auth.forgot_password', 'report.create', 'booking.create']);
    assert.deepEqual(entries.map(entry => entry.outcome), ['failed', 'succeeded', 'rejected', 'succeeded', 'succeeded']);
    assert.deepEqual(entries.map(entry => entry.level), ['error', 'info', 'warning', 'info', 'info']);
    assert.equal(new Set(entries.map(entry => entry.requestId)).size, 5);
    assert.equal(entries[3].actorId, 'fixture-user-id'); assert.equal(entries[3].role, 'passenger');
    assert.ok(entries.every(entry => Number.isInteger(entry.durationMs) && entry.durationMs >= 0));
    for (const secret of ['private@example.test', 'private-password', '654321', 'private-token', 'private-complaint', '15.123456']) assert.equal(JSON.stringify(entries).includes(secret), false);
  } finally { await new Promise(resolve => server.close(resolve)); spies.forEach(spy => spy.mock.restore()); }
});
