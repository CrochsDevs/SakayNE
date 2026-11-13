import assert from 'node:assert/strict';
import { test } from 'node:test';
import { allowedOrigin } from '../shared/security.js';
import { validateImage } from '../config/cloudinary.js';
import { sendError, HttpError } from '../shared/errors.js';

test('production CORS accepts configured origins and native clients only', () => {
  const old = { NODE_ENV: process.env.NODE_ENV, CORS_ORIGINS: process.env.CORS_ORIGINS };
  try {
    process.env.NODE_ENV = 'production';
    process.env.CORS_ORIGINS = 'https://sakay.example';
    assert.equal(allowedOrigin(undefined), true);
    assert.equal(allowedOrigin('https://sakay.example'), true);
    for (const origin of ['https://attacker.example', 'https://sakay.example.attacker.example', 'null', 'http://localhost:8081']) assert.equal(allowedOrigin(origin), false);
    process.env.NODE_ENV = 'development';
    assert.equal(allowedOrigin('http://192.168.1.2:8081'), true);
    assert.equal(allowedOrigin('http://localhost.attacker.example:8081'), false);
  } finally {
    for (const [key, value] of Object.entries(old)) value === undefined ? delete process.env[key] : process.env[key] = value;
  }
});

test('uploads reject remote URLs, spoofed data URIs, non-images and oversized bodies', () => {
  const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aN1cAAAAASUVORK5CYII=';
  assert.equal(validateImage(png, 'image/png'), `data:image/png;base64,${png}`);
  assert.equal(validateImage(`data:image/png;base64,${png}`, 'image/png'), `data:image/png;base64,${png}`);
  for (const value of ['https://localhost/private', `data:text/html;base64,${png}`, Buffer.from('<script>alert(1)</script>').toString('base64'), {}, 'A'.repeat(8 * 1024 * 1024)]) assert.throws(() => validateImage(value, 'image/png'), HttpError);
  assert.throws(() => validateImage(png, 'image/jpeg'), HttpError);
});

test('unexpected provider and database exceptions never appear in client errors', () => {
  const res = { status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
  sendError(res, new Error('mongodb://user:secret@internal-host'));
  assert.equal(res.code, 500);
  assert.equal(JSON.stringify(res.body).includes('secret'), false);
  sendError(res, new HttpError(400, 'Invalid image'));
  assert.equal(res.code, 400);
  assert.equal(res.body.error, 'Invalid image');
});
