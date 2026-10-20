import { ObjectId } from 'mongodb';

export const PROFILE_MIGRATION = 'users-unique-email-v1';
export const PROFILE_BACKUPS = 'user_profile_backups';

// Only profile documents are reconciled. Credentials and reward balances require
// separate review because choosing or adding those values could change access.
export async function reconcileUserProfiles(database, client) {
  const users = database.collection('users');
  const duplicates = await users.aggregate([
    { $group: { _id: '$email', count: { $sum: 1 } } },
    { $match: { count: { $gt: 1 } } },
  ]).toArray();
  if (duplicates.some(({ _id: email }) => typeof email !== 'string' || !email.trim())) {
    throw new Error('Duplicate user profiles have missing or invalid email addresses. Review these records before restarting; no profiles were merged.');
  }
  const report = { groups: 0, removed: 0, references: 0 };
  if (!duplicates.length) return report;

  const backups = database.collection(PROFILE_BACKUPS);
  await backups.createIndex({ migration: 1, batchId: 1 });
  const session = client.startSession();
  try {
    for (const { _id: email } of duplicates) {
      const result = await session.withTransaction(async () => {
        const options = { session };
        // Re-read on transaction retries, including when another server repaired
        // this group while this instance was starting.
        const originals = await users.find({ email }, options).sort({ _id: 1 }).toArray();
        if (originals.length < 2) return null;
        const [canonical, ...extras] = originals;
        const merged = { ...canonical };
        // Keep existing nonempty values on the oldest ID. Fill missing fields
        // using the newest profile that has a value, without changing false/0.
        const empty = value => value == null || (typeof value === 'string' && !value.trim());
        for (const profile of [...extras].reverse()) {
          for (const [key, value] of Object.entries(profile)) {
            if (key !== '_id' && key !== 'email' && empty(merged[key]) && !empty(value)) {
              Object.defineProperty(merged, key, { value, enumerable: true, configurable: true, writable: true });
            }
          }
        }

        const batchId = new ObjectId(), archivedAt = new Date();
        // Archive every original, including the canonical document, in the same
        // transaction as replacement, reference updates and removal.
        await backups.insertMany(originals.map(document => ({
          migration: PROFILE_MIGRATION, batchId, archivedAt,
          originalId: document._id, canonicalId: canonical._id, email, document,
        })), options);
        await users.replaceOne({ _id: canonical._id }, merged, options);
        const ids = extras.map(document => document._id);
        let references = 0;
        for (const [values, replacement] of [[ids, canonical._id], [ids.map(String), String(canonical._id)]]) {
          const updated = await database.collection('rides').updateMany(
            { passengerId: { $in: values } }, { $set: { passengerId: replacement } }, options,
          );
          references += updated.modifiedCount;
        }
        await users.deleteMany({ _id: { $in: ids } }, options);
        return { removed: extras.length, references };
      });
      if (result) {
        report.groups++;
        report.removed += result.removed;
        report.references += result.references;
      }
    }
  } finally {
    await session.endSession();
  }
  return report;
}
