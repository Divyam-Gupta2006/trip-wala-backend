# Performance & Database Optimization Guide (Trip Wala Backend)

This document details the optimizations, indexing designs, caching strategies, and scalability parameters implemented in the Trip Wala Backend.

---

## 🛢️ Database Indexing Strategy

To maintain sub-millisecond query execution times, we have indexed all foreign keys, status columns, and pagination cursor candidates:

1. **`Trip`**:
   * `destination` -> Accelerated search queries by travel spots.
   * `status` -> Optimized dashboard filtering (draft, open, completed).
   * `isDeleted` -> Faster soft-delete filtering.
2. **`TripMember`**:
   * `userId` -> Accelerated query to fetch user membership history.
3. **`Message`**:
   * `conversationId` -> Rapid chat scrollbacks.
   * `senderId` -> Optimized sender audit tracking.
   * `tripId` -> Trip history lookup.
4. **`ConversationParticipant`**:
   * `userId` -> Accelerated lookup of active conversation lists.
5. **`Notification`**:
   * `userId`, `actorId`, `isRead` -> Optimizes notifications center listing and unread count aggregation.
6. **`RefreshToken`**:
   * `sessionId` -> Quick session revocation checks during token rotation.

---

## 🏎️ Caching & Invalidation Architecture

We utilize Redis as a high-performance side-cache layer:

### Notification Preferences Caching (Cache-Aside)
1. **Reads**:
   * When checking preferences via `getPreferences(userId)`, the app queries Redis key `cache:preferences:${userId}` first.
   * On cache hit, data is parsed and returned instantly (latency < 1ms, skipping database queries).
   * On cache miss, it queries PostgreSQL, writes back to Redis with a **1 hour TTL**, and returns.
2. **Invalidations**:
   * When preferences are updated via `updatePreferences(userId, data)`, the app invalidates the cache by deleting key `cache:preferences:${userId}` in Redis.
   * The next read will pull fresh configuration from PostgreSQL.

---

## 🔄 N+1 Query Prevention

Prisma queries are audited to prevent N+1 query problems:
* Instead of running queries inside loops, we use Prisma's `include` features to fetch relations (e.g. including `actor` profile information in notifications fetch in one single JOIN query).
* Batch queries are executed using Prisma Transactions (`prisma.$transaction`) to minimize network roundtrips.

---

## 📄 Cursor-Based Pagination

For high-volume datasets (like Messaging, Notifications, and Rating listings), we enforce **Cursor-Based Pagination** over offset-based pagination:
* **The Problem**: Offset pagination (`LIMIT 10 OFFSET 10000`) becomes increasingly slow as offset grows because the database must scan all previous records.
* **The Solution**: Cursor pagination uses the `id` of the last item fetched as a marker. The next query searches for records where `createdAt < cursorCandidate` (or `id > cursorCandidate`), which utilizes index lookups and maintains O(1) performance regardless of depth.

---

## 🔌 Socket.IO Presence & Scalability

1. **State Storage**: User online status and active socket attachments are tracked via Redis sets (`presence:user:${userId}`). This allows the app to support multiple node clusters because presence is shared on a single cache rather than local Node.js memory.
2. **Stale Presence Purging**: On server startup, the server automatically runs:
   ```typescript
   await redis.keys('presence:*').then(async (keys) => {
     if (keys.length > 0) await redis.del(...keys);
   });
   ```
   This immediately sweeps stale presence records resulting from previous unclean shutdowns or server crashes.
