# Sakay

Expo passenger and driver app with an Express/MongoDB API. Bookings, driver availability, seat reservations, chat, history, cash receipts, ratings, earnings, notifications and rewards are stored on the server. MapLibre GL JS with OpenFreeMap runs inside a WebView on mobile and an isolated iframe on web. See [map setup and provider policies](MAPS.md). See [the development assessment](DEVELOPMENT.md) for implemented improvements, architecture, data changes and remaining phases.

## Run locally

Install dependencies with `npm --prefix server ci` and `npm --prefix client ci`. Configure `server/.env` using `server/.env.example`, and `client/.env` using `client/.env.example`. Start the API with `npm --prefix server run dev` and the app in another terminal with `npm --prefix client start`.

The client's postinstall script applies modern box shadows and style-based pointer events to `react-native-toast-message` 2.4, and corrects the disabled-control pointer-events property in React Native Web 0.21. The script is idempotent and checks the expected source before changing it. After updating dependencies, restart Metro so it does not reuse cached library code.

If Metro reports missing files that exist in `node_modules` or a SHA-1/file-watcher error after installing dependencies, stop the existing Expo process and run `npm --prefix client run start:clean`. Reload the browser after the new bundle finishes compiling. Do not run two Metro processes on port 8081.

The Mobile Simulator browser extension can inject a `script-src 'none'` response policy and a sandbox with both script and same-origin permissions. If those messages mention `simulator.js` or extension assets, disable Mobile Simulator for localhost and reload. Use the browser's built-in responsive/device toolbar to test screen sizes. The app's own map iframe intentionally omits `allow-same-origin`; do not weaken it or remove the API's security headers to suppress extension warnings.

The API defaults to port **3010**. On a physical phone, use your computer's LAN IP in `EXPO_PUBLIC_API_URL` and put both devices on the same network. Android emulators can use `http://10.0.2.2:3010/api`. Web uses the browser hostname when no override is set. Restart Expo after environment changes. Keep database, SMTP and Cloudinary credentials exclusively in `server/.env`; remove old `EXPO_PUBLIC_MONGODB_URI` credentials from the client environment.

If every API request returns **503**, open `/api/health` on the configured API host/port. A response with `database: "unavailable"` means that API process has no initialized database. After repairing a startup error, restart the existing API process; editing files does not reload a server launched with `npm start`. For the web app, open the Expo URL directly in a browser. A preview frame that enforces `script-src 'none'` cannot run the Expo bundle; the current Expo page does not add that policy. The MapLibre iframe runs scripts in an isolated origin and exchanges GPS messages with its parent using `postMessage`.

Run one API process on the configured port. If startup reports that the port is already in use, stop the existing API with Ctrl+C in its terminal before starting again. A failed listen closes the new process's database connection and exits; the existing server is left running.

MongoDB must support transactions: use Atlas or a local replica set, MongoDB 6 or newer. Startup reconciles duplicate `users` profiles with the same nonempty email before creating unique indexes. It keeps the oldest profile ID and its nonempty values, fills missing fields from newer profiles, and updates booking passenger ID references. Every original profile is preserved in `user_profile_backups` with a migration name, batch ID and canonical ID; the backup and changes commit together in a transaction. Subsequent restarts do not repeat completed repairs. Credentials and reward balances are never automatically merged; duplicates in those collections require review. Initialization failures close the database connection and stop the API with an error instead of starting an unusable server. There is no silent local booking fallback.

## Driver approval and booking

Email OTP verification creates the account and then opens sign-in with the registration email filled in. Sign in with the password chosen during registration. Driver document uploads run concurrently; verification can wait up to 90 seconds instead of the standard 15-second API timeout. The OTP screen offers resend after 30 seconds and restarts its countdown after resending. Re-verifying an already verified account offers sign-in. Both `/api/auth/verify-email` and the legacy `/api/otp/verify` URL run the same account-creation transaction.

During startup, obsolete active bookings from the previous schema (email in `driverId`, no request ID, driver email or seat count, and more than 24 hours old) are closed as cancelled with an upgrade explanation. Their original documents are preserved transactionally in `ride_migration_backups`. Existing completed/cancelled history, current reservations, seat holds and financial records are unchanged. Conflicting active bookings from the current schema still require review rather than automatic cancellation.

