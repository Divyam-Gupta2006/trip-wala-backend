# Developer Setup Guide – Running the Project

This guide provides instructions to help you set up, run, and test the Trip Wala backend from scratch.

---

## 🛠️ Prerequisites

Before you begin, ensure you have the following installed:
*   **Node.js**: Version `18.x` or `20.x` (LTS is preferred)
*   **npm**: Version `9.x` or higher
*   **Docker & Docker Compose**: For starting PostgreSQL and Redis easily
*   **Git**: For cloning repositories
*   **PostgreSQL** / **Redis**: (Optional if running locally outside Docker containers)

---

## 🚀 Initial Setup

Follow these steps to set up the project locally:

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment Variables
Copy the template file to create your local `.env` configuration:
```bash
cp .env.example .env
```
Open `.env` in a text editor and adjust connection details if needed.

### 3. Start Database Containers
Use Docker Compose to spin up PostgreSQL, Redis, and pgAdmin services:
```bash
docker compose up -d
```
*Verify containers are running:*
```bash
docker compose ps
```

### 4. Run Migrations & Generate Prisma Client
Apply the database schemas and generate Prisma client bindings:
```bash
npx prisma migrate dev
```
*(This automatically runs database migrations and updates typescript client libraries).*

### 5. Seed the Database
Seed the database with realistic development data (profiles, users, trips, expenses):
```bash
npm run db:seed
```

---

## 🏃 Running the Application

### Development Mode
Runs the server with hot-reloading enabled using `ts-node-dev`:
```bash
npm run dev
```
*   **API Base URL**: `http://localhost:3000/api/v1`
*   **Swagger Documentation**: `http://localhost:3000/docs`
*   **Health Endpoints**: 
    *   `GET http://localhost:3000/health` (Overall app health)
    *   `GET http://localhost:3000/health/live` (Process active check)
    *   `GET http://localhost:3000/health/ready` (DB & Redis connection check)

### Building & Running for Production
Compile the project to JavaScript and start the server:
```bash
npm run build
npm start
```

---

## 🧪 Testing, Linting & Formatting

### Running Automated Tests
Run integration tests using Vitest:
```bash
npm run test
```
To run tests in watch mode during development:
```bash
npm run test:watch
```

### Linting & Code Formatting
Run ESLint rules:
```bash
npm run lint
```
Auto-format code files with Prettier:
```bash
npm run format
```

---

## 🐳 Docker Management

*   **Start all services**: `docker compose up -d`
*   **Stop all services**: `docker compose down`
*   **Stop and clear volumes (Warning: resets database data)**: `docker compose down -v`
*   **Rebuild containers**: `docker compose build`

---

## 📱 Connecting the Flutter Mobile Client

To connect your Flutter application to this live backend:

1.  **Configure Base URL**:
    Open the Flutter project in your editor and navigate to:
    `lib/core/config/env_config.dart`.
    Set the API host URL to your server's address:
    *   *Android Emulator*: `http://10.0.2.2:3000/api/v1`
    *   *iOS Simulator*: `http://localhost:3000/api/v1`
    *   *Physical Device*: Use your computer's local IP address (e.g. `http://192.168.1.15:3000/api/v1`)
2.  **Toggle Repositories to API Mode**:
    In the same `env_config.dart` file, set:
    ```dart
    const bool useApiRepositoryProvider = true;
    ```
3.  **Run the Flutter App**:
    Start your app. The `AuthController` will now query `/api/v1/auth/login` instead of the simulated local mock controllers.

---

## 🔍 Troubleshooting

### 1. Database Connection Failures
*   **Symptom**: `PrismaClientInitializationError: Can't reach database server...`
*   **Fix**: Ensure your Docker containers are running (`docker compose ps`). Check that the connection port `5432` is not occupied by a local PostgreSQL service. If you are running PostgreSQL on your host system, stop it or change the port in `docker-compose.yml`.

### 2. Redis Connection Errors
*   **Symptom**: `Error: connect ECONNREFUSED 127.0.0.1:6379`
*   **Fix**: Ensure Redis is running in Docker. Check if another Redis instance is running locally and blocking port `6379`.

### 3. Port Conflicts (Port 3000 already in use)
*   **Fix**: If port 3000 is occupied by another development server, you can change the port in `.env`:
    ```text
    PORT=3001
    ```
