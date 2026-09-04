# Pagination Review

## Executive summary

The current implementation uses cursor (keyset) pagination and has the right basic shape:

1. Query `limit + 1` records.
2. Use the extra record to determine `hasMore`.
3. Return only the requested `limit` records.
4. Use the last returned record as `nextCursor`.

It compiles successfully with TypeScript. It is reusable in principle, but it should not be considered production-ready until the input validation, ordering, indexing, and cursor format are improved.

## Current implementation review

### Good practices already present

- Cursor pagination is preferable to offset pagination for large or frequently changing tables.
- Fetching `limit + 1` avoids an additional `COUNT(*)` query for the common `hasMore` case.
- `skip: 1` correctly prevents the cursor record from appearing again on the next page.
- The pagination helper is generic over records containing an `id`.
- The project query scopes results by `userId`, which is important for authorization.

### Problems and risks

#### 1. `limit` is not safely parsed or bounded

`Number(limit)` becomes `NaN` when the query parameter is missing. Negative, zero, fractional, and excessively large values are also accepted. This can produce database errors or allow expensive requests.

Use a default and enforce a maximum, for example:

```ts
const limit = Math.min(Math.max(parsedLimit ?? 20, 1), 100);
```

Prefer validating the raw query with Zod before the controller calls the service. Invalid input should return `400`, not become a generic `500` response.

#### 2. The sort order is not fully deterministic

The query orders only by `createdAt`. Two projects can have the same timestamp, so their relative order is undefined. A cursor based on only `id` can then skip or repeat records between requests.

Use a unique tie-breaker:

```ts
orderBy: [
  { createdAt: 'desc' },
  { id: 'desc' },
]
```

For the strongest design, encode both `createdAt` and `id` in the cursor and apply the matching keyset condition. The cursor must represent the complete sort position.

#### 3. The database has no pagination index

The query filters by `userId` and sorts by `createdAt`. Add an index matching that access pattern:

```prisma
model Project {
  // fields...
  @@index([userId, createdAt, id])
}
```

If the endpoint excludes archived records, include `status` in the query and consider an index designed for that filter, based on the actual query plan and data distribution.

#### 4. The `cursor` argument in `PaginateResults` is unused

Remove it from the helper. The helper only needs `results` and `limit`; the service is responsible for constructing the database query.

#### 5. The cursor is an exposed database ID

Using a UUID as a cursor is functional, but an opaque cursor is a better public API. Encode the complete cursor state, such as `{ createdAt, id, filterHash }`, using base64url and optionally sign it. This prevents clients from depending on database implementation details and detects tampered or stale cursors.

#### 6. The response naming is inconsistent

The helper returns `result`, while the endpoint returns `projects`. Define one response contract for all list endpoints, for example:

```json
{
  "data": [],
  "pagination": {
    "hasMore": true,
    "nextCursor": "..."
  }
}
```

#### 7. Filtering behavior is unclear

The endpoint currently returns all project statuses. If deletion means archiving, most user-facing list APIs should explicitly decide whether archived projects are included. Any filter or sort option must be included in the cursor state or rejected when it changes between requests.

#### 8. Mutable data can change page results

Cursor pagination gives good navigation performance, but it is not automatically a fixed snapshot. Inserts and updates between requests can change what a client sees. This is usually acceptable for feeds and admin lists; use a snapshot/version or a stable time boundary when a report must be repeatable.

## Can this component be reused for other APIs?

Yes, with an important distinction:

- The `limit + 1` trimming helper can be reused across projects, API keys, users, events, and admin lists.
- The database pagination query cannot be copied blindly. Each resource needs a deterministic sort, a matching cursor, authorization scope, filters, and a suitable index.

The reusable abstraction should accept a resource-specific query result and return a standard page envelope. The resource service should own the Prisma `where`, `orderBy`, cursor decoding, and index-compatible query.

For small tables or simple back-office screens, offset pagination (`page` and `offset`) is easier for jumping to a page. For large tables, infinite scrolling, feeds, and frequently changing data, cursor pagination is usually the better choice.

## Recommended service shape

