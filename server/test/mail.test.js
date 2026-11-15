import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sendEmail } from '../config/mail.js';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, unlinkSync, rmdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

function configureBrevo(t) {
  for (const [name, value] of Object.entries({ BREVO_API_KEY: 'private-api-key', EMAIL_FROM: 'verified@example.test' })) {
    const previous = process.env[name];
    process.env[name] = value;
    t.after(() => { if (previous === undefined) delete process.env[name]; else process.env[name] = previous; });
  }
}

test('email templates work in a server-only deployment even when the optional logo asset is absent', async () => {
  const root = mkdtempSync(join(tmpdir(), 'sakay-email-template-'));
  const config = join(root, 'config'), file = join(config, 'email-template.mjs');
  mkdirSync(config);
  try {
    writeFileSync(file, readFileSync(new URL('../config/email-template.js', import.meta.url)));
    const templates = await import(pathToFileURL(file).href);
    for (const render of [templates.verifyEmailTemplate, templates.otpTemplate]) {
      const html = render({ otp: '123456' });
      assert.match(html, /123456/); assert.match(html, /SAKAY/); assert.ok(!html.includes('src="null"'));
    }
  } finally { unlinkSync(file); rmdirSync(config); rmdirSync(root); }
});

test('Brevo sends account mail over HTTPS with verified sender, bounded timeout and no SMTP fallback', async t => {
  configureBrevo(t);
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    calls++;
    assert.equal(url, 'https://api.brevo.com/v3/smtp/email');
    assert.equal(options.method, 'POST');
    assert.equal(options.headers['api-key'], 'private-api-key');
    assert.equal(options.redirect, 'error');
    assert.ok(options.signal instanceof AbortSignal);
    const body = JSON.parse(options.body);
    assert.equal(body.sender.email, 'verified@example.test');
    assert.deepEqual(body.to, [{ email: 'passenger@example.test' }]);
    assert.equal(body.subject, 'Verify');
    assert.equal(body.htmlContent, '<p>123456</p>');
    return Response.json({ messageId: 'queued-test-message' }, { status: 201 });
  });
  const result = await sendEmail({ to: 'passenger@example.test', subject: 'Verify', html: '<p>123456</p>' });
  assert.deepEqual(result.accepted, ['passenger@example.test']);
  assert.equal(result.messageId, 'queued-test-message');
  assert.equal(calls, 1);
});

test('Brevo rejection, timeout and malformed acceptance stay private and never retry', async t => {
  configureBrevo(t);
  const logs = [];
  t.mock.method(console, 'error', (...args) => logs.push(args));
  for (const status of [400, 401, 403, 429, 500]) {
    let calls = 0;
    const fetchMock = t.mock.method(globalThis, 'fetch', async () => {
      calls++;
      return Response.json({ message: 'private-api-key passenger@example.test OTP=123456' }, { status });
    });
    await assert.rejects(sendEmail({ to: 'passenger@example.test', subject: 'OTP', html: '123456' }), { status: 503, code: 'EMAIL_DELIVERY_UNAVAILABLE' });
    assert.equal(calls, 1);
    assert.deepEqual(logs.at(-1)[1], { provider: 'brevo', code: 'MAIL_HTTP_REJECTED', responseCode: status });
    fetchMock.mock.restore();
  }
  for (const [reply, code] of [
    [() => { throw new DOMException('secret timeout', 'TimeoutError'); }, 'ETIMEDOUT'],
    [() => { throw new Error('private-api-key network failure'); }, 'MAIL_PROVIDER_ERROR'],
    [() => Response.json({}, { status: 201 }), 'MAIL_NOT_ACCEPTED'],
    [() => new Response('not-json', { status: 201 }), 'MAIL_PROVIDER_ERROR'],
  ]) {
    let calls = 0;
    const fetchMock = t.mock.method(globalThis, 'fetch', async () => { calls++; return reply(); });
    await assert.rejects(sendEmail({ to: 'passenger@example.test', subject: 'OTP', html: '123456' }), { status: 503, code: 'EMAIL_DELIVERY_UNAVAILABLE' });
    assert.equal(calls, 1);
    assert.equal(logs.at(-1)[1].code, code);
    fetchMock.mock.restore();
  }
  for (const secret of ['private-api-key', 'passenger@example.test', '123456', 'secret timeout']) assert.ok(!JSON.stringify(logs).includes(secret));
});

test('missing Brevo configuration fails without a network call', async t => {
  configureBrevo(t);
  const logs = [];
  t.mock.method(console, 'error', (...args) => logs.push(args));
  t.mock.method(globalThis, 'fetch', () => { assert.fail('No request with invalid configuration'); });
  for (const name of ['BREVO_API_KEY', 'EMAIL_FROM']) {
    const previous = process.env[name];
    process.env[name] = ' ';
    await assert.rejects(sendEmail({ to: 'passenger@example.test', subject: 'OTP', html: '123456' }), { status: 503 });
    assert.equal(logs.at(-1)[1].code, 'MAIL_CONFIG_MISSING');
    process.env[name] = previous;
  }

});
