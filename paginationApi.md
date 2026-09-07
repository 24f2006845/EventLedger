# Production-Grade Paginated API Workflow

This document explains the complete pagination architecture for EventLedger and the exact workflow to use it for Projects, Events, API Keys, Admin Users, and future resources.

## 1. Current audit of the implementation

The shared pagination folder already exists:

```text
Backend/src/shared/pagination/
  Pagination.ts
  index.ts
  pagination.cursor.ts
  pagination.types.ts
  pagination.validation.ts
```

The basic `limit + 1` algorithm is correct. However, the current Project endpoint still needs these changes before it is production-ready:

1. `getAllProjectsController` converts the common response back into `{ projects, nextCursor, hasMore }`. It should return the shared `PaginatedResponse` directly.
2. `PaginationMeta` should include `limit` if the API contract requires clients to know the effective page size.
3. The query orders by `createdAt` and `id`, but the Prisma cursor currently uses only `id`. The cursor position and ordering must represent the same keys.
4. The cursor payload is decoded with raw `JSON.parse` and base64 conversion. Invalid or tampered cursors must become a controlled `400` error.
5. The cursor currently exposes unvalidated JSON. Use a schema, cursor version, resource name, and filter/scope validation.
6. The Prisma schema has no index matching the owner filter and pagination ordering.
7. API Keys, Admin lists, and future Events lists must use the same response contract but their own authorization filters and indexes.
8. There are no integration tests proving pagination behavior under duplicate timestamps, invalid cursors, or data changes.

TypeScript compilation currently passes, but compilation does not prove that the query is indexed, that cursors are safe, or that the response contract is consistent.

## 2. The target architecture

The shared code should be responsible for pagination mechanics:

```text
shared pagination types
shared query validation
shared cursor encoding/decoding
shared limit + 1 page builder
shared response envelope
```

Each resource module remains responsible for:

```text
resource-specific filters
resource-specific authorization
resource-specific Prisma query
resource-specific cursor type
resource-specific database index
resource-specific selected fields
```

Do not create one universal Prisma query for every model. Share the pagination mechanism, not the database query.

## 3. The standard response contract

Every paginated endpoint should return exactly this shape:

```json
{
  "data": [],
  "pagination": {
    "limit": 20,
    "hasMore": true,
    "nextCursor": "opaque-cursor"
  }
}
```

The resource changes, but the response structure does not:

```ts
PaginatedResponse<Project>
PaginatedResponse<Event>
PaginatedResponse<ApiKey>
PaginatedResponse<User>
```

Do not return these different shapes from different endpoints:

```json
{ "projects": [], "nextCursor": "...", "hasMore": true }
```

```json
{ "events": [], "nextCursor": "...", "hasMore": true }
```

Use `data` consistently. This simplifies frontend hooks, API clients, tests, documentation, caching, and monitoring.

## 4. Shared pagination types

Use a generic type in `Backend/src/shared/pagination/pagination.types.ts`:

```ts
export interface PaginationMeta {
  limit: number;
  hasMore: boolean;
  nextCursor: string | null;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: PaginationMeta;
}
```

`T` is the resource type. For example:

```ts
PaginatedResponse<Project>
PaginatedResponse<ApiKey>
```

The generic type gives compile-time safety while keeping one response format.

## 5. Validate pagination input

Create a shared schema in `pagination.validation.ts`:

```ts
import { z } from "zod";

export const PaginationSchema = z.object({
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(100)
    .default(20),

  cursor: z
    .string()
    .min(1)
    .max(2000)
    .optional(),
});

export type PaginationQuery = z.infer<typeof PaginationSchema>;
```

Why this is required:

- Express query values arrive as strings.
- `Number(undefined)` becomes `NaN`.
- Negative or zero limits are invalid.
- Very large limits can overload the database.
- A cursor can be malformed or tampered with.

Invalid pagination input must return HTTP `400`, not an unhandled database error.

## 6. Create safe cursor encoding and decoding

A cursor is a bookmark for the last item in the current page. It is not a page number.

Use a resource-independent encoder, but validate the payload before using it:

