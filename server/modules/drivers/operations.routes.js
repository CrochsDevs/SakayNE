import { Router } from 'express';
import { getDB } from '../../config/db.js';
import { authenticate, requireRole } from '../../shared/session.js';
import { asyncRoute } from '../../shared/errors.js';
import { activeStatuses, routes } from '../../shared/transit.js';

const router = Router();
router.use(authenticate, requireRole('admin'));
router.get('/', asyncRoute(async (req, res) => {
  const db = getDB();
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const dayStart = new Date(today + 'T00:00:00+08:00').toISOString();
  const dayEnd = new Date(Date.parse(dayStart) + 86400000).toISOString();
  const [passengers, drivers, pendingApprovals, onlineVehicles, activeBookings, bookingsToday, completedToday, cancelledToday, receipts, recent] = await Promise.all([
    db.collection('auth').countDocuments({ role: 'passenger' }),
    db.collection('drivers').countDocuments({}),
    db.collection('drivers').countDocuments({ approvalStatus: 'pending' }),
    db.collection('drivers').countDocuments({ verified: true, approvalStatus: 'approved', isAvailable: true, onlineUntil: { $gt: new Date() } }),
    db.collection('rides').countDocuments({ status: { $in: activeStatuses } }),
    db.collection('rides').countDocuments({ createdAt: { $gte: dayStart, $lt: dayEnd } }),
    db.collection('rides').countDocuments({ completedAt: { $gte: dayStart, $lt: dayEnd }, status: 'completed' }),
    db.collection('rides').countDocuments({ updatedAt: { $gte: dayStart, $lt: dayEnd }, status: 'cancelled' }),
    db.collection('rides').aggregate([{ $match: { status: 'completed', paymentStatus: 'paid', completedAt: { $gte: dayStart, $lt: dayEnd } } }, { $group: { _id: null, total: { $sum: '$fare' } } }]).toArray(),
    db.collection('rides').find({}, { projection: { fromName: 1, toName: 1, status: 1, seats: 1, fare: 1, paymentStatus: 1, createdAt: 1, vehicle: 1 } }).sort({ createdAt: -1 }).limit(30).toArray(),
  ]);
  res.json({ date: today, timezone: 'Asia/Manila', passengers, drivers, pendingApprovals, onlineVehicles, catalogRoutes: routes.length, activeBookings, bookingsToday, completedToday, cancelledToday, recordedCollectionsToday: receipts[0]?.total || 0, recent });
}));
export default router;
