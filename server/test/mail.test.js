import { mock, test } from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import { sendEmail } from '../config/mail.js';
import nodemailer from 'nodemailer';
import { sendError } from '../shared/errors.js';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, unlinkSync, rmdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

function configureBrevo(t) {
  for (const [name, value] of Object.entries({ EMAIL_PROVIDER: 'brevo', BREVO_API_KEY: 'private-api-key', EMAIL_FROM: 'verified@example.test' })) {
    const previous = process.env[name];
    process.env[name] = value;
    t.after(() => { if (previous === undefined) delete process.env[name]; else process.env[name] = previous; });
  }
}

test('account email uses the configured SMTP transport and renders its content', async () => {
  let received = '', body = '', buffer = '', inData = false;
  const server = net.createServer(socket => {
    socket.write('220 localhost ESMTP test\r\n');
    socket.on('data', chunk => {
      buffer += chunk.toString();
      while (buffer.includes('\r\n')) {
        const pos = buffer.indexOf('\r\n'), line = buffer.slice(0, pos);
        buffer = buffer.slice(pos + 2);
        if (inData) {
          if (line === '.') { received = body; inData = false; socket.write('250 Queued\r\n'); }
          else body += line + '\r\n';
        } else if (/^EHLO/.test(line)) socket.write('250-localhost\r\n250 AUTH PLAIN\r\n');
        else if (/^AUTH/.test(line)) socket.write('235 Authenticated\r\n');
        else if (/^DATA/.test(line)) { inData = true; socket.write('354 Send data\r\n'); }
        else if (/^QUIT/.test(line)) { socket.end('221 Bye\r\n'); }
        else socket.write('250 OK\r\n');
      }
    });
  });
  server.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
  process.env.SMTP_HOST = '127.0.0.1'; process.env.SMTP_PORT = String(server.address().port);
  process.env.SMTP_USER = 'mail@example.test'; process.env.SMTP_PASS = 'local-fixture'; process.env.APP_NAME = 'Sakay';
  try {
    const result = await sendEmail({ to: 'passenger@example.test', subject: 'Verify your account', html: '<p>Your code is 123456</p>' });
    assert.equal(result.accepted[0], 'passenger@example.test');
    assert.match(received, /Subject: Verify your account/);
    assert.match(received, /123456/);
  } finally { await new Promise(resolve => server.close(resolve)); }
});

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

test('SMTP failures expose a deliberate service error and log no password, recipient, OTP or provider response', async () => {
  const logs = []; let closed = 0;
  const logger = mock.method(console, 'error', (...args) => logs.push(args));
  const transport = mock.method(nodemailer, 'createTransport', () => ({
    async sendMail() { throw Object.assign(new Error('password=private-secret recipient=private@example.test OTP=654321'), { code: 'EAUTH', responseCode: 535 }); },
    close() { closed++; },
  }));
  try {
    await assert.rejects(sendEmail({ to: 'private@example.test', subject: 'OTP', html: '654321' }), error => {
      let status, body;
      const res = { status(value) { status = value; return this; }, json(value) { body = value; } };
      sendError(res, error);
      assert.equal(status, 503);
      assert.deepEqual(body, { error: 'Email delivery is temporarily unavailable. Please try again later.', code: 'EMAIL_DELIVERY_UNAVAILABLE' });
      assert.equal(JSON.stringify(body).includes('private-secret'), false);
      return true;
    });
    assert.equal(closed, 1); assert.equal(logs[0][1].code, 'EAUTH');
    for (const secret of ['private-secret', 'private@example.test', '654321']) assert.equal(JSON.stringify(logs).includes(secret), false);
  } finally { logger.mock.restore(); transport.mock.restore(); }
});

test('Brevo sends account mail over HTTPS with verified sender, bounded timeout and no SMTP fallback', async t => {
  configureBrevo(t);
  let calls = 0;
  t.mock.method(nodemailer, 'createTransport', () => { assert.fail('SMTP must not be used in Brevo mode'); });
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
  t.mock.method(nodemailer, 'createTransport', () => { assert.fail('No SMTP fallback'); });
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

test('missing Brevo configuration and invalid provider fail without a network call', async t => {
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
  process.env.EMAIL_PROVIDER = 'invalid-private-value';
  await assert.rejects(sendEmail({ to: 'passenger@example.test', subject: 'OTP', html: '123456' }), { status: 503 });
  assert.deepEqual(logs.at(-1)[1], { provider: 'invalid', code: 'MAIL_CONFIG_INVALID' });
});
