import bcrypt from "bcrypt";
import { ObjectId } from "mongodb";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import assert from "node:assert/strict";
import { after, before, beforeEach, mock, test } from "node:test";
import { v2 as cloudinary } from 'cloudinary';
import { startTestSmtp } from '../test-support/smtp.js';
import { fileURLToPath } from "node:url";
import { closeDB, connectDB, getDB } from "../config/db.js";
import { createSession } from "../shared/session.js";
import { expireReservations } from '../modules/rides/expiration.js';
import { canTransition, routes, tripQuote, towns } from "../shared/transit.js";
import { findPickupArea, findRoutePickupArea } from '../../client/src/data/pickup-area.mjs';
import app from "../src/app.js";

let mongo, server, base, tokens, driverId;
const routeId = "jeep-cabanatuan-palayan";
before(async () => {
  mongo = await MongoMemoryReplSet.create({
    replSet: { count: 1 },
    binary: {
      downloadDir: fileURLToPath(new URL("../.cache/mongodb", import.meta.url)),
    },
  });
  process.env.MONGO_URI = mongo.getUri();
  process.env.DB_NAME = "sakayne_booking_tests";
  process.env.CLOUDINARY_CLOUD_NAME = 'local-fixture';
  process.env.CLOUDINARY_API_KEY = 'fixture-key';
  process.env.CLOUDINARY_API_SECRET = 'fixture-secret';
  await connectDB();
  server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  base = `http://127.0.0.1:${server.address().port}/api`;
});
after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  await closeDB();
  await mongo?.stop();
});
beforeEach(async () => {
  const db = getDB();
  for (const collection of await db.listCollections().toArray())
    await db.collection(collection.name).deleteMany({});
  const password = await bcrypt.hash("TestPassword123", 4);
  tokens = {};
  for (const [name, role] of [
    ["passenger", "passenger"],
    ["other", "passenger"],
    ["third", "passenger"],
    ["driver", "driver"],
    ["admin", "admin"],
  ]) {
    const email = `${name}@example.test`;
    await db
      .collection("users")
      .insertOne({ email, fullName: name, phone: "09123456789" });
    await db
      .collection("auth")
      .insertOne({ email, role, password, verified: true });
    tokens[name] = await createSession(email, role);
  }
  driverId = new ObjectId();
  await db.collection("drivers").insertOne({
    _id: driverId,
    email: "driver@example.test",
    fullName: "Test Driver",
    phone: "09123456789",
    plateNo: "TEST123",
    vehicleType: "jeepney",
    verified: true,
    approvalStatus: "approved",
    isAvailable: true,
    onlineUntil: new Date(Date.now() + 90000),
    routeId,
    capacity: 3,
    reservedSeats: 0,
  });
});
async function api(path, role = "passenger", method = "GET", body) {
  const res = await fetch(base + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(tokens[role] ? { Authorization: `Bearer ${tokens[role]}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return { status: res.status, body: await res.json() };
}
function input(extra = {}) {
  return {
    driverId: driverId.toString(),
    routeId,
    fromId: "cabanatuan",
    toId: "palayan",
    seats: 1,
    requestId: "request_" + new ObjectId(),
    ...extra,
  };
}
async function booking(extra = {}, role = "passenger") {
  const res = await api("/rides", role, "POST", input(extra));
  assert.equal(res.status, 201, JSON.stringify(res.body));
  return res.body.ride;
}
async function transition(ride, status, role = "driver", boardingCode) {
  return api(`/rides/${ride.id}/status`, role, "PATCH", {
    status,
    boardingCode,
  });
}

test('stolen sessions stop working after account deletion or a role change', async () => {
  await getDB().collection('auth').updateOne({ email: 'admin@example.test' }, { $set: { role: 'passenger' } });
  assert.equal((await api('/admin/drivers', 'admin')).status, 401);
  await getDB().collection('auth').deleteOne({ email: 'other@example.test' });
  assert.equal((await api('/auth/me', 'other')).status, 401);
});

test('OTP attempts share a five-attempt account budget across both public verification URLs', async () => {
  const email = 'limited@example.test';
  await getDB().collection('otps').insertOne({ email, otp: '123456', purpose: 'registration', attempts: 0, expiresAt: new Date(Date.now() + 300000) });
  const wrong = await Promise.all(Array.from({ length: 8 }, (_, i) => api(i % 2 ? '/otp/verify' : '/auth/verify-email', 'anonymous', 'POST', { email, otp: '000000' })));
  assert.ok(wrong.every(result => result.status === 400));
  assert.equal((await getDB().collection('otps').findOne({ email })).attempts, 5);
  assert.equal((await api('/auth/verify-email', 'anonymous', 'POST', { email, otp: '123456' })).status, 400);
});

test('signup rejects bcrypt truncation, mail recipient syntax and untyped driver identifiers', async () => {
  const body = { fullName: 'Test', email: 'new@example.test', phone: '09123456789', password: 'TestPassword123' };
  for (const extra of [{ password: 'a'.repeat(73) }, { password: '\u00e9'.repeat(37) }, { email: 'victim@example.test,other@example.test' }, { role: 'driver', licenseNo: { $ne: '' }, plateNo: 'TEST', vehicleType: 'bus' }]) {
    assert.equal((await api('/auth/signup', 'anonymous', 'POST', { ...body, ...extra })).status, 400);
  }
});

test('API rejects oversized regular JSON, hides malformed input and disables response caching', async () => {
  const large = await api('/notifications/settings', 'passenger', 'PUT', { padding: 'a'.repeat(70000) });
  assert.equal(large.status, 413);
  const broken = await fetch(base + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"password":"DO_NOT_REFLECT"' });
  assert.equal(broken.status, 400);
  assert.equal((await broken.text()).includes('DO_NOT_REFLECT'), false);
  const health = await fetch(base + '/health');
  assert.equal(health.headers.get('cache-control'), 'no-store');
  assert.equal(health.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(health.headers.get('x-powered-by'), null);
});

test('GPS pickup preserves the exact pin for passenger and assigned driver without enabling live tracking', async () => {
  const town = towns.find(town => town.id === 'cabanatuan');
  const pickupLocation = { latitude: town.lat + 0.001, longitude: town.lng + 0.001, accuracy: 8, capturedAt: new Date().toISOString() };
  const request = input({ pickupLocation });
  const response = await api('/rides', 'passenger', 'POST', request);
  assert.equal(response.status, 201, JSON.stringify(response.body));
  assert.deepEqual(response.body.ride.pickupLocation, pickupLocation);
  assert.equal(response.body.ride.geoTrackingEnabled, false);
  assert.equal(response.body.ride.passengerLocation, undefined);
  const driver = await api('/rides/' + response.body.ride.id, 'driver');
  assert.deepEqual(driver.body.ride.pickupLocation, pickupLocation);
  assert.equal((await api('/rides/' + response.body.ride.id, 'other')).status, 404);
  assert.equal((await api('/rides', 'passenger', 'POST', request)).body.ride.id, response.body.ride.id);
  assert.equal((await api('/rides', 'passenger', 'POST', { ...request, pickupLocation: { ...pickupLocation, latitude: pickupLocation.latitude + 0.001 } })).status, 409);
});

test('approximate GPS pickup keeps its reported uncertainty and can be booked', async () => {
  const town = towns.find(town => town.id === 'cabanatuan');
  for (const [index, accuracy] of [2500, null].entries()) {
    const pickupLocation = { latitude: town.lat, longitude: town.lng, accuracy, capturedAt: new Date().toISOString() };
    const request = input({ pickupLocation });
    const result = await api('/rides', index === 0 ? 'passenger' : 'other', 'POST', request);
    assert.equal(result.status, 201, JSON.stringify(result.body));
    assert.deepEqual(result.body.ride.pickupLocation, pickupLocation);
    assert.equal(result.body.ride.geoTrackingEnabled, false);
  }
});

test('GPS pickup rejects invalid, stale, distant and mismatched fare-area locations', async () => {
  const town = towns.find(town => town.id === 'cabanatuan');
  const valid = { latitude: town.lat, longitude: town.lng, accuracy: 8, capturedAt: new Date().toISOString() };
  const otherTown = towns.find(town => town.id === 'palayan');
  for (const pickupLocation of [
    { ...valid, latitude: 100 }, { ...valid, accuracy: -1 }, { ...valid, accuracy: '100' },
    { ...valid, capturedAt: new Date(Date.now() - 16 * 60000).toISOString() },
    { ...valid, capturedAt: new Date(Date.now() + 60000).toISOString() },
    { ...valid, latitude: 0, longitude: 0 },
    { ...valid, latitude: otherTown.lat, longitude: otherTown.lng },
  ]) assert.equal((await api('/rides', 'passenger', 'POST', input({ pickupLocation }))).status, 400);
  assert.equal((await getDB().collection('drivers').findOne({ _id: driverId })).reservedSeats, 0);
});

test('GPS fare area uses the nearest known town and refuses distant or invalid positions', () => {
  const town = towns.find(town => town.id === 'munoz');
  assert.equal(findPickupArea({ latitude: town.lat, longitude: town.lng }, towns).id, town.id);
  assert.equal(findPickupArea({ latitude: 0, longitude: 0 }, towns), null);
  assert.equal(findPickupArea({ latitude: NaN, longitude: 180 }, towns), null);
});

test('map endpoints require authentication and validate inputs before provider requests', async () => {
  assert.equal((await api('/maps/route?coordinates=120,15;121,16', 'anonymous')).status, 401);
  assert.equal((await api('/maps/route?coordinates=999,15;121,16')).status, 400);
  assert.equal((await api('/maps/search?q=x')).status, 400);
  assert.equal((await api('/maps/reverse?lat=95&lon=120')).status, 400);
  assert.equal((await api('/maps/reverse?lat=&lon=120')).status, 400);
});

test('GPS pickup near a neighboring catalog town can match the selected route fare area', async () => {
  const neighboringTown = towns.find(town => town.id === 'sta_rosa');
  const position = { latitude: neighboringTown.lat, longitude: neighboringTown.lng, accuracy: 20, capturedAt: new Date().toISOString() };
  const route = routes.find(route => route.id === routeId);
  assert.equal(findPickupArea(position, towns).id, 'sta_rosa');
  assert.equal(findRoutePickupArea(position, towns, route).id, 'cabanatuan');
  const result = await api('/rides', 'passenger', 'POST', input({ pickupLocation: position }));
  assert.equal(result.status, 201, JSON.stringify(result.body));
  assert.deepEqual(result.body.ride.pickupLocation, position);
  assert.equal(findRoutePickupArea({ latitude: 14.5995, longitude: 120.9842 }, towns, route), null);
});

test("legacy booking history retains places and loads email-based driver references", async () => {
  const db = getDB();
  const bookingId = new ObjectId();
  await db.collection('rides').insertOne({
    _id: bookingId, passengerEmail: 'passenger@example.test', driverId: 'driver@example.test',
    driverName: 'Test Driver', pickup: 'Old pickup', dropoff: 'Old drop-off', fare: 40,
    vehicleType: 'jeepney', status: 'completed', createdAt: '2026-07-01T00:00:00.000Z',
  });
  const history = await api('/rides');
  assert.equal(history.status, 200);
  assert.equal(history.body.rides[0].fromName, 'Old pickup');
  assert.equal(history.body.rides[0].toName, 'Old drop-off');
  assert.equal(history.body.rides[0].seats, 1);
  assert.equal(history.body.rides[0].unitFare, 40);
  const details = await api(`/rides/${bookingId}`);
  assert.equal(details.status, 200);
  assert.equal(details.body.ride.vehicle, 'TEST123');
  assert.equal(details.body.ride.driverPhone, '09123456789');
  assert.equal((await api(`/rides/${bookingId}/rating`, 'passenger', 'POST', { rating: 5 })).status, 200);
  assert.equal((await db.collection('drivers').findOne({ _id: driverId })).ratingTotal, 5);
});

test("all catalog routes have ordered stops and exact intermediate quotes", () => {
  for (const route of routes) {
    assert.equal(route.stops[0].townId, route.originId);
    assert.equal(route.stops.at(-1).townId, route.destinationId);
    for (let i = 1; i < route.stops.length; i++)
      assert.ok(route.stops[i].minutes > route.stops[i - 1].minutes);
    const from = route.stops[1],
      to = route.stops.at(-1);
    if (from !== to)
      assert.equal(
        tripQuote(route.id, from.townId, to.townId, 2).minutes,
        to.minutes - from.minutes,
      );
  }
  assert.throws(
    () => tripQuote(routeId, "palayan", "cabanatuan"),
    /later stop/,
  );
  assert.throws(() => tripQuote(routeId, "cabanatuan", "palayan", 0), /seats/);
  assert.equal(canTransition("passenger", "ongoing", "completed"), false);
});
test("booking lifecycle, boarding verification, cash, ratings, history and earnings", async () => {
  const ride = await booking({ seats: 2, fare: 1 });
  assert.equal(ride.status, "pending");
  assert.equal(ride.paymentStatus, "unpaid");
  assert.equal(ride.fare, tripQuote(routeId, "cabanatuan", "palayan", 2).fare);
  assert.equal((await api("/drivers")).body.drivers[0].seats, 1);
  assert.equal((await transition(ride, "completed", "passenger")).status, 409);
  assert.equal((await transition(ride, "accepted")).status, 200);
  assert.equal(
    (await transition(ride, "ongoing", "driver", ride.boardingCode)).status,
    409,
  );
  assert.equal((await transition(ride, "arrived")).status, 200);
  assert.equal(
    (await transition(ride, "ongoing", "driver", "BAD")).status,
    400,
  );
  assert.equal(
    (await transition(ride, "ongoing", "driver", ride.boardingCode)).status,
    200,
  );
  assert.equal((await transition(ride, "cancelled", "passenger")).status, 409);
  assert.equal(
    (await transition(ride, "completed")).body.ride.paymentStatus,
    "paid",
  );
  assert.equal((await api("/drivers")).body.drivers[0].seats, 3);
  assert.equal((await api("/rides/active")).body.ride, null);
  assert.equal((await api("/rides")).body.rides.length, 1);
  assert.equal(
    (await api("/drivers/earnings", "driver")).body.total,
    ride.fare,
  );
  assert.equal(
    (await api(`/rides/${ride.id}/rating`, "passenger", "POST", { rating: 5 }))
      .status,
    200,
  );
  assert.equal(
    (await api(`/rides/${ride.id}/rating`, "passenger", "POST", { rating: 1 }))
      .status,
    409,
  );
  assert.equal((await api("/drivers")).body.drivers[0].rating, "5.0");
});
test("retry uses the same booking and reserves seats only once", async () => {
  const payload = input({ seats: 2 });
  const one = await api("/rides", "passenger", "POST", payload);
  const two = await api("/rides", "passenger", "POST", payload);
  assert.equal(one.body.ride.id, two.body.ride.id);
  assert.equal(
    (await getDB().collection("drivers").findOne({ _id: driverId }))
      .reservedSeats,
    2,
  );
  assert.equal((await api("/rides", "passenger", "POST", input())).status, 409);
});
test("concurrent seat requests cannot overbook a vehicle", async () => {
  const results = await Promise.all(
    ["passenger", "other", "third"].map((role) =>
      api("/rides", role, "POST", input({ seats: 2 })),
    ),
  );
  assert.equal(results.filter((r) => r.status === 201).length, 1);
  assert.equal(results.filter((r) => r.status === 409).length, 2);
  assert.equal(
    (await getDB().collection("drivers").findOne({ _id: driverId }))
      .reservedSeats,
    2,
  );
});
test("concurrent requests by one passenger create one active booking", async () => {
  const results = await Promise.all([
    api("/rides", "passenger", "POST", input()),
    api("/rides", "passenger", "POST", input()),
  ]);
  assert.equal(results.filter((r) => r.status === 201).length, 1);
  assert.equal(await getDB().collection("rides").countDocuments({}), 1);
});
test("cancellation and retry release seats and notify the driver exactly once", async () => {
  const ride = await booking({ seats: 3 });
  assert.equal((await transition(ride, "cancelled", "passenger")).status, 200);
  assert.equal((await transition(ride, "cancelled", "passenger")).status, 200);
  assert.equal(
    (await getDB().collection("drivers").findOne({ _id: driverId }))
      .reservedSeats,
    0,
  );
  assert.equal(
    (await api("/notifications", "driver")).body.notifications.length,
    2,
  );
  assert.equal((await api("/drivers/earnings", "driver")).body.total, 0);
});
test("ownership, role restrictions, hidden driver boarding codes and expired sessions", async () => {
  const ride = await booking();
  assert.equal((await api("/rides", "anonymous")).status, 401);
  assert.equal((await api("/rides", "driver", "POST", input())).status, 403);
  assert.equal((await api(`/rides/${ride.id}`, "other")).status, 404);
  assert.equal((await transition(ride, "cancelled", "other")).status, 404);
  assert.equal(
    (await api("/rides", "driver")).body.rides[0].boardingCode,
    undefined,
  );
  assert.equal(
    (await api(`/rides/${ride.id}`, "driver")).body.ride.boardingCode,
    undefined,
  );
  assert.equal((await api("/admin/drivers")).status, 403);
  await getDB()
    .collection("sessions")
    .updateMany({}, { $set: { expiresAt: new Date(0) } });
  assert.equal((await api("/rides")).status, 401);
});
test("offline, expired and unapproved drivers cannot receive bookings", async () => {
  for (const update of [
    { isAvailable: false },
    { isAvailable: true, onlineUntil: new Date(0) },
    { onlineUntil: new Date(Date.now() + 90000), verified: false },
  ]) {
    await getDB()
      .collection("drivers")
      .updateOne({ _id: driverId }, { $set: update });
    assert.equal(
      (await api("/rides", "passenger", "POST", input())).status,
      409,
    );
  }
});
test("driver GPS and heartbeat are validated and available to passenger tracking", async () => {
  const ride = await booking();
  assert.equal(
    (
      await api("/drivers/location", "driver", "POST", {
        latitude: 100,
        longitude: 121,
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await api("/drivers/location", "passenger", "POST", {
        latitude: 15.5,
        longitude: 121,
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await api("/drivers/location", "driver", "POST", {
        latitude: 15.5,
        longitude: 121,
      })
    ).status,
    200,
  );
  assert.equal(
    (await api(`/rides/${ride.id}`)).body.ride.driverLocation.latitude,
    15.5,
  );
  assert.equal((await api("/drivers/heartbeat", "driver", "POST")).status, 200);
});
test("active reservations prevent route changes and approval revocation", async () => {
  await booking();
  assert.equal(
    (
      await api("/drivers/availability", "driver", "PUT", {
        isAvailable: true,
        routeId: "jeep-cabanatuan-gapan",
        capacity: 3,
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await api(`/admin/drivers/${driverId}`, "admin", "PATCH", {
        approvalStatus: "rejected",
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await api("/drivers/availability", "driver", "PUT", {
        isAvailable: false,
        routeId,
        capacity: 3,
      })
    ).status,
    200,
  );
});
test("online drivers can switch route direction without going offline when bookings are clear", async () => {
  for (const nextRoute of ['jeep-cabanatuan-san-jose', 'jeep-san-jose-cabanatuan']) {
    const result = await api('/drivers/availability', 'driver', 'PUT', {
      isAvailable: true, routeId: nextRoute, capacity: 3,
    });
    assert.equal(result.status, 200, JSON.stringify(result.body));
    assert.equal(result.body.driver.routeId, nextRoute);
    assert.equal(result.body.driver.isAvailable, true);
    const profile = (await api('/drivers/me', 'driver')).body.driver;
    assert.equal(profile.routeId, nextRoute);
    assert.equal(profile.availableSeats, 3);
    const fleet = (await api('/drivers')).body.drivers;
    assert.equal(fleet.find(driver => driver.id === driverId.toString()).routeId, nextRoute);
  }
});

test("bus booking is coming soon while existing bus trips can still complete", async () => {
  const busRoute = 'bus-cabanatuan-manila';
  await getDB().collection('drivers').updateOne({ _id: driverId }, { $set: { vehicleType: 'bus', routeId: busRoute, capacity: 45 } });
  const blocked = await api('/rides', 'passenger', 'POST', input({ routeId: busRoute, fromId: 'gapan', toId: 'manila', seats: 4 }));
  assert.equal(blocked.status, 409); assert.match(blocked.body.error, /coming soon/i);
  const online = await api('/drivers/availability', 'driver', 'PUT', { isAvailable: true, routeId: busRoute, capacity: 45 });
  assert.equal(online.status, 409); assert.match(online.body.error, /coming soon/i);
  assert.equal((await api('/drivers/journeys?fromId=gapan&toId=manila&type=bus')).body.journeys.length, 0);
  assert.equal(await getDB().collection('rides').countDocuments({}), 0);
  assert.equal((await getDB().collection('drivers').findOne({ _id: driverId })).reservedSeats, 0);
  const ride = { _id: new ObjectId(), passengerEmail: 'passenger@example.test', driverEmail: 'driver@example.test', driverId: driverId.toString(), driverName: 'Test Driver', routeId: busRoute, fromId: 'gapan', toId: 'manila', fromName: 'Gapan City', toName: 'Manila', type: 'bus', seats: 4, fare: 400, status: 'ongoing', occupancyStatus: 'onboard', paymentStatus: 'unpaid', createdAt: new Date().toISOString() };
  await getDB().collection('rides').insertOne(ride);
  await getDB().collection('drivers').updateOne({ _id: driverId }, { $set: { reservedSeats: 4 } });
  const finished = await api('/rides/' + ride._id + '/status', 'driver', 'PATCH', { status: 'completed' });
  assert.equal(finished.status, 200); assert.equal(finished.body.ride.paymentStatus, 'paid');
  assert.equal((await api('/rides')).body.rides[0].type, 'bus');
  assert.equal((await getDB().collection('drivers').findOne({ _id: driverId })).reservedSeats, 0);
});

test('fleet exposes online jeepney GPS and hides coming-soon buses and offline locations', async () => {
  assert.equal((await api('/drivers', 'anonymous')).status, 401);
  for (const [vehicleType, selectedRoute, type] of [
    ['jeepney', routeId, 'jeep'], ['bus', 'bus-cabanatuan-manila', 'bus'],
  ]) {
    await getDB().collection('drivers').updateOne({ _id: driverId }, { $set: {
      vehicleType, routeId: selectedRoute, isAvailable: true, onlineUntil: new Date(Date.now() + 90000),
    }, $unset: { location: '' } });
    if (vehicleType === 'bus') { assert.equal((await api('/drivers')).body.drivers.length, 0); continue; }
    assert.equal((await api('/drivers')).body.drivers[0].location, null);
    const published = await api('/drivers/location', 'driver', 'POST', { latitude: 15.487, longitude: 120.974, accuracy: 4 });
    assert.equal(published.status, 200);
    const driver = (await api('/drivers')).body.drivers[0];
    assert.equal(driver.type, type);
    assert.equal(driver.location.latitude, 15.487);
    assert.equal(driver.location.longitude, 120.974);
    assert.equal(driver.location.accuracy, 4);
    assert.ok(Number.isFinite(Date.parse(driver.location.updatedAt)));
    assert.equal(driver.email, undefined);
    await getDB().collection('drivers').updateOne({ _id: driverId }, { $set: { isAvailable: false } });
    assert.equal((await api('/drivers')).body.drivers.length, 0);
    await getDB().collection('drivers').updateOne({ _id: driverId }, { $set: { isAvailable: true, onlineUntil: new Date(0) } });
    assert.equal((await api('/drivers')).body.drivers.length, 0);
  }
});
test("daily rewards are server controlled and atomic under duplicate claims", async () => {
  assert.equal(
    (await api("/tokens/add", "passenger", "POST", { amount: 999 })).status,
    403,
  );
  const results = await Promise.all([
    api("/tokens/claim-daily", "passenger", "POST", { day: 0 }),
    api("/tokens/claim-daily", "passenger", "POST", { day: 0 }),
  ]);
  assert.equal(results.filter((r) => r.status === 200).length, 1);
  assert.equal((await api("/tokens/balance")).body.tokens, 0.1);
  assert.equal((await api("/tokens/history")).body.history.length, 1);
  assert.equal((await api("/tokens/daily-claims")).body.claimedToday, true);
});
test("seven day streak cycles and broken streaks restart from Day 1", async () => {
  const yesterday = new Date(Date.now() - 86400000).toLocaleDateString(
    "en-CA",
    { timeZone: "Asia/Manila" },
  );
  await getDB().collection("streaks").insertOne({
    email: "passenger@example.test",
    currentDay: 6,
    lastClaimDate: yesterday,
  });
  assert.equal((await api("/tokens/daily-claims")).body.nextDay, 0);
  assert.equal(
    (await api("/tokens/claim-daily", "passenger", "POST", { day: 0 })).status,
    200,
  );
  await getDB()
    .collection("streaks")
    .updateOne(
      { email: "passenger@example.test" },
      { $set: { currentDay: 3, lastClaimDate: "2020-01-01" } },
    );
  assert.equal((await api("/tokens/daily-claims")).body.nextDay, 0);
});
test("reward tasks require real completed rides and can only be claimed once", async () => {
  assert.equal(
    (await api("/tokens/complete-task", "passenger", "POST", { task: "rides" }))
      .status,
    400,
  );
  await getDB()
    .collection("rides")
    .insertMany(
      Array.from({ length: 10 }, (_, i) => ({
        passengerEmail: "passenger@example.test",
        status: "completed",
        fare: 10,
        rating: 5,
        createdAt: new Date().toISOString(),
      })),
    );
  assert.equal((await api("/tokens/completed-tasks")).body.counts.rides, 10);
  assert.equal(
    (await api("/tokens/complete-task", "passenger", "POST", { task: "rides" }))
      .status,
    200,
  );
  assert.equal(
    (await api("/tokens/complete-task", "passenger", "POST", { task: "rides" }))
      .status,
    409,
  );
  assert.equal((await api("/tokens/balance")).body.tokens, 1);
});
test("notification preference email is separate from account identity", async () => {
  assert.equal(
    (
      await api("/notifications/settings", "passenger", "PUT", {
        email: "other@example.test",
        emailEnabled: false,
        push: false,
        sms: true,
        promo: false,
      })
    ).status,
    200,
  );
  assert.deepEqual((await api("/notifications/settings")).body, {
    email: false,
    push: false,
    sms: true,
    promo: false,
  });
  assert.equal(
    (
      await getDB()
        .collection("notification_settings")
        .findOne({ email: "passenger@example.test" })
    ).emailEnabled,
    false,
  );
  assert.equal(
    await getDB()
      .collection("notification_settings")
      .countDocuments({ email: "other@example.test" }),
    0,
  );
});
test("login creates an unguessable session, profile updates preserve identity, logout revokes it", async () => {
  const res = await api("/auth/login", "anonymous", "POST", {
    identifier: "PASSENGER@example.test",
    password: "TestPassword123",
  });
  assert.equal(res.status, 200);
  assert.match(res.body.token, /^[a-f0-9]{64}$/);
  tokens.passenger = res.body.token;
  assert.equal(
    (
      await api("/users/profile", "passenger", "PUT", {
        fullName: "Updated",
        phone: "09111111111",
        email: "other@example.test",
      })
    ).status,
    200,
  );
  assert.equal((await api("/auth/me")).body.user.fullName, "Updated");
  assert.equal(
    (await api("/auth/me")).body.user.email,
    "passenger@example.test",
  );
  assert.equal((await api("/auth/logout", "passenger", "POST")).status, 200);
  assert.equal((await api("/auth/me")).status, 401);
});
test("chat is private to participants and closes after cancellation", async () => {
  const ride = await booking();
  assert.equal(
    (
      await api(`/rides/${ride.id}/messages`, "passenger", "POST", {
        text: "At the terminal",
      })
    ).status,
    201,
  );
  const message = (await api(`/rides/${ride.id}/messages`, "driver")).body
    .messages[0];
  assert.equal(message.text, "At the terminal");
  assert.equal(message.mine, false);
  assert.equal((await api(`/rides/${ride.id}/messages`, "other")).status, 404);
  await transition(ride, "cancelled", "passenger");
  assert.equal(
    (
      await api(`/rides/${ride.id}/messages`, "driver", "POST", {
        text: "Hello",
      })
    ).status,
    409,
  );
});
test("unanswered requests expire and release their seats", async () => {
  const ride = await booking({ seats: 3 });
  await getDB()
    .collection("rides")
    .updateOne(
      { _id: new ObjectId(ride.id) },
      { $set: { expiresAt: new Date(0) } },
    );
  assert.equal((await api("/rides/active")).body.ride, null);
  assert.equal(
    (await getDB().collection("drivers").findOne({ _id: driverId }))
      .reservedSeats,
    0,
  );
  assert.equal(
    (await api(`/rides/${ride.id}`)).body.ride.cancelledBy,
    "system",
  );
});
test("OTP objects cannot bypass email or password verification", async () => {
  assert.equal(
    (
      await api("/auth/verify-email", "anonymous", "POST", {
        email: "passenger@example.test",
        otp: { $ne: "" },
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await api("/auth/reset-password", "anonymous", "POST", {
        email: "passenger@example.test",
        otp: { $ne: "" },
        newPassword: "NewPassword123",
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await api("/auth/signup", "anonymous", "POST", {
        fullName: "Admin",
        email: "new@example.test",
        phone: "09123456789",
        password: "TestPassword123",
        role: "admin",
      })
    ).status,
    400,
  );
});
test("only admins can approve drivers and approval refreshes their session profile", async () => {
  await getDB()
    .collection("drivers")
    .updateOne(
      { _id: driverId },
      {
        $set: {
          verified: false,
          approvalStatus: "pending",
          isAvailable: false,
        },
      },
    );
  assert.equal((await api("/auth/me", "driver")).body.user.verified, false);
  assert.equal(
    (
      await api(`/admin/drivers/${driverId}`, "driver", "PATCH", {
        approvalStatus: "approved",
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await api(`/admin/drivers/${driverId}`, "admin", "PATCH", {
        approvalStatus: "approved",
      })
    ).status,
    200,
  );
  assert.equal((await api("/auth/me", "driver")).body.user.verified, true);
});
test("registration confirmation creates a complete driver profile atomically and retains its application", async () => {
  const email = "new-driver@example.test";
  const now = new Date();
  await getDB()
    .collection("pending_users")
    .insertOne({
      email,
      data: {
        fullName: "New Driver",
        phone: "09999999999",
        password: await bcrypt.hash("TestPassword123", 4),
        role: "driver",
        licenseNo: "N01TEST",
        plateNo: "NEW123",
        vehicleType: "jeepney",
        application: { route: "Cabanatuan - Manila", seatingCapacity: "45" },
        documents: {},
      },
      createdAt: now,
    });
  await getDB()
    .collection("otps")
    .insertOne({
      email,
      otp: "123456",
      purpose: "registration",
      expiresAt: new Date(Date.now() + 300000),
    });
  assert.equal(
    (
      await api("/auth/verify-email", "anonymous", "POST", {
        email,
        otp: "123456",
      })
    ).status,
    200,
  );
  const driver = await getDB().collection("drivers").findOne({ email });
  assert.equal(driver.approvalStatus, "pending");
  assert.equal(driver.application.seatingCapacity, "45");
  assert.equal(
    (await getDB().collection("auth").findOne({ email })).role,
    "driver",
  );
  assert.ok(await getDB().collection("users").findOne({ email }));
  assert.equal(
    await getDB().collection("pending_users").countDocuments({ email }),
    0,
  );
  const res = await api("/auth/login", "anonymous", "POST", {
    identifier: email,
    password: "TestPassword123",
  });
  assert.equal(res.status, 200);
  assert.equal(res.body.user.verified, false);
});
test('driver signup sends a usable OTP, uploads documents concurrently, verifies via either URL and then logs in', async () => {
  const smtp = await startTestSmtp();
  Object.assign(process.env, smtp.environment);
  let inFlight = 0, maxInFlight = 0;
  const upload = mock.method(cloudinary.uploader, 'upload', async (_image, options) => {
    assert.equal(options.type, 'authenticated');
    inFlight++; maxInFlight = Math.max(maxInFlight, inFlight);
    await new Promise(resolve => setTimeout(resolve, 30));
    inFlight--;
    return { public_id: 'test/document', format: 'png' };
  });
  try {
    const email = 'otp-driver@example.test';
    const documents = Object.fromEntries(['licenseFront', 'licenseBack', 'vehicleReg', 'selfie'].map(key => [key, { base64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aN1cAAAAASUVORK5CYII=', mimeType: 'image/png' }]));
    assert.equal((await api('/auth/signup', 'anonymous', 'POST', {
      fullName: 'OTP Driver', email: email.toUpperCase(), phone: '09999999999', password: 'TestPassword123', role: 'driver',
      licenseNo: 'N01TEST', plateNo: 'OTP123', vehicleType: 'jeepney', documents,
    })).status, 200);
    const db = getDB(), original = await db.collection('otps').findOne({ email });
    assert.match(smtp.messages[0], new RegExp(original.otp));
    assert.equal((await api('/auth/verify-email', 'anonymous', 'POST', { email, otp: '000000' })).status, 400);
    assert.equal(await db.collection('auth').countDocuments({ email }), 0);
    assert.equal((await api('/otp/send', 'anonymous', 'POST', { email })).status, 200);
    const valid = await db.collection('otps').findOne({ email });
    assert.match(smtp.messages[1], new RegExp(valid.otp));
    if (valid.otp !== original.otp) assert.equal((await api('/auth/verify-email', 'anonymous', 'POST', { email, otp: original.otp })).status, 400);
    assert.equal((await api('/otp/verify', 'anonymous', 'POST', { email, otp: valid.otp })).status, 200);
    assert.equal(upload.mock.callCount(), 4);
    assert.equal(maxInFlight, 4);
    const driver = await db.collection('drivers').findOne({ email });
    assert.equal(Object.keys(driver.documents).length, 4);
    assert.equal(driver.approvalStatus, 'pending');
    assert.equal(await db.collection('otps').countDocuments({ email }), 0);
    const retry = await api('/auth/verify-email', 'anonymous', 'POST', { email, otp: valid.otp });
    assert.equal(retry.status, 409);
    assert.equal(retry.body.code, 'ACCOUNT_ALREADY_VERIFIED');
    assert.equal((await api('/auth/login', 'anonymous', 'POST', { identifier: email, password: 'IncorrectPassword' })).status, 401);
    const login = await api('/auth/login', 'anonymous', 'POST', { identifier: email, password: 'TestPassword123' });
    assert.equal(login.status, 200);
    assert.equal(login.body.user.role, 'driver');
    assert.equal(login.body.user.approvalStatus, 'pending');
    assert.equal(login.body.token.length, 64);
  } finally { upload.mock.restore(); await smtp.close(); }
});

test('a document upload failure preserves the correct OTP and pending registration for retry', async () => {
  const db = getDB(), email = 'upload-retry@example.test';
  await db.collection('pending_users').insertOne({ email, data: {
    email, fullName: 'Retry Driver', phone: '09999999999', password: await bcrypt.hash('TestPassword123', 4), role: 'driver',
    documents: { selfie: { base64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aN1cAAAAASUVORK5CYII=', mimeType: 'image/png' } },
  } });
  await db.collection('otps').insertOne({ email, otp: '123456', purpose: 'registration', expiresAt: new Date(Date.now() + 300000) });
  const upload = mock.method(cloudinary.uploader, 'upload', async () => { throw new Error('Storage temporarily unavailable'); });
  try {
    assert.equal((await api('/auth/verify-email', 'anonymous', 'POST', { email, otp: '123456' })).status, 500);
    assert.equal(await db.collection('auth').countDocuments({ email }), 0);
    assert.equal(await db.collection('users').countDocuments({ email }), 0);
    assert.equal(await db.collection('pending_users').countDocuments({ email }), 1);
    assert.equal(await db.collection('otps').countDocuments({ email, otp: '123456' }), 1);
    upload.mock.mockImplementation(async () => ({ public_id: 'test/retry', format: 'png' }));
    assert.equal((await api('/auth/verify-email', 'anonymous', 'POST', { email, otp: '123456' })).status, 200);
  } finally { upload.mock.restore(); }
});

test("password reset accepts only reset-purpose OTPs and revokes prior sessions", async () => {
  const email = "passenger@example.test";
  const otp = {
    email,
    otp: "123456",
    purpose: "registration",
    expiresAt: new Date(Date.now() + 300000),
  };
  await getDB().collection("otps").insertOne(otp);
  assert.equal(
    (
      await api("/auth/reset-password", "anonymous", "POST", {
        email,
        otp: "123456",
        newPassword: "NewPassword123",
      })
    ).status,
    400,
  );
  await getDB()
    .collection("otps")
    .updateOne({ email }, { $set: { purpose: "reset" } });
  assert.equal(
    (
      await api("/auth/reset-password", "anonymous", "POST", {
        email,
        otp: "123456",
        newPassword: "NewPassword123",
      })
    ).status,
    200,
  );
  assert.equal((await api("/auth/me")).status, 401);
  assert.equal(
    (
      await api("/auth/login", "anonymous", "POST", {
        identifier: email,
        password: "NewPassword123",
      })
    ).status,
    200,
  );
});
test("booking notification preferences are applied to new status notifications", async () => {
  await getDB()
    .collection("notification_settings")
    .insertOne({ email: "passenger@example.test", push: false });
  const ride = await booking();
  await transition(ride, "accepted");
  assert.equal((await api("/notifications")).body.notifications.length, 0);
  assert.equal(
    (await api("/notifications", "driver")).body.notifications.length,
    1,
  );
});
test("active bookings remain visible even after a long driver trip history", async () => {
  const ride = await booking();
  await getDB()
    .collection("rides")
    .insertMany(
      Array.from({ length: 110 }, () => ({
        driverEmail: "driver@example.test",
        status: "completed",
        createdAt: new Date(Date.now() + 10000).toISOString(),
      })),
    );
  const listed = (await api("/rides", "driver")).body.rides;
  assert.equal(listed[0].id, ride.id);
  assert.equal(listed.length, 101);
});
function gps(extra = {}) {
  return {
    latitude: 15.5,
    longitude: 121,
    accuracy: 1,
    capturedAt: new Date().toISOString(),
    ...extra,
  };
}

test('journey discovery checks direction, seat count, online state and role', async () => {
  const path = '/drivers/journeys?fromId=cabanatuan&toId=palayan&seats=2';
  const result = await api(path);
  assert.equal(result.status, 200);
  const match = result.body.journeys.find(j => j.routeId === routeId);
  assert.equal(match.drivers[0].id, driverId.toString());
  assert.equal(match.fare, tripQuote(routeId, 'cabanatuan', 'palayan', 2).fare);
  assert.equal((await api(path, 'driver')).status, 403);
  assert.equal((await api(path, 'anonymous')).status, 401);
  assert.equal((await api(path + '0')).status, 400);
  assert.equal((await api('/drivers/journeys?fromId=cabanatuan&toId=cabanatuan')).status, 400);
  const reverse = await api('/drivers/journeys?fromId=palayan&toId=cabanatuan');
  assert.ok(reverse.body.journeys.every(j => !j.drivers.some(d => d.id === driverId.toString())));
  await booking({ seats: 2 });
  assert.equal((await api(path)).body.journeys.find(j => j.routeId === routeId).drivers.length, 0);
  await getDB().collection('drivers').updateOne({ _id: driverId }, { $set: { onlineUntil: new Date(0) } });
  assert.equal((await api('/drivers/journeys?fromId=cabanatuan&toId=palayan')).body.journeys.find(j => j.routeId === routeId).drivers.length, 0);
});

test('fleet discovery releases expired capacity once across simultaneous requests', async () => {
  const ride = await booking({ seats: 3 });
  await getDB().collection('rides').updateOne({ _id: new ObjectId(ride.id) }, { $set: { expiresAt: new Date(0) } });
  const responses = await Promise.all([api('/drivers'), api('/drivers'), api('/rides/active')]);
  assert.ok(responses.every(r => r.status === 200));
  assert.equal((await api('/drivers')).body.drivers[0].seats, 3);
  assert.equal((await getDB().collection('drivers').findOne({ _id: driverId })).reservedSeats, 0);
  assert.equal(await getDB().collection('notifications').countDocuments({ email: 'passenger@example.test' }), 1);
});

test('concurrent expiry requests share one scan and a failed scan does not block future sweeps', async () => {
  const db = getDB(), originalCollection = db.collection.bind(db);
  let scans = 0, fail = false;
  const interception = mock.method(db, 'collection', (name, ...args) => {
    const collection = originalCollection(name, ...args);
    if (name === 'rides') {
      const find = collection.find.bind(collection);
      collection.find = (query, ...options) => {
        if (query?.status === 'pending' && query.expiresAt?.$lte) {
          scans++;
          if (fail) return { limit: () => ({ toArray: async () => { throw new Error('temporary database failure'); } }) };
        }
        return find(query, ...options);
      };
    }
    return collection;
  });
  try {
    await Promise.all(Array.from({ length: 30 }, () => expireReservations()));
    assert.equal(scans, 1);
    fail = true; await assert.rejects(expireReservations(), /temporary database failure/);
    fail = false; await expireReservations(); assert.equal(scans, 3);
  } finally { interception.mock.restore(); }
});

test('idempotent retries reject changed booking payloads without modifying capacity', async () => {
  const request = input();
  const first = await api('/rides', 'passenger', 'POST', request);
  const retry = await api('/rides', 'passenger', 'POST', request);
  assert.equal(retry.body.ride.id, first.body.ride.id);
  assert.equal((await api('/rides', 'passenger', 'POST', { ...request, seats: 2 })).status, 409);
  assert.equal((await api('/drivers')).body.drivers[0].seats, 2);
});

test('cancelled bookings cannot track a drivers current location', async () => {
  const ride = await booking();
  await getDB().collection('drivers').updateOne({ _id: driverId }, { $set: { location: gps() } });
  assert.ok((await api(`/rides/${ride.id}`)).body.ride.driverLocation);
  await transition(ride, 'cancelled', 'passenger');
  assert.equal((await api(`/rides/${ride.id}`)).body.ride.driverLocation, null);
});

test('driver application reviews create transactional audit records', async () => {
  assert.equal((await api(`/admin/drivers/${driverId}`, 'admin', 'PATCH', { approvalStatus: 'rejected' })).status, 200);
  const audit = await getDB().collection('audit_logs').findOne({ targetId: driverId.toString() });
  assert.equal(audit.action, 'driver.approval');
  assert.equal(audit.before, 'approved');
  assert.equal(audit.after, 'rejected');
  assert.ok(audit.actorId);
});

test('operator overview is admin-only and counts paid collections rather than estimates', async () => {
  const ride = await booking({ seats: 2 });
  assert.equal((await api('/admin/operations')).status, 403);
  assert.equal((await api('/admin/operations', 'driver')).status, 403);
  const pending = (await api('/admin/operations', 'admin')).body;
  assert.equal(pending.activeBookings, 1);
  assert.equal(pending.recordedCollectionsToday, 0);
  assert.equal(pending.recent[0].passengerEmail, undefined);
  assert.equal(pending.recent[0].boardingCode, undefined);
  await transition(ride, 'accepted');
  await transition(ride, 'arrived');
  await transition(ride, 'ongoing', 'driver', ride.boardingCode);
  await transition(ride, 'completed');
  const completed = (await api('/admin/operations', 'admin')).body;
  assert.equal(completed.completedToday, 1);
  assert.equal(completed.activeBookings, 0);
  assert.equal(completed.recordedCollectionsToday, ride.fare);
});
async function geoPair(ride, meters = 0) {
  assert.equal(
    (await api("/drivers/location", "driver", "POST", gps())).status,
    200,
  );
  const response = await api(
    `/rides/${ride.id}/location`,
    "passenger",
    "POST",
    gps({ latitude: 15.5 + meters / 111195 }),
  );
  assert.equal(response.status, 200, JSON.stringify(response.body));
  return response;
}
test("GPS boards the booked seats and alighting releases them without marking cash paid or releasing twice", async (t) => {
  const ride = await booking({ seats: 2 });
  await transition(ride, "accepted");
  await api(`/rides/${ride.id}/geolocation`, "passenger", "PUT", {
    enabled: true,
  });
  t.mock.timers.enable({ apis: ["Date"], now: Date.now() });
  await geoPair(ride);
  t.mock.timers.tick(5000);
  await geoPair(ride);
  t.mock.timers.tick(5000);
  await geoPair(ride);
  const boarded = (await api(`/rides/${ride.id}`)).body.ride;
  assert.equal(boarded.status, "ongoing");
  assert.equal(boarded.boardingSource, "geolocation");
  let driver = (await api("/drivers/me", "driver")).body.driver;
  assert.equal(driver.occupiedSeats, 2);
  assert.equal(driver.reservedSeats, 2);
  assert.equal(driver.availableSeats, 1);
  t.mock.timers.tick(5000);
  await geoPair(ride, 20);
  t.mock.timers.tick(5000);
  await geoPair(ride, 20);
  t.mock.timers.tick(5000);
  assert.equal((await geoPair(ride, 20)).body.trackingClosed, true);
  const alighted = (await api(`/rides/${ride.id}`)).body.ride;
  assert.equal(alighted.occupancyStatus, "alighted");
  assert.equal(alighted.status, "ongoing");
  assert.equal(alighted.paymentStatus, "unpaid");
  assert.equal(alighted.geoTrackingEnabled, false);
  assert.equal(alighted.passengerLocation, null);
  driver = (await api("/drivers/me", "driver")).body.driver;
  assert.equal(driver.occupiedSeats, 0);
  assert.equal(driver.reservedSeats, 0);
  assert.equal(driver.availableSeats, 3);
  assert.equal((await api("/drivers/earnings", "driver")).body.total, 0);
  assert.equal((await api('/drivers/availability', 'driver', 'PUT', {
    isAvailable: true, routeId: 'jeep-san-jose-cabanatuan', capacity: 3,
  })).status, 409, 'Unpaid ongoing trips still prevent a direction change after seats are released');
  const newRide = await booking({ seats: 3 }, "other");
  assert.equal(
    (await api(`/rides/${ride.id}/location`, "passenger", "POST", gps())).body
      .trackingClosed,
    true,
  );
  await transition(ride, "completed");
  await transition(ride, "completed");
  assert.equal(
    (await api("/drivers/me", "driver")).body.driver.reservedSeats,
    3,
  );
  assert.equal(
    (await api("/drivers/earnings", "driver")).body.total,
    ride.fare,
  );
  await transition(newRide, "cancelled", "other");
  assert.equal(
    (await api("/drivers/me", "driver")).body.driver.reservedSeats,
    0,
  );
});
test("passenger GPS needs consent and ownership, and cannot board an unaccepted booking", async (t) => {
  const ride = await booking();
  assert.equal(
    (await api(`/rides/${ride.id}/location`, "passenger", "POST", gps()))
      .status,
    409,
  );
  assert.equal(
    (
      await api(`/rides/${ride.id}/geolocation`, "other", "PUT", {
        enabled: true,
      })
    ).status,
    404,
  );
  assert.equal(
    (await api(`/rides/${ride.id}/location`, "driver", "POST", gps())).status,
    403,
  );
  assert.equal(
    (
      await api(`/rides/${ride.id}/geolocation`, "passenger", "PUT", {
        enabled: true,
      })
    ).status,
    200,
  );
  t.mock.timers.enable({ apis: ["Date"], now: Date.now() });
  for (let i = 0; i < 3; i++) {
    await geoPair(ride);
    t.mock.timers.tick(5000);
  }
  assert.equal((await api(`/rides/${ride.id}`)).body.ride.status, "pending");
  assert.equal(
    (await api("/drivers/me", "driver")).body.driver.occupiedSeats,
    0,
  );
  await api(`/rides/${ride.id}/geolocation`, "passenger", "PUT", {
    enabled: false,
  });
  assert.equal(
    (await api(`/rides/${ride.id}`)).body.ride.passengerLocation,
    null,
  );
});
test("inaccurate GPS and stale fixes keep reservations intact and the boarding code works as fallback", async (t) => {
  const ride = await booking();
  await transition(ride, "accepted");
  await api(`/rides/${ride.id}/geolocation`, "passenger", "PUT", {
    enabled: true,
  });
  t.mock.timers.enable({ apis: ["Date"], now: Date.now() });
  for (let i = 0; i < 3; i++) {
    await api("/drivers/location", "driver", "POST", gps());
    await api(
      `/rides/${ride.id}/location`,
      "passenger",
      "POST",
      gps({ accuracy: 50 }),
    );
    t.mock.timers.tick(5000);
  }
  assert.equal(
    (await api(`/rides/${ride.id}`)).body.ride.geoDetection.state,
    "poor_accuracy",
  );
  assert.equal(
    (
      await api(
        `/rides/${ride.id}/location`,
        "passenger",
        "POST",
        gps({ capturedAt: new Date(Date.now() - 60000).toISOString() }),
      )
    ).status,
    400,
  );
  await transition(ride, "arrived");
  await transition(ride, "ongoing", "driver", ride.boardingCode);
  assert.equal(
    (await api("/drivers/me", "driver")).body.driver.occupiedSeats,
    1,
  );
  await transition(ride, "completed");
  assert.equal(
    (await api("/drivers/me", "driver")).body.driver.occupiedSeats,
    0,
  );
});
test("simultaneous driver and passenger GPS updates apply boarding and alighting once", async (t) => {
  const ride = await booking({ seats: 2 });
  await transition(ride, "accepted");
  await api(`/rides/${ride.id}/geolocation`, "passenger", "PUT", {
    enabled: true,
  });
  t.mock.timers.enable({ apis: ["Date"], now: Date.now() });
  await geoPair(ride);
  t.mock.timers.tick(5000);
  await geoPair(ride);
  t.mock.timers.tick(5000);
  await Promise.all([
    api("/drivers/location", "driver", "POST", gps()),
    api(`/rides/${ride.id}/location`, "passenger", "POST", gps()),
    api(`/rides/${ride.id}/location`, "passenger", "POST", gps()),
  ]);
  assert.equal(
    (await api("/drivers/me", "driver")).body.driver.occupiedSeats,
    2,
  );
  t.mock.timers.tick(5000);
  await geoPair(ride, 30);
  t.mock.timers.tick(5000);
  await geoPair(ride, 30);
  t.mock.timers.tick(5000);
  const far = gps({ latitude: 15.5 + 30 / 111195 });
  await Promise.all([
    api("/drivers/location", "driver", "POST", gps()),
    api(`/rides/${ride.id}/location`, "passenger", "POST", far),
    api(`/rides/${ride.id}/location`, "passenger", "POST", far),
  ]);
  const driver = (await api("/drivers/me", "driver")).body.driver;
  assert.equal(driver.reservedSeats, 0);
  assert.equal(driver.occupiedSeats, 0);
  assert.equal(
    await getDB().collection("notifications").countDocuments({
      email: "passenger@example.test",
      title: "Seat occupancy update",
    }),
    2,
  );
});
