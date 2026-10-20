# SakayNE

Expo SDK 54 passenger and driver app with an Express/MongoDB API. Bookings, driver availability, seat reservations, chat, history, cash receipts, ratings, earnings, notifications and rewards are stored on the server. Leaflet runs inside a WebView on mobile and an iframe on web.

## Run locally

Install dependencies with `npm run install:all`. Configure `server/.env` using `server/.env.example`, and `client/.env` using `client/.env.example`. Start the API with `npm run server:dev` and the app in another terminal with `npm run client`.

The API defaults to port **3010**. On a physical phone, use your computer's LAN IP in `EXPO_PUBLIC_API_URL` and put both devices on the same network. Android emulators can use `http://10.0.2.2:3010/api`. Web uses the browser hostname when no override is set. Restart Expo after environment changes. Keep database, SMTP and Cloudinary credentials exclusively in `server/.env`; remove old `EXPO_PUBLIC_MONGODB_URI` credentials from the client environment.

If every API request returns **503**, open `/api/health` on the configured API host/port. A response with `database: "unavailable"` means that API process has no initialized database. After repairing a startup error, restart the existing API process; editing files does not reload a server launched with `npm start`. For the web app, open the Expo URL directly in a browser. A preview frame that enforces `script-src 'none'` cannot run the Expo bundle; the current Expo page does not add that policy. The Leaflet iframe runs scripts in an isolated origin and exchanges GPS messages with its parent using `postMessage`.

Run one API process on the configured port. If startup reports that the port is already in use, stop the existing API with Ctrl+C in its terminal before starting again. A failed listen closes the new process's database connection and exits; the existing server is left running.

MongoDB must support transactions: use Atlas or a local replica set, MongoDB 6 or newer. Startup reconciles duplicate `users` profiles with the same nonempty email before creating unique indexes. It keeps the oldest profile ID and its nonempty values, fills missing fields from newer profiles, and updates booking passenger ID references. Every original profile is preserved in `user_profile_backups` with a migration name, batch ID and canonical ID; the backup and changes commit together in a transaction. Subsequent restarts do not repeat completed repairs. Credentials and reward balances are never automatically merged; duplicates in those collections require review. Initialization failures close the database connection and stop the API with an error instead of starting an unusable server. There is no silent local booking fallback.

## Driver approval and booking

Email OTP verification creates the account and then opens sign-in with the registration email filled in. Sign in with the password chosen during registration. Driver document uploads run concurrently; verification can wait up to 90 seconds instead of the standard 15-second API timeout. The OTP screen offers resend after 30 seconds and restarts its countdown after resending. Re-verifying an already verified account offers sign-in. Both `/api/auth/verify-email` and the legacy `/api/otp/verify` URL run the same account-creation transaction.

During startup, obsolete active bookings from the previous schema (email in `driverId`, no request ID, driver email or seat count, and more than 24 hours old) are closed as cancelled with an upgrade explanation. Their original documents are preserved transactionally in `ride_migration_backups`. Existing completed/cancelled history, current reservations, seat holds and financial records are unchanged. Conflicting active bookings from the current schema still require review rather than automatic cancellation.

1. Register a passenger and a bus/jeepney driver. Email verification requires working SMTP. Driver registration retains the application details and uploads documents to authenticated Cloudinary storage for review.
2. To provision the first administrator, set `ADMIN_EMAIL` and `ADMIN_PASSWORD` (at least 12 characters) in the server environment, then run `npm --prefix server run create-admin`. This script creates a new account and never promotes or overwrites an existing account. Remove the bootstrap password afterward.
3. Sign in as administrator and review the driver application. Approved drivers select their route direction and total vehicle capacity, then go online.
4. Passengers choose an online vehicle, pickup stop, a later drop-off stop and 1–10 seats. Confirming sends a pending request; the driver accepts, marks arrival, verifies the passenger's boarding code, and starts the ride.
5. The driver collects cash and completes the booking. Seats are released, history and earnings update, and the passenger can rate the driver once. Bookings may be cancelled before boarding; unanswered requests expire after five minutes when the API next processes booking traffic.

Reservations hold seats until the booking completes, cancels, or confirmed GPS alighting releases them. A passenger can have one active booking. Drivers may handle multiple passengers within their vehicle capacity. Route direction and capacity cannot change while reservations remain. Duplicate booking requests and concurrent seat reservations are protected by MongoDB transactions and unique indexes.

## Automatic boarding and alighting

Passengers can enable **Automatic seat detection** from their active booking. Both phones send their own coordinates, horizontal accuracy and capture time while the app is open. Sharing follows the booking across map, chat and settings screens and stops after disabling detection, alighting, cancellation, completion or signing out.

