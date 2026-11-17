# Completion report

Date: 2026-11-17

This is an honest status report for the repository. It separates what has been
executed and observed from what has not. It is **not** a production-readiness or
compliance claim.

## Delivered

### Applications

- **API** (`apps/api`): Express 5 with Better Auth (Mongo adapter, TOTP two-factor,
  Expo plugin). Invitation-only enrollment, owner/admin MFA gating, deny-by-default
  capability checks with per-request scope resolution, CSRF, Mongo-backed rate
  limits, hash-chained audit log, raw-body Resend webhook verification, idempotency
  reservations, and `/api/v1` routes for identity, sites, assignments, invitations,
  shifts/events/sync, observations, alerts, corrections, exports, devices, health,
  and admin operations. Serverless entry and Vercel config included.
- **Worker** (`apps/worker`) and **worker core** (`packages/worker-core`):
  transactional-outbox delivery with leases, exponential backoff, dead-lettering,
  presence reconciliation, stale-shift flagging, and location-retention purging.
  Two schedulers share one implementation: a local/container loop and the
  secret-protected HTTP tick for Vercel.
- **Web** (`apps/web`): Next.js 16 App Router console with owner views (overview,
  sites, site detail, team, alerts, alert detail, timesheets) and platform-admin
  views (overview, organizations, sites, users/grants, audit, health), plus
  invitation acceptance, sign-in, password reset, and MFA setup. Same-origin
  rewrites keep cookies first-party.
- **Mobile** (`apps/mobile`): Expo SDK 58 app with invitation onboarding, staff
  Today/History/shift detail/account, staff reports with author CRUD, site details
  with assignment acceptance, site reviews, encrypted offline queue, background
  location, owner oversight (alerts, corrections, sites, team lead, inspector),
  onboarding steppers, and settings.

### Shared packages

`contracts` (Zod), `api-client`, `tokens`, `domain` (presence, attendance policy,
geo, outbox, CSV), `database` (collections, indexes, repositories, audit,
idempotency, outbox), and `worker-core`.

### Operations assets

- `apps/api/openapi.yaml`
- `apps/api/vercel.json` + prebundled `apps/api/server.js` + `tsup` config
- `apps/api/vercel.json` → Vercel Cron schedule for the worker tick
- `.env.example`, `apps/mobile/.env.example`
- `AGENTS.md`, `README.md`
- `docs/deployment-vercel.md`, `docs/architecture/overview.md`,
  `docs/security/threat-model.md`,
  `docs/operations/backup-restore.md`, `docs/operations/incident-runbook.md`,
  `docs/operations/device-test-record.md`
- `scripts/security-check.mjs` (`pnpm security:check`)

## Verification executed

| Check | Command | Result |
| --- | --- | --- |
| Lint | `pnpm lint` | pass (0 errors, 0 warnings) |
| Typecheck | `pnpm typecheck` | pass, all apps/packages |
| Unit tests | `pnpm test` | pass, 11 API tests; other packages have no unit files |
| Integration tests | `pnpm test:integration` | **25 pass** (4 files, ~105 s) |
| Builds | `pnpm build` | pass: API (tsup), worker, web (`next build` 22 routes) |
| Serverless entry | `node -e "import('./apps/api/server.js')"` | default export is a function |
| Mobile bundle | `expo export --platform android` | pass (single 5.3 MB Hermes bundle) |
| Security scan | `pnpm security:check` | pass (1 warning: local `.env` present, expected) |

Integration coverage includes:

- Unauthenticated access → 401.
- Owner A cannot read Owner B's organization site → 404.
- Staff blocked from owner/admin surfaces; platform admin allowed.
- Cookie mutation without CSRF token → 403.
- Suspended membership loses site access.
- Inside clock-in; replay → `DUPLICATE`; concurrent clock-ins → one active shift.
- Clock-in without location → `NEEDS_REVIEW`; clock-out then new clock-in.
- Scheduled tick: 404 when unconfigured; 401 for missing/prefix/wrong secret;
  422 for `max=0`; delivery with scheduled heartbeat and local mail adapter;
  second tick delivers nothing; two concurrent ticks do not double-deliver;
  cancelled incidents are not sent; location retention purges observations and
  strips event coordinates while keeping distance/outcome.
- Cron GET with `CRON_SECRET` succeeds and records a scheduled heartbeat; POST
  remains available to an external scheduler with the same secret.
- Staff report CRUD with author-only edit/delete, stale-version 409, owner read
  but not edit, cross-staff 404, and staff blocked from team scope.
