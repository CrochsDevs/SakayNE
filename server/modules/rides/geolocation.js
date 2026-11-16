import { ObjectId } from 'mongodb';
import { requireValue } from '../../shared/errors.js';
import { validLocation } from '../../shared/transit.js';

export const GEO_RULES = Object.freeze({ boardingMeters: 8, alightingMeters: 20, maxAccuracyMeters: 15,
  maxAgeMs: 20000, maxPairSkewMs: 10000, minSampleGapMs: 4000, evidenceWindowMs: 15000,
  requiredSamples: 3, confirmationMs: 10000 });

export function normalizePosition(input, now = Date.now()) {
  requireValue(validLocation(input), 'Invalid GPS coordinates');
  const accuracy = input.accuracy ?? null;
  requireValue(accuracy === null || Number.isFinite(accuracy) && accuracy >= 0, 'Invalid GPS accuracy');
  const captured = input.capturedAt === undefined ? now : typeof input.capturedAt === 'string' ? Date.parse(input.capturedAt) : NaN;
  requireValue(Number.isFinite(captured) && captured <= now + 5000 && now - captured <= GEO_RULES.maxAgeMs, 'GPS reading is stale or has an invalid timestamp');
  return { latitude: input.latitude, longitude: input.longitude, accuracy,
    capturedAt: new Date(captured).toISOString(), updatedAt: new Date(now).toISOString() };
}

export function distanceMeters(a, b) {
  const radians = value => value * Math.PI / 180;
  const deltaLat = radians(b.latitude - a.latitude), deltaLng = radians(b.longitude - a.longitude);
  const h = Math.sin(deltaLat / 2) ** 2 + Math.cos(radians(a.latitude)) * Math.cos(radians(b.latitude)) * Math.sin(deltaLng / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(Math.max(0, 1 - h)));
}

export const isOnboard = ride => ride.status === 'ongoing' && ride.occupancyStatus !== 'alighted' && !ride.seatsReleasedAt;
export const hasSeatHold = ride => !ride.seatsReleasedAt;

// Occupancy is derived from booking records, so retries and legacy rides cannot drift a counter.
export async function occupiedSeats(db, driverId, session) {
  const [result] = await db.collection('rides').aggregate([
    { $match: { driverId: driverId.toString(), status: 'ongoing', occupancyStatus: { $ne: 'alighted' }, seatsReleasedAt: { $exists: false } } },
    { $group: { _id: null, seats: { $sum: '$seats' } } },
  ], { session }).toArray();
  return result?.seats || 0;
}

export function evaluateProximity(ride, driverPosition, now = Date.now()) {
  const passenger = ride.passengerLocation;
  const updatedAt = new Date(now).toISOString();
  const result = (state, extra = {}, evidence = null, event = null) => ({ detection: { state, updatedAt, ...extra }, evidence, event });
  if (!ride.geoTrackingEnabled) return result('disabled');
  if (ride.occupancyStatus === 'alighted') return result('alighted');
  if (!['accepted', 'arrived', 'ongoing'].includes(ride.status)) return result('waiting_for_acceptance');
  const fresh = p => p && Number.isFinite(Date.parse(p.capturedAt)) && now - Date.parse(p.capturedAt) <= GEO_RULES.maxAgeMs && Date.parse(p.capturedAt) <= now + 5000;
  if (!fresh(passenger) || !fresh(driverPosition)) return result('waiting_for_fresh_gps');
  const precise = p => Number.isFinite(p.accuracy) && p.accuracy >= 0 && p.accuracy <= GEO_RULES.maxAccuracyMeters;
  if (!precise(passenger) || !precise(driverPosition)) return result('poor_accuracy');
  const passengerAt = Date.parse(passenger.capturedAt), driverAt = Date.parse(driverPosition.capturedAt);
  if (Math.abs(passengerAt - driverAt) > GEO_RULES.maxPairSkewMs) return result('waiting_for_fresh_gps');
  const distance = distanceMeters(passenger, driverPosition);
  const minimumSeparation = Math.max(0, distance - passenger.accuracy - driverPosition.accuracy);
  const details = { distanceMeters: Math.round(distance * 10) / 10,
    minimumSeparationMeters: Math.round(minimumSeparation * 10) / 10 };
  const kind = isOnboard(ride) ? 'alight' : 'board';
  const candidate = kind === 'board' ? distance <= GEO_RULES.boardingMeters : minimumSeparation >= GEO_RULES.alightingMeters;
  if (!candidate) return result(kind === 'board' ? 'waiting_for_proximity' : 'onboard', details);
  const previous = ride.geoEvidence;
  const continuing = previous?.kind === kind && now - previous.lastEvidenceAt <= GEO_RULES.evidenceWindowMs;
  if (continuing && (passengerAt <= previous.passengerAt || driverAt <= previous.driverAt || now - previous.lastEvidenceAt < GEO_RULES.minSampleGapMs)) {
    return result(kind === 'board' ? 'boarding_candidate' : 'alighting_candidate', { ...details, samples: previous.count }, previous);
  }
  const evidence = { kind, count: continuing ? previous.count + 1 : 1,
    since: continuing ? previous.since : now, lastEvidenceAt: now, passengerAt, driverAt };
  const confirmed = evidence.count >= GEO_RULES.requiredSamples && now - evidence.since >= GEO_RULES.confirmationMs;
  return result(confirmed ? kind === 'board' ? 'onboard' : 'alighted' : kind === 'board' ? 'boarding_candidate' : 'alighting_candidate',
    { ...details, samples: evidence.count }, confirmed ? null : evidence, confirmed ? kind : null);
}

