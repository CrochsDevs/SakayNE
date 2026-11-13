import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createPoller } from '../../client/src/ride/polling.mjs';

const flush = () => new Promise(resolve => setImmediate(resolve));
function clock() {
  const timers = new Map(); let id = 0;
  return {
    timers,
    setTimer(fn, delay) { timers.set(++id, { fn, delay }); return id; },
    clearTimer(key) { timers.delete(key); },
    async tick() { const [key, timer] = timers.entries().next().value; timers.delete(key); timer.fn(); await flush(); },
  };
}
function deferred() { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; }

test('manual refresh waits for the current request and coalesces repeated refreshes into one fresh load', async () => {
  const c = clock(), old = deferred(), fresh = deferred(), values = [];
  let calls = 0, running = 0, peak = 0;
  const p = createPoller({ ...c, load: async () => { const request = ++calls; peak = Math.max(peak, ++running); try { return await (request === 1 ? old.promise : fresh.promise); } finally { running--; } }, onData: value => values.push(value), onError: assert.fail, onSettled() {} });
  const first = p.start(); await flush();
  const a = p.refresh(), b = p.refresh();
  assert.equal(a, b); assert.equal(calls, 1);
  old.resolve('before mutation'); await first; await flush();
  assert.equal(calls, 2); assert.equal(peak, 1);
  fresh.resolve('after mutation'); await a;
  assert.equal(values.at(-1), 'after mutation');
  assert.equal(c.timers.size, 1);
  p.stop(); assert.equal(c.timers.size, 0);
});

test('blur and refocus discard stale data and wait for the old request before starting another', async () => {
  const c = clock(), old = deferred(), values = []; let calls = 0;
  const p = createPoller({ ...c, load: () => ++calls === 1 ? old.promise : Promise.resolve('new screen'), onData: value => values.push(value), onError: assert.fail, onSettled() {} });
  const first = p.start(); await flush(); p.stop(); const resumed = p.start();
  assert.equal(calls, 1); old.resolve('stale screen'); await first; await resumed;
  assert.deepEqual(values, ['new screen']); assert.equal(calls, 2);
  p.stop(); await p.refresh(); assert.equal(calls, 2); assert.equal(c.timers.size, 0);
});

test('API failures back off to 30 seconds, recover and never create a zero-delay retry loop', async () => {
  const c = clock(), failures = []; let broken = true, calls = 0;
  const p = createPoller({ ...c, delay: 500, load: async () => { calls++; if (broken) throw new Error('offline'); return 'ok'; }, onData() {}, onError: e => failures.push(e), onSettled() {} });
  await p.start(); const delays = [];
  for (let n = 0; n < 8; n++) { assert.equal(c.timers.size, 1); delays.push([...c.timers.values()][0].delay); await c.tick(); }
  assert.deepEqual(delays, [1000, 2000, 4000, 8000, 16000, 30000, 30000, 30000]);
  assert.equal(calls, 9); assert.equal(failures.length, 9);
  broken = false; await c.tick(); assert.equal([...c.timers.values()][0].delay, 500);
  p.stop(); assert.equal(c.timers.size, 0);
});

test('invalid delays cannot create hot loops and longer configured intervals are respected', async () => {
  const c = clock();
  const p = createPoller({ ...c, delay: 0, load: async () => 'ok', onData() {}, onError: assert.fail, onSettled() {} });
  await p.start();
  assert.equal([...c.timers.values()][0].delay, 250);
  p.setDelay(60000); assert.equal(c.timers.size, 1); assert.equal([...c.timers.values()][0].delay, 60000);
  p.setDelay(NaN); assert.equal([...c.timers.values()][0].delay, 5000);
  p.stop(); assert.equal(c.timers.size, 0);
});
