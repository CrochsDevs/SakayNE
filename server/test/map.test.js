import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
const require = createRequire(new URL('../../client/package.json', import.meta.url));
const ts = require('typescript');
const source = readFileSync(new URL('../../client/src/components/map/mapHtml.ts', import.meta.url), 'utf8');
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const context = { exports: {}, process: { env: {} } };
vm.runInNewContext(code, context);
test('Leaflet inline script remains valid and labels cannot break out of its script', () => {
  const html = context.exports.buildMapHtml([{ label: '</script><script>alert(1)</script>', coord: { latitude: 15.5, longitude: 121 }, isOrigin: true }], [], false);
  const scripts = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)];
  assert.equal(scripts.length, 2);
  for (const [, script] of scripts) if (script.trim()) new vm.Script(script);
  assert.ok(!html.includes('<script>alert(1)</script>'));
  assert.match(html, /tile\.openstreetmap\.org/);
  assert.match(html, /attributionControl: true/);
  assert.match(html, /setLocation/);
  assert.ok(!html.includes('setProgress'));
});
test('empty maps and dark maps have a usable fallback', () => {
  const html = context.exports.buildMapHtml([], [], true);
  assert.match(html, /invert\(1\)/);
  assert.match(html, /map.setView\(\[15.5781, 120.9756\]/);
  assert.match(html, /Service route not yet mapped/);
});

test('service maps preserve supplied directional geometry and reject invalid map points', () => {
  const html = context.exports.buildMapHtml([
    { label: 'Invalid latitude', coord: { latitude: 95, longitude: 121 } },
    { label: 'Invalid longitude', coord: { latitude: 15, longitude: 190 } },
    { label: 'Boarding point', coord: { latitude: 15.5, longitude: 121 } },
  ], [], false, [{ latitude: 15.5, longitude: 121 }, { latitude: 15.6, longitude: 121.1 }]);
  assert.ok(!html.includes('Invalid latitude'));
  assert.ok(!html.includes('Invalid longitude'));
  assert.match(html, /var servicePath = \[\[15.5,121\],\[15.6,121.1\]\]/);
  assert.ok(!html.includes('/route/v1/driving/'));
  assert.ok(!html.includes('fetch('));
  const pending = context.exports.buildMapHtml([], [], false, []);
  assert.match(pending, /var servicePath = \[\]/);
  for (const [, script] of html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)) {
    if (script.trim()) new vm.Script(script);
  }
});

test('missing or invalid service paths never draw inferred roads between stops', () => {
  const stops = [
    { label: 'A', coord: { latitude: 15.5, longitude: 121 } },
    { label: 'B', coord: { latitude: 15.6, longitude: 121.1 } },
  ];
  for (const path of [undefined, [], [stops[0].coord, { latitude: 100, longitude: 121 }, stops[1].coord]]) {
    const html = context.exports.buildMapHtml(stops, [], false, path);
    assert.match(html, /var servicePath = \[\]/);
    assert.ok(!html.includes('L.polyline(latlngs'));
    assert.ok(!html.includes('fetch('));
  }
});
