# Project Pagination Fixes

This document explains what is wrong in the current Project pagination, how to fix it, and why each fix is important.

## Current status

The basic algorithm is correct:

- validate a limit;
- filter projects by the authenticated user;
- fetch limit + 1 rows;
- skip the cursor row;
- return data and a next cursor.

It is not yet fully production-ready because the response shape, cursor definition, Prisma schema, cursor validation, and error handling are not fully aligned.

The key rule is:

~~~text
database filter + database order + cursor fields + database constraint
must all describe the same record position.
~~~

## 1. Fix the response shape

### Problem

The service returns:

~~~ts
{
  data,
  pagination
}
~~~

The controller changes it to:

~~~ts
{
  projects,
  nextCursor,
  hasMore
}
~~~

### Why the old version is not good

Every frontend API needs a different response reader. Projects, Events, API Keys, and Admin lists become inconsistent.

### Fix

Return the service result directly:

~~~ts
const result = await getAllProjectsService({
  limit,
  cursor,
  userId,
});

return res.status(200).json(result);
~~~

The response should be:

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

Why: every paginated API can use result.data, result.pagination.hasMore, and result.pagination.nextCursor.

## 2. Add the effective limit to the response

Use:

~~~ts
export interface PaginationMeta {
  limit: number;
  hasMore: boolean;
  nextCursor: string | null;
}
~~~

The page helper returns:

~~~ts
pagination: {
  limit,
  hasMore,
  nextCursor,
}
~~~

Why: the server may apply a default limit. Returning the effective value makes behavior clear.

## 3. Use array ordering

Use:

~~~ts
orderBy: [
  { createdAt: "desc" },
  { id: "desc" },
]
~~~

The intended order is:

~~~text
1. newest createdAt first
2. if createdAt is equal, highest id first
~~~

Why use an array? It explicitly represents an ordered list of sort rules. The database knows that id is the tie-breaker after createdAt.

Ordering only by createdAt is unsafe because two projects can have the same timestamp. Their order can change, causing duplicates or skipped records on the next request.

The cursor must contain the same fields as the order:

~~~text
order: createdAt + id
cursor: createdAt + id
~~~

## 4. Understand the cursor

A cursor is a bookmark, not a page number.

Offset pagination says:

~~~text
skip the first 40 rows
~~~

Cursor pagination says:

~~~text
continue after this exact record position
~~~

A Project cursor should contain:

~~~json
{
  "version": 1,
  "resource": "projects",
  "createdAt": "2026-09-08T10:00:00.000Z",
  "id": "project-id"
}
~~~

Why include createdAt and id? The query is ordered by both fields, so both are required to identify the exact last position.

## 5. Validate the cursor

### Problem

The current decoder parses any decoded JSON without checking its fields.

A client could send a cursor with:

- invalid JSON;
- missing id;
- missing createdAt;
- invalid date;
- another resource name;
- an old cursor version.

### Fix

Validate the decoded value with Zod:

~~~ts
const ProjectCursorSchema = z.object({
  version: z.literal(1),
  resource: z.literal("projects"),
  id: z.string().uuid(),
  createdAt: z.string().datetime(),
});
~~~

An invalid cursor must return HTTP 400, not a generic 500 error.

For stronger protection, sign cursors so clients cannot change their meaning.

## 5.1 Why the cursor needs version and resource

The cursor should not contain only `createdAt` and `id`:

~~~ts
{
  createdAt,
  id
}
~~~

Use this instead:

~~~ts
{
  version: 1,
  resource: "projects",
  createdAt,
  id
}
~~~

### Version

The version tells the server how to interpret the cursor.

Today the cursor may use:

~~~text
version 1 = createdAt + id
~~~

Later, the ordering may change:

~~~text
version 2 = updatedAt + id
~~~

Without a version, an old cursor may be decoded using the wrong fields after a future API change. The server can reject unsupported versions instead of producing incorrect pages.