1. Register a passenger and a bus/jeepney driver. Email verification requires working SMTP. Driver registration retains the application details and uploads documents to authenticated Cloudinary storage for review.
2. To provision the first administrator, set `ADMIN_EMAIL` and `ADMIN_PASSWORD` (at least 12 characters) in the server environment, then run `npm --prefix server run create-admin`. This script creates a new account and never promotes or overwrites an existing account. Remove the bootstrap password afterward.
3. Sign in as administrator and review the driver application. Approved drivers select their route direction and total vehicle capacity, then go online.
4. Passengers choose an online vehicle, pickup stop, a later drop-off stop and 1–10 seats. Confirming sends a pending request; the driver accepts, marks arrival, verifies the passenger's boarding code, and starts the ride.
5. The driver collects cash and completes the booking. Seats are released, history and earnings update, and the passenger can rate the driver once. Bookings may be cancelled before boarding; unanswered requests expire after five minutes. A server worker checks every 15 seconds, and fleet/booking requests also release expired holds transactionally.

Reservations hold seats until the booking completes, cancels, or confirmed GPS alighting releases them. A passenger can have one active booking. Drivers may handle multiple passengers within their vehicle capacity. Route direction and capacity cannot change while reservations remain. Duplicate booking requests and concurrent seat reservations are protected by MongoDB transactions and unique indexes.

## Automatic boarding and alighting

Passengers can enable **Automatic seat detection** from their active booking. Both phones send their own coordinates, horizontal accuracy and capture time while the app is open. Sharing follows the booking across map, chat and settings screens and stops after disabling detection, alighting, cancellation, completion or signing out.

An accepted/arrived booking boards automatically when the phones stay within **8 meters** for three independent paired GPS readings across at least **10 seconds**. Pending requests and other passengers' coordinates cannot trigger boarding. Occupied seats increase by the number of seats in that booking; reserved seats already include that hold and are not charged twice.

An onboard booking alights automatically after three qualifying readings across at least ten seconds confirm separation of **15 meters or more**. The server subtracts both reported accuracy radii from the measured distance before applying the 15-meter threshold. For example, with 3-meter accuracy on each phone, a measured gap needs to be at least 21 meters. Each reading must be at most twenty seconds old, each accuracy radius at most five meters, and the two readings no more than ten seconds apart. Replayed, out-of-order or low-quality readings do not change occupancy. A failed reading resets the confirmation sequence.

Alighting reduces occupied seats and releases the reserved seats once, making them available to another booking. The vehicle's physical capacity stays fixed. GPS does **not** mark cash paid or add earnings; the driver still confirms cash collection and completion. A later completion cannot release the same seats twice. The manual boarding-code flow remains available when GPS is unavailable or imprecise.

Detection applies to all seats in a booking using that passenger's phone; it cannot independently detect members of a group or people without bookings. These are proximity estimates, not a physical passenger sensor. Validate the thresholds on real phones and vehicles, especially inside buses and in areas with weak GPS. Background/closed apps do not publish GPS with the current foreground-only implementation.

GPS updates are real foreground device locations. Drivers must keep the app open; this implementation does not run a native background service. The passenger sees the last update time and a stale-location message after a minute. Status refreshes every five seconds; chat every three seconds. Drivers renew availability every 25 seconds and stop appearing as online after 90 seconds without a heartbeat. Booking chat is restricted to the participants and closes when the booking ends.

Passengers can tap **View on map** on any online jeepney or bus card before booking, including full vehicles. The map shows the vehicle's last reported GPS position and update time, refreshes every five seconds, supports fullscreen, and labels missing or stale GPS. Going offline or failing a fleet refresh removes the vehicle marker; configured route details remain available.

The passenger's own foreground GPS appears as a blue **You** marker after location permission is granted. **Show both locations** fits the passenger and driver into view; **Center on driver** follows the vehicle. Denied permission offers a retry while leaving the driver map available. Viewing this map keeps the passenger's coordinates on their device and does not enable seat detection or send them to the driver. Jeepneys and buses use distinct upright icons; only the direction arrow rotates.

Booking alerts appear in the app's Notifications inbox and respect the ride-notification preference. External push, SMS, and booking-email delivery are not connected; their unsupported switches are not offered in the settings screen. SMTP is used for account verification and password reset.

## Maps and transport catalog

The driver Home is a full MapLibre/OpenFreeMap vector map with small online/route controls and an incoming-booking popup with Accept/Reject. Trip management lives in Trips. Live GPS uses smooth marker interpolation, heading and accuracy display; dragging pauses camera follow and recenter resumes it. Stale GPS does not drive the camera. Fullscreen maps are retained.

