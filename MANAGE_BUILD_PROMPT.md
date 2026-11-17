# Manage — AI agent build prompt

Copy everything below the divider into your coding agent. Attach IMPLEMENTATION_GUIDE.md and AGENTS.template.md when possible. This prompt is independently usable. These are implementation requirements, not claims that the app already exists.

---

You are the lead engineer implementing Manage, a corporate worksite attendance and remote oversight product. Build working software, not only screens, scaffolding, or a plan. Work in tested vertical slices, keep progress documented, and preserve existing unrelated files.

## 1. Outcome and scope

Deliver:
- An iOS and Android app using React Native + Expo for staff and site owners.
- A responsive Next.js admin web app for system administrators.
- One Node.js + Express API and a durable background worker.
- MongoDB persistence, Resend email, mobile push, and a persistent owner alert inbox.
- Local development instructions, environment examples, seed fixtures, automated checks, and deployment runbooks.

Brand name is exactly Manage. Do not use KhemSafe in UI, emails, package display names, or app metadata. Existing folders may retain their names.

Staff clock in at assigned sites and explicitly clock out when finished. Owners see attendance and receive alerts when an on-duty worker's device is detected outside the site's boundary. Location is imperfect evidence: a missing reading is not an absence, and leaving a boundary is not automatically clocking out.

MVP excludes payroll calculations, facial recognition, screenshots, continuous route playback, general chat, recruitment, advanced scheduling, paid-hour deductions, and automatic disciplinary decisions.

## 2. Required stack and boundaries

Use TypeScript strict mode throughout.
- Mobile: Expo, Expo Router, NativeWind, compatible Expo location/background-task, notifications, SecureStore, and SQLite packages.
- Web: Next.js App Router, shadcn/ui, Tailwind CSS.
- Forms: React Hook Form with Zod validation on both clients. Use native Controllers on mobile.
- Client state: Zustand for UI state only.
- Server data: TanStack Query for client-side request caching; server components may use a server-only API client.
- API: Node.js on a supported LTS release, Express, Zod, official MongoDB Node driver.
- Authentication: Better Auth hosted in Express, its supported MongoDB adapter and Expo integration, and its maintained MFA capabilities. Verify a compatible stable release before implementation.
- Database: MongoDB replica set in local development and deployment, to support multi-document transactions.
- Email: Resend from the server only.
- Async delivery: MongoDB transactional outbox plus a separate Node worker. Do not introduce Redis merely to make this MVP work.

Do not put business logic in Next.js route handlers as a competing backend. Express owns authorization, attendance, site assignments, corrections, and alerts. Next.js may render authenticated pages and forward allowlisted requests to Express. Clients never connect directly to MongoDB.

shadcn/ui is for the web. Build native mobile components with NativeWind and compatible native primitives; do not wrap the mobile app in a webview or import DOM components into React Native. Share tokens and schemas rather than attempting one component implementation for every platform.

Inspect package manifests and relevant repository instructions first. Select a mutually compatible stable dependency set, pin it in the lockfile, and document the compatibility matrix. NativeWind and web Tailwind may require different major versions: keep their build configurations separate. Do not install every package at "latest" without checking peer dependencies. Use Expo-compatible installation for native packages.

## 3. Repository layout

For a new repository, use a pnpm workspace:
~~~
apps/
  mobile/       # Expo; src/app contains route files only
  web/          # Next.js admin
  api/          # Express composition, HTTP routes, auth mounting
  worker/       # outbox delivery and reconciliation
packages/
  contracts/    # Zod DTOs, error codes, API types; no secrets or database code
  api-client/   # platform-neutral transport with injected auth mechanism
  tokens/       # colors, typography, spacing
  domain/       # server-only use cases and authorization policies
  database/     # server-only repositories, indexes, transactions
  config/       # shared lint/TypeScript configuration
docs/
  architecture/
  operations/
  security/
