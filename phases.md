# EventLedger Production-Grade Implementation Phases

This roadmap prioritizes features that improve reliability, security, data correctness, operability, and scale. Complete each phase's acceptance criteria before moving to the next phase.

## Phase 0 — Establish a safe engineering baseline

### Goal

Make local development, CI, configuration, and deployments repeatable.

### Features and work

- Add `development`, `test`, and `production` environment configuration.
- Validate required environment variables at startup with Zod.
- Add a proper `build`, `typecheck`, `lint`, `test`, and migration script.
- Add CI to run typecheck, lint, tests, migration checks, and build on every pull request.
- Add a consistent API version prefix such as `/api/v1`.
- Add a centralized configuration module instead of reading `process.env` throughout the codebase.
- Add Docker or an equivalent reproducible deployment definition.
- Add health endpoints:
  - `/health/live`: process is running.
  - `/health/ready`: process can reach required dependencies.
- Add graceful shutdown for HTTP server, Prisma, and open resources.
- Add a standard error response with request ID and safe public messages.

### Database work

- Use Prisma migrations as the only production schema change mechanism.
- Create separate runtime and migration database credentials when possible.
- Add a migration check to CI.
- Add a PostgreSQL test database for integration tests.

### Done when

- A new developer can start the API from documented steps.
- CI blocks a broken build or migration.
- Deployment readiness reports database connectivity correctly.
- Secrets are never committed or printed in logs.

## Phase 1 — Authentication and authorization hardening

### Goal

Ensure that only the right users can access the right resources.

### Features and work

- Validate login, registration, refresh, and password inputs.
- Use strong password hashing and password policy rules.
- Use short-lived access tokens and rotating refresh tokens.
- Revoke refresh-token families after reuse detection or logout-all-devices.
- Add account lockout or progressive rate limiting for repeated login failures.
- Add authorization checks in every service query, not only in middleware.
- Centralize role and permission checks.
- Ensure an unauthorized resource returns the intended `404` or `403` policy consistently without leaking existence.
- Add security headers, strict CORS configuration, request-size limits, and secure cookie settings.
- Add optional email verification, password reset, and account disable flows.

### Database work

- Add unique constraints for email and any business-unique username.
- Store only password hashes and refresh-token hashes.
- Add token family, expiry, revoked-at, and last-used metadata if refresh-token auditing is required.
- Add indexes for login and token-revocation lookups.
- Add an audit record for security-sensitive actions.

### Done when

- Users cannot access another user's projects or API keys through guessed IDs.
- Refresh-token replay is detected and invalidated.
- Authentication endpoints are rate-limited and tested for abuse.

## Phase 2 — Data model integrity and safe CRUD

### Goal

Make invalid, orphaned, duplicated, or silently lost data difficult to create.

### Features and work

- Complete project, API-key, event, and user CRUD behavior.
- Use domain-specific errors instead of generic `Error` messages.
- Define explicit status transitions, for example `ACTIVE -> ARCHIVED`.
- Make archive/delete behavior consistent across all resources.
- Add request idempotency for retryable create operations.
- Add optimistic concurrency using `updatedAt` or a version column for important updates.
- Select only required fields from Prisma queries.
- Avoid returning passwords, token hashes, or API-key hashes.

### Database work

- Add all foreign keys and explicit `onDelete` behavior.
- Add `NOT NULL`, unique, enum, and check constraints where business rules require them.
- Add timestamps consistently: `createdAt`, `updatedAt`, and, where useful, `deletedAt` or `archivedAt`.
- Add audit tables for project, API-key, user, and permission changes.
- Add indexes based on actual `WHERE`, `JOIN`, and `ORDER BY` patterns.
- Test migrations against realistic data volumes before production.

### Done when

- Database constraints protect integrity even if two requests race.
- Every mutation has authorization, validation, and a predictable error response.
- Destructive actions are recoverable through archive or a documented retention policy.

## Phase 3 — Production-grade pagination, filtering, and search

### Goal

Make list endpoints fast, predictable, and reusable at large data volumes.

### Features and work

