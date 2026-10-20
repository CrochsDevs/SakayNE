import { Router } from 'express';
import { ObjectId } from 'mongodb';
import { getDB, transaction } from '../../config/db.js';
import { authenticate, requireRole } from '../../shared/session.js';
import { asyncRoute, requireValue } from '../../shared/errors.js';
import { routes, activeStatuses } from '../../shared/transit.js';
import { normalizePosition, occupiedSeats, detectOccupancy } from '../rides/geolocation.js';

const router = Router();
router.use(authenticate);
function publicDriver(d) {
  return { id: d._id.toString(), name: d.fullName, vehicle: d.plateNo, type: d.vehicleType === 'bus' ? 'bus' : 'jeep',
    routeId: d.routeId, seats: Math.max(0, (d.capacity || (d.vehicleType === 'bus' ? 45 : 16)) - (d.reservedSeats || 0)),
    rating: d.ratingCount ? (d.ratingTotal / d.ratingCount).toFixed(1) : 'New', etaMin: null };
}
router.get('/', asyncRoute(async (req, res) => {
  const drivers = await getDB().collection('drivers').find({ verified: true, approvalStatus: 'approved', isAvailable: true, onlineUntil: { $gt: new Date() } }).toArray();
  res.json({ drivers: drivers.filter(d => d.routeId && ['bus', 'jeepney'].includes(d.vehicleType)).map(publicDriver) });
}));
router.get('/me', requireRole('driver'), asyncRoute(async (req, res) => {
  const driver = await getDB().collection('drivers').findOne({ email: req.auth.email });
  requireValue(driver, 'Driver profile not found', 404);
  const occupied = await occupiedSeats(getDB(), driver._id);
  res.json({ driver: { ...driver, occupiedSeats: occupied, availableSeats: Math.max(0, (driver.capacity || (driver.vehicleType === 'bus' ? 45 : 16)) - (driver.reservedSeats || 0)),
    waitingSeats: Math.max(0, (driver.reservedSeats || 0) - occupied), id: driver._id.toString(), isAvailable: driver.isAvailable && driver.onlineUntil > new Date() } });
}));
router.put('/availability', requireRole('driver'), asyncRoute(async (req, res) => {
  const driver = await getDB().collection('drivers').findOne({ email: req.auth.email });
  requireValue(driver?.verified && driver.approvalStatus === 'approved', 'Driver account must be approved', 403);
  const { isAvailable, routeId, capacity } = req.body;
  requireValue(typeof isAvailable === 'boolean', 'Availability must be true or false');
  const route = routes.find(r => r.id === routeId);
  if (isAvailable) {
    requireValue(route && route.type === (driver.vehicleType === 'bus' ? 'bus' : 'jeep') && ['bus', 'jeepney'].includes(driver.vehicleType), 'Select a route for your vehicle');
    requireValue(Number.isInteger(capacity) && capacity >= 1 && capacity <= (route.type === 'bus' ? 80 : 30), 'Enter a valid vehicle capacity');
  }
  if ((driver.reservedSeats || 0) > 0) {
    requireValue(routeId === driver.routeId && capacity === driver.capacity, 'Finish existing bookings before changing route or capacity', 409);
  }
  const update = { isAvailable, onlineUntil: isAvailable ? new Date(Date.now() + 90000) : new Date(0),
    ...(isAvailable ? { routeId, capacity } : {}) };
  // CAS prevents an availability change racing with a seat reservation.
  const result = await getDB().collection('drivers').updateOne({ _id: driver._id, reservedSeats: driver.reservedSeats ?? { $exists: false } }, { $set: update });
  requireValue(result.matchedCount, 'Bookings changed. Please retry', 409);
  res.json({ driver: { ...driver, ...update, id: driver._id.toString() } });
}));
router.post('/heartbeat', requireRole('driver'), asyncRoute(async (req, res) => {
  await getDB().collection('drivers').updateOne({ email: req.auth.email, isAvailable: true, verified: true, approvalStatus: 'approved' }, { $set: { onlineUntil: new Date(Date.now() + 90000) } });
  res.json({ success: true });
}));
router.post('/location', requireRole('driver'), asyncRoute(async (req, res) => {
  const location = normalizePosition(req.body);
  await transaction(async (db, session) => {
    const options = { session };
    const driver = await db.collection('drivers').findOne({ email: req.auth.email, verified: true, approvalStatus: 'approved' }, options);
    requireValue(driver, 'Approved driver account required', 403);
    if (driver.location?.capturedAt && Date.parse(location.capturedAt) <= Date.parse(driver.location.capturedAt)) return;
    await db.collection('drivers').updateOne({ _id: driver._id }, { $set: { location } }, options);
    const rides = await db.collection('rides').find({ driverId: driver._id.toString(), geoTrackingEnabled: true, status: { $in: ['accepted', 'arrived', 'ongoing'] }, occupancyStatus: { $ne: 'alighted' } }, options).toArray();
    for (const ride of rides) await detectOccupancy(db, session, ride, { ...driver, location });
  });
  res.json({ success: true });
}));
router.get('/earnings', requireRole('driver'), asyncRoute(async (req, res) => {
  const trips = await getDB().collection('rides').find({ driverEmail: req.auth.email, status: 'completed' }).sort({ completedAt: -1 }).toArray();
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
  const day = r => new Date(r.completedAt).toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
  res.json({ total: trips.reduce((s, r) => s + r.fare, 0), today: trips.filter(r => day(r) === today).reduce((s, r) => s + r.fare, 0), trips });
}));
export const adminDrivers = Router();
adminDrivers.use(authenticate, requireRole('admin'));
adminDrivers.get('/', asyncRoute(async (req, res) => {
  const drivers = await getDB().collection('drivers').find({}).sort({ createdAt: -1 }).toArray();
  res.json({ drivers });
}));
adminDrivers.patch('/:id', asyncRoute(async (req, res) => {
  requireValue(ObjectId.isValid(req.params.id), 'Invalid driver ID');
  const { approvalStatus } = req.body;
  requireValue(['approved', 'rejected', 'pending'].includes(approvalStatus), 'Invalid approval status');
  await transaction(async (db, session) => {
    const options = { session };
    const driver = await db.collection('drivers').findOne({ _id: new ObjectId(req.params.id) }, options);
    requireValue(driver, 'Driver not found', 404);
    requireValue(!await db.collection('rides').findOne({ driverEmail: driver.email, status: { $in: activeStatuses } }, options), 'Resolve active bookings before changing approval', 409);
    await db.collection('drivers').updateOne({ _id: driver._id }, { $set: { approvalStatus, verified: approvalStatus === 'approved', isAvailable: false, reviewedAt: new Date().toISOString() } }, options);
    await db.collection('notifications').insertOne({ email: driver.email, type: 'approval', title: 'Driver application', message: `Your application is ${approvalStatus}.`, read: false, createdAt: new Date().toISOString() }, options);
  });
  res.json({ success: true });
}));
export default router;
