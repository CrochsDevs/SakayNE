import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateProximity, distanceMeters, normalizePosition, GEO_RULES } from '../modules/rides/geolocation.js';
const base = Date.parse('2026-10-14T08:00:00.000Z');
const point = (time, meters = 0, accuracy = 1) => ({ latitude: 15.5 + meters / 111195, longitude: 121, accuracy, capturedAt: new Date(time).toISOString() });
const ride = () => ({ status: 'accepted', geoTrackingEnabled: true, occupancyStatus: 'waiting' });
function sample(r, time, meters = 0, accuracy = 1) {
  r.passengerLocation = point(time, meters, accuracy);
  const result = evaluateProximity(r, point(time), time);
  r.geoEvidence = result.evidence;
  return result;
}
test('boarding requires three independent precise samples over at least ten seconds', () => {
  const r = ride();
  assert.equal(sample(r, base).event, null);
  assert.equal(sample(r, base + 5000).event, null);
  assert.equal(sample(r, base + 10000).event, 'board');
  assert.ok(distanceMeters(point(base), point(base, 15)) > 14.9);
});
test('15-meter alighting threshold uses separation after GPS uncertainty and sustained evidence', () => {
  const r = { ...ride(), status: 'ongoing', occupancyStatus: 'onboard' };
  assert.equal(sample(r, base, 15).detection.state, 'onboard');
  assert.equal(sample(r, base + 5000, 20).event, null);
  assert.equal(sample(r, base + 10000, 20).event, null);
  assert.equal(sample(r, base + 15000, 20).event, 'alight');
});
test('one GPS jump, poor accuracy, stale coordinates and pending bookings cannot change occupancy', () => {
  const r = ride();
  sample(r, base);
  assert.equal(sample(r, base + 5000, 50).evidence, null);
  assert.equal(sample(r, base + 10000).event, null);
  assert.equal(sample(r, base + 15000, 0, 30).detection.state, 'poor_accuracy');
  r.passengerLocation = point(base);
  assert.equal(evaluateProximity(r, point(base + 30000), base + 30000).detection.state, 'waiting_for_fresh_gps');
  r.status = 'pending';
  assert.equal(sample(r, base + 30000).detection.state, 'waiting_for_acceptance');
});
test('replayed samples, unsynchronized fixes and gaps cannot manufacture boarding evidence', () => {
  const r = ride(); sample(r, base);
  r.passengerLocation = point(base);
  assert.equal(evaluateProximity(r, point(base), base + 5000).evidence.count, 1);
  r.passengerLocation = point(base + 12000);
  assert.equal(evaluateProximity(r, point(base), base + 12000).detection.state, 'waiting_for_fresh_gps');
  assert.equal(sample(r, base + GEO_RULES.evidenceWindowMs + 1).evidence.count, 1);
});
test('missing precision never permits detection and invalid location metadata is rejected', () => {
  const r = ride(); r.passengerLocation = point(base, 0, null);
  assert.equal(evaluateProximity(r, point(base), base).detection.state, 'poor_accuracy');
  assert.throws(() => normalizePosition({ ...point(base), accuracy: -1 }, base), /accuracy/);
  assert.throws(() => normalizePosition(point(base - 30000), base), /stale/);
  assert.throws(() => normalizePosition(point(base + 30000), base), /timestamp/);
});
