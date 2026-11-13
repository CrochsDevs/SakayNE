import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
const require = createRequire(new URL('../../client/package.json', import.meta.url));
const ts = require('typescript');
const source = readFileSync(new URL('../../client/src/components/map/maplibreHtml.ts', import.meta.url), 'utf8');
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const context = { exports: {}, process: { env: {} } };
vm.runInNewContext(code, context);
test('MapLibre inline script remains valid and labels cannot break out of its script', () => {
  const html = context.exports.buildMapHtml([{ label: '</script><script>alert(1)</script>', coord: { latitude: 15.5, longitude: 121 }, isOrigin: true }], [], false);
  const scripts = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)];
  assert.equal(scripts.length, 1);
  for (const [, script] of scripts) if (script.trim()) new vm.Script(script);
  assert.ok(!html.includes('<script>alert(1)</script>'));
  assert.match(html, /tiles\.openfreemap\.org/);
  assert.match(html, /AttributionControl/);
  assert.match(html, /setLocation/);
  assert.ok(!html.includes('setProgress'));
});
test('hidden route details remove service paths and drop-offs while retaining a live pickup pin', () => {
  const html = context.exports.buildMapHtml([
    { label: 'Hidden drop-off fixture', coord: { latitude: 15.58, longitude: 120.92 }, isDestination: true },
    { label: 'Live pickup fixture', coord: { latitude: 15.59, longitude: 120.93 }, isLivePickup: true },
  ], [], false, [{ latitude: 15.58, longitude: 120.92 }, { latitude: 15.59, longitude: 120.93 }], false, { showRouteDetails: false, routingExpected: true });
  assert.ok(!html.includes('Hidden drop-off fixture'));
  assert.ok(html.includes('Live pickup fixture'));
  assert.match(html, /servicePath=\[\]/);
  assert.match(html, /routeDetailsEnabled=false,routingExpected=false/);
  for (const [, script] of html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)) if (script.trim()) new vm.Script(script);
});

test('empty maps and dark maps have a usable fallback', () => {
  const html = context.exports.buildMapHtml([], [], true);
  assert.match(html, /styles\/dark/);
  assert.match(html, /120\.9756,15\.5781/);
  assert.match(html, /Retry map/);
  assert.doesNotMatch(html, /(?:^|})\s*(?:html|body|#map|\.maplibregl-canvas)\s*\{[^}]*filter\s*:/);
});

test('service maps preserve supplied directional geometry and reject invalid map points', () => {
  const html = context.exports.buildMapHtml([
    { label: 'Invalid latitude', coord: { latitude: 95, longitude: 121 } },
    { label: 'Invalid longitude', coord: { latitude: 15, longitude: 190 } },
    { label: 'Boarding point', coord: { latitude: 15.5, longitude: 121 } },
  ], [], false, [{ latitude: 15.5, longitude: 121 }, { latitude: 15.6, longitude: 121.1 }]);
  assert.ok(!html.includes('Invalid latitude'));
  assert.ok(!html.includes('Invalid longitude'));
  assert.match(html, /servicePath=\[\[121,15.5\],\[121.1,15.6\]\]/);
  assert.ok(!html.includes('/route/v1/driving/'));
  assert.ok(!html.includes('Authorization'));
  const pending = context.exports.buildMapHtml([], [], false, []);
  assert.match(pending, /servicePath=\[\]/);
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
    assert.match(html, /servicePath=\[\]/);
    assert.ok(!html.includes('L.polyline(latlngs'));
    assert.ok(!html.includes('/route/v1/driving/'));
  }
});
