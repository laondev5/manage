# Device and compatibility test record

This record separates what has actually been executed from what still needs a
physical device. Do not treat an entry as passed until it has a date, device, OS,
and observed result.

## Platform targets

| Item | Value |
| --- | --- |
| Expo SDK | 58 |
| React Native | 0.88 |
| New architecture | enabled (`newArchEnabled: true`) |
| iOS bundle id | `com.manage.attendance` |
| Android package | `com.manage.attendance` |
| Orientation | portrait only |
| Scheme | `manage` |
| Background modes | iOS `location`, `fetch`; Android foreground service + background location |
| Notifications | `expo-notifications`, accent `#2457D6` |

## Automated evidence (executed)

| Check | Result | Date |
| --- | --- | --- |
| `pnpm typecheck` (all apps/packages) | pass | 2026-11-17 |
| `pnpm lint` (workspace) | pass | 2026-11-17 |
| `pnpm test` (unit; API 11 tests) | pass | 2026-11-17 |
| `pnpm test:integration` (25 tests, including reports/reviews/acceptance/inspector/departure alert and cron GET) | pass | 2026-11-17 |
| `npx expo export --platform android` | bundle completed (2,111 modules) | 2026-11-17 |
| `pnpm build` (API, worker, web) | pass | 2026-11-17 |
| Expo web preview (staff account): report create/edit/delete, site acceptance, site review create/delete, icons-only tab bar with labelled screen-reader targets | observed | 2026-11-17 |

These prove the app compiles and bundles. They do **not** prove runtime
permissions, background execution, geolocation accuracy, or notification
delivery on a device.

## Manual device matrix (not yet run)

Mark each row when executed.

| # | Scenario | Android | iOS | Notes |
| --- | --- | --- | --- | --- |
| 1 | Invitation link opens the app and account creation succeeds | ☐ | ☐ | Token from seed; verify role is STAFF |
| 2 | Staff sign-in without MFA works | ☐ | ☐ | |
| 3 | Owner sign-in is challenged for TOTP and enrolment completes | ☐ | ☐ | Owner surfaces must stay locked before enrolment |
| 4 | Clock-in inside the radius → accepted | ☐ | ☐ | Check server time vs device time display |
| 5 | Clock-in outside the radius → accepted-with-review or review state | ☐ | ☐ | Never silently "absent" |
| 6 | Clock-in with location denied → `NEEDS_REVIEW`, no crash | ☐ | ☐ | Deny at OS prompt |
| 7 | Airplane mode clock-in → pending record survives app restart | ☐ | ☐ | Force-quit and reopen, then reconnect |
| 8 | Offline queue flushes once and shows server result | ☐ | ☐ | No duplicate shift in History |
| 9 | Background location produces observations while clocked in | ☐ | ☐ | Requires a development build, not always Expo Go |
| 10 | Leaving the geofence opens a candidate, then confirms after grace | ☐ | ☐ | Owner account sees alert after worker tick |
| 11 | Returning inside cancels the pending alert | ☐ | ☐ | |
| 12 | Clock-out stops location collection | ☐ | ☐ | OS indicator should disappear |
| 13 | Clock-out without a location fix succeeds | ☐ | ☐ | |
| 14 | Sign-out clears the encrypted queue; second account cannot see it | ☐ | ☐ | Check History and pending banner |
| 15 | Push notification opens the alert detail | ☐ | ☐ | Expo push token registered |
| 16 | Large OS font (200%) and screen reader labels on Today/History | ☐ | ☐ | |
| 17 | Low battery / battery saver does not crash tracking | ☐ | ☐ | Document throttling behavior |
| 18 | Staff opens site details and accepts the assignment, then clocks in | ☐ | ☐ | Clock-in stays blocked and explains why until accepted |
| 19 | Staff writes a general and a site report, then edits and deletes them | ☐ | ☐ | Only the author can edit; owners can read team reports |
| 20 | Staff submits a review with the star control, then edits or deletes it | ☐ | ☐ | One active review per site; screen reader announces the rating |
| 21 | Owner sets a team lead and chooses an inspector (self or staff) | ☐ | ☐ | Inspector reports carry the Inspection badge |
| 22 | Keyless OpenStreetMap view renders the site centre and boundary | ☐ | ☐ | Needs network; confirm the WebView shows the fence circle |

## Known platform constraints

- **Background location requires a development build.** Expo Go does not
  reliably support background location tasks with the configured permissions;
  use `npx expo run:android` / `npx expo run:ios` or an EAS development build.
- iOS will pause background updates aggressively (Low Power Mode, force-quit).
  The product never promises continuous tracking; presence becomes `UNKNOWN`, and
  alerts are review prompts.
- Android 13+ requires `POST_NOTIFICATIONS` at runtime; denying it must not block
  clock-in.
- Simulators/emulators do not provide realistic GPS movement, background
  execution, or push delivery. Rows above must be run on hardware.
- Site maps use a keyless OpenStreetMap/Leaflet page rendered in a WebView. They
  need network access and are visual context only; presence decisions are made
  from server-side geofence math, never from the map.
- Confirm dialogs (`Alert.alert`) are native-only; react-native-web ignores them.
  Destructive paths such as deleting a report or review and signing out were
  verified against the API in the preview and still need a hardware pass.

## How to record a run

For each scenario record: date, device model, OS version, build type (Expo Go or
development build), account role, observed result, screenshots/logs for failures,
and the server-side state (shift id or alert id). File failures as issues with the
request id from the error banner.

Until this matrix is filled in, the mobile runtime behavior is **untested on
hardware**; only compile-time and bundle-time checks have passed.