~~~
Respect an established layout instead of moving an existing application unnecessarily. If the workspace contains unrelated projects, create Manage in an isolated subdirectory. Do not overwrite a workspace-wide AGENTS.md without checking its scope.

## 4. Product roles and access

There are three business roles, assigned by trusted invitations or administrative actions:
- PLATFORM_ADMIN: operates the system through the web app.
- SITE_OWNER: manages only authorized sites and assigned staff in their organization.
- STAFF: accesses their own attendance and assigned site information.

Model organization memberships and site assignments explicitly. A global user may have multiple memberships, but active organization selection must be verified by the server. No public role selector can grant a role. Owners can invite staff to sites they manage, never grant platform-admin status or broaden their own access.

Platform administrators can manage organizations and access grants, but exact staff coordinates and attendance corrections require separately scoped, audited operational access. Do not use an unconditional "admin can do anything" bypass. Nobody may approve their own attendance correction.

Every lookup, mutation, aggregation, export, alert detail, and notification recipient selection must enforce organization/site/subject scope. Resource IDs, headers, form fields, and mobile cached roles are untrusted. Recheck permissions at execution and delivery time after invitations, assignments, or memberships change.

## 5. Visual direction and required screens

Use the provided Manage transparent logo if available. Use navy #101D35, cobalt #2457D6, canvas #F5F7FB, white surfaces, text #14213D, secondary text #526078. Use amber and red for warnings/errors; blue labeled checkmarks for success. No green, mint, or teal. Prefer readable opaque surfaces over decorative glass or gradients.

Mobile should feel like an iPhone app: large clear titles, grouped lists, bottom tabs, sheets, native navigation, scalable typography, at least 44-point touch targets, and prominent 56-point primary actions. Preserve Android navigation and accessibility expectations. Web uses an intentional desktop sidebar, accessible tables, filters, and responsive layouts.

Staff:
- Invitation acceptance, sign-in, verification/reset, and expired-invitation states.
- First-use stepper: Confirm details → Review assigned site → Check readiness. Save progress, provide Back, and request permissions contextually.
- Tabs: Today, History, Account.
- Today: assigned site, expected window, attendance status, separate presence status, last update, primary Clock in or Clock out.
- Clock-out confirmation and shift receipt.
- History and event detail; correction request with reason.
- Permission recovery, no assigned site, outside-boundary clock-in exception, offline pending, rejected sync, and unavailable-location states.

Owner:
- Tabs: Overview, Sites, Alerts, Team.
- First-site stepper: Site details → Set boundary → Invite staff → Review alerts.
- Site address, IANA timezone, map pin, radius with numeric alternative, basic expected hours, grace/accuracy settings, recipients, and notification preferences.
- Roster, activity, attendance reports, CSV export, staff invitation.
- Alert detail with detected time, received time, last location update, still-working status, explanation, contact action, and review action.
- Correction review with original and proposed values, reason, approve/reject, and audit history.
- Account/security settings accessible without introducing a crowded fifth tab.

Admin web:
- Separate admin sign-in and mandatory MFA.
- Overview, Organizations, Users & access, Sites, Audit log, System health.
- Organization lifecycle, scoped grants, invitations, suspension/revocation, notification failures, and controlled retry.
- Loading, empty, denied, stale, conflict, success, and error states.
- MFA enrollment/recovery and session management for privileged accounts.

## 6. Attendance rules

Maintain three independent dimensions:
- Attendance: NOT_STARTED, WORKING, ENDED.
- Presence: UNKNOWN, INSIDE, EXIT_PENDING, OUTSIDE.
- Sync/review: LOCAL_PENDING, ACCEPTED, NEEDS_REVIEW, REJECTED.

The server is authoritative for accepted records. Do not show a locally queued clock-in as server-confirmed. During an unconfirmed shift, show "Clock-in pending sync" and allow a linked provisional clock-out.

Enforce one active accepted shift per user globally with an atomic database constraint. Attendance events are append-only. Corrections create amendments and rebuild derived totals without erasing original evidence.