export async function detectOccupancy(db, session, ride, driver) {
  if (!driver.verified || driver.approvalStatus !== 'approved') return ride;
  const evaluation = evaluateProximity(ride, driver.location);
  const options = { session }, now = new Date().toISOString();
  const changes = { geoDetection: evaluation.detection, geoEvidence: evaluation.evidence };
  if (evaluation.event === 'board') Object.assign(changes, { status: 'ongoing', occupancyStatus: 'onboard', boardedAt: now, startedAt: now, boardingSource: 'geolocation' });
  if (evaluation.event === 'alight') {
    Object.assign(changes, { status: 'completed', completedAt: now, occupancyStatus: 'alighted', alightedAt: now,
      seatsReleasedAt: now, alightingSource: 'geolocation', geoTrackingEnabled: false, passengerLocation: null });
  }
  const rideFilter = evaluation.event === 'board'
    ? { _id: ride._id, status: { $in: ['accepted', 'arrived'] }, seatsReleasedAt: { $exists: false } }
    : evaluation.event === 'alight'
      ? { _id: ride._id, status: 'ongoing', occupancyStatus: 'onboard', seatsReleasedAt: { $exists: false } }
      : { _id: ride._id };
  const savedRide = await db.collection('rides').updateOne(rideFilter, { $set: changes }, options);
  if (evaluation.event) requireValue(savedRide.matchedCount === 1, 'Booking changed while GPS was being verified. Please retry', 409);
  if (evaluation.event === 'alight') {
    // Ride completion and seat restoration commit together; retries cannot release twice.
    const released = await db.collection('drivers').updateOne({ _id: new ObjectId(ride.driverId), reservedSeats: { $gte: ride.seats } },
      { $inc: { reservedSeats: -ride.seats, totalTrips: 1, totalEarnings: ride.fare } }, options);
    requireValue(released.matchedCount === 1, 'Seat reservations changed. Please retry', 409);
  }
  if (evaluation.event) {
    const message = evaluation.event === 'board' ? `GPS detected boarding: ${ride.seats} occupied seat(s).`
      : `GPS detected alighting: booking completed and ${ride.seats} seat(s) released. Cash payment remains pending.`;
    for (const email of [ride.passengerEmail, ride.driverEmail]) {
      const preferences = await db.collection('notification_settings').findOne({ email }, options);
      if (preferences?.push !== false) await db.collection('notifications').insertOne({ email, type: 'booking', title: 'Seat occupancy update',
        message, rideId: ride._id.toString(), read: false, createdAt: now }, options);
    }
  }
  return { ...ride, ...changes };
}
