# Manage — repository instructions

Manage is a corporate site-attendance system. Staff clock in and out in an Expo
mobile app; site owners use the mobile app for oversight and departure alerts;
platform administrators use a Next.js web console. The product is named exactly
**Manage** (never KhemSafe).

`MANAGE_BUILD_PROMPT.md`, `IMPLEMENTATION_GUIDE.md`, and `Design.md` at the repo
root are the product specification. They describe required behavior, not proof
that it exists. Current explicit user requirements override earlier research
suggestions.

## Layout

```
apps/api        Express composition, Better Auth, /api/v1 routes, webhooks, scripts
apps/worker     Long-running outbox/reconciliation loop (local and container use)
apps/web        Next.js App Router console (owner + platform admin)
apps/mobile     Expo Router app (staff + owner oversight)
packages/contracts   Zod DTOs, error codes, API types; no secrets or DB access
packages/api-client  Platform-neutral transport with injected auth
packages/tokens      Brand colors, type scale, spacing
packages/domain      Use cases and authorization policy; server-only
packages/database    Mongo driver, collections, repositories, indexes; server-only
packages/worker-core Delivery + tick logic shared by apps/worker and the API
```

## Stack (as installed)

- TypeScript 5.9 strict (`noUncheckedIndexedAccess`), pnpm workspace, Node >= 22.
- Expo SDK 58, Expo Router, React Native 0.88, NativeWind 4.
- Next.js 16 App Router, React 19, Tailwind 4.
- Express 5, Better Auth 1.7 with the MongoDB adapter, two-factor TOTP, and the
  Expo plugin. Resend for email, Expo Push for notifications.
- Official `mongodb` driver 7. Replica set required (transactions). Transactional
  outbox with leases; no Redis, no ORM.
- Zod is the only schema/validation layer shared across apps. There is no query
  library: web uses `lib/use-api-data.ts`, mobile uses `lib/hooks.ts`.

## Non-negotiable product behavior

- Attendance, presence, and sync status are separate states. Never collapse them.
- Leaving a site does not clock a worker out or reduce payable time.
- Missing or stale GPS is **unknown**, never absence. A departure alert is a
  review prompt, not a determination of misconduct.
- Clock-out works without a location fix. Stop device collection on local clock-out.
- One active accepted shift per user, enforced atomically in MongoDB.
- Original attendance records are append-only; corrections are audited amendments.
  Nobody may approve their own correction.
- Never promise instant alerting or reliable tracking after a force-quit.
- Offline records show as pending and sync once with durable client IDs.
- First-use steppers are functional setup, not a tour; they never grant access.
- Brand: navy `#101D35`, cobalt `#2457D6`, canvas `#F5F7FB`, ink `#14213D`, muted
  `#526078`, amber/red warnings, blue checks. **No green, mint, or teal.**
- Web console must be keyboard-usable and readable with large text; native screens
  must work with OS font scaling and screen readers.

## Security rules

- Deny by default. Centralize authorization in `packages/domain` and
  `apps/api/src/http/context.ts`; constrain every query, aggregate, export, and
  job by verified organization/site/subject scope.
- Never trust roles, user IDs, organization IDs, site assignments, presence flags,
  or coordinates from client state. Re-resolve them per request.
- No public admin signup (`/api/auth/sign-up` is blocked). Owners invite staff only
  to sites they manage. Owners cannot grant platform-admin status or widen their
  own scope.
- Owners and platform admins require TOTP MFA before owner/admin surfaces work,
  and the server rechecks it per request.
- Cookie-authenticated browser mutations require the CSRF token from `/api/v1/csrf`
  (HMAC of the session id) plus an allowlisted `Origin`.
- Browser sessions: HttpOnly secure cookies. Native sessions: SecureStore through
  the Better Auth Expo integration.
- The offline queue is AES-256-GCM encrypted with a key kept in SecureStore
  (`apps/mobile/src/lib/secure-store.ts`). Never persist coordinates or tokens in
  plain AsyncStorage or unencrypted state.
- Validate every request body/query with a Zod schema and build Mongo filters and
  updates explicitly. Never pass client operators or aggregation stages through.
- Preserve raw request bytes for Resend webhook signature verification.
- Recompute notification recipients at delivery time; do not trust the recipient
  captured when an incident opened.
- Never put secrets in `NEXT_PUBLIC_*` or `EXPO_PUBLIC_*`. Never log request
  bodies, coordinates, tokens, invitation links, or MFA secrets. pino redaction
  covers auth/cookie/CSRF/worker-secret headers; keep it that way.
- Audit history is an append-only hash chain. Describe its limits honestly: it
  detects edits made outside the app, not a compromised database administrator.
- Do not claim production readiness, uptime, or regulatory compliance without
  measured evidence.

## Workflow

1. Read the relevant code and specs before changing behavior.
2. For anything non-trivial, write a short plan; keep it current.
3. Build or extend a vertical slice (UI → API → database) before broadening.
4. Add tests for authorization denial, state transitions, replays, and races —
   not only happy paths.
5. After changes run: `pnpm lint`, `pnpm typecheck`, `pnpm test`,
   `pnpm test:integration` (requires the in-memory Mongo download on first run),
   and the affected `pnpm build`.
6. Record external dependencies and unverified device/provider behavior in
   `docs/operations/device-test-record.md`.
7. Keep `docs/`, `.env.example`, `apps/api/openapi.yaml`, index scripts, and
   runbooks current when behavior changes.

Do not rewrite unrelated files, swap working dependencies without cause, expose
credentials, send real invitations, or deploy production changes without
authorization. A missing credential is a reason to use a clearly labeled local
adapter, never to fake integration success.

## Commands

```bash
pnpm install
pnpm db:dev              # in-memory single-node replica set on :27017
pnpm seed                # two organizations, demo accounts, invitation token
pnpm dev                 # API :4000 + web :3000
pnpm dev:worker          # long-running loop (optional when using the tick endpoint)
pnpm dev:mobile          # Expo dev server (prints a QR code)
pnpm lint && pnpm typecheck && pnpm test && pnpm test:integration
pnpm security:check      # public-env secrets, client/server import boundary, committed URIs
pnpm db:indexes:verify   # compares required indexes with the live database
```

## Deployment

The API is designed for Vercel (prebundled `apps/api/server.js`, see
`docs/deployment-vercel.md`). Vercel Cron calls
`GET /api/v1/internal/worker/tick` with `CRON_SECRET`
(`apps/api/vercel.json`, every five minutes). Keep the schedule, secret, and
`WORKER_SCHEDULE_SECONDS` consistent, or the admin health page will report the
worker as overdue.
