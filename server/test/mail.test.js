import { test } from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import { sendEmail } from '../config/mail.js';

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