```ts
const pageSize = Math.min(Math.max(input.limit ?? 20, 1), 100);

const rows = await prisma.project.findMany({
  where: { userId: input.userId, status: 'ACTIVE' },
  take: pageSize + 1,
  ...(input.cursor ? { cursor: decodeCursor(input.cursor), skip: 1 } : {}),
  orderBy: [
    { createdAt: 'desc' },
    { id: 'desc' },
  ],
});

const hasMore = rows.length > pageSize;
const data = hasMore ? rows.slice(0, pageSize) : rows;
const last = data.at(-1);

return {
  data,
  pagination: {
    hasMore,
    nextCursor: hasMore && last
      ? encodeCursor({ createdAt: last.createdAt, id: last.id })
      : null,
  },
};
```

The exact Prisma cursor representation may need a composite unique key or an equivalent `where` condition for the chosen schema. Verify it with the generated Prisma client and an `EXPLAIN ANALYZE` query against realistic data.

## Good and bad pagination practices

### Good practices

- Validate and cap page size.
- Use a deterministic, unique ordering.
- Create an index matching filters and sort columns.
- Return `hasMore` and a nullable `nextCursor`.
- Make cursors opaque and include all sort/filter state.
- Scope every query by the authenticated tenant/user.
- Select only the columns needed by the endpoint.
- Test first page, middle page, final page, invalid cursor, duplicate timestamps, deleted rows, and empty results.
- Document whether cursors are single-use, expire, or remain valid after mutations.

### Bad practices

- Trusting `limit` directly from the URL.
- Ordering by a non-unique column only.
- Running an expensive total count for every request when the UI does not need it.
- Using offset pagination for very deep pages in a large table without measuring it.
- Returning database internals as a public cursor contract.
- Allowing arbitrary client-selected sort fields without an allowlist and matching indexes.
- Performing N+1 queries while serializing each page item.
- Returning different pagination field names from different endpoints.

## Advanced backend optimization concepts

### Keyset pagination

Keyset pagination seeks from the last sort key rather than scanning and discarding all earlier rows. It remains fast for deep pages when the index matches the query.

### Composite indexes and covering indexes

Put equality-filter columns first, followed by ordering columns. A covering index can include frequently returned scalar fields, reducing table lookups, but it increases write and storage cost. Confirm the benefit with query plans.

### Query-plan inspection

Use PostgreSQL `EXPLAIN (ANALYZE, BUFFERS)` on representative queries. Look for index scans, rows removed by filtering, sort operations, and unexpected sequential scans.

### Avoiding total counts

`hasMore` from `limit + 1` is cheap. If the UI needs a total, calculate it separately, cache it, return an estimate, or make it an explicit optional request because exact counts can be expensive on large or heavily filtered data.

### Consistency and snapshots

For exports and financial/audit reports, use a repeatable snapshot, a transaction isolation strategy, or a fixed upper-bound timestamp. Normal interactive lists can generally accept eventual changes between page requests.

### Caching and read scaling

Cache stable, public list responses carefully. For tenant-specific data, include tenant and filter identity in the cache key. Read replicas can scale reads, but replica lag means the next page may temporarily be behind the previous page.

### Bounded APIs and abuse protection

Enforce maximum page size, request timeouts, rate limits, query complexity limits, and field-selection allowlists. These controls protect the database from accidental or malicious expensive requests.

## Production-grade application practices

Pagination performance depends on the whole application. A fast query can still fail in production if connections, migrations, errors, security, and recovery are not managed correctly.

### API and application practices

#### Validate at the boundary

Validate route parameters, query parameters, request bodies, cursor contents, enum values, and sort fields with Zod. Do not rely on TypeScript types for runtime input; TypeScript types disappear after compilation.

For pagination, validate:

- `limit`: integer from `1` to a documented maximum such as `100`.
- `cursor`: a valid opaque cursor with a maximum length.
- `sort`: an allowlisted value only.
- filters: correct type, length, and allowed combinations.

Return a structured `400` response for invalid input and never pass unchecked values into a database query.

#### Use one error-handling policy

Use a central Express error middleware. Map validation errors to `400`, authentication failures to `401`, authorization failures to `403`, missing resources to `404`, conflicts to `409`, rate limits to `429`, and unexpected failures to `500`. Log internal details but do not expose SQL, stack traces, tokens, or passwords to clients.

#### Make list endpoints predictable

Document default and maximum page size, sort direction, filter behavior, cursor expiry, whether archived records are included, and whether results are snapshot-consistent. Keep the response envelope identical across resources.

