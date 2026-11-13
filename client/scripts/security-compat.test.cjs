const assert = require('node:assert/strict');
const { test } = require('node:test');
const { performance } = require('node:perf_hooks');
const query = require('query-string');

test('patched URL decoder preserves router query encoding and malformed input behavior', () => {
  assert.equal(query.parse('name=Mu%C3%B1oz&route=jeep-cabanatuan-san-jose').name, 'Mu\u00f1oz');
  assert.equal(query.stringify({ name: 'Mu\u00f1oz', seats: 2 }), 'name=Mu%C3%B1oz&seats=2');
  assert.deepEqual({ ...query.parse('seats=1&seats=2') }, { seats: ['1', '2'] });
  for (const input of ['%E0%A4%A', '%FF'.repeat(50000), '%C2'.repeat(50000)]) {
    const start = performance.now();
    const result = query.parse('q=' + input);
    assert.equal(typeof result.q, 'string');
    assert.ok(performance.now() - start < 5000, 'Malformed URL decoding must have bounded processing time');
  }
});

test('ngrok retains its CommonJS v4 UUID interface after the security override', () => {
  const { createRequire } = require('node:module');
  const ngrokRequire = createRequire(require.resolve('@expo/ngrok'));
  assert.equal(typeof require('@expo/ngrok').connect, 'function');
  assert.match(ngrokRequire('uuid').v4(), /^[0-9a-f-]{36}$/);
});
