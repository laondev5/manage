# Incident runbook

Operational procedures for the deployed topology: Vercel API + web, MongoDB
Atlas, Vercel Cron worker, Resend, Expo Push. Commands assume `MANAGE_API_URL`
and `CRON_SECRET` are exported in your shell and that `mongosh "$MANAGE_URI"` is
available for read-only checks.

Never print secrets. `set +o history` before pasting a secret into a shell.

## 1. Worker overdue or alerts not sending

**Symptoms:** Admin → Health shows worker `overdue`; outbox `PENDING` grows; no
new email/push; Vercel Cron invocations are failing.

**Diagnose**

1. Admin → Health (also `GET /api/v1/admin/health` with an admin session) for
   `worker.lastHeartbeatAt`, `state`, `mode`, and outbox counts.
2. Vercel → API project → Cron Jobs: did the last run succeed? Is the `crons`
   entry present in the deployment?
3. Project environment: `CRON_SECRET` (or `WORKER_TRIGGER_SECRET` for an
   external scheduler) is set to the value the scheduler sends.
4. API health:
   ```bash
   curl -sS "$MANAGE_API_URL/health/ready"
   ```
5. Run one manual tick and read the JSON:
   ```bash
   curl -sS "$MANAGE_API_URL/api/v1/internal/worker/tick?max=40" \
     -H "Authorization: Bearer $CRON_SECRET"
   ```
   `401`/`404` means the secret or route is misconfigured; `503` means the tick
   ran but something failed — inspect `ok`, `failed`.

**Recover**

- Secret mismatch: rotate `CRON_SECRET` in Vercel, redeploy, trigger a tick.
- Route 404: neither `CRON_SECRET` nor `WORKER_TRIGGER_SECRET` is set. Set one
  (32+ chars), redeploy.
- Cron not firing: confirm the plan allows sub-daily schedules, then trigger a
  manual tick while the schedule is repaired.
- Backlog after recovery: call the endpoint with `?max=100` a few times; it is
  bounded per tick and reports `remaining`.
- Dead letters: review Admin → Health deliveries, then retry with
  `POST /api/v1/admin/deliveries/retry` (`outboxIds`, requires recent sign-in).
  Retrying is safe: incident state is rechecked before send.

## 2. Tick endpoint returning 429

The tick rate limit is 120 requests/minute per instance. Overlapping manual
retries can exceed it. Wait a minute and retry; scheduled ticks are far below
the limit.

## 3. API 503 / database unavailable

**Symptoms:** `/health/ready` returns 503 `PROVIDER_UNAVAILABLE`; sign-in fails;
Vercel function logs show Mongo timeouts.

1. Check Atlas cluster status and network access (the API's egress must be
   allowed; serverless egress is dynamic, so an IP allowlist entry is usually
   `0.0.0.0/0` with strong database credentials, or use PrivateLink).
2. Verify `MONGODB_URI`, `MONGODB_DB_NAME`, and pool size in Vercel.
3. If credentials were rotated, update Vercel and the worker/DB scripts, then
   redeploy.
4. If the database is being restored, follow `backup-restore.md` and pause the
   cron schedule first.
5. After recovery, run a manual tick and smoke-test one clock-in.

## 4. Compromised or leaked worker secret

1. Generate a new secret:
   `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.
2. Update `CRON_SECRET` (and `WORKER_TRIGGER_SECRET` if an external scheduler
   uses it) in Vercel and redeploy.
3. Expect failed ticks between the old and new deployments; that is safe (401).
4. Audit `outbox` for unexpected recent deliveries and `auditEvents` for admin
   actions in the exposure window.
5. Do not reuse the leaked value in logs, tickets, or chat.

## 5. Compromised `BETTER_AUTH_SECRET`

Rotating this secret invalidates sessions and CSRF tokens; every user must sign
in again. Rotating it also invalidates encrypted Better Auth state tied to the
secret.

1. Announce a maintenance window.
2. Update the secret in Vercel (32+ chars) and redeploy.
3. Revoke sessions in the database only if you must be certain:
   `db.session.deleteMany({})` — this is destructive and signs everyone out.
4. Verify sign-in, owner MFA challenge, and web CSRF flow afterwards.
5. Review audit entries for actions taken with the compromised secret.

## 6. Lost MFA device / owner locked out

There is no self-service MFA reset in this build. Backup codes are issued at
enrolment; use one if the owner still has them.

If no factor or backup code remains, a database administrator must remove the
affected user's `twoFactor` documents and active sessions. This is a privileged,
manual action:

```js
// mongosh, after confirming the user id with the user out-of-band
db.twoFactor.find({ userId: '<user id>' })
db.session.deleteMany({ userId: '<user id>' })
```

Do this with a second reviewer, record the request in `auditEvents` manually or
in the incident log, and have the owner re-enrol immediately on next sign-in.
Never disable MFA globally to unblock one account.

## 7. Bad deployment / rollback

1. Vercel → Deployments → previous healthy deployment → **Instant Rollback**
   (or promote it). Roll back the web project and API project separately if only
   one changed.
2. Database changes are additive by policy. If a release added an index, do
   **not** delete it during rollback; leaving an unused index is harmless.
3. If a release changed document shapes, rolling back code may leave newer
   documents unreadable by older code. Prefer roll-forward fixes for data shape
   changes; test the previous version against a snapshot first.
4. After rollback, run `/health/ready`, a manual tick, and one clock-in/out.

## 8. Resend webhook failing

- Resend → Webhooks: delivery failures usually mean signature mismatch or a 5xx.
- Confirm `RESEND_WEBHOOK_SECRET` matches the endpoint secret and that the API
  still mounts the raw-body route before `express.json`.
- The webhook only records delivery/complaint state (`lastError`, suppression
  signals). Missing it does not lose attendance; it degrades delivery
  observability.
- Replay a test event from Resend after fixing.

## 9. Suspected data exposure

1. Identify the route, user, and time window from `auditEvents` and request ids
   (`X-Request-Id` is returned to clients and logged).
2. Preserve logs and take an Atlas snapshot before further changes.
3. Rotate affected credentials (sections 4–5).
4. Check whether precise coordinates were exposed; location data is retained only
   for `LOCATION_RETENTION_DAYS` in observations and stripped from older evidence
   rows by the worker, but recent data is sensitive.
5. Follow your organization's breach notification obligations. Do not claim
   compliance status without evidence.

## 10. Post-incident

- Record: start/end time, detection source, customer impact, root cause, actions,
  and follow-up tests.
- Add a failing test for the condition if it was code-related.
- Update this runbook and `docs/operations/device-test-record.md` if behavior was
  previously untested.
- Verify the worker heartbeat and outbox are healthy before closing.
