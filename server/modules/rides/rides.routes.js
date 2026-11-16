import { Router } from 'express';
import { ObjectId } from 'mongodb';
import { getDB, transaction } from '../../config/db.js';
import { asyncRoute, requireValue } from '../../shared/errors.js';
import { authenticate, requireRole } from '../../shared/session.js';
import { tripQuote, canTransition, activeStatuses, towns, validLocation } from '../../shared/transit.js';
import { findRoutePickupArea } from '../../../client/src/data/pickup-area.mjs';
import { normalizePosition, detectOccupancy, hasSeatHold } from './geolocation.js';
import { expireReservations } from './expiration.js';
import { isServiceAvailable, BUS_COMING_SOON } from '../../../client/src/data/service-availability.mjs';

const router = Router();
router.use(authenticate);
// Requests clean up abandoned matches; driver transitions and expiration share a transaction.
router.use(asyncRoute(async (req, res, next) => {
  await expireReservations();
  next();
}));
const id = value => { requireValue(ObjectId.isValid(value), 'Invalid booking ID'); return new ObjectId(value); };
const owned = (req) => req.auth.role === 'driver' ? { driverEmail: req.auth.email } : { passengerEmail: req.auth.email };
function partyDistanceMeters(ride, driver) {
  const passenger = ride.passengerLocation, vehicle = driver?.location;
  if (!passenger || !vehicle) return null;
  const now = Date.now();
  const passengerAt = Date.parse(passenger.capturedAt), driverAt = Date.parse(vehicle.capturedAt || vehicle.updatedAt);
  if (![passengerAt, driverAt].every(Number.isFinite) || now - passengerAt > 30000 || now - driverAt > 30000) return null;
  const radians = value => value * Math.PI / 180;
  const deltaLat = radians(vehicle.latitude - passenger.latitude), deltaLng = radians(vehicle.longitude - passenger.longitude);
  const h = Math.sin(deltaLat / 2) ** 2 + Math.cos(radians(passenger.latitude)) * Math.cos(radians(vehicle.latitude)) * Math.sin(deltaLng / 2) ** 2;
  return Math.round(6371000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(Math.max(0, 1 - h))));
}
function serialize(ride, driver, role = 'passenger') {
  const { boardingCode, passengerEmail, driverEmail, requestId, geoEvidence, ...safe } = ride;
  return { ...safe, fromName: ride.fromName || ride.pickup || '', toName: ride.toName || ride.dropoff || '',
    type: ride.type || (ride.vehicleType === 'bus' ? 'bus' : 'jeep'),
    vehicle: ride.vehicle || driver?.plateNo || '', seats: ride.seats ?? 1,
    unitFare: ride.unitFare ?? ride.fare, minutes: ride.minutes ?? 0,
    id: ride._id.toString(), createdAt: new Date(ride.createdAt).getTime(),
    driverLocation: activeStatuses.includes(ride.status) ? driver?.location || null : null,
    partyDistanceMeters: activeStatuses.includes(ride.status) ? partyDistanceMeters(ride, driver) : null,
    driverPhone: driver?.phone || '', progress: ride.status === 'completed' ? 1 : 0 };
}
// Legacy history points to a driver by email, rather than the current ObjectId.
async function findRideDriver(db, ride, options = {}) {
  return db.collection('drivers').findOne(ObjectId.isValid(ride.driverId)
    ? { _id: new ObjectId(ride.driverId) } : { email: ride.driverId }, options);
}
async function notify(db, session, email, ride, message) {
  const preferences = await db.collection('notification_settings').findOne({ email }, { session });
  if (preferences?.push === false) return;
  await db.collection('notifications').insertOne({ email, type: 'booking', title: 'Booking update', message,
    rideId: ride._id.toString(), read: false, createdAt: new Date().toISOString() }, { session });
}
router.get('/', asyncRoute(async (req, res) => {
  const [active, history] = await Promise.all([
    getDB().collection('rides').find({ ...owned(req), status: { $in: activeStatuses } }).sort({ createdAt: -1 }).toArray(),
    getDB().collection('rides').find({ ...owned(req), status: { $nin: activeStatuses } }).sort({ createdAt: -1 }).limit(100).toArray(),
  ]);
  const rides = [...active, ...history];
  res.json({ rides: rides.map(r => serialize(r, null, req.auth.role)) });
}));
router.get('/active', asyncRoute(async (req, res) => {
  const ride = await getDB().collection('rides').findOne({ ...owned(req), status: { $in: activeStatuses } }, { sort: { createdAt: -1 } });
  const driver = ride && await findRideDriver(getDB(), ride);
  res.json({ ride: ride ? serialize(ride, driver, req.auth.role) : null });
}));
router.post('/', requireRole('passenger'), asyncRoute(async (req, res) => {
  const { driverId, routeId, fromId, toId, seats = 1, requestId } = req.body;
  requireValue(typeof requestId === 'string' && /^[a-zA-Z0-9_-]{8,80}$/.test(requestId), 'Booking request ID is required');
  const quote = tripQuote(routeId, fromId, toId, seats);
  requireValue(isServiceAvailable(quote.route.type), BUS_COMING_SOON, 409);
  let pickupLocation;
  if (req.body.pickupLocation !== undefined) {
    const position = req.body.pickupLocation;
    requireValue(validLocation(position), 'Invalid pickup GPS coordinates');
    // Pickup is an agreed pin, so approximate phone locations are allowed.
    // Automatic seat detection keeps its separate, stricter accuracy rules.
    requireValue(position.accuracy === null || Number.isFinite(position.accuracy) && position.accuracy >= 0, 'Invalid pickup GPS accuracy');
    const capturedAt = typeof position.capturedAt === 'string' ? Date.parse(position.capturedAt) : NaN;
    requireValue(Number.isFinite(capturedAt) && capturedAt <= Date.now() + 5000 && Date.now() - capturedAt <= 15 * 60000, 'Refresh your pickup location before booking.');
    requireValue(findRoutePickupArea(position, towns, quote.route)?.id === fromId, 'Your GPS pickup does not match this route fare area. Choose a ride again.');
    pickupLocation = { latitude: position.latitude, longitude: position.longitude, accuracy: position.accuracy, capturedAt: new Date(capturedAt).toISOString() };
  }
  let ride;
  await transaction(async (db, session) => {
    const options = { session };
    const previous = await db.collection('rides').findOne({ passengerEmail: req.auth.email, requestId }, options);
    if (previous) {
      requireValue(['driverId', 'routeId', 'fromId', 'toId', 'seats'].every(key => previous[key] === ({ driverId, routeId, fromId, toId, seats })[key]), 'This request ID belongs to a different booking. Refresh before trying again.', 409);
      requireValue(JSON.stringify(previous.pickupLocation) === JSON.stringify(pickupLocation), 'This request ID belongs to a different pickup. Refresh before trying again.', 409);
      ride = previous; return;
    }
    requireValue(!await db.collection('rides').findOne({ passengerEmail: req.auth.email, status: { $in: activeStatuses } }, options), 'You already have an active booking', 409);
    const driver = await db.collection('drivers').findOne({ _id: id(driverId), verified: true, approvalStatus: 'approved', isAvailable: true, routeId }, options);
    requireValue(driver && driver.onlineUntil > new Date(), 'Driver is offline or no longer serving this route', 409);
    requireValue((driver.vehicleType === 'bus' ? 'bus' : 'jeep') === quote.route.type, 'Vehicle does not serve this route');
    const capacity = driver.capacity || (quote.route.type === 'bus' ? 45 : 16);
    const reserved = driver.reservedSeats || 0;
    requireValue(reserved + seats <= capacity, 'Not enough seats available', 409);
    const seatUpdate = await db.collection('drivers').updateOne({ _id: driver._id, isAvailable: true,
      onlineUntil: { $gt: new Date() }, routeId,
      $expr: { $lte: [{ $add: [{ $ifNull: ['$reservedSeats', 0] }, seats] }, capacity] } },
    { $inc: { reservedSeats: seats } }, options);
    requireValue(seatUpdate.matchedCount === 1, 'Driver is unavailable', 409);
    ride = { _id: new ObjectId(), requestId, passengerEmail: req.auth.email, passengerId: req.auth.userId,
      passengerName: (await db.collection('users').findOne({ email: req.auth.email }, options)).fullName,
      driverEmail: driver.email, driverId, driverName: driver.fullName, vehicle: driver.plateNo,
      routeId, type: quote.route.type, fromId, toId, fromName: quote.fromName, toName: quote.toName,
      ...(pickupLocation ? { pickupLocation } : {}),
      fare: quote.fare, unitFare: quote.unitFare, minutes: quote.minutes, seats, paymentMethod: 'cash', paymentStatus: 'unpaid', occupancyStatus: 'waiting', geoTrackingEnabled: false,
      status: 'pending', expiresAt: new Date(Date.now() + 5 * 60000), createdAt: new Date().toISOString() };
    await db.collection('rides').insertOne(ride, options);
    await notify(db, session, driver.email, ride, `${ride.passengerName} requested ${seats} seat(s): ${ride.fromName} to ${ride.toName}`);
  });
  res.status(201).json({ ride: serialize(ride) });
}));
router.get('/:id', asyncRoute(async (req, res) => {
  const ride = await getDB().collection('rides').findOne({ _id: id(req.params.id), ...owned(req) });
  requireValue(ride, 'Booking not found', 404);
  const driver = await findRideDriver(getDB(), ride);
  res.json({ ride: serialize(ride, driver, req.auth.role) });
}));
router.patch('/:id/status', asyncRoute(async (req, res) => {
  let updated;
  await transaction(async (db, session) => {
    const options = { session };
    const ride = await db.collection('rides').findOne({ _id: id(req.params.id), ...owned(req) }, options);
    requireValue(ride, 'Booking not found', 404);
    const { status } = req.body;
    if (status === ride.status) { updated = ride; return; }
    requireValue(canTransition(req.auth.role, ride.status, status), 'That booking status change is not allowed', 409);
    if (req.auth.role === 'driver') {
      const driver = await db.collection('drivers').findOne({ _id: id(ride.driverId) }, options);
      requireValue(driver?.verified && driver.approvalStatus === 'approved', 'Driver approval required', 403);
    }
    const changes = { status, updatedAt: new Date().toISOString() };
    if (status === 'accepted') Object.assign(changes, { geoTrackingEnabled: true, passengerLocation: null, geoEvidence: null,
      geoDetection: { state: 'waiting_for_fresh_gps', updatedAt: changes.updatedAt } });
    if (status === 'completed') { changes.completedAt = changes.updatedAt; changes.paymentStatus = 'paid'; changes.occupancyStatus = 'alighted'; changes.alightedAt = ride.alightedAt || changes.updatedAt; changes.geoTrackingEnabled = false; changes.geoEvidence = null; }
    if (status === 'cancelled') { changes.cancelledBy = req.auth.role; changes.cancellationReason = String(req.body.reason || 'Cancelled').slice(0, 250); }
    if (['completed', 'cancelled'].includes(status)) {
      changes.geoTrackingEnabled = false;
      changes.geoEvidence = null;
      changes.passengerLocation = null;
      if (hasSeatHold(ride)) changes.seatsReleasedAt = changes.updatedAt;
      if (hasSeatHold(ride)) {
        const released = await db.collection('drivers').updateOne({ _id: id(ride.driverId), reservedSeats: { $gte: ride.seats } },
          { $inc: { reservedSeats: -ride.seats, ...(status === 'completed' ? { totalTrips: 1, totalEarnings: ride.fare } : {}) } }, options);
        requireValue(released.matchedCount === 1, 'Seat reservations changed. Please retry', 409);
      }
    }
    await db.collection('rides').updateOne({ _id: ride._id, status: ride.status }, { $set: changes }, options);
    updated = { ...ride, ...changes };
    await notify(db, session, req.auth.role === 'driver' ? ride.passengerEmail : ride.driverEmail, ride, `${ride.fromName} to ${ride.toName}: ${status}`);
  });
  res.json({ ride: serialize(updated, null, req.auth.role) });
}));
router.put('/:id/geolocation', requireRole('passenger'), asyncRoute(async (req, res) => {
  requireValue(req.body.enabled === true, 'Automatic seat detection is enabled by the booking');
  await transaction(async (db, session) => {
    const options = { session };
    const ride = await db.collection('rides').findOne({ _id: id(req.params.id), passengerEmail: req.auth.email }, options);
    requireValue(ride, 'Booking not found', 404);
    requireValue(activeStatuses.includes(ride.status) && ride.occupancyStatus !== 'alighted', 'GPS detection is closed for this booking', 409);
    await db.collection('rides').updateOne({ _id: ride._id }, { $set: { geoTrackingEnabled: req.body.enabled, geoEvidence: null,
      passengerLocation: null, geoDetection: { state: req.body.enabled ? 'waiting_for_fresh_gps' : 'disabled', updatedAt: new Date().toISOString() } } }, options);
  });
  res.json({ success: true });
}));
router.post('/:id/location', requireRole('passenger'), asyncRoute(async (req, res) => {
  const location = normalizePosition(req.body);
  let trackingClosed = false;
  await transaction(async (db, session) => {
    const options = { session };
    const ride = await db.collection('rides').findOne({ _id: id(req.params.id), passengerEmail: req.auth.email }, options);
    requireValue(ride, 'Booking not found', 404);
    if (!activeStatuses.includes(ride.status) || ride.occupancyStatus === 'alighted') { trackingClosed = true; return; }
    requireValue(ride.geoTrackingEnabled, 'Enable automatic seat detection before sharing passenger GPS', 409);
    if (ride.passengerLocation?.capturedAt && Date.parse(location.capturedAt) <= Date.parse(ride.passengerLocation.capturedAt)) return;
    await db.collection('rides').updateOne({ _id: ride._id }, { $set: { passengerLocation: location } }, options);
    const driver = await db.collection('drivers').findOne({ _id: id(ride.driverId) }, options);
    if (driver) {
      const updated = await detectOccupancy(db, session, { ...ride, passengerLocation: location }, driver);
      trackingClosed = updated.occupancyStatus === 'alighted';
    }
  });
  res.json({ success: true, trackingClosed });
}));
router.post('/:id/rating', requireRole('passenger'), asyncRoute(async (req, res) => {
  const rating = req.body.rating;
  requireValue(Number.isInteger(rating) && rating >= 1 && rating <= 5, 'Choose a rating from 1 to 5');
  await transaction(async (db, session) => {
    const options = { session };
    const ride = await db.collection('rides').findOne({ _id: id(req.params.id), passengerEmail: req.auth.email, status: 'completed' }, options);
    requireValue(ride, 'Only completed rides can be rated', 409);
    requireValue(!ride.rating, 'Ride already rated', 409);
    const driver = await findRideDriver(db, ride, options);
    requireValue(driver, 'Driver profile is no longer available', 409);
    await db.collection('rides').updateOne({ _id: ride._id }, { $set: { rating } }, options);
    await db.collection('drivers').updateOne({ _id: driver._id }, { $inc: { ratingTotal: rating, ratingCount: 1 } }, options);
  });
  res.json({ success: true });
}));
router.get('/:id/messages', asyncRoute(async (req, res) => {
  const ride = await getDB().collection('rides').findOne({ _id: id(req.params.id), ...owned(req) });
  requireValue(ride, 'Booking not found', 404);
  const messages = await getDB().collection('ride_messages').find({ rideId: ride._id.toString() }).sort({ createdAt: -1 }).limit(100).toArray();
  res.json({ messages: messages.reverse().map(({ senderEmail, ...message }) => ({ ...message, mine: senderEmail === req.auth.email })) });
}));
router.post('/:id/messages', asyncRoute(async (req, res) => {
  const ride = await getDB().collection('rides').findOne({ _id: id(req.params.id), ...owned(req) });
  requireValue(ride, 'Booking not found', 404);
  requireValue(activeStatuses.includes(ride.status), 'Chat is closed for this booking', 409);
  const text = req.body.text;
  requireValue(typeof text === 'string' && text.trim().length > 0 && text.length <= 1000, 'Message must contain 1 to 1000 characters');
  const message = { rideId: ride._id.toString(), senderEmail: req.auth.email, role: req.auth.role, text: text.trim(), createdAt: new Date().toISOString() };
  await getDB().collection('ride_messages').insertOne(message);
  res.status(201).json({ success: true });
}));
export default router;
