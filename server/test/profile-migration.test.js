import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { MongoClient, ObjectId } from 'mongodb';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { closeDB, connectDB, getDB } from '../config/db.js';
import { PROFILE_BACKUPS, PROFILE_MIGRATION, reconcileUserProfiles } from '../config/profile-migration.js';
import { createProfile } from '../modules/users/users.model.js';
import { archiveObsoleteLegacyBookings, LEGACY_BOOKING_BACKUPS } from '../config/legacy-booking-migration.js';

let mongo, client, database;
before(async () => {
  mongo = await MongoMemoryReplSet.create({
    replSet: { count: 1 },
    binary: { downloadDir: fileURLToPath(new URL('../.cache/mongodb', import.meta.url)) },
  });
  client = await new MongoClient(mongo.getUri()).connect();
  database = client.db('sakayne_profile_migration_tests');
});
beforeEach(async () => { await database.dropDatabase(); });
after(async () => {
  await closeDB();
  await client?.close();
  await mongo?.stop();
});

test('duplicate profiles are backed up, merged and referenced atomically; reruns do nothing', async () => {
  const email = 'legacy@example.test';
  const originals = [
    { _id: new ObjectId('000000000000000000000001'), email, fullName: 'Original name', phone: '', enabled: false, count: 0, createdAt: '2024-01-01' },
    { _id: new ObjectId('000000000000000000000002'), email, fullName: 'Later name', phone: 'old phone', enabled: true, count: 4 },
    { _id: new ObjectId('000000000000000000000003'), email, fullName: 'Latest name', phone: 'latest phone', avatar: 'photo.png' },
  ];
  await database.collection('users').insertMany(originals);
  const unrelated = { _id: new ObjectId(), email: 'other@example.test', fullName: 'Other' };
  await database.collection('users').insertOne(unrelated);
  await database.collection('rides').insertMany([
    { passengerId: String(originals[1]._id), status: 'completed' },
    { passengerId: originals[2]._id, status: 'accepted' },
    { passengerId: String(unrelated._id), status: 'completed' },
  ]);
  const auth = { _id: new ObjectId(), email, password: 'credential', role: 'admin' };
  const balance = { _id: new ObjectId(), email, balance: 123 };
  await database.collection('auth').insertOne(auth);
  await database.collection('tokens').insertOne(balance);
  assert.deepEqual(await reconcileUserProfiles(database, client), { groups: 1, removed: 2, references: 2 });
  assert.deepEqual(await database.collection('users').findOne({ email }), {
    ...originals[0], phone: 'latest phone', avatar: 'photo.png',
  });
  const backups = await database.collection(PROFILE_BACKUPS).find().sort({ originalId: 1 }).toArray();
  assert.deepEqual(backups.map(b => b.document), originals);
  assert.ok(backups.every(b => b.migration === PROFILE_MIGRATION && b.canonicalId.equals(originals[0]._id) && b.archivedAt instanceof Date));
  assert.equal(new Set(backups.map(b => String(b.batchId))).size, 1);
  assert.equal(await database.collection('rides').countDocuments({ passengerId: String(originals[0]._id) }), 1);
  assert.equal(await database.collection('rides').countDocuments({ passengerId: originals[0]._id }), 1);
  assert.deepEqual(await database.collection('users').findOne({ _id: unrelated._id }), unrelated);
  assert.deepEqual(await database.collection('auth').findOne({ email }), auth);
  assert.deepEqual(await database.collection('tokens').findOne({ email }), balance);
  assert.deepEqual(await reconcileUserProfiles(database, client), { groups: 0, removed: 0, references: 0 });
  assert.equal(await database.collection(PROFILE_BACKUPS).countDocuments(), 3);
});

test('a reference update failure rolls back backups, profile changes and removals', async () => {
  const originals = [
    { _id: new ObjectId(), email: 'rollback@example.test', phone: '' },
    { _id: new ObjectId(), email: 'rollback@example.test', phone: 'filled phone' },
  ];
  await database.collection('users').insertMany(originals);
  const faultyDatabase = {
    collection(name) {
      if (name === 'rides') return { updateMany: async () => { throw new Error('Simulated reference failure'); } };
      return database.collection(name);
    },
  };
  await assert.rejects(reconcileUserProfiles(faultyDatabase, client), /Simulated reference failure/);
  assert.deepEqual(await database.collection('users').find().sort({ _id: 1 }).toArray(), originals);
  assert.equal(await database.collection(PROFILE_BACKUPS).countDocuments(), 0);
});

test('missing email duplicates stop repair without combining unrelated profiles', async () => {
  await database.collection('users').insertMany([{ fullName: 'One' }, { fullName: 'Two' }]);
  await assert.rejects(reconcileUserProfiles(database, client), /missing or invalid email/);
  assert.equal(await database.collection('users').countDocuments(), 2);
  assert.equal(await database.collection(PROFILE_BACKUPS).countDocuments(), 0);
});

