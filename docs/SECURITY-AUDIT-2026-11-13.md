# Sakay security and dependency audit

Date: 13 November 2026. Scope: the local client/server working tree, npm dependency trees, API authorization and validation, sessions, OTP/password flows, uploads, booking ownership, rewards, map messaging, and local configuration. This is a source review with isolated regression tests, not a penetration test of a deployed system or a guarantee that no vulnerabilities remain.

## Dependency results

Online npm advisory scans included production and development dependencies. The initial offline scan was discarded because it did not contain current advisories.

| Project | Before | After |
| --- | --- | --- |
| Server | 4 affected packages: 2 high, 2 moderate | 0 known npm advisories |
| Client | 22 affected dependency entries: 6 high, 15 moderate, 1 low | 0 known npm advisories |

Counts include dependency chains; they are not counts of unique exploitable vulnerabilities. The separate client production dependency scan also returned zero. Installed dependency trees report no missing, invalid or extraneous packages. Both lockfiles contain integrity hashes for every registry dependency and use HTTPS npm registry tarballs.

Server fixes include `body-parser` 1.20.9, `follow-redirects` 1.16.3, `nodemailer` 10.5.0 and `qs` 6.16.2. Express remains on its compatible 4.x release.

Client Expo remains on SDK 57, updated to 57.0.33 with matching location, router, image-picker, constants, linking and splash-screen patches. Compatible updates also fix the vulnerable forge, Zod, deepmerge and other transitive tooling packages. `expo install --check` passes.

Reviewed compatibility decisions:

- Pin `babel-plugin-module-resolver` to 5.0.0, avoiding its newer vulnerable glob dependency chain. Its older glob/inflight dependencies still carry upstream deprecation warnings; deprecation and a published vulnerability are different findings. Replace this workaround when the maintained resolver release supports patched glob.
- Override affected minimatch versions (7.x through 11.0.0) to 11.0.8. Older minimatch 3 consumers retain their expected API.
- Override ngrok's UUID to CommonJS-compatible 11.1.1. Its v4 interface is regression tested. No tunnel was opened during this audit.
- Override query-string's decoder to `decode-uri-component` 0.5.1. Query-string 7 expects CommonJS while the fixed decoder uses ESM; `client/scripts/patch-web-compat.cjs` explicitly unwraps the default export. The patch fails clearly if the upstream source changes, and is idempotent. URL encoding, repeated parameters and large malformed percent-encoded inputs are tested. Keep this bridge until Expo Router removes or updates query-string. A clean install must run the project's postinstall script.

No forced Expo, React Native, React or server framework major upgrades were applied. NativeWind remains a preview release. ESLint 9 and some transitive tools are deprecated; plan their migration with a compatible Expo/tooling update. Dependencies outside their current declared compatibility ranges are listed in `artifacts/security-*-outdated.json`; an outdated version is not automatically vulnerable.

## Application fixes made

| Severity | Finding | Resolution |
| --- | --- | --- |
| High, potential exposure | `client/.env` contained a credential-bearing `EXPO_PUBLIC_MONGODB_URI` | Removed the unused public database variables. Server credentials were not changed. Added `npm run security:env` and npm start/web/native/web-build hooks that reject secret-like public environment keys without printing their values. |
| High | A session retained its stored role after account deletion or role changes | Every authenticated request now verifies the current auth record and rejects sessions whose role no longer matches. |
| Medium | OTP guesses were constrained only by process/IP limits | Added an atomic five-attempt database budget per issued code and purpose, shared by both verification URLs. Expiry and transaction-based consumption remain enforced. |
| Medium | Controllers exposed database/provider exception messages | Auth, OTP, users and notifications now return generic unexpected-error responses. Deliberate validation errors remain readable. Malformed JSON bodies are not reflected. |
| Medium | Uploads trusted MIME declarations and arbitrary data URI prefixes | Validate base64, size and PNG/JPEG/WebP signatures before storage/provider upload; require matching data URI MIME; restrict Cloudinary to image resources and allowed formats. Registration documents are validated before saving the pending application. Provider decoding still supplies the final image validation. |
| Medium | New bcrypt passwords could silently exceed the 72-byte input boundary | Signup, reset and change-password reject new passwords exceeding 72 UTF-8 bytes. Registration also bounds identity fields and rejects complex mail-recipient syntax and object-valued driver identifiers. |
| Medium | Sensitive unverified applications had no retention limit | Pending registrations now receive a 24-hour TTL index at database initialization. Resubmitting registration is required after expiry. MongoDB TTL cleanup is asynchronous. |
| Medium / hardening | API responses were cacheable and lacked basic browser headers; CORS accepted every origin | Added no-store, nosniff, frame denial, referrer policy and an API-only restrictive CSP. Removed the Express banner. Production CORS permits exact configured origins; development also accepts localhost/private LAN origins. Origin-less native clients still require normal authentication. |
| Medium / hardening | Every endpoint accepted 10 MB JSON and compressed input | Regular requests are limited to 64 KB. Signup and avatar uploads retain 10 MB. Compressed JSON is rejected. Query strings use Express's simple parser. |
| Low / hardening | Rate-limit bucket memory could grow without a cap | Cap new IP buckets at 10,000 and return Retry-After with throttled responses. Environment file variants are now ignored by Git. |

The restrictive API CSP applies to the Express API server, not the Expo web page or map iframe. Do not copy `script-src/default-src 'none'` to the frontend host: it would block the app's JavaScript.

