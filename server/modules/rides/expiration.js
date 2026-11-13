import { ObjectId } from 'mongodb';
import { getDB, transaction } from '../../config/db.js';

let inFlight;
// Fleet polling, ride requests and the worker share one sweep per process.
// Transactions still protect against another server process doing the same work.
export function expireReservations() {
  if (!inFlight) inFlight = sweepReservations().finally(() => { inFlight = undefined; });
  return inFlight;
}

async function sweepReservations() {
  const expired = await getDB().collection('rides').find({ status: 'pending', expiresAt: { $lte: new Date() } }).limit(100).toArray();
  for (const candidate of expired) await transaction(async (db, session) => {
    const options = { session };
    const ride = await db.collection('rides').findOne({ _id: candidate._id, status: 'pending', expiresAt: { $lte: new Date() } }, options);
    if (!ride) return;
    const now = new Date().toISOString();
    await db.collection('rides').updateOne({ _id: ride._id }, { $set: { status: 'cancelled', cancellationReason: 'Driver confirmation timed out', cancelledBy: 'system', updatedAt: now, seatsReleasedAt: now, geoTrackingEnabled: false, passengerLocation: null, geoEvidence: null } }, options);
    if (!ride.seatsReleasedAt) await db.collection('drivers').updateOne({ _id: new ObjectId(ride.driverId) }, { $inc: { reservedSeats: -ride.seats } }, options);
    for (const email of [ride.passengerEmail, ride.driverEmail]) {
      const preferences = await db.collection('notification_settings').findOne({ email }, options);
      if (preferences?.push !== false) await db.collection('notifications').insertOne({ email, type: 'booking', title: 'Booking update', message: 'Driver confirmation timed out. The reservation has been released.', rideId: ride._id.toString(), read: false, createdAt: now }, options);
    }
  });
}

// Each process may run this worker; transactions make overlapping sweeps safe.
export function startReservationExpiry(intervalMs = 15000) {
  let running = false;
  const timer = setInterval(async () => {
    if (running) return;
    running = true;
    try { await expireReservations(); }
    catch { console.error('Reservation expiry sweep failed; it will retry on the next interval.'); }
    finally { running = false; }
  }, intervalMs);
  timer.unref();
  return () => clearInterval(timer);
}
