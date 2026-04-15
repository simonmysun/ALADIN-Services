# ---- build stage ----
FROM node:20-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY src/ src/
COPY tsconfig.json import-meta-url.js ./

RUN npm run build

# Install only production deps for the runtime image.
# @electric-sql/pglite is excluded from the bundle (WASM cannot be inlined)
# so it must be present in node_modules at runtime.
RUN npm ci --omit=dev

# ---- production stage ----
FROM node:20-alpine

WORKDIR /app

COPY --from=build /app/build/ ./build/
COPY --from=build /app/node_modules/@electric-sql/pglite ./node_modules/@electric-sql/pglite

EXPOSE 3000

CMD ["node", "build/index.js"]
