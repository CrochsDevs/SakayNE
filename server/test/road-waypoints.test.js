import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(new URL('../../client/src/data/sakay.ts', import.meta.url));
const ts = require('typescript');
const source = readFileSync(new URL('../../client/src/data/sakay.ts', import.meta.url), 'utf8');
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText;
const api = {};
new Function('require', 'exports', code)(require, api);
const { getRoute, getTown, getRoadWaypoints, getRouteMapTown, getTerminalMapStops, getServiceMapStops, isRouteMapEnabled, ROUTES } = api;

test('only the configured Guimba and San Jose directions show route details', () => {
  assert.deepEqual(ROUTES.filter(isRouteMapEnabled).map(route => route.id).sort(), [
    'jeep-cabanatuan-guimba', 'jeep-cabanatuan-san-jose', 'jeep-guimba-cabanatuan', 'jeep-san-jose-cabanatuan',
  ]);
  assert.equal(isRouteMapEnabled(getRoute('jeep-cabanatuan-palayan')), false);
  assert.equal(isRouteMapEnabled(), false);
});

for (const id of ['jeep-san-jose-cabanatuan', 'jeep-cabanatuan-san-jose']) {
  test(`${id} follows the selected corridors and uses the terminal`, () => {
    const route = getRoute(id), points = getRoadWaypoints(route);
    assert.equal(points.length, route.originId === 'sanjose' ? 9 : 5);
    const munoz = route.originId === 'sanjose' ? points[1] : points.find(point => point.latitude === 15.713745 && point.longitude === 120.905717);
    if (route.originId === 'sanjose') {
      // Turn from Tobias onto T. de los Santos, without the school spur farther north.
      assert.ok(munoz.latitude > 15.7137 && munoz.latitude < 15.714);
      assert.ok(munoz.longitude > 120.9033 && munoz.longitude < 120.9036);
    } else {
      assert.ok(munoz);
      assert.equal(route.roadApproaches?.munoz, undefined);
    }
    // The eastern catalog center used to force a loop through Burgos/Sibul.
    const baloc = points[route.stops.findIndex(s => s.townId === 'baloc')];
    assert.ok(baloc.latitude > 15.63 && baloc.latitude < 15.65 && baloc.longitude < 120.90);
    const talavera = points[route.stops.findIndex(s => s.townId === 'talavera')];
    assert.ok(talavera.latitude > 15.60 && talavera.latitude < 15.62 && talavera.longitude < 120.925);

    const terminal = getRouteMapTown(route, 'cabanatuan');
    assert.equal(terminal.name, 'Cabanatuan Central Terminal');
    assert.ok(terminal.lat > 15.472 && terminal.lat < 15.473 && terminal.lng > 120.968 && terminal.lng < 120.970);
    const endpoint = route.destinationId === 'cabanatuan' ? points.at(-1) : points[0];
    assert.deepEqual(endpoint, { latitude: terminal.lat, longitude: terminal.lng });
    const marker = getTerminalMapStops(route).find(stop => stop.label === 'Cabanatuan Central Terminal');
    assert.ok(marker);
    assert.deepEqual(marker.coord, endpoint);
    assert.equal(marker.isDestination, route.destinationId === 'cabanatuan');
    assert.equal(marker.isOrigin, route.originId === 'cabanatuan');
    if (route.originId === 'sanjose') {
      const start = getTerminalMapStops(route).find(stop => stop.isOrigin);
      assert.equal(start.label, 'Start');
      assert.deepEqual(start.coord, points[0]);
      assert.ok(start.coord.latitude > 15.791 && start.coord.latitude < 15.792);
      assert.ok(start.coord.longitude > 120.989 && start.coord.longitude < 120.990);
    } else {
      const end = getTerminalMapStops(route).find(stop => stop.isDestination);
      assert.equal(end.label, 'WalterMart San Jose');
      assert.deepEqual(end.coord, { latitude: 15.7972918, longitude: 120.9940545 });
      assert.deepEqual(points.at(-1), end.coord);
      assert.equal(getRouteMapTown(route, 'sanjose').name, 'WalterMart San Jose');
    }
  });
}

