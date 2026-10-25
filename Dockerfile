# Production image: one container serves the API and the built frontend on the same origin.
#   docker build -t retailpulse .
#   docker run -p 4000:4000 --env-file backend/.env.production retailpulse

# 1. Frontend: type check and build static files
FROM node:22-slim AS frontend
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# 2. Backend: install, generate the Prisma client, compile TypeScript, cache the embedding model
FROM node:22-slim AS backend
# Prisma's migration engine needs OpenSSL, which the slim image leaves out.
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app/backend
COPY backend/package.json backend/package-lock.json backend/prisma.config.ts ./
COPY backend/prisma ./prisma
# prisma.config.ts reads DATABASE_URL; generating the client doesn't connect, so a placeholder is enough.
RUN DATABASE_URL=postgresql://build:build@localhost:5432/build npm ci
COPY backend/ ./
RUN npm run build && node scripts/prefetch-model.mjs

# 3. Runtime
FROM node:22-slim
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production \
    PORT=4000 \
    FRONTEND_DIST=/app/frontend/dist
WORKDIR /app/backend
COPY --from=backend --chown=node:node /app/backend ./
COPY --from=frontend --chown=node:node /app/frontend/dist /app/frontend/dist
USER node
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s \
  CMD node -e "fetch('http://localhost:' + process.env.PORT + '/api/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"
# Applies pending migrations (safe to repeat), then starts the server.
CMD ["npm", "run", "start:prod"]
