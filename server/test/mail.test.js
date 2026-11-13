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