test('partial trips retain requested pickup/drop-off and do not add an unrelated terminal', () => {
  const route = getRoute('jeep-san-jose-cabanatuan');
  const points = getRoadWaypoints(route, 'munoz', 'talavera');
  assert.deepEqual(points.at(-1), { latitude: 15.584677, longitude: 120.918712 });
  assert.deepEqual(getTerminalMapStops(route, 'munoz', 'talavera'), []);
  const pickup = { latitude: 15.70, longitude: 120.91 };
  assert.deepEqual(getRoadWaypoints(route, 'munoz', 'cabanatuan', pickup)[0], pickup);
});

test('Munoz jeep drop-off uses the supplied pin and stays an intermediate stop on the full route', () => {
  const route = getRoute('jeep-san-jose-cabanatuan');
  const coord = { latitude: 15.713847, longitude: 120.903991 };
  const [stop] = getServiceMapStops(route);
  assert.deepEqual(stop.coord, coord);
  assert.equal(stop.label, 'Muñoz Drop-off');
  assert.equal(stop.isOrigin, false);
  assert.equal(stop.isDestination, false);
  const destination = getServiceMapStops(route, 'sanjose', 'munoz')[0];
  assert.equal(destination.isDestination, true);
  assert.deepEqual(getRoadWaypoints(route, 'sanjose', 'munoz').at(-1), coord);
  const town = getRouteMapTown(route, 'munoz');
  assert.equal(town.lat, coord.latitude);
  assert.equal(town.lng, coord.longitude);
  assert.ok(!getServiceMapStops(route, 'baloc', 'cabanatuan').some(stop => stop.label === 'Muñoz Drop-off'));
  const northbound = getRoute('jeep-cabanatuan-san-jose');
  const northCoord = { latitude: 15.713745, longitude: 120.905717 };
  assert.deepEqual(getServiceMapStops(northbound).find(stop => stop.label === 'Muñoz Drop-off').coord, northCoord);
  assert.deepEqual(getRoadWaypoints(northbound, 'cabanatuan', 'munoz').at(-1), northCoord);
});

test('Baloc drop-off uses the supplied pin on driver and passenger maps', () => {
  const route = getRoute('jeep-san-jose-cabanatuan');
  const coord = { latitude: 15.642027, longitude: 120.886145 };
  const stop = getServiceMapStops(route).find(stop => stop.label === 'Baloc Drop-off');
  assert.deepEqual(stop.coord, coord);
  assert.equal(stop.isOrigin, false);
  assert.equal(stop.isDestination, false);
  assert.deepEqual(getRoadWaypoints(route, 'sanjose', 'baloc').at(-1), coord);
  assert.equal(getServiceMapStops(route, 'sanjose', 'baloc').find(stop => stop.label === 'Baloc Drop-off').isDestination, true);
  assert.ok(!getServiceMapStops(route, 'sanjose', 'munoz').some(stop => stop.label === 'Baloc Drop-off'));
});

test('Talavera route follows Quezon Street through the drop-off and rejoins at the southern exit', () => {
  const route = getRoute('jeep-san-jose-cabanatuan');
  const dropoff = { latitude: 15.584677, longitude: 120.918712 };
  const full = getRoadWaypoints(route);
  const index = full.findIndex(point => point.latitude === dropoff.latitude && point.longitude === dropoff.longitude);
  assert.ok(index > 0);
  assert.ok(full[index - 1].latitude > 15.589 && full[index - 1].longitude < 120.9196);
  assert.ok(full[index + 1].latitude < 15.583 && full[index + 1].longitude < 120.919);
  assert.ok(full[index + 2].latitude < 15.582 && full[index + 2].longitude > 120.9195);
  const arriving = getRoadWaypoints(route, 'sanjose', 'talavera');
  assert.deepEqual(arriving.at(-1), dropoff);
  assert.deepEqual(arriving, full.slice(0, index + 1));
  const leaving = getRoadWaypoints(route, 'talavera', 'cabanatuan');
  assert.deepEqual(leaving, full.slice(index));
  const pickup = { latitude: 15.5846, longitude: 120.9187 };
  assert.deepEqual(getRoadWaypoints(route, 'talavera', 'cabanatuan', pickup), [pickup, ...leaving.slice(1)]);
});

