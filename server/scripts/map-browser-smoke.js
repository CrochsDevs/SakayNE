import assert from 'node:assert/strict';
import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { chromium, expect } from '@playwright/test';

const require = createRequire(new URL('../../client/package.json', import.meta.url));
const ts = require('typescript');
const module = { exports: {}, process: { env: {} } };
vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../../client/src/components/map/maplibreHtml.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, module);
const edge = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const browser = await chromium.launch({ ...(existsSync(edge) ? { executablePath: edge } : {}), headless: true, args: ['--enable-unsafe-swiftshader'] });
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 600 } });
  const errors = [], network = []; page.on('pageerror', error => errors.push(error.message));
  page.on('requestfailed', request => network.push(request.url() + ' ' + request.failure()?.errorText));
  // Test-only geometry. No application data or location is modified.
  const path = [{ latitude: 15.487, longitude: 120.974 }, { latitude: 15.49, longitude: 120.977 }];
  const stops = path.map((coord, index) => ({ coord, label: index ? 'Drop-off' : 'Pickup', isOrigin: !index, isDestination: !!index }));
  await page.setContent(module.exports.buildMapHtml(stops, [], false, path, true));
  try { await page.locator('#map[data-map-ready="true"]').waitFor({ timeout: 45000 }); }
  catch (error) { console.error({ errors, network, body: await page.locator('body').innerText(), state: await page.evaluate(() => ({ loaded: map?.loaded(), style: map?.isStyleLoaded(), sources: Object.keys(map?.getStyle()?.sources || {}), width: map?.getCanvas().width, height: map?.getCanvas().height })) }); throw error; }
  await expect.poll(() => page.evaluate(() => map.loaded()), { timeout: 45000 }).toBe(true);
  await expect(page.locator('.maplibregl-ctrl-attrib-inner')).toBeHidden();
  await page.locator('.maplibregl-ctrl-attrib-button').click();
  await expect(page.locator('.maplibregl-ctrl-attrib-inner')).toBeVisible();
  await expect(page.locator('.maplibregl-ctrl-attrib-inner')).toContainText('OpenStreetMap');
  await page.locator('.maplibregl-ctrl-attrib-button').click();
  await expect(page.locator('.maplibregl-ctrl-attrib-inner')).toBeHidden();
  const send = async value => page.evaluate(value => window.dispatchEvent(new MessageEvent('message', { data: JSON.stringify({ type: 'setLocation', value }) })), value);
  await send({ ...path[0], accuracy: 12, capturedAt: new Date().toISOString() });
  await expect(page.locator('.car')).toBeVisible();
  assert.equal(await page.evaluate(() => following), true);
  await expect(page.locator('.maplibregl-ctrl-group')).toHaveCount(0);
  await page.evaluate(() => map.fire('dragstart'));
  const before = await page.evaluate(() => [map.getCenter().lat, map.getCenter().lng]);
  await send({ ...path[1], accuracy: 10, capturedAt: new Date().toISOString() });
  await expect.poll(() => page.evaluate(() => car.getLngLat().lat)).toBe(path[1].latitude);
  assert.deepEqual(await page.evaluate(() => [map.getCenter().lat, map.getCenter().lng]), before, 'Dragging pauses automatic camera follow');
  await page.evaluate(() => window.dispatchEvent(new MessageEvent('message', { data: { type: 'recenter' } })));
  await expect.poll(() => page.evaluate(() => Math.abs(map.getCenter().lat - 15.49))).toBeLessThan(0.00001);
  await page.evaluate(() => window.dispatchEvent(new MessageEvent('message', { data: { type: 'overview' } })));
  assert.equal(await page.evaluate(() => following), false);
  const artifacts = fileURLToPath(new URL('../../artifacts', import.meta.url)); mkdirSync(artifacts, { recursive: true });
  await page.screenshot({ path: artifacts + '/maplibre-driver-map.png' });
  await send(null);
  await expect(page.locator('.car')).toHaveCount(0);
  await send({ ...path[0], accuracy: 20, capturedAt: new Date(Date.now() - 65000).toISOString() });
  await expect(page.locator('.car')).toHaveClass(/stale/);
  const last = await page.evaluate(() => car.getLngLat().lat);
  await send({ ...path[1], capturedAt: new Date(Date.now() - 90000).toISOString() });
  assert.equal(await page.evaluate(() => car.getLngLat().lat), last, 'Older GPS cannot rewind the marker');
  await page.goto('about:blank');
  await page.setContent(module.exports.buildMapHtml(stops, [], true, undefined, false, { routingExpected: true }));
  await page.locator('#map[data-map-ready="true"]').waitFor({ timeout: 45000 });
  await expect.poll(() => page.evaluate(() => map.loaded()), { timeout: 45000 }).toBe(true);
  const routed = [[120.974, 15.487], [120.976, 15.4875], [120.977, 15.49]];
  await page.evaluate(coordinates => window.dispatchEvent(new MessageEvent('message', { data: { type: 'setRoadRoute', value: { coordinates, durationMin: 8, distanceKm: 3 }, status: 'ready' } })), routed);
  await expect(page.locator('#route-note')).toHaveText('Road route preview · OSRM');
  assert.deepEqual(await page.evaluate(async () => (await map.getSource('sakay-route').getData()).geometry.coordinates), routed);
  await page.screenshot({ path: artifacts + '/maplibre-dark-road-preview.png' });
  await send({ ...path[0], accuracy: 20, capturedAt: new Date().toISOString() });
  await page.evaluate(() => { map.fire('dragstart'); map.jumpTo({ center: [120.975, 15.488], zoom: 14 }); });
  const camera = await page.evaluate(() => [map.getCenter().lng, map.getCenter().lat, map.getZoom(), following]);
  for (const id of ['streets', 'bright', 'light', 'dark']) {
    await page.evaluate(value => window.dispatchEvent(new MessageEvent('message', { data: { type: 'setMapStyle', value } })), id);
    await expect.poll(() => page.evaluate(id => appliedStyleId === id && styleReady && map.loaded(), id), { timeout: 45000 }).toBe(true);
    assert.deepEqual(await page.evaluate(() => [map.getCenter().lng, map.getCenter().lat, map.getZoom(), following]), camera);
    assert.deepEqual(await page.evaluate(async () => (await map.getSource('sakay-route').getData()).geometry.coordinates), routed);
    assert.equal(await page.evaluate(async () => (await map.getSource('sakay-accuracy').getData()).geometry.type), 'Polygon');
    await expect(page.locator('.car')).toHaveCount(1);
    assert.equal(await page.evaluate(() => map.hasImage('sakay-bus-stop-icon') && !!map.getLayer('sakay-bus-stops')), true, 'Bus stops survive every basemap change');
    assert.equal(await page.evaluate(() => getComputedStyle(map.getCanvas()).filter), 'none', 'Dark mode styles the map without inverting its canvas');
    await page.screenshot({ path: artifacts + '/map-custom-' + id + '.png' });
  }
  // Test-only GeoJSON exercises the real bus filter, icon, and popup without changing map data.
  await page.evaluate(() => {
    const vector = map.getStyle().layers.find(layer => layer.id === 'sakay-bus-stops');
    const testLayer = { ...vector, source: 'test-transit' };
    delete testLayer['source-layer'];
    map.addSource('test-transit', { type: 'geojson', data: { type: 'FeatureCollection', features: [
      { type: 'Feature', properties: { class: 'bus', name: 'Test-only bus stop' }, geometry: { type: 'Point', coordinates: [120.967, 15.488] } },
      { type: 'Feature', properties: { class: 'rail', name: 'Test-only railway' }, geometry: { type: 'Point', coordinates: [120.9675, 15.488] } },
    ] } });
    map.removeLayer('sakay-bus-stops'); map.addLayer(testLayer);
  });
  await expect.poll(() => page.evaluate(() => map.queryRenderedFeatures({ layers: ['sakay-bus-stops'] }).length)).toBe(1);
  const busPoint = await page.evaluate(() => { const point = map.project([120.967, 15.488]), rect = map.getCanvas().getBoundingClientRect(); return { x: point.x + rect.left, y: point.y + rect.top }; });
  await page.mouse.click(busPoint.x, busPoint.y);
  await expect(page.locator('.maplibregl-popup-content')).toContainText('Test-only bus stop');
  await expect(page.locator('.maplibregl-popup-content')).toContainText('Confirm boarding with your driver');
  await page.locator('.maplibregl-popup-close-button').click();
  await page.evaluate(() => window.dispatchEvent(new MessageEvent('message', { data: { type: 'setRoadRoute', value: null, status: 'unavailable' } })));
  await expect(page.locator('#route-note')).toHaveText('Road route unavailable');
  assert.equal((await page.evaluate(async () => await map.getSource('sakay-route').getData())).features.length, 0, 'Routing failure clears the road line rather than inventing a shortcut');
  await expect(page.locator('.stop-marker')).toHaveCount(2);
  for (const id of ['light', 'dark', 'streets']) {
    await page.evaluate(id => {
      window.dispatchEvent(new MessageEvent('message', { data: { type: 'setMapStyle', value: id } }));
      map.jumpTo({ center: [120.967, 15.488], zoom: 17 });
    }, id);
    await expect.poll(() => page.evaluate(id => appliedStyleId === id && styleReady && map.loaded(), id), { timeout: 45000 }).toBe(true);
    await expect.poll(() => page.evaluate(() => {
      const layers = map.getStyle().layers.filter(layer => layer.type === 'symbol' && layer['source-layer'] === 'poi').map(layer => layer.id);
      return map.queryRenderedFeatures({ layers }).filter(feature => feature.properties.name || feature.properties.name_en).length;
    }), { timeout: 15000 }).toBeGreaterThan(0);
    await page.waitForTimeout(500); // Let MapLibre finish its symbol fade before visual inspection.
    await page.screenshot({ path: artifacts + '/map-establishments-' + id + '.png' });
  }
  assert.deepEqual(errors, []);
  for (const id of ['3d', 'terrain', 'light']) {
    await page.evaluate(id => {
      window.dispatchEvent(new MessageEvent('message', { data: { type: 'setMapStyle', value: id } }));
      map.jumpTo({ center: id === 'terrain' ? [120.744, 15.205] : [120.967, 15.488], zoom: id === 'terrain' ? 11 : 17 });
    }, id);
    await expect.poll(() => page.evaluate(id => appliedStyleId === id && styleReady && map.loaded(), id), { timeout: 60000 }).toBe(true);
    assert.ok(Math.abs(await page.evaluate(() => map.getPitch()) - (id === '3d' ? 55 : id === 'terrain' ? 50 : 0)) < 0.001);
    assert.equal(await page.evaluate(() => !!map.getTerrain()), id === 'terrain');
    assert.equal(await page.evaluate(() => map.getStyle().layers.some(layer => layer.type === 'fill-extrusion')), id === '3d');
    if (id === '3d') assert.ok(await page.evaluate(() => map.queryRenderedFeatures({ layers: ['building-3d'] }).length > 0), '3D buildings render from the provider data');
    if (id === 'terrain') assert.equal(await page.evaluate(() => map.isSourceLoaded('sakay-elevation') && map.isSourceLoaded('sakay-hillshade')), true);
    await expect(page.locator('.car')).toHaveCount(1);
    await page.waitForTimeout(500);
    await page.screenshot({ path: artifacts + '/map-view-' + id + '.png' });
  }
  assert.deepEqual(errors, []);
  await page.route('**/elevation-tiles-prod/**', route => route.fulfill({ status: 503, headers: { 'access-control-allow-origin': '*' }, body: 'Test elevation unavailable' }));
  await page.evaluate(() => window.dispatchEvent(new MessageEvent('message', { data: { type: 'setMapStyle', value: 'terrain' } })));
  await expect.poll(() => page.evaluate(() => terrainFailed && !map.getTerrain()), { timeout: 30000 }).toBe(true);
  await expect(page.locator('.car')).toHaveCount(1);
  await page.unroute('**/elevation-tiles-prod/**');
  await page.evaluate(() => window.dispatchEvent(new MessageEvent('message', { data: { type: 'setMapStyle', value: 'terrain' } })));
  await expect.poll(() => page.evaluate(() => !terrainFailed && !!map.getTerrain() && map.loaded()), { timeout: 60000 }).toBe(true);
  assert.deepEqual(errors, []);
  console.log('PASS: map views, terrain failure/retry, live GPS, bus stops, dark maps, OSRM and preserved map state.');
} finally { await browser.close(); }