#### Prevent N+1 queries

Use Prisma `include` or a batched query when related data is needed. Do not query each project separately for its API keys. Select only required fields with `select`, especially never returning password hashes, refresh-token hashes, or API-key hashes.

#### Add observability

Record request ID, authenticated user/tenant ID, route, status code, latency, result count, database duration, and error category. Track slow queries and pagination usage. Redact credentials and personally identifiable information from logs.

#### Add timeouts and rate limits

Set request, database, and transaction timeouts. Rate-limit authentication, API-key operations, and expensive list/filter endpoints. A maximum `limit` is necessary but not sufficient protection against abusive filters or repeated requests.

## Database techniques that should be implemented

The following checklist describes what to do for this PostgreSQL/Prisma application.

### 1. Use constraints as the final integrity boundary

Application validation improves messages, but database constraints prevent invalid data during races or when another client writes directly.

Recommended checks for this schema:

- Keep primary keys and foreign keys on every relationship.
- Decide whether `User.username` must be unique; if so, add `@unique`.
- Add unique constraints for business identifiers, not only technical IDs.
- Add `NOT NULL` to fields that are always required.
- Add database `CHECK` constraints for values such as non-empty names where appropriate.
- Define foreign-key delete behavior explicitly. For example, decide whether deleting a user should restrict, cascade, or archive projects.
- Use enums for controlled states, as already done for roles and statuses.

Example:

```prisma
model User {
  id       String @id @default(uuid())
  username String @unique
  email    String @unique
}

model Project {
  id        String   @id @default(uuid())
  userId    String
  createdAt DateTime @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Restrict)

  @@index([userId, createdAt, id])
}
```

Do not add indexes or uniqueness assumptions without checking the existing data first; a migration can fail if duplicates already exist.

### 2. Design indexes from real query patterns

Create indexes for frequent `WHERE`, `JOIN`, and `ORDER BY` combinations. For this project:

- Projects by owner ordered by newest: `[userId, createdAt, id]`.
- API keys by project and status: `[projectId, status, createdAt]` if that is a frequent query.
- Events by project and time: `[projectId, createdAt, id]`.
- Unique lookup values: unique indexes on email, username, and key hash.

Index rules:

- Put equality filters first, then range/order columns.
- Include the tie-breaker used by cursor pagination.
- Avoid indexes on every column; each index increases storage and insert/update cost.
- Review unused and duplicate indexes.
- Use partial indexes when a small subset is queried frequently, for example active records only.
- Use covering indexes only after measuring table-lookup cost.

Always verify with `EXPLAIN (ANALYZE, BUFFERS)` using production-like row counts. An index is useful only if the planner chooses it and the write cost is justified.

### 3. Manage migrations safely

Use Prisma migrations as versioned, reviewed code:

```bash
npx prisma migrate dev --name add_project_pagination_index
npx prisma generate
npx prisma migrate deploy
```

Production rules:

- Run migrations in CI/CD before the application requires the new schema.
- Back up before high-risk migrations.
- Keep migrations small and reversible where possible.
- Do not edit an already-applied migration; create a new migration.
- Avoid long table locks during business hours.
- For large tables, create indexes concurrently with a reviewed SQL migration when appropriate.
- Use the expand/contract pattern: add compatible schema, deploy code that supports both versions, backfill, switch reads/writes, then remove old schema later.
- Test migrations against a production-sized copy, not only an empty local database.

### 4. Use transactions for multi-step business operations

If multiple writes must succeed or fail together, use `prisma.$transaction`. Examples include creating a project and its initial API key, rotating a key, or changing status plus writing an audit event.

Keep transactions short. Do not make network calls, send emails, or wait for user input inside a transaction. Use an outbox table when a database change must reliably produce a message or webhook.

### 5. Handle concurrent writes correctly

Avoid a read-then-write race for uniqueness, balances, quotas, or status transitions. Prefer a database unique constraint and handle the conflict, or use an atomic `UPDATE ... WHERE ...` operation.

For operations that require locking, use the smallest possible scope and consistent lock order. Keep retry logic for transient serialization/deadlock failures bounded and idempotent.

Choose isolation deliberately:

- `Read Committed` is usually adequate for ordinary CRUD.
- `Repeatable Read` can provide a stable multi-query view.
- `Serializable` protects complex invariants but requires retries and can reduce throughput.

