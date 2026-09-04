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

## Priority order

1. Add Zod validation, defaults, and a maximum `limit`.
2. Make ordering deterministic with a unique tie-breaker.
3. Add and migrate the matching Prisma index.
4. Standardize the response envelope and remove the unused helper argument.
5. Move to opaque composite cursors.
6. Add pagination tests and inspect query plans with realistic data.

