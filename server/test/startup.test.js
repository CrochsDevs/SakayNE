import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import { MongoMemoryReplSet } from 'mongodb-memory-server';

let mongo;
const cwd = fileURLToPath(new URL('../', import.meta.url));
before(async () => {
  mongo = await MongoMemoryReplSet.create({
    replSet: { count: 1 }, binary: { downloadDir: fileURLToPath(new URL('../.cache/mongodb', import.meta.url)) },
  });
});
after(async () => { await mongo?.stop(); });

function launch(port) {
  const child = spawn(process.execPath, ['src/index.js'], {
    cwd, windowsHide: true,
    env: { ...process.env, MONGO_URI: mongo.getUri(), DB_NAME: 'sakayne_startup_tests', PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const output = { stdout: '', stderr: '' };
  child.stdout.on('data', chunk => { output.stdout += chunk; });
  child.stderr.on('data', chunk => { output.stderr += chunk; });
  return { child, output };
}

test('an occupied port produces a clear error and exits without stopping the existing listener', { timeout: 25000 }, async () => {
  const existing = http.createServer((req, res) => res.end('existing server'));
  existing.listen(0, '0.0.0.0'); await once(existing, 'listening');
  const port = existing.address().port;
  const { child, output } = launch(port);
  try {
    const [code] = await once(child, 'exit');
    assert.equal(code, 1);
    assert.match(output.stderr, new RegExp(`port ${port} is already in use`));
    assert.doesNotMatch(output.stderr, /Unhandled|node:events|throw er;/);
    assert.doesNotMatch(output.stdout, /Server running at/);
    assert.equal(await (await fetch(`http://127.0.0.1:${port}`)).text(), 'existing server');
  } finally {
    if (child.exitCode === null) { child.kill(); await once(child, 'exit'); }
    await new Promise(resolve => existing.close(resolve));
  }
});

test('normal startup reports the actual listening port and serves database health', { timeout: 25000 }, async () => {
  const { child, output } = launch(0);
  try {
    const port = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error(`Startup timed out: ${output.stderr}`)), 15000);
      const started = chunk => {
        const match = (output.stdout + chunk).match(/Server running at http:\/\/0\.0\.0\.0:(\d+)/);
        if (match) { clearTimeout(timeout); resolve(Number(match[1])); }
      };
      child.stdout.on('data', started);
      child.once('exit', code => { clearTimeout(timeout); reject(new Error(`Exited ${code}: ${output.stderr}`)); });
    });
    assert.ok(port > 0);
    const response = await fetch(`http://127.0.0.1:${port}/api/health`);
    assert.equal(response.status, 200);
    assert.equal((await response.json()).database, 'connected');
    assert.equal(output.stderr, '');
  } finally {
    if (child.exitCode === null) { child.kill(); await once(child, 'exit'); }
  }
});