Use a client-generated event ID for replay-safe ingestion and a client shift ID for offline clock-in/out pairing. Retain capture time, server receipt time, device ID, site ID, accuracy, policy version, and review outcome. Never trust user IDs, organization IDs, or "inside site" flags sent by clients as authority.

Server validates identity, assignment, site policy, coordinates, timestamps, ordering, duplicates, and allowable transitions. Online verified clock-in requires acceptable site evidence; otherwise request a reviewable exception. Never prevent clock-out merely because GPS is denied or the worker is outside the site.

A stale shift must be flagged for review, not silently closed. Time since clock-in is not paid time. Use UTC storage and the site's named timezone for reporting, including overnight and daylight-saving cases.

## 7. Location and offline behavior

Location collection is limited to an active or locally pending shift. Explain permission use clearly. Stop collection immediately on local clock-out, logout, or observed access revocation, even if a network request fails. The server may remain temporarily unaware of an offline stop; display uncertainty instead of inventing certainty.

Use version-appropriate Expo geofencing/background capabilities in real development builds. Validate iOS and Android on physical devices. Do not promise instant delivery, monitoring after every force-quit, or proof against GPS spoofing.

Where the selected Expo SDK requires TaskManager task registration, register it at module scope in the app entry dependency graph, not inside a mounted screen. A periodic background scheduler is not a substitute for location/geofence events. Request foreground and background permission in the platform-required order with clear explanations and a manual-review fallback.

Server-side distance/accuracy validation must independently assess observations. Use configurable hysteresis, a grace interval, and fresh evidence to confirm a departure; stale or inaccurate readings become UNKNOWN. A scheduler reaching a deadline without new evidence must not manufacture an OUTSIDE result. On return, close the same incident; do not create alert storms.

One active departure incident per shift; one logical notification per incident/recipient/channel. A legitimate clock-out cancels pending future exit work. Delayed, earlier observations remain historical and must not trigger a misleading current-departure notification.

Persist the mobile queue in encrypted SQLite with a key in SecureStore. Verify encryption in the actual native build. Never put credentials or precise coordinates in persisted Zustand or ordinary AsyncStorage. Namespace data by account and organization. Preserve unsent records privately for the same account across session expiry; never expose or replay them under another account. Explicit local deletion requires a clear data-loss warning.

Sync at launch, foreground, network recovery, and supported background opportunities. Retry with bounded backoff and jitter; handle each batch item independently. Show pending/reviewed/rejected counts and useful recovery actions.

## 8. Persistence, APIs, and async jobs

Create schemas, indexes, and services for identities/auth-library collections, organizations, memberships, site assignments, sites and policy versions, shifts, attendance events, location observations, departure incidents, corrections, invitations, devices, alerts, notification outbox/delivery attempts, audit events, and idempotency records.

Indexes must enforce duplicate prevention and the one-active-shift rule. Deploy indexes through explicit migration scripts; verify them in CI against a real replica set. Use transactions for related attendance, audit, and outbox state changes. External network calls never occur inside retryable transactions.

Implement versioned REST endpoints under /api/v1 for current user/context, organizations, sites, assignments, invitations, shifts/events/sync, location observations, alerts, corrections, exports, devices, and operational administration. Auth-library endpoints stay under /api/auth. Include OpenAPI documentation, bounded cursor pagination, consistent errors, idempotency semantics, and resource-scope rules.

The worker atomically leases outbox items, retries transient failures with jitter, recovers expired leases, and exposes terminal failures for review. Record provider handoff separately from recipient acknowledgment. Resend handles transactional email; Expo/APNs/FCM handles push. Store durable in-app alerts before attempting either.

Verify Resend webhook signatures against the original raw body, enforce replay protection, and deduplicate provider event IDs. Use stable provider idempotency keys and application-level deduplication. If a provider call has an ambiguous outcome beyond its idempotency window, flag it for reconciliation instead of blindly resending.

## 9. Security requirements

