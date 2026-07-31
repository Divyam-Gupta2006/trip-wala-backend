# Security Architecture & Hardening (Trip Wala Backend)

This document details the security layers, policies, and practices implemented in the Trip Wala backend.

---

## 🔐 Authentication & Session Lifecycle

### 1. Two-Tier JWT Architecture
* **Access Tokens**: Short-lived (15 minutes) bearer tokens containing the `userId`, user `name`, and unique `sessionId`.
* **Refresh Tokens**: Long-lived (7 days) tokens stored in PostgreSQL. They can only be exchanged once.

### 2. Strict Single-Use Token Rotation (FIFO)
* When the `/api/v1/auth/refresh` endpoint is hit:
  1. The server verifies the token signature.
  2. The server checks the DB to ensure the token exists and is not revoked.
  3. The server immediately deletes (or revokes) that refresh token from the database.
  4. A brand new `AccessToken` and `RefreshToken` pair is generated and sent to the client.
* **Security Benefit**: If a refresh token is stolen and replayed by an attacker, the request will fail because the token is deleted upon first use, preventing unauthorized access.

### 3. Session Revocation
* When a user logs out (`/api/v1/auth/logout`), their entire `Session` record in the database is deleted.
* Through database cascade rules (`onDelete: Cascade`), all associated active refresh tokens are immediately deleted, instantly invalidating sessions across all user devices.

---

## 🛡️ Input Validation & Serialization

* **Zod Middleware**: All request bodies, parameters, and query options are validated against schema definitions prior to reaching controllers.
* **Strict Schema Parsing**: Zod parses inputs and returns sanitized payloads, stripping out unmapped or unsafe properties to block payload pollution attacks.

---

## 🛢️ SQL Injection Protection

* All standard database interactions are conducted using the **Prisma ORM**. Prisma automatically parameterizes all queries under the hood, completely eliminating SQL injection vectors.
* For the health check raw queries, we use parameterized query templates:
  ```typescript
  await prisma.$queryRaw`SELECT 1`;
  ```
  This is 100% immune to SQL injection. No string interpolation or raw SQL concatenation is allowed in the codebase.

---

## 🌐 HTTP Security Headers (Helmet)

We use `helmet()` middleware globally. This applies standard secure headers:
* **Content-Security-Policy (CSP)**: Mitigates XSS attacks.
* **X-Content-Type-Options**: Set to `nosniff` to prevent browser mime-sniffing.
* **Strict-Transport-Security (HSTS)**: Restricts browsers to secure HTTPS connections only.
* **X-Frame-Options**: Set to `DENY` to prevent clickjacking.
* **Referrer-Policy**: Limits sensitive referrer leakages.

---

## 🚦 Rate Limiting & CORS Configuration

### 1. Rate Limiting
Global rate limiting is enforced via `express-rate-limit`:
* Window: `15 minutes` (customizable via `RATE_LIMIT_WINDOW_MS`).
* Maximum Requests: `100` requests per window (customizable via `RATE_LIMIT_MAX`).
* Exceeded requests receive an HTTP `429 Too Many Requests` status code with a structured error payload.

### 2. CORS Policy
CORS origins are explicitly restricted via configuration:
* In production, the allowed origins must be explicitly listed in the `CORS_ORIGIN` env variable (e.g. `https://app.tripwala.com`).
* Wildcards (`*`) are disallowed for credentials-enabled paths.

---

## 🚫 Error Sanitation & Leakage Prevention

* Global error handlers intercept all thrown errors.
* **In Production**: Any `500 Internal Server Error` message is sanitized to `"An unexpected error occurred"` before being sent to the client.
* Call stacks, database table layouts, and library logs are recorded securely in stdout via **Pino** but are never exposed in the HTTP response envelope.
