# Changelog - Trip Wala Backend API

All notable changes to the Trip Wala Backend project are documented here.

---

## [Phase 9] - Production Hardening & Infrastructure (Latest)
### Added
* Built a high-performance **BullMQ** background job queue infrastructure with dedicated Redis connection pools.
* Configured a centralized worker thread in `src/core/jobs/worker.ts` with handlers for:
  * Notification fan-out (`notification-fanout`)
  * SMTP email delivery (`email-delivery`)
  * Database cleanup (`cleanup`)
  * Trust score recalculation (`trust-score-recalculate`)
  * Daily scheduled maintenance (`maintenance`)
* Hardened database schema by adding custom indexes on fields:
  * `Trip` (`destination`, `status`, `isDeleted`)
  * `TripMember` (`userId`)
  * `Message` (`conversationId`, `senderId`, `tripId`)
  * `ConversationParticipant` (`userId`)
  * `Notification` (`userId`, `actorId`, `isRead`)
  * `RefreshToken` (`sessionId`)
* Implemented Redis cache-aside caching with automatic cache invalidation for **Notification Preferences** to avoid PostgreSQL bottleneck query flows.
* Configured automated presence sweeping on server startup to delete stale online status keys from Redis.
* Created a multi-stage Docker environment (`Dockerfile` and `docker-compose.prod.yml`) running the application under the non-privileged `node` user.
* Created a complete **GitHub Actions CI Pipeline** (`.github/workflows/ci.yml`) validating style formatting, Lint rules, TypeScript compilation, DB migrations, and executing all 96 integration tests on temporary PostgreSQL/Redis services.

---

## [Phase 8] - Trust & Safety
### Added
* Centralized Trust Engine evaluating profile completion status, traveler reviews, verified channels (socials, identity, phone), and memory counts.
* Identity Verification management system.
* Guardian and emergency contacts system.
* Travel memories system with visibility permissions.

---

## [Phase 7] - Expenses & Settlements
### Added
* Shared trip expenses engine with support for Equal, Percentage, and Custom split calculations.
* Peer-to-peer settlement tracking and balance sheets.

---

## [Phase 6] - Notifications
### Added
* Centralized in-app notification publisher.
* User preference settings for customizing event alerts.

---

## [Phase 5] - Messaging & Real-Time Communication
### Added
* Real-time messaging service powered by **Socket.IO**.
* Group chats for trips and personal direct messaging.
* Real-time read receipts, typing indicators, and user presence (online/offline status) tracked via Redis.

---

## [Phase 4] - Applications & Invitations
### Added
* Trip application flow with organizer review states.
* Trip invitation flow with invitee acceptance and rejection logic.
* Capacity manager enforcing maximum limit caps and auto-transitioning trip status between `open` and `full`.
