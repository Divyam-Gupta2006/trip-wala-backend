# Trip Wala Backend Service

Production-ready backend API service for **Trip Wala**, a social travel companion platform designed to connect travelers, coordinate budgets, and provide real-time updates.

---

## 🛠️ Technology Stack
*   **Runtime**: Node.js (v18/v20)
*   **Language**: TypeScript
*   **Framework**: Express.js
*   **Database ORM**: Prisma ORM with PostgreSQL
*   **Cache & Queueing**: Redis with BullMQ
*   **Logging**: Pino (Structured JSON logging)
*   **Validation**: Zod (Runtime type validations)
*   **Testing**: Vitest with Supertest
*   **Containerization**: Docker & Docker Compose
*   **API Spec**: OpenAPI / Swagger UI

---

## 🚀 Quick Start

### 1. Installation
Install dependencies:
```bash
npm install
```

### 2. Configure Infrastructure
Spin up databases:
```bash
docker compose up -d
```

### 3. Run Migrations & Seeding
```bash
npx prisma migrate dev
npm run db:seed
```

### 4. Run Development Server
```bash
npm run dev
```
*   **API Endpoint**: `http://localhost:3000/api/v1`
*   **Swagger Documentation**: `http://localhost:3000/docs`
*   **Health Status**: `http://localhost:3000/health`

---

## 📚 Documentation Reference Files
*   [**RUNNING_THE_PROJECT.md**](file:///d:/projects/trip_wala_backend/RUNNING_THE_PROJECT.md): Full onboarding setup, testing, and troubleshooting steps.
*   [**ARCHITECTURE.md**](file:///d:/projects/trip_wala_backend/ARCHITECTURE.md): Design patterns, validation lifecycles, and standard response payload envelopes.
