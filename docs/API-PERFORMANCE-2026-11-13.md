# API bottleneck and loop review

Reviewed on 13 November 2026. Scope: API queries, reservation expiration, polling, foreground presence, GPS uploads, map request queues and retry/timer cleanup. Tests use disposable MongoDB data and browser API fixtures. The local API was restarted after validation and successfully initialized the new indexes.

## Findings and fixes

1. **Repeated reservation-expiration work.** Fleet discovery, every ride request and the background worker independently scanned and processed the same expired bookings. Transactions already prevented duplicate seat release, but concurrent requests still repeated scans and transaction work. These callers now share one in-flight sweep per API process. A failed sweep releases that slot so the next request can retry. A regression test sends 30 simultaneous sweep calls and observes one scan, then verifies recovery after a database error. The 100-record batch limit and transaction-based seat accounting remain intact.
2. **Missing indexes on frequently polled queries.** Added driver email and online-fleet indexes; passenger history and driver occupancy indexes; notification/settings/history lookup indexes; and pending-registration/OTP lookup indexes. The existing booking uniqueness constraints remain. Query plans below show the effect on a seeded fixture.
3. **Manual refresh skipped during an active poll.** Previously a refresh returned immediately if another request was busy. After a booking or route mutation, the screen could retain that older snapshot. Refresh now waits for the in-flight request and coalesces simultaneous refresh clicks into one subsequent load.
4. **Stale responses after blur/refocus.** An older request could resolve after focus returned and update the current screen. The polling controller now invalidates older focus generations and waits before starting another request.
5. **Background polling and rapid failure retries.** Screen polling and global driver/passenger presence now pause when the app/tab is inactive and resume on foreground. Automatic screen retries back off after failures, capped at 30 seconds for the normal 3–15 second polling intervals. A successful request resets the delay. Polls schedule after completion, and invalid delays cannot create a zero-delay loop.
6. **Overlapping slow GPS uploads.** Driver uploads previously relied on a four-second timestamp limit without an in-flight guard. A slower request could overlap the next upload. Driver and passenger uploads now keep one in-flight upload across navigation/background changes. Disposed presence effects stop issuing follow-up profile/ride calls.

No literal unbounded synchronous loop or unbounded immediate retry was found in the inspected request, map and presence paths. Existing polling intervals are intentional. This review and finite tests cannot prove that every possible runtime path is free of loops.

## Measured query plans

The isolated fixture contains 5,001 drivers, 10,001 rides (including active rides across drivers) and 10,000 notifications. The baseline removes only the newly added indexes from that disposable database; existing indexes remain. No indexes were removed from application data.

| Query | Documents examined before | After | Results returned |
| --- | ---: | ---: | ---: |
| Driver profile | 5,001 | 1 | 1 |
| Online fleet | 5,001 | 1 | 1 |
| Driver occupancy | 1,000 | 1 | 1 |
| Passenger history | 9,001 | 11 | 10 |
| Notifications | 10,000 | 10 | 10 |

For a bounded local burst of 120 authenticated requests at concurrency 10 across `/drivers`, `/rides/active`, `/notifications` and `/rides`: **0 errors**, median **46 ms**, p95 **107 ms**, maximum **127 ms**, total **630 ms**. Event-loop delay p95 was **28 ms**. This is a local fixture result, not a production throughput guarantee. It does not include real mobile latency, Atlas latency, uploads or third-party map providers.

## Validation

- Full server suite: **93 passed**. Final standalone polling suite, including the added delay-boundary check: **4 passed**. Regression coverage includes transaction/seat consistency, expiration concurrency, manual refresh, blur/refocus, failure backoff and timer cleanup.
- Client TypeScript and ESLint passed.
- Live Metro browser test passed route changes, persisted direction, configured map visibility, failed-switch recovery and booking locks without page errors.
- Foreground/GPS browser test simulates **6.5-second upload responses**, observes **one maximum concurrent upload**, observes **zero API requests during 7.5 seconds hidden**, and confirms foreground recovery without page errors.
- Android Hermes export passed for the new polling module and foreground lifecycle code.
- The updated local API started on port 3010 with MongoDB connected; indexes are installed by startup.

Reproduce with `npm --prefix server run test:performance` and `npm --prefix server run test:polling:browser`. The latter expects Metro on port 8081 and intercepts every API request. MongoDB tests require the configured system binary or a downloadable test binary. Local output is under `artifacts/api-performance.json`, `api-performance-log.txt`, `polling-browser.json`, `polling-browser-log.txt`, `bottleneck-server-tests.txt`, `bottleneck-route-switch-browser.txt` and `bottleneck-android-build.txt`.

## Remaining scale limits

- Expiry sweeps are shared per process; multiple API workers still rely on transactions for cross-process correctness. A large expiry backlog can still add latency to requests waiting for that bounded sweep. A dedicated job queue is a next step if production measurements show a backlog.
- Some endpoints still return entire driver lists or completed-trip earnings arrays. Large fleets/history need pagination and server-side summary queries coordinated with the UI. The fixture does not benchmark those large responses.
- Several active screens/presence services legitimately poll different resources. An event stream or shared subscription layer can reduce aggregate request volume at larger user counts. Background pausing does not provide background GPS service: drivers need the app open for foreground tracking/heartbeat.
- OSRM/Photon already have cached/deduplicated requests, an eight-second upstream timeout and a bounded queue. Their external rate/availability limits remain independent of database improvements.
- Client fetches have timeouts, but client cancellation does not automatically cancel every MongoDB operation. Production query budgets, pool limits and transaction deadlines should be selected using deployment metrics. No high-concurrency test was run against the user's live database.
