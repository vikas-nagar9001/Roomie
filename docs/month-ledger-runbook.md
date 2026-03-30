# Month ledger (accounting) runbook

## Concepts

- **`accountingMonth`**: string `YYYY-MM` (calendar month of the row’s business date, or bill period).
- **`lifecycleStatus`**: `active` | `archived` — archived rows are part of a closed period (immutable via API guards).
- **`FlatMonth`**: one document per `(flatId, monthKey)` with `status: active | locked`.
- **`isDeleted`**: soft delete only; documents stay in MongoDB.
- **`MonthlyHistory`**: optional snapshot for fast reads; closing a month still writes a snapshot when configured.

## Migration

1. Backup the database (your usual process).
2. Deploy code that understands the new fields (backward compatible: missing fields are treated as “active” / not deleted).
3. Run:

```bash
npm run migrate:ledger
```

4. **Consistency pass** (recompute `accountingMonth` from dates, dedupe multiple `FlatMonth` actives, backfill penalty `incurredAt`, sync indexes):

```bash
npm run migrate:consistency
```

Run **after** `migrate:ledger` in production, or whenever you need to fix drift.

## Single active FlatMonth

- At most one `FlatMonth` per flat may have `status: "active"` (partial unique index).
- On each write, `assertAccountingMonthOpen` / `prepareFlatMonthForWrite` will **auto-close** an **older** active month (lexicographic `YYYY-MM`) via `closeFlatMonth` before opening the target month.
- If a **newer** month is still active, writes to an older month return **409** `{ "error": "NEWER_MONTH_ACTIVE", ... }`.

## accountingMonth source of truth

| Entity   | Derived from |
|----------|----------------|
| Entry    | `dateTime` |
| Bill     | `month` + `year`, else `dueDate` |
| Payment  | Parent bill’s derived month |
| Penalty  | `incurredAt` (default create time), else `createdAt` |

Client-supplied `accountingMonth` is **ignored** on create/update.

4. Optional — lock every month strictly before the current calendar month (creates/updates `FlatMonth` and archives rows):

```bash
MIGRATION_ACTOR_USER_ID=<mongo ObjectId of admin user> npm run migrate:ledger -- --lock-past-months
```

If `MIGRATION_ACTOR_USER_ID` is omitted, months are still closed but `closedBy` may be empty.

## API (summary)

- `GET /api/flat-months` — list period states for the flat.
- `POST /api/flat-months/:monthKey/close` — snapshot (if applicable) + archive rows + lock month.
- `POST /api/flat-months/:monthKey/reopen` — **ADMIN** only; unlocks month for edits (use sparingly).

Mutations on entries, penalties, bills, and payments for a locked `accountingMonth` return **403** with body:

```json
{ "error": "MONTH_LOCKED", "message": "This month is locked and cannot be modified" }
```

Archived rows (`lifecycleStatus: "archived"`) use the same `error` code on writes.

## Query examples (MongoDB)

**Current workspace (active period rows only, hide soft-deleted):**

```js
db.entries.find({
  flatId: ObjectId("..."),
  $and: [
    { $or: [{ lifecycleStatus: { $ne: "archived" } }, { lifecycleStatus: { $exists: false } }] },
    { $or: [{ isDeleted: { $ne: true } }, { isDeleted: { $exists: false } }] },
  ],
});
```

**Single month audit trail (include archived, exclude deleted):**

```js
db.entries.find({ flatId: ObjectId("..."), accountingMonth: "2026-03", isDeleted: { $ne: true } });
```

**Locked months:**

```js
db.flatmonths.find({ flatId: ObjectId("..."), status: "locked" });
```

## Edge cases

- Rows missing `accountingMonth`: migration backfills from `dateTime` / `createdAt` / bill `month+year`; until then, guards may treat month as derivable from dates.
- **`$or` at same level**: application code uses `$and` of `ledgerExtraMatch` clauses; do not duplicate top-level `$or` keys in raw queries.
- Reopen month: restores editability; does not delete snapshots — reconcile mentally with any exported reports.

## Auto-close

- **Rollover** (penalty checker): on first run after the calendar month changes, auto-snapshot runs for every flat; **closing** the previous month runs only if `AUTO_CLOSE_PREVIOUS_ACCOUNTING_MONTH` is not set to `false`/`0`/`off`/`no`. When unset, behaviour matches legacy (close enabled).
- **Daily cron**: a safety tick runs every 24h and closes the **previous** calendar month for any flat where it is still open (same env gate).

Ensure server timezone matches your definition of “month” for boundaries.

## Manual close (alternate path)

`POST /api/months/:flatId/:month/close` — same as `POST /api/flat-months/:monthKey/close` with explicit `flatId`; `month` must be `YYYY-MM`. Caller’s `flatId` must match their session flat.
