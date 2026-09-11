# Project Pagination Implementation

This document describes the pagination implementation currently created in EventLedger.

## 1. Shared response format

Every paginated endpoint returns:

~~~json
{
  "data": [],
  "pagination": {
    "limit": 20,
    "hasMore": true,
    "nextCursor": "encoded-cursor"
  }
}
~~~

The generic response type is:

~~~ts
export interface PaginatedResponse<T> {
  data: T[];
  pagination: PaginationMeta;
}
~~~

The same type can be used for Projects, Events, API Keys, and Admin records.

## 2. Validate pagination input

File: Backend/src/shared/pagination/pagination.validation.ts

~~~ts
export const PaginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().min(1).max(2000).optional(),
});
~~~

This validates:

- limit is an integer;
- limit is between 1 and 100;
- missing limit becomes 20;
- cursor is optional;
- cursor cannot be empty or excessively long.

The Project controller uses safeParse. Invalid input returns HTTP 400 before Prisma is called.

## 3. Authenticate the user

The Project route uses authMiddleware:

~~~ts
router.get("/", authMiddleware, getAllProjectsController);
~~~

The controller gets the user ID from the verified access token:

~~~ts
const userId = req.user?.userId;
~~~

The client does not submit the owner user ID. This prevents a user from requesting another user's projects by changing a request parameter.

## 4. Define the cursor payload

The shared cursor type contains:

~~~ts
export interface CursorPayload {
  version: 1;
  resource: string;
  createdAt: string;
  id: string;
}
~~~

A Project cursor contains:

~~~json
{
  "version": 1,
  "resource": "project",
  "createdAt": "2026-09-12T10:00:00.000Z",
  "id": "project-uuid"
}
~~~

Version supports future cursor formats. Resource prevents a Project cursor from being used by an Events or API Keys endpoint.

## 5. Encode and validate cursors

File: Backend/src/shared/pagination/pagination.cursor.ts

The cursor is encoded as base64url so the client receives one opaque string.

The decoder:

1. Decodes base64url.
2. Parses JSON.
3. Validates version.
4. Validates resource.
5. Validates the ISO datetime.
6. Validates the UUID.
7. Converts malformed values to AppError with status 400.

The Project service calls:

~~~ts
decodeCursor(cursor, "project")
~~~

Invalid Base64, JSON, resource, version, date, or ID returns HTTP 400 instead of HTTP 500.

## 6. Shared page helper

File: Backend/src/shared/pagination/Pagination.ts

The helper receives rows, limit, and a cursor callback:

~~~ts
PaginateResults(rows, limit, getCursor)
~~~

The database returns limit + 1 rows.

Example:

~~~text
requested limit: 2
database rows: A, B, C
response data: A, B
hasMore: true
nextCursor: cursor for B
~~~

The third row proves another page exists. The helper removes the extra row and creates the cursor from the final returned row.

When there are no more rows:

~~~json
{
  "hasMore": false,
  "nextCursor": null
}
~~~

## 7. Deterministic ordering

The Project query uses:

~~~ts
orderBy: [
  { createdAt: "desc" },
  { id: "desc" },
]
~~~

The ordering means:

1. Newest createdAt first.
2. ID is used as the tie-breaker when timestamps are equal.

The cursor contains the same ordering fields:

~~~text
order fields: createdAt + id
cursor fields: createdAt + id
~~~

This prevents records from being repeated or skipped when two projects have the same timestamp.

## 8. Prisma composite cursor

The Project model contains:

~~~prisma
@@unique(
  [userId, createdAt, id],
  name: "Project_page_cursor_unique"
)
~~~

This combines:

~~~text
userId + createdAt + id
~~~

The fields represent:

- userId: authenticated owner scope;
- createdAt: primary sort position;
- id: unique tie-breaker.

The named constraint is used by Prisma:

~~~ts
cursor: {
  Project_page_cursor_unique: {
    userId,
    createdAt,
    id,
  },
}
~~~

The name in the Prisma schema and the name in the query must match exactly.

## 9. Project Prisma query

The Project service applies authorization and pagination together:

~~~ts
const projects = await prisma.project.findMany({
  where: {
    userId,
    status: "ACTIVE",
  },
  take: limit + 1,
  orderBy: [
    { createdAt: "desc" },
    { id: "desc" },
  ],
});
~~~

For a later page, it adds the composite cursor and skip:

~~~ts
cursor: {
  Project_page_cursor_unique: {
    userId,
    createdAt: new Date(decodedCursor.createdAt),
    id: decodedCursor.id,
  },
},
skip: 1
~~~

The user filter is inside Prisma, so unauthorized projects are not loaded into application memory.

## 10. Build the next cursor

The Project service passes a Project-specific callback to the shared helper:

~~~ts
(project) => encodeCursor({
  createdAt: project.createdAt.toISOString(),
  id: project.id,
  version: 1,
  resource: "project",
})
~~~

The helper remains reusable because it does not know anything about Project fields.

## 11. Controller response

The controller validates the request, gets the authenticated user, calls the service, and returns:

~~~ts
return res.status(200).json(result);
~~~

The client then stores pagination.nextCursor and sends it in the next request.

## 12. Complete request flow

~~~text
1. Client requests /api/projects?limit=20.
2. Authentication middleware verifies the token.
3. Controller validates limit and cursor.
4. Controller reads userId from req.user.
5. Project service decodes the cursor if present.
6. Prisma filters by userId and ACTIVE status.
7. Prisma fetches limit + 1 rows.
8. Prisma orders by createdAt DESC and id DESC.
9. Prisma continues after the composite cursor.
10. Shared helper removes the extra row.
11. Shared helper calculates hasMore.
12. Shared helper creates nextCursor.
13. Controller returns data and pagination.
14. Client sends nextCursor for the next page.
~~~

## 13. Reuse for other APIs

Reuse these shared parts:

~~~text
pagination.types.ts
pagination.validation.ts
pagination.cursor.ts
Pagination.ts
common response format
limit + 1 logic
~~~

Change these parts per resource:

~~~text
Prisma model
authorization relationship
cursor resource name
cursor constraint
database index
selected fields
~~~

### API Keys

Relationship:

~~~text
User -> Project -> ApiKey
~~~

Authorize API Keys through the Project:

~~~ts
where: {
  projectId,
  project: {
    userId: authenticatedUserId,
  },
}
~~~

Use an API Key cursor and a constraint based on:

~~~text
projectId + createdAt + id
~~~

### Events

If Events belong to Projects, authorize through:

~~~ts
where: {
  projectId,
  project: {
    userId: authenticatedUserId,
  },
}
~~~

Use an Event cursor and a constraint based on:

~~~text
projectId + createdAt + id
~~~

### Admin APIs

Admin lists use role authorization and allowlisted filters. They still use the same response shape, page helper, limit + 1 logic, deterministic order, and cursor continuation.

## 14. Implemented checklist

~~~text
[x] Generic PaginatedResponse<T>
[x] Pagination metadata with limit, hasMore, nextCursor
[x] Limit validation
[x] Maximum limit of 100
[x] Cursor length validation
[x] Base64url cursor encoding
[x] Cursor version field
[x] Cursor resource field
[x] Cursor payload validation
[x] Invalid cursor returns 400
[x] Invalid pagination input returns 400
[x] limit + 1 query
[x] skip: 1 continuation
[x] createdAt + id ordering
[x] Project authorization inside Prisma
[x] Composite Project cursor constraint
[x] Common Project response
[x] TypeScript verification
[x] Prisma schema verification
~~~

## 15. Final verification still required

~~~text
[ ] Unit tests for the shared helper
[ ] First, next, and final page integration tests
[ ] Invalid cursor and invalid limit tests
[ ] Duplicate timestamp tests
[ ] User authorization tests
[ ] Confirm migration is applied to the real database
[ ] EXPLAIN (ANALYZE, BUFFERS)
[ ] Load test with realistic project data
[ ] Pagination latency and slow-query metrics
~~~

The reusable pagination foundation and Project implementation are complete. The unchecked items verify behavior and database performance in a real production environment.