An accepted/arrived booking boards automatically when the phones stay within **8 meters** for three independent paired GPS readings across at least **10 seconds**. Pending requests and other passengers' coordinates cannot trigger boarding. Occupied seats increase by the number of seats in that booking; reserved seats already include that hold and are not charged twice.

An onboard booking alights automatically after three qualifying readings across at least ten seconds confirm separation of **15 meters or more**. The server subtracts both reported accuracy radii from the measured distance before applying the 15-meter threshold. For example, with 3-meter accuracy on each phone, a measured gap needs to be at least 21 meters. Each reading must be at most twenty seconds old, each accuracy radius at most five meters, and the two readings no more than ten seconds apart. Replayed, out-of-order or low-quality readings do not change occupancy. A failed reading resets the confirmation sequence.

Alighting reduces occupied seats and releases the reserved seats once, making them available to another booking. The vehicle's physical capacity stays fixed. GPS does **not** mark cash paid or add earnings; the driver still confirms cash collection and completion. A later completion cannot release the same seats twice. The manual boarding-code flow remains available when GPS is unavailable or imprecise.

Detection applies to all seats in a booking using that passenger's phone; it cannot independently detect members of a group or people without bookings. These are proximity estimates, not a physical passenger sensor. Validate the thresholds on real phones and vehicles, especially inside buses and in areas with weak GPS. Background/closed apps do not publish GPS with the current foreground-only implementation.

GPS updates are real foreground device locations. Drivers must keep the app open; this implementation does not run a native background service. The passenger sees the last update time and a stale-location message after a minute. Status refreshes every five seconds; chat every three seconds. Drivers renew availability every 25 seconds and stop appearing as online after 90 seconds without a heartbeat. Booking chat is restricted to the participants and closes when the booking ends.

Booking alerts appear in the app's Notifications inbox and respect the ride-notification preference. External push, SMS, and booking-email delivery are not connected; their unsupported switches are not offered in the settings screen. SMTP is used for account verification and password reset.

## Maps and transport catalog

`client/src/data/transit.json` is the catalog used by both app and API. Routes have ordered stops and separate direction definitions; only later stops are bookable. The included towns, route durations and fare formula are **planning estimates**, not a certified operator schedule or official fare matrix. Confirm the real routes and fares with the operators before public use. Payments currently support **cash**; no wallet or payment processor is connected.

Leaflet uses OpenStreetMap tiles with visible attribution, custom stop/driver markers, zoom controls, road routing and dark styling. The driver marker uses received GPS only. OSRM is used for road previews; if it fails, the app shows a dashed stop-to-stop preview. Tiles and routing require connectivity. `EXPO_PUBLIC_MAP_TILE_URL` and `EXPO_PUBLIC_ROUTING_URL` can point to an appropriate hosted or self-hosted service. Update attribution when changing providers. Public OSM/OSRM endpoints have no availability guarantee and should be replaced with a suitable service as traffic grows. See the [OSM tile policy](https://operations.osmfoundation.org/policies/tiles/).

## Verify

```powershell
npm test
npm run typecheck
npm run lint
npm run build:web
npm --prefix server run test:browser
npm --prefix server run test:auth:browser
```

API tests launch an isolated temporary MongoDB replica set and never use the application database. The first test run may download a local MongoDB binary. Browser checks use installed Edge on Windows, or Playwright Chromium elsewhere, and redirect all app API traffic to an isolated fixture server. Review screenshots are written to `artifacts/`.

The auth browser check requires a current web export (`npm run build:web`). It uses a local-only SMTP inbox and mocked Cloudinary uploads, including a 17-second upload to verify the extended OTP timeout, wrong-code rejection, repeated verification, driver login awaiting approval, and restarting an expired countdown after resend. It does not send real emails or upload test documents to an external account.

Android JavaScript/Hermes export can be checked with `npx expo export --platform android --output-dir ../artifacts/android-bundle --max-workers 1` from `client`. After adding Expo Location, rebuild the native app with `npm --prefix client run android`; a JavaScript export is not an APK. Test camera permissions, document upload and foreground GPS on a physical device. Email delivery and Cloudinary uploads require live credentials and are not exercised by the local integration tests.

Daily rewards and tasks are calculated and credited by the API. Completed rides and ratings determine task eligibility; tapping a task cannot fabricate progress. Direct token grants from a client are rejected. All private API routes require an expiring bearer session; account IDs and emails supplied by callers do not determine authorization. Old timestamp-based tokens require a new sign-in.

Compatible dependency security fixes were applied. The server audit reports zero advisories, and the client critical advisory was removed. The Expo SDK 54 client dependency tree still reports 44 advisories (27 high, 17 moderate), including Metro/build dependencies and some routing dependencies. Clearing the remaining audit requires a separately validated Expo/React Native migration; do not use `npm audit fix --force` against this SDK. NativeWind and react-native-css are pinned together to their tested versions because the newer NativeWind release candidate has an incompatible peer requirement.