test('Cabanatuan to San Jose stays on the Talavera highway instead of reversing the southbound detour', () => {
  const route = getRoute('jeep-cabanatuan-san-jose');
  const points = getRoadWaypoints(route);
  assert.equal(points.length, 5);
  assert.equal(route.originId, 'cabanatuan');
  assert.equal(route.destinationId, 'sanjose');
  assert.equal(route.roadApproaches?.talavera, undefined);
  assert.ok(points.filter(point => point.latitude > 15.578 && point.latitude < 15.60).length === 0);
  assert.deepEqual(points[1], { latitude: 15.60784, longitude: 120.921094 });
  const coord = { latitude: 15.584694, longitude: 120.919742 };
  const [dropoff] = getServiceMapStops(route);
  assert.equal(dropoff.label, 'Talavera Drop-off');
  assert.deepEqual(dropoff.coord, coord);
  assert.equal(dropoff.isDestination, false);
  assert.deepEqual(getRoadWaypoints(route, 'cabanatuan', 'talavera').at(-1), coord);
  assert.equal(getServiceMapStops(route, 'cabanatuan', 'talavera')[0].isDestination, true);
  assert.ok(!getServiceMapStops(route, 'baloc', 'sanjose').some(stop => stop.label === 'Talavera Drop-off'));
  const markers = getServiceMapStops(route);
  assert.deepEqual(markers.map(stop => stop.label), ['Talavera Drop-off', 'Baloc Drop-off', 'Muñoz Drop-off']);
  assert.deepEqual(markers[1].coord, { latitude: 15.642027, longitude: 120.886145 });
  assert.deepEqual(markers[2].coord, { latitude: 15.713745, longitude: 120.905717 });
  assert.ok(markers.every(stop => !stop.isOrigin && !stop.isDestination));
});

test('Cabanatuan to Guimba shares the San Jose corridor and drop-offs through Baloc', () => {
  const guimba = getRoute('jeep-cabanatuan-guimba');
  const sanJose = getRoute('jeep-cabanatuan-san-jose');
  const points = getRoadWaypoints(guimba);
  assert.deepEqual(points.slice(0, 3), getRoadWaypoints(sanJose).slice(0, 3));
  assert.deepEqual(getServiceMapStops(guimba), getServiceMapStops(sanJose).slice(0, 2));
  assert.deepEqual(getRoadWaypoints(guimba, 'cabanatuan', 'baloc'), getRoadWaypoints(sanJose, 'cabanatuan', 'baloc'));
  const [start, end] = getTerminalMapStops(guimba);
  assert.equal(start.isOrigin, true);
  assert.equal(start.label, 'Cabanatuan Central Terminal');
  assert.equal(end.isDestination, true);
  assert.equal(end.label, 'Guimba');
  assert.deepEqual(end.coord, { latitude: 15.659691, longitude: 120.764845 });
  assert.deepEqual(points.at(-1), end.coord);
  assert.ok(!guimba.stops.some(stop => stop.townId === 'munoz'));
});

test('Guimba to Cabanatuan shares the San Jose route from Baloc through the municipal Talavera drop-off', () => {
  const guimba = getRoute('jeep-guimba-cabanatuan');
  const sanJose = getRoute('jeep-san-jose-cabanatuan');
  const points = getRoadWaypoints(guimba);
  assert.deepEqual(points.slice(1), getRoadWaypoints(sanJose).slice(2));
  assert.deepEqual(getServiceMapStops(guimba), getServiceMapStops(sanJose).slice(1));
  assert.deepEqual(getRoadWaypoints(guimba, 'baloc', 'cabanatuan'), getRoadWaypoints(sanJose, 'baloc', 'cabanatuan'));
  const markers = getTerminalMapStops(guimba);
  assert.deepEqual(markers.find(stop => stop.isOrigin).coord, { latitude: 15.659691, longitude: 120.764845 });
  const end = markers.find(stop => stop.isDestination);
  assert.equal(end.label, 'Cabanatuan Central Terminal');
  assert.deepEqual(points.at(-1), end.coord);
  const dropoff = getServiceMapStops(guimba).find(stop => stop.label === 'Talavera Drop-off');
  assert.deepEqual(dropoff.coord, { latitude: 15.584677, longitude: 120.918712 });
});

test('other route corridors and municipality coordinates are unchanged', () => {
  for (const id of ['jeep-cabanatuan-palayan', 'jeep-cabanatuan-gapan', 'bus-cabanatuan-manila']) {
    const route = getRoute(id);
    assert.deepEqual(getRoadWaypoints(route), route.stops.map(stop => {
      const town = getTown(stop.townId);
      return { latitude: town.lat, longitude: town.lng };
    }));
  }
  assert.equal(getTown('cabanatuan').lat, 15.4868);
  assert.equal(getTown('baloc').lng, 120.9572);
});