```ts
import { z } from "zod";

const BaseCursorSchema = z.object({
  version: z.literal(1),
  resource: z.string().min(1),
  id: z.string().uuid(),
  createdAt: z.string().datetime(),
});

export type BaseCursor = z.infer<typeof BaseCursorSchema>;

export function encodeCursor(payload: BaseCursor): string {
  return Buffer
    .from(JSON.stringify(payload))
    .toString("base64url");
}

export function decodeCursor(
  value: string,
  expectedResource: string,
): BaseCursor {
  try {
    const decoded = JSON.parse(
      Buffer.from(value, "base64url").toString("utf8"),
    );

    const cursor = BaseCursorSchema.parse(decoded);

    if (cursor.resource !== expectedResource) {
      throw new Error("Cursor resource mismatch");
    }

    return cursor;
  } catch {
    throw new Error("Invalid pagination cursor");
  }
}
```

For stronger protection, sign the cursor with an application secret. Also include a filter hash when a cursor must not be reused with different filters.

The cursor should contain the complete sort position. If the query orders by `createdAt` and `id`, the cursor must contain both values.

## 7. Create the shared page builder

In `Backend/src/shared/pagination/Pagination.ts`:

```ts
import type { PaginatedResponse } from "./pagination.types.js";

export function createPaginatedResponse<T>(
  rows: T[],
  limit: number,
  getCursor: (item: T) => string,
): PaginatedResponse<T> {
  const hasMore = rows.length > limit;
  const data = hasMore ? rows.slice(0, limit) : rows;
  const lastItem = data.at(-1);

  return {
    data,
    pagination: {
      limit,
      hasMore,
      nextCursor:
        hasMore && lastItem
          ? getCursor(lastItem)
          : null,
    },
  };
}
```

`getCursor` means:

```ts
getCursor: (item: T) => string
```

It is a function that receives the final item in the page and returns the cursor for that item. Each resource can decide which fields belong in its cursor.

Example:

```ts
(project) => encodeCursor({
  version: 1,
  resource: "projects",
  id: project.id,
  createdAt: project.createdAt.toISOString(),
})
```

The helper does not know what a Project or API Key is. That is what makes it reusable.

## 8. Database design for cursor pagination

Cursor pagination requires three things to agree:

```text
WHERE filters
ORDER BY columns
CURSOR columns
```

For Projects:

```text
WHERE userId = authenticated user
ORDER BY createdAt DESC, id DESC
CURSOR createdAt + id
```

For API Keys:

```text
WHERE projectId = requested project
  AND project.userId = authenticated user
ORDER BY createdAt DESC, id DESC
CURSOR createdAt + id
```

Add resource-specific constraints and indexes. A possible Prisma design is:

```prisma
model Project {
  id          String        @id @default(uuid())
  name        String
  description String?
  status      ProjectStatus @default(ACTIVE)
  createdAt   DateTime      @default(now())
  updatedAt   DateTime      @updatedAt
  userId      String
  user        User          @relation(fields: [userId], references: [id])
  apiKeys     ApiKey[]

  @@unique([userId, createdAt, id], name: "project_page_cursor")
}

model ApiKey {
  id        String       @id @default(uuid())
  name      String
  projectId String
  project   Project     @relation(fields: [projectId], references: [id])
  key_hash  String       @unique
  status    ApiKeyStatus @default(ACTIVE)
  createdAt DateTime     @default(now())
  updatedAt DateTime     @updatedAt

  @@unique([projectId, createdAt, id], name: "api_key_page_cursor")
}
```

A composite unique constraint creates an index and gives Prisma a unique cursor target. Before applying it, check existing data and test the migration against realistic data.

Run a migration after reviewing the schema:

```bash
npx prisma migrate dev --name add_pagination_cursor_constraints
npx prisma generate
```

In production:

```bash
npx prisma migrate deploy
```

Use `EXPLAIN (ANALYZE, BUFFERS)` on realistic data to verify the query uses the intended index.

## 9. Project API implementation flow

### Request

```http
GET /api/projects?limit=20
Authorization: Bearer <access-token>
```

### Route

```ts
router.get("/", authMiddleware, getAllProjectsController);
```

### Controller

```ts
export const getAllProjectsController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const query = PaginationSchema.parse(req.query);
    const userId = req.user?.userId;

    if (!userId) {
      throw new AppError("Unauthorized", 401);
    }

    const response = await getAllProjectsService({
      userId,
      limit: query.limit,
      cursor: query.cursor,
    });

    // Return the common response directly.
    return res.status(200).json(response);
  } catch (error) {
    return next(error);
  }
};
```

