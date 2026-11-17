# Architecture overview

Manage is a TypeScript monorepo (pnpm workspace) with four runnable apps and six
shared packages. This document explains the runtime topology, the data model, and
the state machines that make attendance and alerting defensible.

## Topology

```
                    ┌─────────────────────┐
  Expo app  ───────▶│                     │
  (staff/owner)     │   Express API       │──▶ MongoDB replica set
                    │   /api/auth/*       │      (transactions, indexes)
  Browser ─────────▶│   /api/v1/*         │
  (admin/owner)     │   /health/*         │
      │             └─────────┬───────────┘
      │ same-origin           │ transactional outbox
      │ rewrites              ▼
      └──────────▶ Next.js   ┌──────────────────────┐
                   web app   │ outbox + heartbeat   │
                             │ collections           │
                             └─────────┬────────────┘
                                       │ leased delivery
                        ┌──────────────┴──────────────┐
                        │                             │
             apps/worker (loop)          GET /api/v1/internal/worker/tick
             local / container           Vercel Cron on Vercel
```

- **One API origin.** The browser never talks to a second origin: Next.js
  rewrites `/api/v1/*` and `/api/auth/*` to `API_ORIGIN`, so Better Auth cookies
  stay first-party and `SameSite=Lax` works without CORS exceptions.
- **Two worker modes.** `apps/worker` runs a polling loop for local/container
  deployments. On Vercel, Vercel Cron calls the secret-protected tick endpoint
  every five minutes (`CRON_SECRET` in the bearer header). Both modes call the
  same `runWorkerTick` in `packages/worker-core`; only scheduling differs.
- **Mongo only.** No Redis, no ORM. Mongo leases fence outbox delivery, partial
  unique indexes enforce invariants, and transactions keep outbox writes atomic
  with the alert/incident writes that create them.

## Request pipeline (API)

Order matters and is defined in `apps/api/src/create-app.ts` and
`apps/api/src/routes/index.ts`:

1. `requestId` — generates or accepts `X-Request-Id` (max 100 chars) on every
   response, including errors.
2. `pino-http` — request logs with header redaction (authorization, cookie,
   CSRF, API key, worker secret). Health probes are not logged.
3. `helmet`, then CORS — credentialled CORS only for configured web origins,
   `manage://` (mobile scheme in production), and `exp://` in development.
4. `/api/auth/sign-up*` → 404. Public signup is disabled; accounts arrive through
   invitations or administrative provisioning.
5. `/api/v1/webhooks/resend` → `express.raw` so the HMAC signature is verified
   against the exact bytes Resend signed.
6. `/api/auth/*` → Better Auth handler.
7. `express.json` (1 MB) and health probes (`/health/live`, `/health/ready`,
   `/api/v1/health`).
8. `/api/v1/internal/*` → machine routes. No session auth, no CSRF; the caller
   presents `CRON_SECRET` or `WORKER_TRIGGER_SECRET` (constant-time compare). The
   route 404s when neither secret is set.
9. `requireAuth` — resolves the session, then re-derives membership roles, active
   organizations, site ownership, assignments, grants, and capabilities from
   MongoDB on every request. Client-supplied roles are never read.
10. `csrfProtection` — a cross-origin `Origin` must be allowlisted, and
    cookie-authenticated browser mutations must present `X-CSRF-Token` (an HMAC of
    the session id). Requests without `Origin` are treated as non-browser clients
    and skip the token check; browsers attach `Origin` to cross-site writes.
11. `requireVerifiedEmail`, then feature routes. Each route validates its body and
    query with Zod, checks a capability, and scopes every read/write by the
    actor's verified organization/site/subject IDs.

Owners and platform admins with an enrolled factor but without a challenged
session are blocked by `mfaBlocked`; `requireMfaComplete` is applied by owner and
admin routes. The UI mirrors this state, but the server is authoritative.

## Data model

Core collections and their invariants (`packages/database/src/indexes.ts`):

| Collection | Purpose | Key invariant |
| --- | --- | --- |
| `users`, `session`, `account`, `twoFactor`, `verification` | Better Auth | library-owned |
| `organizations` | tenant root | — |
| `memberships` | user ↔ organization, role, onboarding flags | unique `(organizationId, userId)` |
| `sites` | location, radius policy snapshot, owners | owner lists are intersected with active memberships at read/send time |
| `sitePolicies` | immutable policy versions | unique `(siteId, version)` |
| `assignments` | staff ↔ site, effective interval | unique `(siteId, memberId, effectiveFrom)` |
| `shifts` | one work session | **partial unique `userId` where `status: 'WORKING'`** |
| `attendanceEvents` | append-only clock events | unique `(userId, deviceId, clientEventId)` prevents replay |
| `observations` | location samples during a shift | unique `(userId, clientObservationId)` |
| `incidents` | possible departures | unique `shiftId` where `open: true` |
| `alerts` | owner-facing in-app alerts | unique per `(incidentId, recipientId)` |
| `outbox` | email/push intents | unique `logicalKey`; leases + attempt counters |
| `corrections` | proposed amendment to a shift | unique `shiftId` where `status: 'PENDING'` |
| `auditEvents` + `auditHead` | append-only hash chain | unique `sequence`, previous hash |
| `workerHeartbeats` | single worker health document | `_id: 'worker'` |
| `idempotency` | HTTP idempotency reservations | unique `(actorId, key)` |

