# Backend Quality Blueprint for Senior-Level Engineering

## 1) Before writing any API, think like a senior engineer

Do not start by writing route code or Prisma models. Start by understanding the real problem.

Ask:
- What problem is this feature solving?
- Who is using it?
- What are the happy paths?
- What are the failure paths?
- What can break?
- What assumptions are we making?
- How should this scale in the future?

### Junior mindset
- “I need to create a login route.”

### Senior mindset
- “A user should be able to sign in securely, receive valid tokens, and be rejected with clear errors if credentials are wrong, expired, or rate-limited.”

---

## 2) Design the API contract before implementation

Before writing code, define these for every endpoint:
- path
- method
- request body
- auth requirement
- validation rules
- response shape
- success status code
- failure status codes
- edge cases

### Example

POST /api/v1/auth/login

Request:
```json
{
  "email": "user@example.com",
  "password": "12345678"
}
```

Success response:
```json
{
  "status": "success",
  "data": {
    "accessToken": "...",
    "refreshToken": "..."
  }
}
```

Error response:
```json
{
  "status": "error",
  "message": "Invalid email or password",
  "code": "INVALID_CREDENTIALS"
}
```

### Good API design principles
- use resource nouns, not action names
- keep routes consistent
- use versioned APIs like /api/v1
- return consistent response structures
- use proper HTTP status codes
- add pagination/filtering for list endpoints
- document auth rules clearly

---

## 3) Think in invariants

A senior engineer works with invariants.

Examples:
- A user cannot create a project without authentication.
- A project must belong to exactly one user.
- An API key cannot be stored in plain readable form.
- A revoked API key must never be accepted.
- Admin users can access all projects, but normal users can access only their own.

These rules should be explicit before code exists.

---

## 4) Before writing database design, think about the real domain

Do not jump directly into Prisma models.

Start by listing the domain entities and relationships:
- User
- Project
- API key
- Role
- Ownership
- Status
- Expiry
- Audit events

Then ask:
- What belongs to whom?
- What is one-to-many, many-to-many, or one-to-one?
- Can a record be deleted or should it be archived?
- Should this be soft-deleted instead of hard-deleted?
- What is required vs optional?
- What data is sensitive?

### Example relationship model
- One User has many Projects
- One Project has many API keys
- One User has many tokens or sessions
- One Project can have multiple statuses over time

This is the correct starting point.

---

## 5) Think about lifecycle, not just storage

A production DB is not only about storing values. It is about modeling lifecycle.

Ask these questions:
- When is the record created?
- When is it updated?
- When is it deleted?
- When is it revoked?
- When does it expire?
- When was it last used?
- Who changed it?

Good domain design includes:
- createdAt
- updatedAt
- deletedAt
- revokedAt
- expiresAt
- lastUsedAt
- createdBy / updatedBy

A junior model often stops at:
- id
- email
- password
- createdAt

A senior model thinks beyond storage and models the full lifecycle.

---

## 6) Design queries before schema

Before writing Prisma models, ask:
- What queries will run often?
- Which columns will be filtered on?
- Which relationships will be joined?
- Which fields need indexes?
- Which operations are read-heavy or write-heavy?

Example for your project:
- find user by email
- find projects by userId
- find API keys by projectId
- find active/inactive/revoked keys
- find projects by status

If you know those queries upfront, you can design a better schema.

---

## 7) Design for correctness and safety

Good DB design protects correctness.

Think about:
- unique constraints
- not-null rules
- optional fields
- relation constraints
- cascade behavior
- soft delete policy
- audit trail
- permission boundaries

Example:
If API keys are sensitive, never store the raw key in a readable field. Store the hash and keep the raw value only for the first response.

---

## 8) Good backend architecture separates layers

A senior backend keeps these layers clean:
- routes / HTTP layer
- controllers / request handling
- services / business logic
- data access / Prisma layer
- utils / shared helpers
- errors / validation middleware

### Antipattern to avoid
A route file doing everything:
- parse request
- validate input
- call DB
- enforce business rules
- send response

### Preferred structure
- controller handles HTTP specifics
- service handles business rules
- Prisma handles persistence

