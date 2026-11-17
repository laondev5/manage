# Manage — implementation and security guide

Prepared 16 November 2026. This is a proposed engineering specification, not a completed implementation or security certification. It supersedes the earlier research report's suggested database: MongoDB is the required database. "React form" is interpreted as React Hook Form.

## 1. How to use this package

1. Give your coding agent MANAGE_BUILD_PROMPT.md and this file.
2. Supply the Manage logo and the existing Google Stitch prompts or approved exported designs.
3. For a new Manage repository, copy AGENTS.template.md to its root as AGENTS.md. In an existing repository, merge relevant instructions rather than replacing existing ones.
4. Have the agent complete each phase below, demonstrate its acceptance checks, and record actual commands/results.
5. Configure real provider accounts and test devices when needed. Local adapters allow earlier phases to proceed without real emails.

Existing reference files in this workspace:
- Build prompt: C:/Users/USER/Desktop/workspace/khemsafe/docs/build-spec/MANAGE_BUILD_PROMPT.md
- Stitch prompts: C:/Users/USER/Desktop/workspace/khemsafe/reports/Google Stitch UI prompts.md
- Research: C:/Users/USER/Desktop/workspace/khemsafe/reports/Site workforce app design.md
- Logo: C:/Users/USER/Desktop/workspace/khemsafe/assets/branding/manage-logo-transparent.png

Do not infer that the containing workspace is a clean application repository. Inspect it first; it contains unrelated work. A new implementation can live in a dedicated manage subdirectory.

## 2. System boundaries

~~~text
Expo staff/owner ── TLS ─────────────────────────┐
                                               v
Browser ── same-origin /api ── reverse proxy ── Express ── MongoDB replica set
   │                                           │                  │
   └── Next.js admin rendering ── scoped API ────┘                  │
                                                                  v
                                                     Outbox worker
                                                       │       │
                                                     Resend   Push provider
                                                       │       │
                                                     email   iOS/Android

Resend signed webhooks ── raw-body verified Express endpoint ── delivery records
~~~

Express is the only business API. The worker calls the same server-side domain services and repositories, not client code. Next.js does not receive MongoDB credentials. A same-origin reverse proxy routes /api/auth and /api/v1 to Express; browser page routes go to Next.js. Mobile uses an explicitly configured public API base URL.

If hosting requires Next.js forwarding handlers instead of an edge proxy, allowlist routes/methods and the upstream origin. Forward only necessary headers, preserve multiple Set-Cookie values, reject user-selected destinations, and never trust incoming X-User/X-Role headers. Test login, logout, MFA, CSRF, redirects, and session renewal through the actual deployment topology.

For server-rendered pages, use request-scoped cookie forwarding to Express with private/no-store behavior. Do not put private responses in shared Next.js, CDN, or module-level caches. Keep browser query caches scoped to user/organization/site and clear them on sign-out or context change.

## 3. Technology allocation

| Concern | Choice | Implementation rule |
|---|---|---|
| Mobile UI | Expo + Expo Router + NativeWind | Native controls; no web DOM shadcn components |
| Admin UI | Next.js App Router + shadcn/ui + Tailwind | Accessible forms/tables, server/client boundaries |
| Forms | React Hook Form + Zod | Client validation improves UX; API validates independently |
| Local UI state | Zustand | Filters, navigation preferences, nonsensitive stepper state |
| Remote data | TanStack Query or request-scoped server fetch | No duplicate server record ownership in Zustand |
| Persistence | Official MongoDB driver | Explicit schemas, repositories, indexes, transactions |
| Auth | Better Auth in Express | Supported Expo/MongoDB/MFA integrations; no custom auth protocol |
| Offline records | Expo SQLite with verified SQLCipher build | SecureStore key; account-scoped queue |
| Delivery | Mongo outbox worker + Resend + push | Persistent alert first, external delivery second |

