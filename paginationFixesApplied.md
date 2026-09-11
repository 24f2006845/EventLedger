# Pagination Fixes Applied

This document records the production-hardening changes applied to the shared pagination utilities and Project list API.

## 1. Strict cursor payload type

The cursor version is now the literal value `1`, not any number. This prevents unsupported cursor formats from being treated as valid.

The cursor contains:

```ts
{
  version: 1,
  resource: "project",
  createdAt: string,
  id: string
}
```

The resource identifies which endpoint created the cursor. A Project cursor cannot silently be reused by an Events or API Keys endpoint.

## 2. Cursor payload validation

The decoder now validates the decoded JSON with Zod:

- version must be `1`;
- resource must be non-empty;
- createdAt must be a valid ISO datetime;
- id must be a UUID.

Before this change, any valid JSON could be accepted as a cursor, including invalid dates and IDs.

## 3. Invalid cursor errors now return HTTP 400

Base64 errors, JSON parsing errors, invalid cursor fields, wrong resources, and unsupported versions are converted to `AppError` with status `400`.

Before this change, JSON parsing produced a normal `SyntaxError`. The controller treated that as an unexpected error and returned `500`.

## 4. Query validation now returns HTTP 400

The Project controller now uses `PaginationSchema.safeParse()`.

Invalid values such as these return `400`:

```text
limit=abc
limit=-1
limit=1000
cursor=<invalid value>
```

The previous `if (!parsedQuery)` check was ineffective because `.parse()` throws before returning an empty value.

## 5. Page size is bounded

The maximum page size is now `100`. This protects the database and response payload from unexpectedly large requests.

## 6. The controller preserves the common response

The Project controller now returns the service result directly:

```ts
return res.status(200).json(result);
```

Every paginated API therefore keeps the same format:

```json
{
  "data": [],
  "pagination": {
    "limit": 20,
    "hasMore": true,
    "nextCursor": "..."
  }
}
```

## 7. Existing database pagination remains aligned

The Project query still uses:

```text
filter: userId + ACTIVE status
order: createdAt DESC, id DESC
fetch: limit + 1
continue: composite Project_page_cursor_unique + skip: 1
```

The schema constraint is:

```prisma
@@unique([userId, createdAt, id], name: "Project_page_cursor_unique")
```

This gives Prisma an exact cursor position and gives PostgreSQL a supporting unique index.

## 8. Remaining verification

The implementation should still be verified with:

1. TypeScript compilation.
2. Prisma schema validation.
3. First, next, and final page integration tests.
4. Invalid cursor and invalid limit tests.
5. Duplicate timestamp tests.
6. Authorization tests between users.
7. `EXPLAIN (ANALYZE, BUFFERS)` on realistic data.

The implementation is production-ready only after the behavior is covered by tests and the database query plan confirms that the composite cursor constraint is being used efficiently.