Implement security before introducing sensitive attendance/location data:
- Use maintained authentication/session/MFA libraries; no invented crypto, custom password hashing, or pretend auth.
- Default to invitation-gated email/password accounts, email verification, and mandatory authenticator MFA for owners/admins. Use the auth library's supported secure password hashing; review parameters and do not downgrade it.
- Enrollment-only sessions cannot access protected data until required MFA is complete. Recovery must revoke relevant sessions and never become an easier bypass.
- Browser auth uses secure, HttpOnly, appropriately SameSite, host-only cookies. No bearer/session secrets in localStorage or Zustand.
- Mobile auth uses the supported Expo integration backed by SecureStore. Do not bolt an unrelated homemade JWT/refresh flow onto library sessions.
- Check current memberships, suspension, session validity, and MFA server-side on every protected request. Session revocation must take effect on the next request.
- Explicitly protect cookie-authenticated business mutations against CSRF, including Origin validation and a session-bound CSRF mechanism. CORS is not authorization or CSRF protection.
- Enforce object-level and field-level authorization. Reject mass-assignment fields and client-supplied database operators.
- Validate all request bodies, params, queries, file names, and webhook data with bounded schemas. Never pass arbitrary JSON to MongoDB queries, updates, or aggregation pipelines.
- Rate-limit authentication, invitations, exports, sync, and location ingest using a shared store; cap payload size, batch length, range, concurrency, and execution time.
- Apply TLS, security headers, a tested web CSP, safe error responses, dependency/secret checks, and least-privilege MongoDB access.
- Keep email keys, database credentials, auth secrets, encryption keys, and signing credentials server-side. Public-prefixed frontend variables are public.
- Exclude passwords, tokens, reset links, MFA secrets, raw coordinates, and full request bodies from logs.
- Audit role changes, site-policy changes, attendance amendments, alert reviews, exports, and sensitive-data access. Audit records are append-only at the application role level.
- Minimize collection and retention; implement configurable deletion jobs and explain backups. Do not claim regulatory compliance without review.

## 10. Execution sequence and acceptance

First inspect the repo, read supplied documents, and write a short implementation plan and dependency compatibility record. Then proceed without stopping after the plan.

Build in this order:
1. Workspace, configuration validation, MongoDB replica set, indexes, CI, design tokens.
2. Authentication, invitation gating, MFA, session handling, organization/site authorization.
3. Organization/site/team management and first-run steppers.
4. Complete staff clock-in → server persistence → owner roster → clock-out slice.
5. Encrypted offline queue, replay-safe sync, corrections, and conflict handling.
6. Background location, departure state machine, durable alerts, push and Resend.
7. Admin operations, reports/export, accessibility, and full error-state polish.
8. Security/integration tests, device tests, operational hardening, and handoff.

Required proof:
- Cross-organization and cross-site access is denied through reads, writes, lists, aggregates, exports, and jobs.
- Invalid, expired, revoked, or MFA-incomplete sessions cannot access protected operations.
- Concurrent/replayed clock-ins cannot create duplicate shifts.
- Offline clock-in/out survive app restart, sync once, and cannot cross accounts.
- Unknown location never becomes confirmed absence.
- Departure grace, boundary jitter, return, delayed upload, and clock-out races behave correctly.
- Webhook forgery/replay fails; worker crashes/retries do not create duplicate logical alerts.
- UI tests cover key staff/owner/admin journeys; real device results distinguish tested from untested behavior.
- Production build/typecheck/lint pass for all apps; security findings are triaged with no unaddressed critical/high findings in scope.

Deliver code, tests, a realistic development seed with two organizations, .env.example files without secrets, root scripts, OpenAPI, architecture and threat-model notes, index/setup scripts, device test record, deployment/backup/restore/rollback runbooks, and an honest completion report.

Missing real credentials must not stop local work: use explicitly labeled local email/push adapters, never fake provider success. Identify exactly what remains unverified. Do not deploy, send real staff invitations, or alter production data unless authorized. Do not call the result production-ready based only on a screenshot or a successful compile.

