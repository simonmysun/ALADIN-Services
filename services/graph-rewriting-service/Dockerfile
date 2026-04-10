# ── Stage 1: builder ─────────────────────────────────────────────────────────
# Bundles TypeScript to JavaScript via esbuild.
FROM node:22-slim AS builder

WORKDIR /build

# Install dependencies first (separate layer for better cache reuse)
COPY package.json package-lock.json ./
RUN npm ci

# Copy source and build
COPY tsconfig.json ./
COPY scripts/ ./scripts/
COPY src/ ./src/
RUN npm run build

# ── Stage 2: runtime ──────────────────────────────────────────────────────────
# Lightweight runtime using bundled JavaScript only.
# Neo4j is deployed as a separate service (configured via environment variables).
FROM node:22-alpine

WORKDIR /app

# Copy bundled app output from builder
COPY --from=builder /build/dist ./dist

# ── Environment defaults ───────────────────────────────────────────────────────
# Neo4j connection is configured via environment variables.
# When using docker-compose, these will be set from the Neo4j service name.
ENV APP_ENV=production \
    NODE_ENV=production \
    NEO4J_URI=bolt://neo4j:7687 \
    NEO4J_USERNAME=neo4j \
    NEO4J_PASSWORD=neo4j

# ── Port ────────────────────────────────────────────────────────────────────────
# 8080  – Fastify HTTP API
EXPOSE 8080

# Health check (optional)
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:8080/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

# CLI is also available inside the container:
#   docker run --rm -e NEO4J_URI=... graph-rewriting-service node dist/cli.js transform /data/request.json

# Start API server by default
CMD ["node", "dist/index.js"]