- Clock-in rejected until the assignment is accepted; accept endpoint unblocks it
  and staff site lists expose `assignmentAcceptedAt`.
- One review per member per site (duplicate 409), author-only edit/delete,
  unassigned staff denied, and the average/mine payload.
- Team lead set/clear requires active staff already assigned; staff attempts are
  denied; an unassigned member returns 422.
- Owner self-inspection and staff inspector assignment produce `INSPECTION`
  reports; non-assignees cannot report; assigned staff produce `SITE` reports.
- Two outside readings during an active shift open a candidate incident, confirm
  after the grace interval, create one owner in-app alert and two queued outbox
  deliveries, and surface the alert in the owner's unread list.

## Vercel + Vercel Cron implementation

- The API is prebundled (`tsup` → `dist/serverless.js`) and exposed through a plain
  JS `server.js`; Vercel's Express preset does not transpile pnpm workspace
  TypeScript reliably, so no TS source is executed at runtime.
- `apps/api/vercel.json` declares a five-minute Vercel Cron for
  `GET /api/v1/internal/worker/tick`; Vercel supplies `CRON_SECRET` as the bearer
  token. The route also accepts `POST` from an external scheduler with
  `WORKER_TRIGGER_SECRET`, returns 404 when neither is configured, and uses
  constant-time comparison.
- `WORKER_SCHEDULE_SECONDS` defaults to `300` to match the cron. The admin health
  page derives its overdue threshold from it.
- `docs/deployment-vercel.md` covers Atlas setup, env tables, index verification,
  deployment order, cron cadence, secret rotation, and rollback.

## Not verified

These require credentials, hardware, or an authorized deployment and were
intentionally not executed:

1. **Production deployment.** Nothing has been deployed to Vercel or Atlas, and no
   real invitations, emails, or pushes have been sent.
2. **Physical-device behavior.** `docs/operations/device-test-record.md` has 22
   manual scenarios, all unrun: permissions, background tracking, OS throttling,
   push delivery, encrypted-queue restart, assignment acceptance, report and
   review flows, inspector assignment, keyless map rendering, account switching,
   large text, and screen reader behavior. Compile/bundle success is not device
   evidence.
3. **Owner/admin browser journey with real MFA enrollment.** The web console was
   built and compiled; an interactive walkthrough was not completed because it
   needs a human to scan a TOTP QR code.
4. **Real provider integration.** Resend and Expo Push paths are implemented but
   untested against live accounts; the webhook handler is tested only with unit
   fixtures.
5. **Restore drill.** `backup-restore.md` describes the procedure; it has not been
   executed against a real snapshot.
6. **Penetration testing, load testing, and DoS behavior.**
7. **Pixel comparison with the Figma design.** Layout was implemented from the
   spec; no side-by-side visual audit was recorded.
8. **`pnpm test:e2e:web`.** Suggested by the implementation guide, but no browser
   E2E harness is present. Web behavior is covered by build + manual review, not
   automation.

## Known limitations and triaged findings

No unaddressed critical/high code findings were identified in the areas tested.
The following are documented residual risks, not fixes to hide:

- CSRF token checking is skipped when the `Origin` header is absent (non-browser
  client assumption). A proxy that strips `Origin` weakens the control.
- Outbox delivery is at-least-once. A crash between provider acceptance and the
  `SENT` update can duplicate an email; Resend's idempotency key limits it, but
  push has no provider idempotency.
- The audit hash chain detects application-level edits; a database administrator
  can rewrite the whole chain.
- MFA reset is a manual database operation; there is no self-service recovery UI.
- Scheduled Actions can be disabled after 60 days of public-repo inactivity.
  Health reporting is passive; pair it with external monitoring.
- Location retention deletes observations and strips coordinates from evidence
  rows after `LOCATION_RETENTION_DAYS` (default 7). This is a policy choice; adjust
  it before production if payroll disputes need coordinates longer.
- The in-memory tick rate limiter is per instance (120/min each). That is adequate
  for a scheduler, not a substitute for edge protection.

## Recommended next steps

1. Create the Vercel projects and Atlas cluster, follow
   `docs/deployment-vercel.md`, and record the deployment as verified.
2. Run the device matrix on at least one Android and one iOS device using a
   development build.
3. Complete the owner MFA + console walkthrough in a browser.
4. Send one real Resend email and one Expo push in a staging project, then record
   the webhook delivery result.
5. Execute and record a restore drill.
6. Add `pnpm test:e2e:web` (Playwright) for sign-in, MFA, invite acceptance, alert
   review, and correction approval denial.
7. Set up external uptime monitoring against `/health/ready` and the admin health
   worker state.
