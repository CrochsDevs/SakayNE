import { MongoClient } from "mongodb";
import { reconcileUserProfiles, PROFILE_BACKUPS } from './profile-migration.js';
import { archiveObsoleteLegacyBookings, LEGACY_BOOKING_BACKUPS } from './legacy-booking-migration.js';

let client;
let db;

export async function connectDB() {
  const uri = process.env.MONGO_URI;
  const dbName = process.env.DB_NAME || "SakayNE";

  if (!uri) throw new Error('MONGO_URI is required');
  client = new MongoClient(uri, {
    serverSelectionTimeoutMS: 10000,
  });

  try {
    await client.connect();
    const database = client.db(dbName);
    const topology = await database.admin().command({ hello: 1 });
    if (!topology.setName && topology.msg !== 'isdbgrid') throw new Error('MongoDB must use a replica set or Atlas to support booking transactions');
    const repaired = await reconcileUserProfiles(database, client);
    if (repaired.groups) console.log(`Reconciled ${repaired.groups} duplicate user profile group(s); archived ${repaired.groups + repaired.removed} originals in ${PROFILE_BACKUPS} and updated ${repaired.references} booking reference(s).`);
    const archived = await archiveObsoleteLegacyBookings(database, client);
    if (archived) console.log(`Closed ${archived} obsolete legacy booking(s); originals preserved in ${LEGACY_BOOKING_BACKUPS}.`);
    await ensureIndexes(database);
    db = database;
    return db;
  } catch (error) {
    await client.close();
    db = undefined;
    throw error;
  }
}

export async function ensureIndexes(database) {
  for (const name of ['auth', 'users', 'tokens', 'streaks', 'completed_tasks']) {
    try {
      await database.collection(name).createIndex({ email: 1 }, { unique: true });
    } catch (error) {
      if (error.code === 11000) throw new Error(`Database initialization stopped: duplicate email records in '${name}'. Review that collection before restarting. Credentials and reward records are never automatically merged.`, { cause: error });
      throw error;
    }
  }
  await database.collection('daily_claims').createIndex({ email: 1, date: 1 }, { unique: true });
  await database.collection('sessions').createIndex({ tokenHash: 1 }, { unique: true });
  await database.collection('sessions').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
  await database.collection('rides').createIndex({ passengerEmail: 1, requestId: 1 }, { unique: true, partialFilterExpression: { requestId: { $type: 'string' } } });
  try {
    await database.collection('rides').createIndex({ passengerEmail: 1 }, { unique: true, partialFilterExpression: { status: { $in: ['pending', 'accepted', 'arrived', 'ongoing'] } } });
  } catch (error) {
    if (error.code === 11000) throw new Error('Database initialization stopped: a passenger has multiple active bookings. Review the conflicting reservations before restarting; current seat holds were not changed.', { cause: error });
    throw error;
  }
  await database.collection('rides').createIndex({ driverEmail: 1, createdAt: -1 });
  await database.collection('rides').createIndex({ status: 1, expiresAt: 1 });
  await database.collection('drivers').createIndex({ routeId: 1, isAvailable: 1 });
  await database.collection('ride_messages').createIndex({ rideId: 1, createdAt: -1 });
  await database.collection('otps').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
}

export async function transaction(work) {
  const session = client.startSession();
  try {
    return await session.withTransaction(() => work(db, session));
  } finally { await session.endSession(); }
}

export async function closeDB() { await client?.close(); db = undefined; }

export function getDB() {
  return db;
}