### 6. Use connection pooling correctly

Use one Prisma client per process, not one client per request. Configure the PostgreSQL pool for the deployment size. The total connections across all application instances must fit the database limit.

For serverless or highly scaled deployments, use a managed pooler such as PgBouncer or the provider's connection pool. Monitor connection saturation, wait time, idle connections, and transaction duration.

### 7. Protect secrets and sensitive database data

- Store passwords with a slow password hash such as bcrypt; never store plaintext passwords.
- Store API keys as hashes and show the raw key only once.
- Encrypt TLS connections to PostgreSQL.
- Keep `DATABASE_URL`, JWT secrets, and encryption keys in a secret manager.
- Rotate secrets and revoke compromised tokens.
- Restrict database credentials by environment and least privilege.
- Separate migration credentials from runtime read/write credentials where practical.
- Ensure logs, backups, and staging copies do not leak secrets or unnecessary PII.

### 8. Build backup and disaster recovery procedures

Enable automated backups and point-in-time recovery. Define a recovery point objective (maximum acceptable data loss) and recovery time objective (maximum acceptable downtime).

Backups are not complete until restoration is tested. Regularly restore into an isolated environment, verify row counts and application startup, and document who performs the recovery and how credentials are rotated.

### 9. Maintain PostgreSQL health

Monitor table/index growth, cache hit ratio, slow queries, locks, dead tuples, autovacuum activity, replication lag, and disk usage. Keep autovacuum and analyze working; stale statistics lead to poor query plans.

Archive or delete old data according to a documented retention policy. Partition very large append-only tables by time only after measuring that a single table and suitable indexes are insufficient. Partitioning adds operational complexity and is not a default optimization.

### 10. Choose consistency and replicas deliberately

Read replicas improve read capacity but can lag. Do not send a read-after-write request to a replica when the user must immediately see the write. Route consistency-sensitive reads to the primary or use a replication-lag-aware strategy.

For report/export endpoints, use a fixed `createdAt` upper bound or a database snapshot so later pages cannot unexpectedly include newly inserted rows.

### 11. Cache carefully

Cache only data that can tolerate staleness. Include user/tenant identity, filters, sort, and cursor in the cache key. Invalidate or version keys after writes. Never share a private user's response through a public cache key.

Use database query optimization before adding a cache. Caches add invalidation, memory, and consistency complexity.

### 12. Test database behavior, not only TypeScript

Add integration tests against PostgreSQL for:

- first, middle, final, and empty pages;
- invalid, expired, and tampered cursors;
- duplicate `createdAt` values;
- inserts, updates, and archived rows between page requests;
- authorization isolation between users;
- transaction rollback;
- unique-constraint conflicts;
- migration success on realistic data;
- query performance at expected row counts.

Use seed data with identical timestamps and enough rows to force multiple pages. Unit tests for the trimming helper are useful, but they cannot prove the Prisma query is indexed or correctly ordered.

## Database production checklist

Before release, confirm:

- [ ] Required foreign keys, unique constraints, and non-null rules exist.
- [ ] Pagination has a deterministic order and matching index.
- [ ] Query plans have been reviewed with realistic data.
- [ ] Page size, filters, cursors, and sort fields are validated.
- [ ] Prisma migrations are committed and tested.
- [ ] No request creates a new Prisma client.
- [ ] Transactions cover related writes and remain short.
- [ ] Slow queries, errors, locks, pool usage, and replication lag are monitored.
- [ ] Automated backups and point-in-time recovery are enabled.
- [ ] Restore procedures have been tested.
- [ ] Secrets are stored outside source control and logs are redacted.
- [ ] Authorization is enforced in every resource query.
- [ ] Integration tests cover pagination under concurrent data changes.

## Priority order

1. Add Zod validation, defaults, and a maximum `limit`.
2. Make ordering deterministic with a unique tie-breaker.
3. Add and migrate the matching Prisma index.
4. Standardize the response envelope and remove the unused helper argument.
5. Move to opaque composite cursors.
6. Add pagination tests and inspect query plans with realistic data.

For the broader production hardening work, implement constraints and indexes first, then migrations and integration tests, followed by pooling/observability, backups/recovery, and finally caching or replicas when measurements show they are needed.