Route lines and drop-off markers are currently enabled only for Cabanatuan ↔ Guimba and Cabanatuan ↔ San Jose through the catalog's `mapDetailsEnabled` flag. Other routes show live GPS and any booking's live pickup pin without route lines or drop-off markers. Switching to an unconfigured route clears the previous geometry and does not request an OSRM preview.

OSRM supplies labeled road previews through the ordered waypoints on enabled routes; operator-verified geometry takes precedence. There is no invented straight-line route fallback. Photon supplies debounced place search and pickup address labels while local booking stops remain available offline from the search provider. The travel-time cards use public-transport planning estimates, not live traffic or a pickup ETA. Price display is disabled.

See [MAPS.md](MAPS.md) for provider configuration, attribution, public-service limits, self-hosted endpoint options, and verification. OpenFreeMap needs no key; public OSRM and Photon services have limits and no SLA. Run `node server/scripts/map-browser-smoke.js` for camera/GPS checks; it writes `artifacts/maplibre-driver-map.png`.

`client/src/data/transit.json` is shared by the app and API. Routes have ordered stops and separate directions; only later stops are bookable. Town centers identify approximate planning areas, not verified boarding points.

## Verify

```powershell
npm --prefix server test
npm --prefix client run typecheck
npm --prefix client run lint
npm --prefix client run build:web
npm --prefix server run test:browser
npm --prefix server run test:bus:browser
npm --prefix server run test:vehicle-map:browser
npm --prefix server run test:route-switch:browser
npm --prefix server run test:map-console:browser
npm --prefix server run test:auth:browser
```

API tests launch an isolated temporary MongoDB replica set and never use the application database. The first test run may download a local MongoDB binary. Browser checks use installed Edge on Windows, or Playwright Chromium elsewhere, and redirect all app API traffic to an isolated fixture server. Review screenshots are written to `artifacts/`.

If the MongoDB test download fails its checksum, use an installed `mongod` executable through `MONGOMS_SYSTEM_BINARY` and set `MONGOMS_VERSION` to its version. Tests still launch their own temporary replica set. Keep checksum verification enabled. The bus and jeepney browser runs cover manual and GPS boarding, chat, cash completion and ratings. The vehicle-map browser run also checks missing/stale GPS, position changes, fullscreen, connection recovery and offline marker removal.

`test:vehicle-map:browser -- --dev` checks the running Metro page at `http://localhost:8081` using the same isolated API fixtures. It checks script policy, iframe sandbox permissions, passenger GPS permission/retry, both markers in view, upright vehicle icons and console warnings. `test:map-console:browser` exercises missing landmark sprites, null ranks and null building heights across light, streets, bright, dark and 3D styles without suppressing console messages.

`test:route-switch:browser` checks the running Metro app at `http://localhost:8081` with isolated API fixtures. It switches the online driver in both directions, reloads the saved selection, checks the map endpoint, rejects a failed switch, blocks changes during active bookings, and checks that closing the route panel leaves no backdrop over the map. Online drivers can change direction when they have no active bookings; capacity changes in the driver UI still require going offline.

The auth browser check requires a current web export (`npm --prefix client run build:web`). It uses a local-only SMTP inbox and mocked Cloudinary uploads, including a 17-second upload to verify the extended OTP timeout, wrong-code rejection, repeated verification, driver login awaiting approval, and restarting an expired countdown after resend. It does not send real emails or upload test documents to an external account.

Android JavaScript/Hermes export can be checked with `npx expo export --platform android --output-dir ../artifacts/android-bundle --max-workers 1` from `client`. After adding Expo Location, rebuild the native app with `npm --prefix client run android`; a JavaScript export is not an APK. Test camera permissions, document upload and foreground GPS on a physical device. Email delivery and Cloudinary uploads require live credentials and are not exercised by the local integration tests.

Daily rewards and tasks are calculated and credited by the API. Completed rides and ratings determine task eligibility; tapping a task cannot fabricate progress. Direct token grants from a client are rejected. All private API routes require an expiring bearer session; account IDs and emails supplied by callers do not determine authorization. Old timestamp-based tokens require a new sign-in.

Earlier dependency audit counts applied to the former Expo SDK 54 tree. The working manifest now specifies Expo 57; those audit counts are not current validation. Run dependency audits against the installed lockfiles before release, and validate native builds separately. Do not apply force upgrades without checking Expo/React Native compatibility.
