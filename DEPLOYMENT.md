# Production Deployment Guide (Trip Wala Backend)

This document describes how to deploy, configure, run, and maintain the Trip Wala Backend API in production environments.

---

## 🏗️ Deployment Topology

The recommended production layout consists of:
1. **Application Layer**: Node.js Docker containers running the Express API & BullMQ background workers.
2. **Database Layer**: Managed PostgreSQL (15+).
3. **Caching & Job Queue**: Managed Redis (7+) for Socket.IO presence, rate limiting, and BullMQ queues.
4. **Proxy/Load Balancer**: Nginx or AWS ALB handling SSL termination and routing WebSocket traffic.

---

## 🐳 Docker Deployment

A multi-stage, hardened `Dockerfile` is provided at the root of the project. It features:
* Multi-stage build to exclude build-time devDependencies and minimize final image size (~150MB).
* Non-privileged system user (`node`) execution for high container runtime security.
* Inbuilt environment variable validations on startup.

### 1. Build the Docker Image
```bash
docker build -t trip-wala-backend:latest .
```

### 2. Run with Docker Compose (Production)
We provide a production-hardened `docker-compose.prod.yml` that includes healthchecks for all services.

To deploy in production:
```bash
# 1. Create a production .env file (see Configuration section)
# 2. Run with production settings
docker-compose -f docker-compose.prod.yml up -d
```

---

## ⚙️ Environment Configuration

Ensure the following variables are configured in your production environment or `.env` file:

| Variable | Description | Required / Default |
|----------|-------------|--------------------|
| `PORT` | API listening port | Default: `3000` |
| `NODE_ENV` | Run mode (`production` / `development`) | Required: `production` |
| `DATABASE_URL` | PostgreSQL connection string | Required (URI scheme) |
| `REDIS_URL` | Redis connection string | Required (URI scheme) |
| `JWT_SECRET` | Secure symmetric key for signing access tokens | Required (min 32 chars) |
| `JWT_REFRESH_SECRET` | Secure key for refresh tokens | Required (min 32 chars) |
| `CORS_ORIGIN` | Allowed domains list (comma-separated) | Default: `*` |
| `RATE_LIMIT_WINDOW_MS`| Rate limit sliding window duration (ms) | Default: `900000` (15 mins) |
| `RATE_LIMIT_MAX` | Max requests allowed per window per IP | Default: `100` |

---

## 🔄 Database Migrations & Seeding

Before running the application for the first time or after updating schemas, apply Prisma migrations:

### Apply Migrations
```bash
# In production, use prisma migrate deploy to run pending migrations without dev interactions
npx prisma migrate deploy
```

---

## 🚦 Health Checks & Diagnostics

The platform exposes two dedicated endpoints for infrastructure diagnostics:

### 1. Liveness Check
* **Path**: `/health/live`
* **Purpose**: Used by Kubernetes/Docker orchestrators to detect if the Node.js process is alive.
* **Response**:
  ```json
  {
    "success": true,
    "message": "Process is alive",
    "data": { "status": "up", "uptime": 120.5, "version": "1.0.0" }
  }
  ```

### 2. Readiness Check
* **Path**: `/health/ready`
* **Purpose**: Checks active TCP/socket connections to PostgreSQL, Redis, and BullMQ. Returns HTTP status `200` if all are reachable, or `503` if degraded.
* **Response**:
  ```json
  {
    "success": true,
    "message": "Services are ready",
    "data": {
      "database": "connected",
      "redis": "connected",
      "queue": "connected",
      "version": "1.0.0"
    }
  }
  ```

---

## 🧹 Process Management & Graceful Shutdown

Upon receiving a `SIGTERM` or `SIGINT` signal, the server:
1. Stops the BullMQ background worker to prevent claiming new jobs.
2. Closes the HTTP server to refuse new incoming connections while processing active requests.
3. Disconnects from PostgreSQL and Redis.
4. Exits cleanly after connection drops.
5. Has a hard fallback timeout of 10 seconds to force-kill if processes hang.