## Remaining actions and limits

1. **High priority: review and rotate the MongoDB credential that was placed in public client configuration.** Current app code has no reference to that variable, so its mere presence does not prove it was bundled. A scan found no current server secret values in tracked/unignored source or the inspected generated bundles. Previously published builds, Git history, EAS environment values and cloud access logs were not inspected. Removal cannot revoke a previously distributed credential. Keep MongoDB credentials exclusively on the server, restrict database network access and use a least-privilege database account. Follow the [Expo public environment-variable guidance](https://docs.expo.dev/guides/environment-variables/).
2. **High priority before production: configure HTTPS and production origins.** Set `NODE_ENV=production`, `CORS_ORIGINS=https://your-actual-frontend.example` and an HTTPS `EXPO_PUBLIC_API_URL`. The local setup uses HTTP for development. TLS termination, HSTS, frontend security headers, MongoDB access lists, backups and cloud permissions require deployment-level verification. CORS is a browser boundary, not authorization.
3. **Medium: token storage.** Native tokens still use AsyncStorage, and web tokens use its localStorage backend. Native storage should migrate to an OS-backed secure store; the web token remains accessible to any successful same-origin XSS. An HttpOnly cookie/session design requires coordinated web/native authentication and CSRF changes. Server sessions are random, SHA-256 hashed at rest and expire after seven days; reset revokes sessions and password change revokes the other sessions.
4. **Medium: legacy authentication and enumeration.** Login/change-password still support legacy plaintext password records, with successful login upgrading them to bcrypt. No live credential records were inspected. Inventory and retire the fallback through a controlled migration or reset. Forgot-password/signup responses disclose account existence; use uniform responses/timing if account enumeration is in the threat model. OTP values remain readable in the database for their five-minute lifetime; consider keyed hashing with a server secret and protected database backups.
5. **Medium: production abuse controls.** IP limits are in process memory and reset on restart. Multiple API workers need a shared limiter and account-based login controls. A reverse proxy needs a narrowly scoped trusted-proxy configuration; do not trust arbitrary forwarded IP headers. Add deployment-level request limits, upload quotas, alerting and retention policies for trip GPS, chat, audit logs and approved identity documents.
6. **Low / supply-chain and privacy:** MapLibre JS/CSS are loaded from a version-pinned CDN outside the npm lockfiles. Consider vendoring or subresource integrity. The map iframe is sandboxed without same-origin privileges and checks message sources, but third-party map/routing/geocoding services still participate in location features. Cloudinary authenticated document URLs should be treated as sensitive bearer links; review short-lived delivery and access logging. No third-party service security or external script malware audit was performed.

No real users were messaged, no production database records were modified by the tests, and no service credentials were rotated during this audit. Application startup will install the new pending-registration TTL index when this code is loaded.

## Validation and reproducibility

- Full server suite: **89 passed**, including ownership/role checks, reward/booking concurrency, OTP-purpose and attempt controls, password validation, upload validation, CORS and error redaction. Database tests use an isolated MongoDB replica set and test SMTP.
- Client TypeScript and ESLint: passed.
- Dependency compatibility tests: **2 passed** (`npm --prefix client run security:test`).
- Web static export and Android Hermes export: passed. This verifies bundling, not an installed-device end-to-end test or a signed APK.
- Fresh web browser tests: authentication/OTP/document registration and jeep/bus GPS map scenarios passed with fixtures/local services.
- Expo dependency alignment: passed. Full client dependency tree: no problems.
- Clean client installation dry run: passed; all lockfile integrity hashes are present.
- Secret scan: 197 tracked/unignored files inspected; the only credential-pattern match was an intentional dummy URI in a security regression test. Actual secret values were not printed. Full Git history and remote deployments remain outside scope.
- Fresh generated web/Android scan: 146 files inspected, no matches for current server database, SMTP password or Cloudinary secret values.

Re-run current advisories with `npm --prefix server audit --offline=false` and `npm --prefix client audit --offline=false`. Use `npm ci` and retain both lockfiles. After client install, run `npm --prefix client run security:test` and `npm --prefix client run security:env`. Restart development processes after applying dependency/environment changes so their cached environment/modules are refreshed.

Local evidence (ignored artifacts): `security-server-audit-before.json`, `security-client-audit-before.json`, both `security-*-audit-after.json`, `security-client-production-audit.json`, `security-*-installed-after.json`, `security-client-full-tree.json`, `security-server-tests.txt`, `security-web-build.txt`, `security-android-build.txt`, `security-auth-browser.txt`, `security-map-browser.txt`, `security-expo-compat.txt` and `security-secrets-scan.json` under `artifacts/`.

Advisory references: [body-parser](https://github.com/advisories/GHSA-27r3-jxmh-p828), [follow-redirects](https://github.com/advisories/GHSA-mrwp-f3q8-3g9p), [Nodemailer](https://github.com/advisories/GHSA-8c8m-p3m8-cjg8), [qs](https://github.com/advisories/GHSA-6pq8-jhm2-2vcw), [URL decoder](https://github.com/advisories/GHSA-qr28-fpjm-wq7f), [minimatch](https://github.com/advisories/GHSA-g3hv-75wg-m249), [UUID](https://github.com/advisories/GHSA-w5hq-g745-h8pq), [bcrypt password limits](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html).
