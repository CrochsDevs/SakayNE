import { Router } from 'express';
import { ObjectId } from 'mongodb';
import { getDB, transaction } from '../../config/db.js';
import { authenticate, requireRole } from '../../shared/session.js';
import { asyncRoute, requireValue } from '../../shared/errors.js';
import { rateLimit } from '../../shared/rate-limit.js';

const reasons = ['Unsafe driving', 'Harassment or rude behavior', 'Overcharging', 'Refused pickup or drop-off', 'Vehicle condition', 'Other'];
const statuses = ['open', 'in_review', 'resolved', 'dismissed'];
const objectId = value => {
  requireValue(typeof value === 'string' && /^[a-f\d]{24}$/i.test(value), 'Invalid reference');
  return new ObjectId(value);
};
function serialize(report, admin = false) {
  const { _id, rideId, driverName, vehicle, fromName, toName, reason, details, status, adminResponse, createdAt, updatedAt } = report;
  return { id: _id.toString(), rideId, driverName, vehicle, fromName, toName, reason, details, status, adminResponse, createdAt, updatedAt,
    ...(admin ? { passengerName: report.passengerName, passengerEmail: report.passengerEmail, driverId: report.driverId } : {}) };
}
async function list(req, res, admin = false) {
  const query = admin ? {} : { passengerEmail: req.auth.email };
  if (req.query.status !== undefined) {
    requireValue(statuses.includes(req.query.status), 'Invalid report status');
    query.status = req.query.status;
  }
  if (req.query.rideId !== undefined) query.rideId = objectId(req.query.rideId).toString();
  if (req.query.cursor !== undefined) query._id = { $lt: objectId(req.query.cursor) };
  const rows = await getDB().collection('driver_reports').find(query).sort({ _id: -1 }).limit(31).toArray();
  const reports = rows.slice(0, 30);
  res.json({ reports: reports.map(report => serialize(report, admin)), nextCursor: rows.length > 30 ? reports.at(-1)._id.toString() : null });
}

const router = Router();
router.use(authenticate, requireRole('passenger'));
router.get('/', asyncRoute((req, res) => list(req, res)));
router.post('/', rateLimit(10, 15 * 60000, req => req.auth.userId), asyncRoute(async (req, res) => {
  const rideId = objectId(req.body.rideId).toString();
  requireValue(reasons.includes(req.body.reason), 'Choose a report reason');
  requireValue(typeof req.body.details === 'string' && req.body.details.trim().length >= 10 && req.body.details.length <= 2000, 'Describe what happened in 10 to 2000 characters');
  let report;
  await transaction(async (db, session) => {
    const options = { session };
    const ride = await db.collection('rides').findOne({ _id: new ObjectId(rideId), passengerEmail: req.auth.email }, options);
    requireValue(ride, 'Booking not found', 404);
    requireValue(!await db.collection('driver_reports').findOne({ rideId, passengerEmail: req.auth.email }, options), 'You already reported this booking. Check My reports for updates.', 409);
    report = { _id: new ObjectId(), rideId, passengerEmail: req.auth.email, passengerName: ride.passengerName || '',
      driverId: String(ride.driverId), driverName: ride.driverName || 'Driver', vehicle: ride.vehicle || '',
      fromName: ride.fromName || ride.pickup || '', toName: ride.toName || ride.dropoff || '',
      reason: req.body.reason, details: req.body.details.trim(), status: 'open', adminResponse: '', createdAt: new Date().toISOString() };
    await db.collection('driver_reports').insertOne(report, options);
    const admins = await db.collection('auth').find({ role: 'admin' }, { ...options, projection: { email: 1 } }).toArray();
    if (admins.length) await db.collection('notifications').insertMany(admins.map(admin => ({ email: admin.email, type: 'driver_report', title: 'New passenger report', message: `${report.reason} — booking #${rideId.slice(-8).toUpperCase()}`, reportId: report._id.toString(), read: false, createdAt: report.createdAt })), options);
  });
  res.status(201).json({ report: serialize(report) });
}));

export const adminReports = Router();
adminReports.use(authenticate, requireRole('admin'));
adminReports.get('/', asyncRoute((req, res) => list(req, res, true)));
adminReports.patch('/:id', asyncRoute(async (req, res) => {
  const reportId = objectId(req.params.id);
  requireValue(statuses.includes(req.body.status), 'Invalid report status');
  requireValue(typeof req.body.response === 'string' && req.body.response.trim().length >= 3 && req.body.response.length <= 2000, 'Enter a response in 3 to 2000 characters');
  let updated;
  await transaction(async (db, session) => {
    const options = { session };
    const report = await db.collection('driver_reports').findOne({ _id: reportId }, options);
    requireValue(report, 'Report not found', 404);
    const changes = { status: req.body.status, adminResponse: req.body.response.trim(), updatedAt: new Date().toISOString(), reviewedBy: req.auth.email };
    await db.collection('driver_reports').updateOne({ _id: reportId }, { $set: changes }, options);
    await db.collection('audit_logs').insertOne({ action: 'driver_report_review', targetId: reportId.toString(), actor: req.auth.email, previousStatus: report.status, status: changes.status, response: changes.adminResponse, createdAt: changes.updatedAt }, options);
    await db.collection('notifications').insertOne({ email: report.passengerEmail, type: 'driver_report', title: 'Your report was updated', message: `Booking #${report.rideId.slice(-8).toUpperCase()}: ${changes.status.replace('_', ' ')}. Open My reports to read the admin response.`, reportId: reportId.toString(), read: false, createdAt: changes.updatedAt }, options);
    updated = { ...report, ...changes };
  });
  res.json({ report: serialize(updated, true) });
}));
export default router;