test('startup repairs legacy profiles before indexing and concurrent profile creation shares one ID', async () => {
  process.env.MONGO_URI = mongo.getUri();
  process.env.DB_NAME = database.databaseName;
  const email = 'startup@example.test';
  await database.collection('users').insertMany([{ email, fullName: 'Original' }, { email, phone: '123' }]);
  await database.collection('rides').insertMany([
    { passengerEmail: email, driverId: 'driver@example.test', status: 'pending', createdAt: '2020-01-01T00:00:00.000Z' },
    { passengerEmail: email, driverId: 'driver@example.test', status: 'ongoing', createdAt: '2020-01-02T00:00:00.000Z' },
  ]);
  try {
    await connectDB();
    assert.ok(getDB());
    assert.equal(await database.collection('users').countDocuments({ email }), 1);
    assert.equal(await database.collection('rides').countDocuments({ status: 'cancelled' }), 2);
    assert.equal(await database.collection(LEGACY_BOOKING_BACKUPS).countDocuments(), 2);
    await assert.rejects(database.collection('users').insertOne({ email }), { code: 11000 });
    const profiles = await Promise.all(Array.from({ length: 16 }, () => createProfile({ email: 'concurrent@example.test', fullName: 'Name', phone: '123' })));
    assert.equal(new Set(profiles.map(p => String(p._id))).size, 1);
    assert.equal(await database.collection('users').countDocuments({ email: 'concurrent@example.test' }), 1);
    assert.equal((await createProfile({ email, fullName: '', phone: '' })).fullName, 'Original');
  } finally {
    await closeDB();
  }
});

test('duplicate credentials prevent startup without merging accounts or exposing a ready database', async () => {
  process.env.MONGO_URI = mongo.getUri();
  process.env.DB_NAME = database.databaseName;
  await database.collection('auth').insertMany([
    { email: 'conflict@example.test', role: 'passenger', password: 'one' },
    { email: 'conflict@example.test', role: 'admin', password: 'two' },
  ]);
  await assert.rejects(connectDB(), /duplicate email records in 'auth'/);
  assert.equal(getDB(), undefined);
  assert.equal(await database.collection('auth').countDocuments(), 2);
});

test('only obsolete legacy bookings are backed up and closed; seats and money are unchanged', async () => {
  const now = new Date('2026-10-15T00:00:00.000Z');
  const legacy = { passengerEmail: 'old@example.test', driverId: 'driver@example.test', status: 'ongoing', createdAt: '2026-07-01T00:00:00.000Z', fare: 99 };
  const documents = [
    { _id: new ObjectId(), ...legacy },
    { _id: new ObjectId(), ...legacy, status: 'pending', createdAt: new Date('2026-07-01T00:00:00.000Z') },
    { _id: new ObjectId(), ...legacy, createdAt: now.toISOString() },
    { _id: new ObjectId(), ...legacy, status: 'completed' },
    { _id: new ObjectId(), ...legacy, status: 'cancelled' },
    { _id: new ObjectId(), ...legacy, requestId: 'current_request', seats: 2, driverEmail: 'driver@example.test' },
    { _id: new ObjectId(), ...legacy, driverId: String(new ObjectId()) },
    { _id: new ObjectId(), ...legacy, createdAt: 'unknown' },
  ];
  await database.collection('rides').insertMany(documents);
  const driver = { _id: new ObjectId(), email: 'driver@example.test', reservedSeats: 5, totalEarnings: 1200, totalTrips: 40 };
  await database.collection('drivers').insertOne(driver);
  assert.equal(await archiveObsoleteLegacyBookings(database, client, now), 2);
  assert.equal(await database.collection('rides').countDocuments(), documents.length);
  const backups = await database.collection(LEGACY_BOOKING_BACKUPS).find().sort({ originalId: 1 }).toArray();
  assert.deepEqual(backups.map(b => b.document), documents.slice(0, 2));
  for (const doc of documents.slice(0, 2)) {
    const archived = await database.collection('rides').findOne({ _id: doc._id });
    assert.equal(archived.status, 'cancelled');
    assert.equal(archived.cancelledBy, 'system');
    assert.equal(archived.fare, doc.fare);
    assert.equal(archived.paymentStatus, undefined);
    assert.match(archived.cancellationReason, /system upgrade/);
  }
  for (const doc of documents.slice(2)) assert.deepEqual(await database.collection('rides').findOne({ _id: doc._id }), doc);
  assert.deepEqual(await database.collection('drivers').findOne({ _id: driver._id }), driver);
  assert.equal(await archiveObsoleteLegacyBookings(database, client, now), 0);
  assert.equal(await database.collection(LEGACY_BOOKING_BACKUPS).countDocuments(), 2);
});

test('legacy booking archival rolls back its backup if updating the booking fails', async () => {
  const original = { _id: new ObjectId(), passengerEmail: 'old@example.test', driverId: 'driver@example.test', status: 'pending', createdAt: '2020-01-01T00:00:00.000Z' };
  await database.collection('rides').insertOne(original);
  const faultyDatabase = {
    collection(name) {
      const collection = database.collection(name);
      if (name !== 'rides') return collection;
      return {
        find: collection.find.bind(collection), findOne: collection.findOne.bind(collection),
        updateOne: async () => { throw new Error('Simulated booking write failure'); },
      };
    },
  };
  await assert.rejects(archiveObsoleteLegacyBookings(faultyDatabase, client), /Simulated booking write failure/);
  assert.deepEqual(await database.collection('rides').findOne({ _id: original._id }), original);
  assert.equal(await database.collection(LEGACY_BOOKING_BACKUPS).countDocuments(), 0);
});

test('current conflicting bookings remain intact and produce an actionable startup error', async () => {
  process.env.MONGO_URI = mongo.getUri();
  process.env.DB_NAME = database.databaseName;
  const bookings = [
    { _id: new ObjectId(), passengerEmail: 'current@example.test', driverEmail: 'driver@example.test', seats: 1, requestId: 'current_1', status: 'ongoing' },
    { _id: new ObjectId(), passengerEmail: 'current@example.test', driverEmail: 'driver@example.test', seats: 2, requestId: 'current_2', status: 'accepted' },
  ];
  await database.collection('rides').insertMany(bookings);
  await assert.rejects(connectDB(), /multiple active bookings/);
  assert.equal(getDB(), undefined);
  assert.deepEqual(await database.collection('rides').find().sort({ _id: 1 }).toArray(), bookings);
});