- Create a shared pagination response contract.
- Validate and cap `limit` with a documented default and maximum.
- Use opaque, tamper-resistant cursors.
- Include every sort key and relevant filter version in the cursor.
- Use deterministic ordering with a unique tie-breaker.
- Add allowlisted filters and sort fields.
- Add cursor pagination for feeds and large lists.
- Use offset pagination only where page-number navigation is actually required.
- Decide whether archived records are included on every list endpoint.
- Add field selection and avoid returning large descriptions or payloads unless requested.
- Add optional `totalCount` only when the product requires it; do not calculate it automatically for every request.

### Database work

- Add matching composite indexes, for example:

```prisma
@@index([userId, createdAt, id])
@@index([projectId, createdAt, id])
```

- Use `EXPLAIN (ANALYZE, BUFFERS)` with production-like data.
- Add indexes for the most common event filters and API-key lookups.
- Consider partial or covering indexes only after measurement.

### Done when

- First, middle, final, empty, invalid-cursor, and duplicate-timestamp cases are tested.
- Deep pages remain performant without scanning all earlier rows.
- Pagination behavior remains safe when records are inserted or archived between requests.

## Phase 4 — Event ingestion reliability

### Goal

Make event collection reliable under retries, bursts, malformed requests, and partial failures.

### Features and work

- Define a stable event ingestion contract and schema version.
- Validate event names, payload size, timestamps, metadata, and content types.
- Add idempotency keys or producer event IDs to deduplicate retries.
- Return clear accepted/rejected results for batch ingestion.
- Add batch size, payload size, and rate limits.
- Add asynchronous processing for expensive enrichment or fan-out.
- Add retry with exponential backoff and jitter for transient failures.
- Add a dead-letter queue for permanently failed events.
- Preserve the original event and processing error for replay.

### Database work

- Add a unique constraint for `(projectId, producerEventId)` when producer IDs are guaranteed unique per project.
- Add indexes for project/time, event type/time, and processing status/time.
- Store processing attempts, last error, and processed timestamp.
- Partition very large append-only event tables by time only after measuring the need.
- Define retention and archival rules before the event table becomes large.

### Done when

- Retrying the same event does not create duplicates.
- A temporary database or queue failure does not silently lose accepted events.
- Failed events can be inspected and replayed safely.

## Phase 5 — API-key lifecycle and security

### Goal

Make machine-to-machine access safe to issue, use, rotate, and revoke.

### Features and work

- Show a raw API key only once at creation.
- Store only a strong hash and a short key prefix for identification.
- Add key scopes and project-level permissions.
- Add expiration, rotation, revocation, and last-used timestamps.
- Support overlapping old/new keys during rotation.
- Rate-limit by API key and project.
- Add a mechanism to revoke all keys for a compromised project.
- Never place secrets in URLs, logs, analytics events, or error messages.

### Database work

- Keep `key_hash` unique.
- Add indexes for active key lookup and project/status filtering.
- Add `expiresAt`, `revokedAt`, `lastUsedAt`, and optional `createdBy` fields.
- Record security events for creation, rotation, use anomalies, and revocation.

### Done when

- A leaked key can be identified and revoked without database access.
- Rotation causes no service interruption.
- Key usage and unusual activity can be investigated.

## Phase 6 — Transactions, concurrency, and background jobs

### Goal

Keep multi-step workflows correct under concurrent requests and asynchronous processing.

### Features and work

- Use short Prisma transactions for related writes.
- Add atomic updates for counters, quotas, and status transitions.
- Add bounded retries for serialization failures and deadlocks.
- Use an outbox table for reliable webhooks, emails, and queue messages.
- Add a worker process for event processing and scheduled cleanup.
- Make workers idempotent and safe to restart.
- Add job status, attempts, backoff, lease/visibility timeout, and dead-letter handling.
- Use consistent lock order to reduce deadlocks.

### Database work

- Add unique idempotency constraints.
- Add outbox and job tables with indexes on status and next-attempt time.
- Use `SELECT ... FOR UPDATE` only where required and keep locks short.
- Select transaction isolation intentionally.

### Done when

- A process crash can resume work without duplicate side effects.
- Related writes cannot leave partially completed business operations.
- Queue backlog, failure rate, and retry rate are visible.

## Phase 7 — Observability and operational control

### Goal

Make failures detectable, diagnosable, and measurable before users report them.

### Features and work

