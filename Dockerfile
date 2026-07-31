# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /usr/src/app

# Copy dependency manifests
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies (including devDependencies for compilation)
RUN npm ci

# Copy source code and config files
COPY tsconfig.json ./
COPY src ./src

# Generate Prisma Client and compile TypeScript to JavaScript
RUN npm run prisma:generate && npm run build

# Stage 2: Production runner
FROM node:20-alpine AS runner

WORKDIR /usr/src/app

ENV NODE_ENV=production

# Copy built artifacts and package manifests
COPY package*.json ./
COPY prisma ./prisma/
COPY --from=builder /usr/src/app/dist ./dist
COPY --from=builder /usr/src/app/node_modules ./node_modules

# Clean up devDependencies, keeping only production dependencies
RUN npm prune --production

# Expose server port
EXPOSE 3000

# Set non-privileged system user for runtime security
USER node

# Start script
CMD ["node", "dist/server.js"]