React Hook Form supports controlled integration; shadcn documents the web form pattern. Keep client form helpers platform-specific while sharing DTO schemas. [React Hook Form](https://react-hook-form.com/get-started), [shadcn forms](https://ui.shadcn.com/docs/forms/react-hook-form).

NativeWind's documented stable setup and web Tailwind may not use the same major version. Freeze each app's compatible configuration independently; avoid a root override that breaks native builds. Verify the mobile dependency matrix before scaffolding. [NativeWind installation](https://www.nativewind.dev/docs/getting-started/installation).

Zustand stores used during SSR must not leak state between requests. Use provider-scoped initialization and deterministic hydration; never create one mutable server-global user store. [Zustand Next.js guidance](https://zustand.docs.pmnd.rs/learn/guides/nextjs).

## 4. Phase plan with exit conditions

| Phase | Deliver | Exit condition |
|---|---|---|
| 0: foundations | Workspace, lockfile, env schemas, database replica set, CI, tokens, architecture decision record | All apps boot; invalid config fails clearly; transaction test passes |
| 1: identity/access | Auth, invitations, MFA, policies, session revoke, seed tenants | Tenant/access/MFA negative tests pass before real sensitive data |
| 2: organization/sites | Owner site setup, invitations, assignment history, admin grants | Owner A cannot read/change owner B's site or elevate roles |
| 3: attendance | Staff and owner connected flow, audit events, active-shift constraint | Concurrent start/retry/end tests and device UI flow pass |
| 4: offline/review | Encrypted queue, batch sync, reasons, correction approvals | Restart, two-device conflict, account switch, and replay tests pass |
| 5: presence/alerts | Native background integration, state machine, inbox, outbox, delivery | Physical-device evidence and worker failure tests recorded |
| 6: operations | Admin health, exports, privacy lifecycle, backup/restore, accessibility | Bounded export, restore drill, deployment rehearsal completed |
| 7: release evidence | Security checks, full journey tests, runbooks, unresolved issues | No known unaddressed critical/high in-scope findings; limitations explicit |

Suggested checks the implementation should expose as real scripts:
~~~text
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
pnpm test:integration
pnpm test:e2e:web
pnpm build
pnpm db:indexes:verify
pnpm security:check
~~~
These are script requirements to implement, not commands claimed to work in the current workspace. Include platform-specific native build and device-testing instructions separately.

## 5. Data model and invariants

Use explicit runtime validators even with TypeScript. Keep auth-library collections owned by the library; map its canonical user ID consistently. Business resources may use Mongo ObjectIds, but validate and convert at a single boundary. Do not accidentally treat string and ObjectId references as equivalent.

| Collection/group | Minimum fields and invariants |
|---|---|
| Auth identities/sessions | Library-owned schema; verified email, session expiry/revocation, MFA state |
| Organizations | Name, status, policy settings, retention configuration |
| Memberships | Organization, user, role, status, version; unique organization/user |
| Sites | Organization, name, address, GeoJSON point, radius, timezone, policy version, status |
| Site assignments | Organization, site, member, permission scope, effectiveFrom/effectiveTo; preserve history |
| Shifts | Organization, site, user, clientShiftId, start/end, status, version, review state |
| Attendance events | Organization, actor, device, clientEventId, shift references, capturedAt, receivedAt, type, outcome; original immutable |
| Location observations | Organization, user/shift/site, point, accuracy, timestamps, source, policyVersion, expiry |
| Departure incidents | Shift, state, candidate/confirmation/return timestamps, latest evidence, review status |
| Corrections | Shift/event, requested values, reason, requester, reviewer, decision, expectedVersion |
| Invitations | Organization/site scope, intended email/role, hashed token, expiry, consumedAt |
| Device registrations | User/session/organization association, push token, platform, revokedAt |
| In-app alerts | Incident, recipient, scoped site, createdAt, readAt/reviewedAt |
| Outbox/delivery | Logical key, recipient/channel, state, attempts, nextAttemptAt, lease/version, provider ID, last safe error |
| Audit events | Actor, action, target, scope, time, request ID, approved redacted diff |
| Idempotency records | Actor/scope/operation/key, request digest, committed result, expiry policy |

GeoJSON coordinates are longitude then latitude. Validate finite numbers, latitude [-90, 90], longitude [-180, 180], accuracy nonnegative, and bounded radius. Basic circle distance can be computed in the domain service; a geospatial index is needed only when actual geospatial queries use it.

Required indexes:
- Unique memberships on organizationId + userId.
- Partial unique shifts on userId for status WORKING, enforcing the proposed global one-shift rule.
- Unique attendance event identity on userId + deviceId + clientEventId.
- Unique client shift mapping on userId + clientShiftId.
- Unique logical outbox key on incident/event + recipient + channel.
- Partial unique open incident per shift.
- History/roster indexes starting with tenant scope, then site/user and time as appropriate.
- Explicit retention indexes/jobs for location observations and expired temporary records.

A unique partial index limits uniqueness to matching documents; multi-document transactions require a compatible deployment such as a replica set. Verify actual index creation rather than relying only on application checks. [MongoDB indexes](https://www.mongodb.com/docs/manual/core/index-unique/), [transactions](https://www.mongodb.com/docs/manual/core/transactions/).

TTL deletion is cleanup, not an authorization timer: reject expired tokens/sessions in application logic even if records remain. Attendance deduplication must last at least as long as the offline replay horizon; do not expire event identities after only a few minutes.

Use optimistic version checks for site settings and correction decisions. Return 409 for stale updates. Editing a site's boundary must create a policy version; evaluate observations against the policy effective at their capture time. Do not turn moving a geofence into a fabricated employee departure.

Correction approval must atomically save its decision, append the amendment and audit event, and update the derived shift projection. Concurrent decisions must have one winner. Preserve original event timestamps even when a reviewer approves different effective work times. Reassignment or revocation during an offline shift requires explicit review rules based on historical assignment validity; it must not silently discard the submitted evidence.

## 6. Authorization policy matrix

| Operation | Staff | Site owner | Platform admin |
|---|---|---|---|
| Own profile/security | Self | Self | Self |
| Read site details | Assigned subset | Managed sites | Administrative metadata |
| Clock in/out | Self and eligible assignment | Only if also granted staff membership | No impersonated punching |
| Read attendance | Own records | Scoped staff/site records | Explicit operational grant only |
| Submit correction | Own records | Own only if also staff | Operational support workflow only |
| Decide correction | No | Managed site, never own request | Explicit grant; never own request |
| Change boundary | No | Managed site | Scoped administrative grant |
| Invite staff | No | Managed sites, staff role only | Authorized organization scope |
| Grant owners/admins | No | No | Dedicated audited privilege |
| View exact location | Own available record | Minimum needed for active scoped incident | Explicit audited access |
| Export | Own history if offered | Scoped site attendance | Explicit scoped export privilege |
| System health | No | Delivery status for own alerts only | Redacted system operations |

Implement centralized policy functions and tenant-constrained repository methods. Organization selection is context, not permission. For forbidden resources, use a consistent non-enumerating response policy. Scope aggregation pipelines and nested lookups too; do not filter only the final JSON response. Deny-by-default authorization is the baseline. [OWASP authorization](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html).

## 7. API contract outline

Document precise schemas and policy checks in OpenAPI; the routes below describe product contracts, not auth-library endpoint internals.

| Routes | Required behavior |
|---|---|
| /api/auth/* | Library-managed login, MFA, verification, reset, session lifecycle; public enrollment gated |
| GET /api/v1/me | Safe profile, verified memberships, allowed capabilities, readiness |
| GET/POST /api/v1/organizations | Platform-administration policy |
| GET/POST/PATCH /api/v1/sites[/id] | Scope, DTO allowlist, version checks |
| POST /api/v1/sites/:id/invitations | Staff-only grant for owners, rate limit, one-use invite |
| POST /api/v1/invitations/accept | Verify invite email/scope, atomically consume; cannot self-select role |
| GET/POST/PATCH /api/v1/sites/:id/assignments[/assignmentId] | Scope and effective-dated changes |
| GET /api/v1/shifts/current | Current accepted shift plus safe review state |
| POST /api/v1/attendance/events | Idempotent clock-in/out or exception event |
| POST /api/v1/attendance/sync | Bounded batch, per-item result, dependency ordering |
| GET /api/v1/shifts and /shifts/:id | Bounded time range and scoped cursor pagination |
| POST /api/v1/location/observations | Active/relevant shift only; accuracy, freshness, replay limits |
| GET /api/v1/alerts and /alerts/:id | Recipient/site scope; fresh access recheck |
| POST /api/v1/alerts/:id/review | Explicit acknowledgment; no audit deletion |
| POST /api/v1/corrections | Own record, proposed values, reason |
| POST /api/v1/corrections/:id/decision | Reviewer scope, no self-approval, expected version |
| POST/DELETE /api/v1/devices[/id] | Authenticated device registration/revocation |
| POST /api/v1/exports | Authorized report bounds; audit and quota |
| /api/v1/admin/* | Named capabilities, MFA, sensitive-action reauthentication |
| POST /webhooks/resend | Raw-body signature verification and event deduplication |
| GET /health/live and /health/ready | Minimal public status; internal diagnostics authenticated |

Proposed event envelope:
~~~json
{
  "clientEventId": "uuid",
  "clientShiftId": "uuid",
  "deviceId": "registered-device-id",
  "siteId": "validated-resource-id",
  "type": "CLOCK_IN",
  "capturedAt": "2026-11-16T07:00:00.000Z",
  "location": {
    "latitude": 6.43,
    "longitude": 3.42,
    "accuracyMeters": 18,
    "capturedAt": "2026-11-16T06:59:58.000Z"
  },
  "sitePolicyVersion": 3
}
~~~
This contains client claims, not verified facts. Derive user/organization from authenticated context. Pair a CLOCK_OUT with the same clientShiftId when its start is still offline. If a start is rejected, retain its linked end for review rather than attaching it to an unrelated active shift.

Return an event ID, accepted/review/rejected outcome, authoritative state when available, and a request ID. Errors use a stable code, safe message, optional field errors, and request ID. Use 401, 403/404, 409, 422, and 429 consistently. A repeated idempotency key with different input is a conflict, not a successful retry.

## 8. Presence state machine and practical defaults

Proposed pilot defaults—not universal accuracy guarantees:
- Site radius 150 m, editable within validated 50–2,000 m bounds.
- Maximum acceptable horizontal accuracy 50 m.
- Exit buffer 30 m; re-entry buffer 15 m.
- Exit grace 120 seconds.
- Evidence freshness limit 120 seconds for current-departure confirmation.
- Presence becomes UNKNOWN after 5 minutes without qualifying evidence.
- Offline replay beyond 24 hours requires attendance review.
- Raw precise observations retained 7 days in the pilot; attendance/audit retention must be configured before production.

All settings are explicit, versioned, and field-tested; smaller sites may require a different verification workflow.

Let d be distance from the site center, a reported horizontal accuracy, and r the radius:
- Candidate outside when d - a > r + exitBuffer.
- Candidate inside when d + a < r - entryBuffer.
- Overlap/uncertainty: keep historical state with an age indicator, then UNKNOWN when stale; never assert reliable presence from uncertainty.

These are conservative heuristics, not proof of physical location. Confirm departure only after a candidate remains plausible across the grace interval with new sufficiently fresh, accurate evidence. A missing second reading yields uncertainty. Process event time and receipt time separately; handle out-of-order data through reconciliation.

State transitions:
~~~text
UNKNOWN → qualifying inside reading → INSIDE
INSIDE → qualifying outside reading → EXIT_PENDING
EXIT_PENDING → qualifying inside reading → INSIDE, cancel candidate
EXIT_PENDING → fresh confirming outside evidence after grace → OUTSIDE + incident
OUTSIDE → qualifying inside reading → INSIDE, close incident as returned
ANY → evidence too old/unavailable → UNKNOWN, preserve historical incident
ANY → local clock-out → stop device monitoring
~~~

The server's stale-observation job can mark UNKNOWN but cannot detect a physical departure without evidence. Never infer that a killed app or disabled location means misconduct. Expo background behavior varies by OS, permission, and termination state; version-pin documentation and verify physical-device behavior. [Expo Location](https://docs.expo.dev/versions/latest/sdk/location/).

## 9. Authentication and session implementation

Use one Express-hosted Better Auth instance with the supported MongoDB adapter. Do not run independent incompatible auth databases in Next.js and Express. Mount the auth handler before generic JSON body parsing, using the installed Express version's route syntax. Prove this integration early. [Better Auth Express](https://better-auth.com/docs/integrations/express), [MongoDB adapter](https://better-auth.com/docs/adapters/mongo).

Product security requirements:
- Invitation-only enrollment; block direct public signup paths and plugin bypasses.
- Do not treat invitation possession as permission to choose another organization/email/role.
- If identity creation and business membership cannot share one transaction, create an inactive pending identity and finalize membership through an idempotent workflow. It has zero resource access until finalized.
- Require email verification and authenticator-based MFA for owners/admins.
- MFA setup/challenge sessions have only setup/challenge/logout capability. Merely having twoFactorEnabled is not proof a session completed MFA.
- Require recent reauthentication for granting privileges, disabling MFA, changing sensitive settings, or performing high-impact exports.
- First platform admin is created through a controlled one-time bootstrap command; no default password or public bootstrap endpoint. Protect the last active admin from accidental removal.
- Reset and invitation tokens expire, are single-use, and never appear in logs. Do not consume them on GET requests that email link scanners might prefetch.
- Use allowlisted redirects and verified mobile app links where feasible; reject arbitrary callback destinations.
- Login/reset responses do not reveal whether an email exists.
- Password handling uses the maintained library algorithm. Do not weaken secure scrypt defaults merely to change algorithms; if configuring Argon2id, use a maintained implementation and reviewed parameters.

Mobile session storage uses the library's Expo adapter and SecureStore. SecureStore is for small secrets, not full offline attendance records. [Expo integration](https://better-auth.com/docs/integrations/expo), [SecureStore](https://docs.expo.dev/versions/latest/sdk/securestore/).

Privileged MFA, recovery codes, and recovery flows should use the library capability, with server-enforced role policy layered above it. [Better Auth MFA](https://better-auth.com/docs/plugins/2fa). Library selection does not itself prove those policies are implemented.

For web, configure Secure, HttpOnly, host-only cookies with an appropriate SameSite policy and test session renewal/revocation. Keep server authorization near data access rather than relying on navigation guards. [Next.js authentication](https://nextjs.org/docs/app/guides/authentication), [OWASP sessions](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html).

Disable any auth-library session-cookie cache behavior that would defeat the required next-request revocation semantics, or use a documented live validation path for protected operations. A signed cookie with an old role is not current authorization. Document session expiry, idle timeout, reauthentication windows, and the exact invalidation behavior in the authentication decision record.

Use supported auth-library CSRF defenses for auth routes. Business cookie-authenticated mutations need their own tested Origin and session-bound CSRF checks. Do not disable protections globally to make native clients work: use the documented native integration and prove browser requests cannot misuse that path. [OWASP CSRF](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html).

## 10. Security threat model and verification

Assets: identities, privileged sessions, precise locations, attendance evidence, organization separation, exports, provider credentials, and audit records. Trust boundaries: device→API, browser→proxy→API, API→database, worker→providers, webhook→API, and CI→deployment.

| Threat | Required control | Concrete test/evidence |
|---|---|---|
| Cross-tenant ID guessing | Scope repository queries and resource relations | Substitute IDs across two organizations on every route family |
| Owner privilege escalation | Named capability and allowed-role policy | Owner attempts admin grant and unrelated site assignment |
| Stolen/revoked session | Server-side validation, revoke, MFA, protected storage | Reuse session after logout/suspension/reset |
| MFA bypass | Challenge-bound session policy | Direct API call before enrollment/challenge completion |
| Login brute force/email flooding | Shared account/IP quotas and bounded work | Multiple API instances enforce the same limit |
| CSRF | Origin + session-bound validation for browser mutations | Cross-origin form/fetch and missing/invalid token rejected |
| NoSQL injection/mass assignment | Typed scalar schemas and explicit update DTOs | Send $ne, $where, nested operators, role/status fields |
| Private cache leak | Per-request server state and tenant query keys | Sequential SSR requests by different organizations |
| Double punches/replays | Unique indexes, transactions, idempotency | Parallel starts, repeated same event, changed-payload retry |
| Forged GPS/timestamps | Validate evidence; flag anomalies; human review | Future/old times, impossible coordinates, stale fixes |
| Worker retry/lease race | Atomic leasing and stable logical identities | Kill worker before/after provider handoff; recover lease |
| Forged webhook | Raw-body signature and replay window | Modified body, old signature, duplicate event ID |
| CSV formula injection | Safe text serialization | Cells beginning =, +, -, @ and whitespace/control variants |
| Sensitive logs | Structured redaction and safe errors | Inspect logs after auth, sync, reset, export, and failures |
| Device account switch | Per-account encrypted queue and cache clearing | Account B cannot see/sync A's offline events |
| Background privacy breach | Stop hooks plus event intake policy | Offline clock-out/logout stops new collection |
| Dependency/secret exposure | Locked builds, scanning, restricted CI | Scan bundle/repo/build artifacts and triage findings |
| Database privilege abuse | Scoped credentials, network controls, backup isolation | API cannot run admin operations or alter audit history |

Never pass user JSON directly to MongoDB query/update APIs; parser validation and explicit construction are the main defenses, not a sanitizer alone. [OWASP NoSQL security](https://cheatsheetseries.owasp.org/cheatsheets/NoSQL_Security_Cheat_Sheet.html).

Configure Express security headers, trusted-proxy settings, request limits, and safe production errors. Trust only the actual proxy chain so attackers cannot spoof rate-limit identities through forwarded headers. Web CSP must be tested against Next.js rendering and required map resources. [Express production security](https://expressjs.com/en/advanced/best-practice-security/).

Protect the encrypted offline database with the correct native build option; a key pragma alone is not proof encryption is enabled. Test that a copied database is unreadable without the key. Bound local retention and never silently destroy unsynced attendance. [Expo SQLite](https://docs.expo.dev/versions/latest/sdk/sqlite/).

Choose device key accessibility deliberately: background work may be unable to read secrets that require an interactive biometric prompt. Test the selected policy on locked devices and after reboot. If the key is unavailable, do not fall back to plaintext storage or falsely report successful capture; surface a recovery/readiness state when the app resumes. After membership revocation, stop collection as soon as the device learns of it; an offline device cannot learn a remote change instantly, so the server must reject or review subsequent uploads according to policy.

Audit immutability here means the application cannot modify past records. Database operators can still alter data unless stronger external controls exist. Do not claim tamper-proof auditing; use separate privileges, backups, and optionally an external append-only audit destination.

## 11. Notifications and delivery semantics

Create incident, recipient alert, audit entry, and outbox intent atomically. The worker resolves currently authorized recipients before sending and cancels obsolete work. Avoid exposing employee names or coordinates on a locked screen by default: send a generic alert with an opaque resource ID and fetch details after authentication.

Use a bounded retry policy, exponential backoff with jitter, attempt history, and a dead-letter state. Acknowledge jobs with a lease/version check so a slow old worker cannot overwrite a new worker's result.

Resend supports idempotency keys with a documented time window; application deduplication must outlast that window. Unknown delivery outcomes require reconciliation. [Resend idempotency](https://resend.com/docs/dashboard/emails/idempotency-keys).

Resend webhook verification requires the raw request body. Mount its raw-body route before generic JSON parsing, verify with the maintained SDK, then validate event shape and deduplicate. [Resend verification](https://resend.com/docs/webhooks/verify-webhooks-requests).

Keep these statuses distinct: queued, provider accepted, delivery reported, failed, owner reviewed. Email/server or push-provider acceptance is not proof the owner saw the alert. Exactly-once external delivery cannot be guaranteed across all network failures.

## 12. Environment and local setup contract

The agent must create .env.example per service with comments and no credentials.

| Variable category | Example names | Visibility |
|---|---|---|
| API/worker database | MONGODB_URI, MONGODB_DB_NAME | Server only |
| Auth | BETTER_AUTH_SECRET, AUTH_BASE_URL, TRUSTED_WEB_ORIGINS | Secret except public origin metadata |
| Email | RESEND_API_KEY, RESEND_WEBHOOK_SECRET, EMAIL_FROM | Keys secret |
| Push | EXPO_ACCESS_TOKEN, project ID/config | Token server-only; project ID may be public |
| Web server | INTERNAL_API_ORIGIN | Server only |
| Mobile | EXPO_PUBLIC_API_URL, EXPO_PUBLIC_ENVIRONMENT | Public; no credentials |
| Worker | OUTBOX_POLL_MS, LEASE_SECONDS, MAX_ATTEMPTS | Operational config |
| Retention | LOCATION_RETENTION_DAYS, configured attendance/audit policies | Server policy |
| Encryption | Secret-manager/KMS references if used | Server/device secret as applicable |

Environment schemas must fail startup on missing production secrets, insecure public origins, or enabled mock delivery in production. Generate secrets using a cryptographically secure mechanism; never commit generated values.

Provide a local Mongo replica set with documented initialization, health check, and isolated development/test databases. Test migrations against disposable data first. Dev email/push adapters write sanitized messages to a protected local viewer or files; they never pretend a real provider accepted delivery.

Create seed organizations A and B, owners with different site scopes, two staff accounts, shifts, incidents, and pending corrections. Seed credentials are development-only and must not run in production. Provide an explicit cleanup procedure scoped to the test database.

## 13. Test and operational handoff

Use unit tests for policy/state-machine/time logic; API integration tests against a replica set for authorization, indexes, transactions, and concurrency; React Native Testing Library for user behavior; Playwright for admin web. Use physical devices for background tracking, encrypted storage, push, and permission recovery. A browser simulator cannot validate native background behavior.

Device matrix must record OS/device/build, permission mode, foreground/background/locked/force-quit state, network state, timestamps, and observed result. Include reduced precision, battery restrictions, reboot, offline end, app restart, stale sessions, and push disabled. Record untested cases explicitly.

Production topology needs a long-running API and worker, suitable MongoDB deployment, HTTPS ingress, secret management, verified Resend sender/domain, push credentials, and protected observability. Do not put the persistent worker into a request-only serverless function without a supported scheduling/lease design.

Before rollout:
- Run a restore drill and define recovery-time/recovery-point targets.
- Verify indexes, encryption, backup access, privacy retention jobs, and log redaction.
- Confirm app permission strings and store disclosures match active-shift behavior.
- Rehearse schema-compatible rollback; native plugin changes require a new binary, not only an OTA JavaScript update.
- Enable monitored alerting for worker backlog, rejected auth spikes, delivery failures, database errors, and stale presence rates.
- Check deactivated organizations cannot access data or receive new notifications.
- Confirm launch-region employment/privacy obligations and retention decisions with the organization; this guide does not certify legal compliance.

The completion report must separate implemented, automatically tested, manually/device tested, and blocked/unverified work. Include commands, results, known risks, and the next concrete step. A clean audit scan alone is not evidence that authorization or geofencing works.