- Add structured JSON logs.
- Propagate a request ID through API, database, and worker logs.
- Add metrics for request count, latency, error rate, active connections, slow queries, queue depth, and event throughput.
- Add distributed tracing for high-value request paths.
- Add dashboards and alerts for availability, latency, database saturation, and authentication abuse.
- Add error tracking with stack traces and release versions.
- Add a status and incident communication process.
- Create runbooks for database outage, credential compromise, queue backlog, and rollback.

### Database work

- Monitor locks, dead tuples, autovacuum, table/index growth, cache hit ratio, slow queries, and replication lag.
- Add slow-query thresholds and query fingerprints.
- Keep sensitive values out of database logs and observability payloads.

### Done when

- The team can identify which endpoint, query, deployment, or dependency caused an incident.
- Alerts are actionable and tested.
- Every production incident produces a timeline and follow-up action.

## Phase 8 — Backups, disaster recovery, and data lifecycle

### Goal

Recover from accidental deletion, corruption, outage, or regional failure.

### Features and work

- Enable automated backups and point-in-time recovery.
- Define recovery point objective and recovery time objective.
- Test restoration regularly in an isolated environment.
- Document failover and rollback procedures.
- Add retention policies for events, audit records, tokens, and archived projects.
- Provide export tools for customer-owned data.
- Add secure deletion procedures where required.

### Database work

- Encrypt backups and restrict access.
- Keep backup credentials separate from runtime credentials.
- Validate restored schema, migrations, indexes, and application compatibility.
- Monitor backup freshness, size, and completion status.

### Done when

- A recent backup can be restored by someone other than the original author.
- Recovery time and data-loss limits are measured rather than assumed.
- Retention and deletion behavior are documented and automated.

## Phase 9 — Performance and scale based on measurement

### Goal

Scale only the bottlenecks that real traffic demonstrates.

### Features and work

- Load-test authentication, event ingestion, pagination, API-key validation, and exports.
- Establish performance budgets for p50, p95, and p99 latency.
- Add caching for safe, high-read, staleness-tolerant data.
- Add a connection pooler when instance count or serverless traffic requires it.
- Use read replicas only for workloads that tolerate replica lag.
- Add queue-based load shedding for non-critical work.
- Add request cancellation and database query timeouts.
- Consider partitioning or archival for very large append-only tables.

### Database work

- Compare query plans before and after every major index or schema change.
- Remove redundant indexes and unused columns from hot queries.
- Tune autovacuum for high-write tables.
- Review lock waits and long-running transactions.
- Test failover, replica lag, pool exhaustion, and cache failure.

### Done when

- Capacity limits and scaling triggers are documented.
- Performance targets hold under expected peak and burst traffic.
- Every optimization has a measured reason and a rollback plan.

## Phase 10 — Governance and continuous improvement

### Goal

Keep production quality from declining as the product changes.

### Features and work

- Maintain an API contract and backward-compatibility policy.
- Publish OpenAPI documentation and generated client types where useful.
- Version breaking API and event-schema changes.
- Require code review for authorization, migrations, indexes, and data-retention changes.
- Run dependency and container vulnerability scans.
- Rotate secrets on a documented schedule.
- Perform periodic access reviews and restore drills.
- Track technical debt, incident actions, and performance regressions.

### Done when

- New features include tests, migration notes, observability, and rollback plans.
- Breaking changes are versioned and communicated.
- Security and recovery checks happen continuously, not only before launch.

## Highest-impact order for this project

If development capacity is limited, implement in this order:

1. Phase 0: baseline, configuration, CI, health checks, and safe errors.
2. Phase 1: authorization and token security.
3. Phase 2: constraints, safe CRUD, and auditability.
4. Phase 3: validated, indexed, deterministic pagination.
5. Phase 4: idempotent event ingestion and retry handling.
6. Phase 5: secure API-key lifecycle.
7. Phase 6: transactions, outbox, and background jobs.
8. Phase 7: logs, metrics, traces, and alerts.
9. Phase 8: tested backups and disaster recovery.
10. Phases 9–10: measured scaling and continuous governance.

The most important principle is to complete reliability and security before adding advanced infrastructure. Caching, replicas, partitioning, and microservices should follow measurements, not replace correct data modeling and operational discipline.

