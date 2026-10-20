import { ObjectId } from 'mongodb';

export const LEGACY_BOOKING_MIGRATION = 'legacy-active-bookings-v1';
export const LEGACY_BOOKING_BACKUPS = 'ride_migration_backups';

// The previous booking schema used an email as driverId and had no seat hold,
// request ID or driverEmail. Only obsolete records of that exact shape qualify;
// never guess which of two current reservations should be cancelled.
export async function archiveObsoleteLegacyBookings(database, client, now = new Date()) {
  const cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const filter = {
    status: { $in: ['pending', 'accepted', 'arrived', 'ongoing'] },
    requestId: { $exists: false }, driverEmail: { $exists: false }, seats: { $exists: false },
    driverId: { $type: 'string', $regex: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ },
    $or: [
      { createdAt: { $type: 'string', $regex: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/, $lt: cutoff.toISOString() } },
      { createdAt: { $type: 'date', $lt: cutoff } },
    ],
  };
  const rides = database.collection('rides');
  const candidates = await rides.find(filter, { projection: { _id: 1 } }).toArray();
  if (!candidates.length) return 0;
  const backups = database.collection(LEGACY_BOOKING_BACKUPS);
  await backups.createIndex({ migration: 1, originalId: 1 });
  const session = client.startSession();
  let count = 0;
  try {
    for (const { _id } of candidates) {
      const archived = await session.withTransaction(async () => {
        const options = { session };
        const document = await rides.findOne({ ...filter, _id }, options);
        if (!document) return false;
        await backups.insertOne({
          _id: new ObjectId(), migration: LEGACY_BOOKING_MIGRATION,
          originalId: _id, archivedAt: now, document,
        }, options);
        await rides.updateOne({ _id }, { $set: {
          status: 'cancelled', cancelledBy: 'system',
          cancellationReason: 'Old booking closed during system upgrade. Please create a new booking.',
          legacyBookingMigration: LEGACY_BOOKING_MIGRATION, updatedAt: now.toISOString(),
        } }, options);
        // These records never held seats in the current schema. Do not adjust
        // driver capacity, cash, earnings or completed-trip counters.
        return true;
      });
      if (archived) count++;
    }
  } finally {
    await session.endSession();
  }
  return count;
}
