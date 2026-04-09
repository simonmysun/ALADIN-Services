# ---- build stage ----
FROM node:20-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY src/ src/
COPY tsconfig.json import-meta-url.js ./

RUN npm run build

# ---- production stage ----
FROM node:20-alpine

WORKDIR /app

COPY --from=build /app/build/index.js ./build/index.js

EXPOSE 3000

CMD ["node", "build/index.js"]