Do not transform the response into this:

```ts
res.json({
  projects,
  nextCursor,
  hasMore,
});
```

That breaks the shared contract.

### Service

```ts
interface ProjectCursor {
  version: 1;
  resource: "projects";
  id: string;
  createdAt: string;
}

export async function getAllProjectsService(input: {
  userId: string;
  limit: number;
  cursor?: string;
}) {
  const decodedCursor = input.cursor
    ? decodeCursor(input.cursor, "projects")
    : undefined;

  const projects = await prisma.project.findMany({
    where: {
      userId: input.userId,
      status: "ACTIVE",
    },
    take: input.limit + 1,
    orderBy: [
      { createdAt: "desc" },
      { id: "desc" },
    ],
    ...(decodedCursor
      ? {
          cursor: {
            project_page_cursor: {
              userId: input.userId,
              createdAt: new Date(decodedCursor.createdAt),
              id: decodedCursor.id,
            },
          },
          skip: 1,
        }
      : {}),
  });

  return createPaginatedResponse(
    projects,
    input.limit,
    (project) =>
      encodeCursor({
        version: 1,
        resource: "projects",
        id: project.id,
        createdAt: project.createdAt.toISOString(),
      }),
  );
}
```

The exact generated Prisma cursor property must match the name of the composite unique constraint. Regenerate Prisma Client after changing the schema.

## 10. API Key relationships and authorization

The relationship is:

```text
User 1 ---- many Project 1 ---- many ApiKey
```

An API Key does not need a `userId` column because it belongs to a Project, and the Project belongs to a User.

The API Key query must authorize through the relation:

```ts
const apiKeys = await prisma.apiKey.findMany({
  where: {
    projectId,
    status: "ACTIVE",
    project: {
      userId,
    },
  },
  take: limit + 1,
  orderBy: [
    { createdAt: "desc" },
    { id: "desc" },
  ],
});
```

This means:

```text
apiKey.projectId = requested projectId
AND project.userId = authenticated userId
```

Never query API keys using only the URL's `projectId`. A user could guess another project ID. Always use the authenticated user in the relation filter.

The API Key endpoint then calls the same shared helper:

```ts
return createPaginatedResponse(
  apiKeys,
  limit,
  (apiKey) =>
    encodeCursor({
      version: 1,
      resource: "api-keys",
      id: apiKey.id,
      createdAt: apiKey.createdAt.toISOString(),
    }),
);
```

## 11. Reuse pattern for Events and Admin APIs

### Events

If an Event belongs to a Project, authorize through both IDs:

```ts
where: {
  projectId,
  project: {
    userId,
  },
}
```

Use an index matching the event list:

```prisma
@@unique([projectId, createdAt, id], name: "event_page_cursor")
```

### Admin users

Admin users may query all users, so the filter differs:

```ts
where: {
  role: requestedRole,
}
```

The endpoint still uses:

```text
take: limit + 1
orderBy: createdAt DESC, id DESC
cursor: createdAt + id
createPaginatedResponse()
```

The role filter must be represented in the cursor design or the API must require the same filter on every next-page request.

### Resource comparison

| Resource | Authorization filter | Cursor order | Matching index |
|---|---|---|---|
| Projects | `userId` | `createdAt`, `id` | `userId`, `createdAt`, `id` |
| API Keys | `projectId` and `project.userId` | `createdAt`, `id` | `projectId`, `createdAt`, `id` |
| Events | `projectId` and `project.userId` | `createdAt`, `id` | `projectId`, `createdAt`, `id` |
| Admin Users | role/status filters | `createdAt`, `id` | filter columns, `createdAt`, `id` |

## 12. Complete request-to-response flow

```text
1. Client sends the first request.
   GET /api/projects?limit=20

2. Authentication middleware verifies the token.

3. Validation parses limit and cursor.
   limit becomes number 20.
   cursor remains undefined for the first page.

4. Controller gets authenticated userId and validated pagination input.

5. Controller calls the Project service.

6. Project service applies authorization.
   where userId = authenticated userId.

7. Project service decodes a cursor if one was supplied.

8. Prisma fetches limit + 1 rows.
   take: 21.

9. Prisma uses deterministic ordering.
   createdAt DESC, id DESC.

10. Shared helper checks whether row 21 exists.

11. Shared helper returns rows 1–20.

12. Shared helper creates a cursor from row 20.

13. Controller returns the common response.

14. Client stores pagination.nextCursor.

15. Client sends the cursor on the next request.
   GET /api/projects?limit=20&cursor=<cursor>

16. Prisma starts after that cursor and repeats the same process.
```

