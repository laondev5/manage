# Backup and restore

Attendance, audit, and outbox data live in MongoDB (Atlas in the deployed
configuration). Nothing in the application keeps a second copy of attendance, so
database backups are the only recovery path. Treat this runbook as required
reading before the first production write.

## What must survive a restore

| Data | Restore consequence if lost |
| --- | --- |
| `shifts`, `attendanceEvents`, `corrections` | Payroll evidence; cannot be reconstructed |
| `auditEvents`, `auditHead` | Tamper evidence and investigation history |
| `outbox` | Pending alert deliveries; re-enqueue only from live incidents |
| `memberships`, `sites`, `assignments` | Authorization scope; a partial restore can widen access |
| Better Auth collections | Sessions, MFA enrolments, invitations |
| `observations` | Location history, retained `LOCATION_RETENTION_DAYS` by policy |

## Atlas tiers (choose deliberately)

- **M0 / M2 / M5 (free/shared):** no automated backups. Data can be lost if the
  cluster is deleted. Acceptable for demo/smoke only, and must be labeled as such.
- **M10+ (dedicated):** enable Cloud Backup (continuous snapshots + point-in-time
  restore). This is the minimum for real attendance data. Set the retention
  window to at least the longest payroll dispute window the business expects.
- Backups must be encrypted at rest (Atlas default) and access restricted to
  database administrators.

## Before a risky change

Create an on-demand snapshot named after the change, for example
`pre-2026-11-17-index-rollout`. Do not rely on "we can take one afterwards".

## Manual logical backup (any tier, including local)

Use a role with `read` on the database. Never paste the URI into a shell history
on a shared machine; prefer an env var.

```bash
export MANAGE_URI='mongodb+srv://<user>:<password>@<cluster>/<db>?retryWrites=true&w=majority'
mongodump --uri "$MANAGE_URI" --gzip --archive="manage-$(date +%Y%m%d-%H%M).gz"
```

`mongodump` is not a single cross-collection snapshot. On a busy database a dump
can contain a shift without its matching event. Prefer Atlas snapshots for
production; use `mongodump` for small databases, rehearsals, or as a secondary
copy while writes are paused.

## Restore procedure

1. **Announce and freeze writes.** Disable the Worker tick workflow (Actions →
   Worker tick → ⋯ → Disable workflow) and put the web/mobile apps into a
   maintenance state or stop traffic. Do not let the worker deliver alerts from a
   half-restored database.
2. **Restore into a scratch database first** (`manage_restore_check`), never
   directly over production on the first attempt:

   ```bash
   mongorestore --uri "$MANAGE_URI" --gzip --archive="manage-YYYYMMDD-HHMM.gz" \
     --nsFrom='manage.*' --nsTo='manage_restore_check.*'
   ```

3. **Verify the scratch copy:**
   - `pnpm db:indexes:verify` with `MONGODB_DB_NAME=manage_restore_check` must
     pass (indexes are part of the dump; verify before trusting it).
   - Spot-check invariants:
     ```js
     // mongosh
     db.shifts.aggregate([
       { $match: { status: 'WORKING' } },
       { $group: { _id: '$userId', n: { $sum: 1 } } },
       { $match: { n: { $gt: 1 } } },
     ])
     db.auditEvents.countDocuments()
     db.outbox.countDocuments({ state: { $in: ['PENDING', 'LEASED'] } })
     ```
     The first query must return nothing; the audit count must match the restore
     point.
   - Sign in to the console against the scratch database only if you can point a
     staging API at it. Never point production at the scratch database.
4. **Restore production.** If the database was dropped/replaced, restore the
   verified dump, then run `pnpm db:indexes:apply` followed by
   `pnpm db:indexes:verify` from a trusted machine.
5. **Handle outbox rows explicitly.** A restore can resurrect `SENT` rows or
   rewind `LEASED` leases to `PENDING`. This is safe for delivery (unique
   `logicalKey`, and the worker rechecks incident state) but may duplicate a
   provider message. Check:
   ```js
   db.outbox.find({ state: 'LEASED' }).forEach((row) =>
     print(row.logicalKey, row.leaseUntil, row.attempts))
   ```
   Leases expire on their own; do not hand-edit `attempts` unless you intend to
   bypass dead-lettering.
6. **Re-enable the worker** and run a manual tick (`curl` the endpoint with
   `WORKER_TRIGGER_SECRET`). Confirm `delivered`, `failed`, and `remaining` in
   the response.
7. **Smoke-test** one staff clock-in/out and one owner alert review against a
   test site, then re-enable normal traffic.

## Restore drill record

A full restore has **not** been performed in this repository's environment as part
of development. Before go-live:

1. Take a snapshot of staging.
2. Restore into a scratch database as above.
3. Record the actual durations, failures, and index-verification output in this
   file.

Until that drill is recorded, treat restore as untested.

## Point-in-time recovery (Atlas M10+)

Use the Atlas UI/API to restore to a timestamp after the last known-good write
and before the incident. Atlas restores into a new cluster; update
`MONGODB_URI` and redeploy, keeping the old cluster read-only until verification
completes. Re-run index verification and the smoke test before cutting over.

## Backup hygiene

- Store logical dumps encrypted (`age`/`gpg`) and outside the Vercel/GitHub
  accounts. A dump contains coordinates and password hashes.
- Test restore access quarterly with the least-privileged role.
- Rotate database credentials after any dump leaves a trusted machine.
- Delete dumps after the retention window; location data has a short
  `LOCATION_RETENTION_DAYS` policy in the application, and backups should not
  silently extend it.
