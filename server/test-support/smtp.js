import net from 'node:net';

// A local inbox for integration tests. No messages leave this process.
export async function startTestSmtp() {
  const messages = [];
  const server = net.createServer(socket => {
    let buffer = '', body = '', inData = false;
    socket.write('220 localhost ESMTP test\r\n');
    socket.on('data', chunk => {
      buffer += chunk.toString();
      while (buffer.includes('\r\n')) {
        const end = buffer.indexOf('\r\n'), line = buffer.slice(0, end);
        buffer = buffer.slice(end + 2);
        if (inData) {
          if (line === '.') { messages.push(body); body = ''; inData = false; socket.write('250 Queued\r\n'); }
          else body += line + '\r\n';
        } else if (/^EHLO/.test(line)) socket.write('250-localhost\r\n250 AUTH PLAIN\r\n');
        else if (/^AUTH/.test(line)) socket.write('235 Authenticated\r\n');
        else if (/^DATA/.test(line)) { inData = true; socket.write('354 Send data\r\n'); }
        else if (/^QUIT/.test(line)) socket.end('221 Bye\r\n');
        else socket.write('250 OK\r\n');
      }
    });
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return {
    messages,
    environment: { SMTP_HOST: '127.0.0.1', SMTP_PORT: String(server.address().port), SMTP_USER: 'mail@example.test', SMTP_PASS: 'local-fixture', APP_NAME: 'Sakay' },
    close: () => new Promise(resolve => server.close(resolve)),
  };
}
