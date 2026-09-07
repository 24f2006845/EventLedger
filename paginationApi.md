# Production-Grade Paginated API Roadmap

This is the focused implementation plan for reusable cursor pagination in EventLedger.

## 1. Define one response contract

Every paginated endpoint returns:

~~~json
{
  "data": [],
  "pagination": {
    "limit": 20,
    "hasMore": true,
    "nextCursor": "opaque-cursor"
  }
}
~~~

Why: frontend code, tests, and future APIs use one predictable format.

## 2. Build shared pagination utilities

Keep these files under Backend/src/shared/pagination/:

~~~text
pagination.types.ts       response types
pagination.validation.ts  limit and cursor validation
pagination.cursor.ts      encode/decode cursor
Pagination.ts             limit + 1 page helper
index.ts                  shared exports
~~~

The shared helper should be generic:

~~~ts
createPaginatedResponse<T>(
  rows: T[],
  limit: number,
  getCursor: (item: T) => string,
): PaginatedResponse<T>
~~~

It must not contain Project, Event, API Key, or Prisma-specific logic.

## 3. Validate every request

~~~ts
const PaginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().min(1).max(2000).optional(),
});
~~~

Use this in every controller:

~~~ts
const query = PaginationSchema.parse(req.query);
~~~

Why: query parameters arrive as strings. Validation prevents NaN, negative limits, huge queries, and malformed cursors. Invalid input returns 400.

## 4. Use a deterministic cursor

Order every page by:

~~~ts
orderBy: [
  { createdAt: "desc" },
  { id: "desc" },
]
~~~

The cursor must contain both ordering values:

~~~json
{
  "version": 1,
  "resource": "projects",
  "id": "project-id",
  "createdAt": "2026-09-08T10:00:00.000Z"
}
~~~

Encode it as base64url and validate it after decoding. Why: timestamps can be equal, so id is the unique tie-breaker that prevents duplicates or skipped records.

## 5. Build the Prisma query

Every resource query must:

1. Apply authorization filters.
2. Fetch limit + 1 rows.
3. Use deterministic ordering.
4. Apply the cursor for later pages.
5. Use skip: 1 so the cursor row is not repeated.
6. Select only fields needed by the response.

Example:

~~~ts
const rows = await prisma.project.findMany({
  where: {
    userId: authenticatedUserId,
    status: "ACTIVE",
  },
  take: limit + 1,
  orderBy: [
    { createdAt: "desc" },
    { id: "desc" },
  ],
});
~~~

Then pass rows to the shared page helper. The controller returns that result directly.

## 6. Add matching Prisma constraints and indexes

The filter, order, cursor, and index must match.

For Projects:

~~~prisma
@@unique([userId, createdAt, id], name: "project_page_cursor")
~~~

For API Keys:

~~~prisma
@@unique([projectId, createdAt, id], name: "api_key_page_cursor")
~~~

Why: Prisma needs a unique cursor position, and PostgreSQL needs an index supporting the filter and order.

Run:

~~~bash
npx prisma migrate dev --name add_pagination_constraints
npx prisma generate
~~~

Use migrate deploy in production. Verify with EXPLAIN (ANALYZE, BUFFERS) using realistic data.

## 7. Finish Projects first

Flow:

~~~text
route
-> authentication
-> pagination validation
-> controller
-> project service
-> Prisma
-> shared page helper
-> common response
~~~

Project authorization:

~~~text
userId = authenticated user
cursor/index = userId + createdAt + id
~~~

The controller must return the service result directly:

~~~ts
const result = await getAllProjectsService(input);
return res.status(200).json(result);
~~~

Do not convert it to { projects, nextCursor, hasMore }; that breaks the common contract.

## 8. Apply the pattern to other APIs

Share the types, validation, cursor utilities, helper, and response format. Change the Prisma filter, authorization relationship, cursor resource name, and index.

### API Keys

Relationship:

~~~text
User -> Project -> ApiKey
~~~

API keys do not need userId. Authorize through the Project:

~~~ts
where: {
  projectId,
  project: {
    userId: authenticatedUserId,
  },
}
~~~

Cursor/index: projectId + createdAt + id.

### Events

If Events belong to Projects:

~~~ts
where: {
  projectId,
  project: {
    userId: authenticatedUserId,
  },
}
~~~

Cursor/index: projectId + createdAt + id.

### Admin APIs

Admin endpoints use role authorization and allowlisted filters. They still use limit + 1, deterministic ordering, cursor continuation, and the common response. Their index must match the filters plus createdAt + id.

## 9. Test and verify

Test every resource for:

- empty, first, middle, and final pages;
- fewer than, equal to, and greater than limit;
- invalid limits and cursors;
- duplicate timestamps;
- records inserted or archived between requests;
- user/project authorization;
- consistent { data, pagination } responses.

Also verify:

~~~text
migration succeeds
composite cursor exists
EXPLAIN shows the intended index
maximum page size is acceptable under load
~~~

## Final implementation order

~~~text
1. Finalize shared response types.
2. Add validation.
3. Harden cursor encode/decode.
4. Finish the shared page helper.
5. Fix Project ordering, cursor, and response shape.
6. Add Project Prisma constraint/index.
7. Add Project integration tests and query-plan check.
8. Add API Key pagination with project.userId authorization.
9. Add Events pagination with project authorization.
10. Add Admin pagination with role protection.
11. Add rate limits, timeouts, slow-query logs, and monitoring.
~~~

Production-grade pagination is:

~~~text
validated input
+ deterministic cursor
+ correct Prisma query
+ authorization in the database filter
+ matching database index
+ common response format
+ tests and query-plan verification
~~~