This separation is critical for maintainability and debugging.

---

## 9) Define business rules before coding

Every feature should have explicit business rules.

Examples:
- A user cannot delete another user’s project.
- A project name cannot be empty.
- A duplicate email must be rejected.
- Admin users can read all projects.
- A revoked API key cannot be used.
- Refresh tokens must be rotated.

These are not “extra validation checks.” They are domain rules.

---

## 10) Think about failure modes before happy path

A senior engineer thinks through failure before implementing success.

Ask:
- What happens if the token is invalid?
- What happens if projectId is missing?
- What happens if the user is unauthorized?
- What happens if the DB returns null?
- What happens if a record is not found?
- What happens if an API key is revoked?
- What happens during duplicate insert?
- What happens if the request body is malformed?
- What happens if the refresh token is reused?

Then define the exact error contract and status codes.

---

## 11) Always think about edge cases

Junior developers often code only the happy path.
Senior engineers design edge cases first.

Examples:
- invalid Bearer token
- expired refresh token
- cookie missing in Safari/private mode
- duplicate email registration
- user trying to access another user’s project
- API key generated but not returned correctly
- project renamed to blank value
- database timeout while creating a record

This is where senior-level thinking shows up.

---

## 12) Senior-level API design checklist

Before writing an endpoint, confirm:
- resource name is clear
- method is correct
- route is consistent with rest of the project
- auth requirement is clear
- request validation is defined
- response shape is defined
- error shape is defined
- unauthorized and forbidden cases are handled
- pagination/filtering is considered
- versioning is planned

---

## 13) Senior-level DB design checklist

Before finalizing schema, confirm:
- entities and relationships are correct
- constraints are explicit
- unique keys are correctly defined
- indexes support actual accesses
- soft-delete or archive strategy exists where needed
- lifecycle fields exist
- sensitive fields are hashed or encrypted
- audit trail is considered
- data integrity rules are enforced

---

## 14) Senior-level backend quality checklist

Use this for every feature:
- requirement understood clearly
- API contract defined
- business rules defined
- validation rules defined
- endpoint secured
- DB access optimized
- error handling consistent
- test coverage considered
- code is maintainable
- future scale is considered

---

## 15) The real difference between junior and senior engineers

### Junior engineer mindset
- writes route first
- writes DB schema as they go
- focus on getting it to work
- handles errors ad hoc
- ignores edge cases until later
- cares mainly about “the feature works”

### Senior / SDE-2 mindset
- designs the contract first
- understands ownership and security first
- models lifecycle and scale first
- separates concerns cleanly
- defines edge cases early
- writes code for maintainability and safety
- thinks like a system designer, not just a code writer

---

## 16) A practical rule to follow always

Before writing any API, DB schema, or backend logic, ask this sequence:

1. What is the business requirement?
2. Who owns the data?
3. What is the contract?
4. What are the validation rules?
5. What are the security rules?
6. What is the data model?
7. What are the edge cases?
8. What are the failure cases?
9. How should this be tested?
10. How will this scale and stay maintainable?

If you can answer these, you are thinking like a senior backend engineer.

---

## 17) What to apply in your EventLedger project specifically

### API improvements to think about
- version your endpoints
- standardize route naming
- create consistent response format
- add pagination to list endpoints
- define proper 401, 403, and 404 behavior
- support both bearer token and cookie token fallback
- design admin access rules clearly

### DB improvements to think about
- add indexes for common queries
- add lifecycle info for API keys
- add status tracking and expiry logic
- decide on soft delete vs hard delete
- define ownership clearly via userId/projectId
- add audit fields when needed

### Backend quality improvements to think about
- keep controllers thin
- enforce business logic in service layer
- centralize validation and errors
- use AppError consistently
- write tests for critical flows
- keep types strong and explicit

---

## 18) Final takeaway

To move from junior-level backend thinking to senior-level / SDE-2 thinking:

- design before coding
- model real domain rules
- define API contracts before implementation
- think in terms of ownership, security, lifecycle, and scale
- create clean separation between routes, services, and DB access
- treat edge cases as part of the design, not as a later fix

That is the difference between writing code and engineering software.
