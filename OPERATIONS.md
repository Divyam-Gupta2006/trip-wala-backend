# Operations & Monitoring Runbook (Trip Wala Backend)

This document contains standard runbook instructions for operating, monitoring, and debugging the Trip Wala Backend service in production.

---

## 📊 Structured Logging

We use **Pino** for fast, JSON-structured logging.

### 1. Log Levels
* `fatal`: System crash or critical startup failure (e.g. database unreachable).
* `error`: Expected or unexpected internal exceptions (5xx errors, failed jobs).
* `warn`: Non-fatal API issues (4xx validations, rate limits, slow caches).
* `info`: General operational events (server booted, database synced, worker started).
* `debug`: Verbose debugging context (active socket events, individual job details).

### 2. Output Format (Production)
In production (`NODE_ENV=production`), logs are written in a single-line JSON format:
```json
{"level":30,"time":1785489275812,"pid":28895,"hostname":"api-server-1","requestId":"ceb54849-8fa0-4c5c-8684-e4957b60eab3","method":"POST","url":"/api/v1/trust/memories","statusCode":201,"duration":"29ms","userId":"28895fbf-3de3-487a-874f-169cb60851f9","msg":"HTTP POST /api/v1/trust/memories 201 in 29ms"}
```
This is fully compatible with log aggregation tools (e.g., Datadog, ELK Stack, AWS CloudWatch).

---

## ⚙️ Background Worker Monitoring

Background queues are managed by **BullMQ**.

### 1. Job Configurations
* **Retries**: All jobs are configured to retry up to **3 times** if they fail.
* **Backoff**: An exponential backoff policy of `2000ms * 2^retry_attempt` is applied to avoid overwhelming external dependencies (like SMTP or external services).
* **Retention**:
  * Completed jobs are kept in Redis for **24 hours** before automatic eviction.
  * Failed jobs are retained for **7 days** to allow operators to review failures, fix underlying issues, and manually retry them if necessary.

### 2. Manual Worker Dashboard
To view queue health in real-time, operators can use utilities such as `bull-board` or connect a Redis client to monitor the `trip-wala-jobs` namespace.

---

## 🚦 Health Probes & Load Balancing

For Kubernetes or Docker swarm orchestrators:

* **Liveness Probe**:
  * Endpoint: `/health/live`
  * Action: If HTTP status is not `200`, the orchestrator will restart the container.
* **Readiness Probe**:
  * Endpoint: `/health/ready`
  * Action: If HTTP status is not `200`, the load balancer will stop sending traffic to this container. It will resume once dependencies recover.

---

## 📉 Troubleshooting Common Issues

### 1. High CPU or Out of Memory
* **Cause**: Large payloads or memory leaks from active socket connections.
* **Resolution**: Scale the application horizontally. Ensure Socket.IO uses the Redis adapter so clients can join rooms across different nodes.

### 2. Redis Connection Terminated / Queue Blocked
* **Symptoms**: Background jobs are not executing, health check shows `queue: failed`.
* **Resolution**: Verify the `REDIS_URL`. Check Redis server memory capacity. Ensure the Redis server has sufficient connection limits. Restarting the backend will re-initialize the connection.