Deleted data is never reused as a new record with the same logical identity:
`clientShiftId`, `clientEventId`, and `logicalKey` are durable client/provider
identities, which is what makes offline replay safe.

## Clock-in / clock-out

`apps/api/src/services/attendance.ts`:

1. Validate the DTO (site, client ids, captured time, optional location).
2. Verify an active assignment to that site and that the payload's site belongs
   to the actor's verified organization.
3. Classify the reading against the site policy at the **shift's** policy version
   (`INSIDE`, `OUTSIDE`, `UNCERTAIN`); no location is `NEEDS_REVIEW`, never
   accepted as presence.
4. Insert `shifts` + `attendanceEvents` in one transaction. The partial unique
   index is the race arbiter: the loser gets `DUPLICATE` if the same
   `clientShiftId` won, otherwise `REJECTED`.
5. Clock-out evaluates device time: a clock-out more than 24 hours late becomes
   `NEEDS_REVIEW` and the shift stays auditable. An unmatched clock-out is stored
   as an orphan event for review rather than being attached to someone else's
   shift.
6. Corrections never mutate the original event. Approving one writes an
   `AMENDMENT` event referencing the correction, sets the shift's payable times,
   and appends an audit entry. The server rejects self-approval.

## Presence and departure alerts

`packages/domain/src/presence.ts` and `apps/api/src/services/presence.ts`:

```
INSIDE ──outside reading──▶ EXIT_PENDING ──grace elapsed + still outside──▶ OUTSIDE (confirmed)
   ▲                              │                                            │
   └────── inside reading ────────┘                                            │
   └──────────────────── inside reading (RETURNED) ────────────────────────────┘
STALE ── no fresh qualified reading ──▶ UNKNOWN
```

- Outside requires `distance - accuracy > radius + exitBuffer`; inside requires
  `distance + accuracy < radius - entryBuffer`. Anything else is `UNCERTAIN` and
  never moves the state machine.
- Readings older than `freshnessSeconds` are stored as history and mark presence
  `UNKNOWN`; they cannot confirm a departure.
- Confirmation opens an `incident` and creates an alert per owner, plus email/push
  outbox intents in the same transaction. Returning cancels the incident and its
  queued deliveries.
- The scheduled worker flips presence to `UNKNOWN` when qualified readings go
  stale and flags shifts with no sync for `STALE_SHIFT_HOURS`. Unknown never
  becomes "absent" and never closes a shift.

## Outbox and worker

- Business writes enqueue `outbox` rows with a deterministic `logicalKey`
  (`alert:<incident>:<recipient>:EMAIL`). The unique key makes re-processing
  idempotent.
- A tick leases up to `max` rows atomically (state `LEASED`, owner, expiry),
  delivers, then marks `SENT` with the provider message id or `FAILED` with
  exponential backoff. After `OUTBOX_MAX_ATTEMPTS` the item becomes `DEAD` and is
  visible to admins for retry.
- Delivery re-reads the incident at send time; if it was returned or cancelled
  the item is `CANCELLED` instead of sent.
- A heartbeat document (`mode: 'scheduled' | 'loop'`) lets the admin health page
  distinguish "worker healthy" from "worker overdue". The scheduled mode's stale
  threshold is `max(2 × WORKER_SCHEDULE_SECONDS + 120, 300)`.
- Provider adapters are explicit: Resend/Expo when configured, otherwise a disk
  adapter that labels output as local and is disabled on serverless production
  (`isProduction`), where pretending a file write was a delivery would be
  dishonest.

## Mobile offline path

- The queue (`apps/mobile/src/lib/queue.ts`) stores clock events, observations,
  and the active shift in AsyncStorage, encrypted with AES-256-GCM using a key in
  SecureStore (`WHEN_UNLOCKED_THIS_DEVICE_ONLY`).
- Writes are serialized through a promise chain so the foreground UI and the
  background location task cannot clobber each other.
- Events carry durable `clientEventId`/`clientShiftId`; a flush is safe to retry
  because the server's unique indexes and transaction collapse duplicates.
- Sign-out removes the active-shift and queue keys so cached work cannot cross
  accounts. Background tracking stops on local clock-out.

## Indexes and migrations

- `packages/database/src/indexes.ts` is the single source of truth;
  `ensureIndexes` is additive and never drops or rewrites an index.
- Locally, `pnpm seed` applies indexes. Before/after a deployment run
  `pnpm db:indexes:apply` and `pnpm db:indexes:verify` from a trusted machine with
  database credentials; verify exits non-zero when a required index is missing.
- Changes are additive-first: add the index in the same release that starts using
  it, then remove old access paths in a later release. Never rely on
  `autoIndex` in production.

## Limits and deliberate omissions

- No presence/online tracking: presence means "qualified location evidence for a
  working shift", not a liveness signal.
- No geofence promise: background OS throttling can delay or drop samples. Alerts
  are best-effort prompts, and the UI says so.
- No cross-organization aggregation endpoint for owners; platform administrators
  use scoped admin routes that are audited.
- Audit chaining detects tampering by someone with application access; it does not
  protect against a database administrator who can rewrite the whole chain.
