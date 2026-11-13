import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import { chromium, expect } from '@playwright/test';

const require = createRequire(new URL('../../client/package.json', import.meta.url));
const ts = require('typescript');
const module = { exports: {}, process: { env: {} } };
vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../../client/src/components/map/maplibreHtml.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, module);
const edge = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const browser = await chromium.launch({ ...(existsSync(edge) ? { executablePath: edge } : {}), headless: true, args: ['--enable-unsafe-swiftshader'] });
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 700 }, reducedMotion: 'reduce' });
  const warnings = [], errors = [];
  page.on('console', message => { if (/could not be loaded|Expected value to be of type number|Content Security Policy|escape its sandboxing/.test(message.text())) warnings.push(message.text()); });
  page.on('pageerror', error => errors.push(error.message));
  await page.setContent(module.exports.buildMapHtml([], [], false, undefined, false, { followDriver: true, vehicleType: 'jeep' }));
  await page.locator('#map[data-map-ready="true"]').waitFor({ timeout: 45000 });
  for (const id of ['light', 'streets', 'bright', 'dark', '3d']) {
    await page.evaluate(id => {
      window.dispatchEvent(new MessageEvent('message', { data: { type: 'setMapStyle', value: id } }));
      map.jumpTo({ center: [120.967, 15.488], zoom: 17 });
    }, id);
    await expect.poll(() => page.evaluate(id => appliedStyleId === id && styleReady && map.loaded(), id), { timeout: 45000 }).toBe(true);
    await page.evaluate(() => {
      const icons = ['office', 'multi', 'gate', 'sports_centre', 'atm', 'bicycle_parking', 'swimming_pool', 'brownfield'];
      map.addSource('fixture-landmarks', { type: 'geojson', data: { type: 'FeatureCollection', features: icons.map((name, index) => ({ type: 'Feature', properties: { name, rank: null }, geometry: { type: 'Point', coordinates: [120.966 + index * 0.0001, 15.488] } })) } });
      const poi = map.getStyle().layers.find(layer => layer['source-layer'] === 'poi');
      map.addLayer({ id: 'fixture-landmarks', type: 'symbol', source: 'fixture-landmarks', layout: { 'icon-image': ['get', 'name'], 'icon-allow-overlap': true, 'symbol-sort-key': poi.layout['symbol-sort-key'] } });
      if (appliedStyleId === '3d') {
        const paint = map.getLayer('building-3d').serialize().paint;
        map.addSource('fixture-buildings', { type: 'geojson', data: { type: 'Feature', properties: { render_height: null, render_min_height: null }, geometry: { type: 'Polygon', coordinates: [[[120.967, 15.488], [120.9672, 15.488], [120.9672, 15.4882], [120.967, 15.488]]] } } });
        map.addLayer({ id: 'fixture-buildings', type: 'fill-extrusion', source: 'fixture-buildings', paint });
      }
    });
    await expect.poll(() => page.evaluate(() => ['office', 'multi', 'gate', 'sports_centre', 'atm', 'bicycle_parking', 'swimming_pool', 'brownfield'].every(id => map.hasImage(id)) && map.loaded()), { timeout: 15000 }).toBe(true);
  }
  assert.deepEqual(warnings, [], 'Map console warnings');
  assert.deepEqual(errors, [], 'Map runtime errors');
  console.log('PASS: no missing-sprite or null-number warnings across light, streets, bright, dark and 3D; missing landmark icons and null building heights have usable fallbacks.');
} finally { await browser.close(); }
