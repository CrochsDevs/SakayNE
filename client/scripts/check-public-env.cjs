const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const unsafe = new Set();
const inspect = (key, value) => {
  if (key.startsWith('EXPO_PUBLIC_') && /MONGO|DATABASE|PASSWORD|SECRET|PRIVATE_KEY|SMTP_PASS/i.test(key) && value.trim()) unsafe.add(key);
};
for (const [key, value] of Object.entries(process.env)) inspect(key, value || '');
for (const name of fs.readdirSync(root).filter(name => /^\.env(?:\..+)?$/.test(name) && name !== '.env.example')) {
  for (const line of fs.readFileSync(path.join(root, name), 'utf8').split(/\r?\n/)) {
    const entry = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (entry) inspect(entry[1], entry[2].replace(/^['"]|['"]$/g, ''));
  }
}
if (unsafe.size) {
  console.error(`Unsafe public environment keys: ${[...unsafe].join(', ')}. Move credentials to server/.env.`);
  process.exitCode = 1;
} else console.log('Public environment credential check passed.');