## 13. Client behavior

The client should not calculate page numbers or decode the cursor.

```ts
let cursor: string | undefined;
let hasMore = true;

while (hasMore) {
  const params = new URLSearchParams({ limit: "20" });

  if (cursor) {
    params.set("cursor", cursor);
  }

  const response = await fetch(`/api/projects?${params}`);
  const result = await response.json();

  projects.push(...result.data);
  cursor = result.pagination.nextCursor ?? undefined;
  hasMore = result.pagination.hasMore;
}
```

For infinite scrolling, load the next page only when `hasMore` is true and no request is already running.

## 14. Error behavior

Use these responses:

| Situation | Status |
|---|---:|
| Invalid limit | `400` |
| Invalid cursor | `400` |
| Missing authentication | `401` |
| Authenticated but not allowed | `403` or resource-safe `404` |
| Resource not found | `404` |
| Rate limit exceeded | `429` |
| Unexpected server/database error | `500` |

An invalid cursor should never crash the process or produce an unclear Prisma error.

## 15. Production test plan

### Shared helper tests

- Empty rows return `data: []` and `nextCursor: null`.
- Rows fewer than `limit` return `hasMore: false`.
- Rows exactly equal to `limit` return `hasMore: false`.
- Rows greater than `limit` return only `limit` rows.
- The cursor is generated from the final returned row.

### API integration tests

- First page without a cursor.
- Second page with a cursor.
- Final page with `nextCursor: null`.
- Invalid cursor.
- Invalid, zero, negative, fractional, and oversized limits.
- Duplicate `createdAt` values.
- User A cannot paginate User B's projects.
- User A cannot read User B's API keys through a guessed project ID.
- Archived records follow the documented filter policy.
- A record inserted between requests does not cause unexpected duplicates.
- A record deleted between requests does not crash the next page.
- Every endpoint returns the same response envelope.

### Database tests

- Migration succeeds on a realistic database.
- Composite cursor constraints exist.
- `EXPLAIN (ANALYZE, BUFFERS)` uses the intended index.
- No query creates an N+1 relationship lookup.

## 16. Implementation order

Apply the feature in this order:

1. Confirm and finalize `PaginatedResponse<T>`.
2. Add `limit` to `PaginationMeta` if the contract requires it.
3. Harden cursor encoding and decoding.
4. Update `createPaginatedResponse` to use `limit + 1`.
5. Add deterministic ordering to the Project query.
6. Add Project composite cursor constraint and migration.
7. Return the shared response directly from the Project controller.
8. Add Project pagination integration tests.
9. Add the API Key paginated query with `project.userId` authorization.
10. Add API Key cursor constraint and index.
11. Add Events pagination using `projectId` and `project.userId` authorization.
12. Add Admin pagination with allowlisted filters.
13. Add query-plan checks, slow-query monitoring, rate limits, and cursor signing.

Do not copy the Project service and only rename variables. Copy the workflow, then change the resource filter, relationship authorization, cursor resource name, selected fields, and database index.

## 17. Final production checklist

- [ ] All paginated endpoints use `PaginatedResponse<T>`.
- [ ] All endpoints return `data` and `pagination`.
- [ ] Limits are validated and capped.
- [ ] Cursors are opaque and validated.
- [ ] Cursor version and resource are checked.
- [ ] Cursor contains every ordering field.
- [ ] Ordering has a unique tie-breaker.
- [ ] Queries use `take: limit + 1`.
- [ ] `skip: 1` is used for cursor continuation.
- [ ] Authorization is included inside the Prisma `where` clause.
- [ ] Every list query has a matching database index.
- [ ] API key queries authorize through `project.userId`.
- [ ] Invalid cursors return `400`.
- [ ] Tests cover duplicate timestamps and concurrent changes.
- [ ] Query plans have been reviewed with realistic data.
- [ ] Controllers return the service response without changing its shape.
- [ ] No endpoint exposes password hashes, token hashes, or API-key hashes.