### Resource

The resource identifies which endpoint created the cursor:

~~~text
resource = projects
resource = events
resource = api-keys
~~~

Without a resource name, a Project cursor could accidentally be sent to an Event endpoint. The server can reject a cursor when its resource does not match the endpoint.

### Validation example

~~~ts
const ProjectCursorSchema = z.object({
  version: z.literal(1),
  resource: z.literal("projects"),
  id: z.string().uuid(),
  createdAt: z.string().datetime(),
});
~~~

Version and resource are not encryption. They provide compatibility and safety checks. Signing the cursor is an additional protection against tampering.

## 6. Why add version and resource?

Version supports future cursor changes:

~~~text
version 1: createdAt + id
version 2: updatedAt + id
~~~

Resource prevents a Project cursor from being used on an Event endpoint.

The server should reject a cursor when:

~~~text
cursor.resource is not "projects"
cursor.version is not supported
~~~

## 7. Understand the database index

The current index is:

~~~prisma
@@index([userId, createdAt, id])
~~~

The Project query does:

~~~text
WHERE userId = authenticated user
ORDER BY createdAt DESC, id DESC
~~~

The index starts with userId because that is the equality filter, then contains the ordering fields.

Why: PostgreSQL can find one user's projects and read them in the requested order instead of scanning unrelated rows.

An ordinary index helps performance, but Prisma also needs a unique cursor target.

Production pagination needs:

~~~text
performance index + unique cursor definition
~~~

## 7.1 Difference between @@index and @@unique

### @@index

~~~prisma
@@index([userId, createdAt, id])
~~~

`@@index` creates a database index for faster searching and ordering. It helps PostgreSQL execute a query such as:

~~~text
WHERE userId = ?
ORDER BY createdAt DESC, id DESC
~~~

It improves read performance, but it does not prevent duplicate values. Multiple rows may have the same `userId` and `createdAt`.

### @@unique

~~~prisma
@@unique(
  [userId, createdAt, id],
  name: "project_page_cursor"
)
~~~

`@@unique` creates a unique database constraint and a unique index. It prevents two rows from having the same combination of `userId`, `createdAt`, and `id`.

It also gives Prisma a unique compound field that can be used as a cursor:

~~~ts
cursor: {
  project_page_cursor: {
    userId,
    createdAt,
    id,
  },
}
~~~

### Do we need both?

Usually, no. The `@@unique` constraint already creates an index for those columns. If both definitions contain exactly the same columns and order, the normal `@@index` is usually redundant and adds unnecessary storage and write overhead.

Prefer:

~~~prisma
@@unique(
  [userId, createdAt, id],
  name: "project_page_cursor"
)
~~~

Use a separate `@@index` only when it supports a different query pattern, for example:

~~~prisma
@@index([userId, status, createdAt])
~~~

That index may help a query filtering by both `userId` and `status`, while the unique cursor constraint supports the exact cursor position.

### Important distinction

~~~text
@@index  = performance lookup/order structure
@@unique = data-integrity rule plus unique lookup structure
~~~

Do not add both automatically. Check the actual queries and confirm with `EXPLAIN (ANALYZE, BUFFERS)`.

## 8. What is a composite cursor?

A composite cursor uses multiple fields:

~~~text
userId + createdAt + id
~~~

Add this to the Project model:

~~~prisma
@@unique(
  [userId, createdAt, id],
  name: "project_page_cursor"
)
~~~

This says that the combination of userId, createdAt, and id is unique.

The id is already globally unique, but defining the complete combination is useful because it matches:

- the owner scope;
- the ordering;
- the cursor position;
- Prisma's unique cursor input.

## 9. Why use a unique constraint?

A cursor must identify one exact database position.

This is ambiguous:

~~~text
createdAt = 2026-09-08 10:00:00
~~~

Several projects can share this timestamp.

This is exact:

~~~text
userId + createdAt + id
~~~

