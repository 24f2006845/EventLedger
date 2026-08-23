# Authentication

This document describes the authentication module in `Backend/src/modules/auth` and the services that depend on it.

## Components

The request path is:

```text
HTTP request
  -> Express route
  -> validation middleware (public write endpoints)
  -> auth middleware (protected endpoints)
  -> controller
  -> auth service
  -> Prisma User model / PostgreSQL
```

- `auth.routes.ts` exposes the auth API under `/api/auth`.
- `auth.validation.ts` validates and normalizes registration and login bodies.
- `auth.middleware.ts` validates access tokens and attaches `{ userId, role }` to `req.user`.
- `auth.controller.ts` translates service results into HTTP responses and manages the refresh-token cookie.
- `auth.service.ts` owns password hashing, user lookup, token creation, refresh-token rotation, and logout invalidation.
- `utils/jwt.ts` signs and verifies access and refresh JWTs.
- Prisma persists the user and only a SHA-256 hash of the current refresh token.

## Token model

There are two tokens:

1. The access token is a JWT with the user ID and role. It expires after 15 minutes. Clients send it in `Authorization: Bearer <token>`.
2. The refresh token is a JWT with the same identity claims. It expires after 7 days, is stored in an HTTP-only `refreshToken` cookie, and is never returned in a JSON response. Its SHA-256 hash is stored in `User.refreshTokenHash`.

The refresh-token hash makes a stolen database record insufficient to replay a refresh token. Only one refresh token is valid per user at a time; login and refresh replace the stored hash.

`ACCESS_TOKEN_SECRET` and `REFRESH_TOKEN_SECRET` must be configured. The application fails fast if either secret is missing; insecure fallback secrets are not used.

## Endpoints and flows

### Register — `POST /api/auth/register`

1. `validateRegister` validates and normalizes the request body.
2. `registerController` passes the parsed values to `registerService`.
3. The service checks the unique email, hashes the password with bcrypt (cost 10), and creates the user.
4. The response is `201 { "message": "User registered successfully", "userId": "..." }`.

Example body:

```json
{ "username": "alice", "email": "alice@example.com", "password": "at-least-8-characters" }
```

Registration does not log the user in or issue tokens.

### Login — `POST /api/auth/login`

1. `validateLogin` trims/lowercases the email and validates the password.
2. `loginService` finds the user and compares the submitted password with the bcrypt hash.
3. The service signs an access token and refresh token, hashes the refresh token, and stores that hash.
4. The controller sets the refresh token as an HTTP-only, `SameSite=Strict` cookie scoped to `/api/auth`.
5. The JSON response contains the access token and success message, but not the refresh token.

Unknown email and wrong password intentionally return the same `401 Invalid email or password` response.

### Refresh — `POST /api/auth/refresh-token`

1. `cookie-parser` reads the refresh-token cookie.
2. The controller rejects a missing cookie with `401`.
3. `refreshTokenService` verifies the JWT signature and expiry, loads the user, hashes the presented token, and compares it with `refreshTokenHash`.
4. If valid, the service signs a new access token and refresh token and atomically replaces the stored hash.
5. The controller replaces the cookie and returns only the new access token.

A previously used or mismatched refresh token is rejected with `401 Invalid refresh token`.

### Current user — `GET /api/auth/me`

The access-token middleware verifies the bearer token and attaches its identity to the request. `GetMeService` then loads and returns the user’s `id`, `username`, `email`, and `role`; the password and refresh-token hash are never selected.

### Logout — `POST /api/auth/logout`

This endpoint requires a valid access token. The service clears `refreshTokenHash`, invalidating refresh-token reuse, and the controller clears the refresh cookie. Existing access tokens remain valid until their short expiry.

## Service connections

`Backend/src/app.ts` mounts the auth router at `/api/auth` and the API-key router at `/api/apiKeys`. Every API-key route uses `authMiddleware`, so it depends on the access-token contract but does not call the auth service directly:

```text
Client -> /api/apiKeys/* -> authMiddleware -> API-key controller/service
       \> /api/auth/*    -> auth route -> auth controller -> auth service -> Prisma
```

`server.ts` loads environment variables, connects Prisma to PostgreSQL, and starts Express. `cookie-parser` must run before the auth routes so refresh cookies are available.

## Validation and error behavior

Registration requires a trimmed username of at least 3 characters, a valid email, and a password of at least 8 characters. Login requires a valid email and an 8-character minimum password. Zod strips unknown body fields, stores the parsed/normalized body on `req.body`, and returns `400` with field-level errors when validation fails.

Protected routes require exactly a bearer token in the `Authorization` header. JWT verification checks the correct secret, signature, expiry, user ID, and role. Invalid or expired access tokens return `401`.

Expected auth errors are returned as `{ "error": "..." }`; validation errors are returned as `{ "error": "Validation failed", "errors": [{ "field": "...", "message": "..." }] }`.

## Required environment

```text
DATABASE_URL=postgresql://...
ACCESS_TOKEN_SECRET=<long random secret>
REFRESH_TOKEN_SECRET=<different long random secret>
NODE_ENV=production   # enables the Secure cookie flag
```

After applying the username schema migration, regenerate the Prisma client before building or starting the backend.