The unique constraint also makes the rule enforceable by the database instead of relying only on application code.

## 10. Why is project_page_cursor inside the Prisma cursor?

This schema definition:

~~~prisma
@@unique(
  [userId, createdAt, id],
  name: "project_page_cursor"
)
~~~

creates a named Prisma unique input.

Therefore the query references it like this:

~~~ts
cursor: {
  project_page_cursor: {
    userId,
    createdAt: new Date(decodedCursor.createdAt),
    id: decodedCursor.id,
  },
}
~~~

project_page_cursor is not a table or a value. It is the name of the composite unique constraint.

If the schema uses another name:

~~~prisma
name: "project_cursor_position"
~~~

the query must use:

~~~ts
cursor: {
  project_cursor_position: {
    userId,
    createdAt,
    id,
  },
}
~~~

The names must match exactly.

## 11. Correct Project query

After adding the composite constraint and regenerating Prisma Client:

~~~ts
const decodedCursor = cursor
  ? decodeProjectCursor(cursor)
  : undefined;

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
  ...(decodedCursor
    ? {
        cursor: {
          project_page_cursor: {
            userId,
            createdAt: new Date(decodedCursor.createdAt),
            id: decodedCursor.id,
          },
        },
        skip: 1,
      }
    : {}),
});
~~~

Then create the response:

~~~ts
return createPaginatedResponse(
  projects,
  limit,
  (project) =>
    encodeProjectCursor({
      version: 1,
      resource: "projects",
      id: project.id,
      createdAt: project.createdAt.toISOString(),
    }),
);
~~~

## 12. Authorization must be inside Prisma

### Bad

~~~ts
const projects = await prisma.project.findMany();

const userProjects = projects.filter(
  (project) => project.userId === userId,
);
~~~

Why bad:

- reads unauthorized data into application memory;
- wastes database and application resources;
- can leak data accidentally;
- filters after pagination and produces wrong pages.

### Good

~~~ts
const projects = await prisma.project.findMany({
  where: {
    userId: authenticatedUserId,
  },
});
~~~

The database returns only authorized records.

## 13. API Key relationship

API Keys do not need userId because the relationship is:

~~~text
User -> Project -> ApiKey
~~~

The API Key query must authorize through the Project:

~~~ts
const apiKeys = await prisma.apiKey.findMany({
  where: {
    projectId,
    project: {
      userId: authenticatedUserId,
    },
  },
  take: limit + 1,
  orderBy: [
    { createdAt: "desc" },
    { id: "desc" },
  ],
});
~~~

Use the API Key constraint:

~~~prisma
@@unique(
  [projectId, createdAt, id],
  name: "api_key_page_cursor"
)
~~~

The shared helper is reused, but the authorization filter, cursor name, and index are resource-specific.

## 14. Migration and verification

Run after changing the schema:

~~~bash
npx prisma migrate dev --name add_project_pagination_cursor
npx prisma generate
~~~

Use this in production:

~~~bash
npx prisma migrate deploy
~~~

Before calling the API production-ready:

1. Check existing data before adding uniqueness.
2. Test the migration against realistic data.
3. Verify the generated Prisma Client.
4. Run first, next, and final page tests.
5. Test invalid cursors and duplicate timestamps.
6. Run EXPLAIN ANALYZE BUFFERS.
7. Run a load test using the maximum limit.

## Final fix order

~~~text
1. Return { data, pagination } directly from the controller.
2. Add limit to PaginationMeta.
3. Use array ordering: createdAt DESC, id DESC.
4. Validate decoded cursor fields.
5. Add cursor version and resource.
6. Add the project_page_cursor unique constraint.
7. Regenerate Prisma Client and run the migration.
8. Use project_page_cursor in the Prisma cursor query.
9. Add authorization and pagination tests.
10. Verify the index and query plan.
~~~

The Project API is production-grade only when response format, validation, cursor, Prisma query, authorization, schema constraint, index, and tests all agree.
