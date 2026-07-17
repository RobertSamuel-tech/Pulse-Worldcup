# PULSE backend (Fastify + Prisma)
# node:24 matches the npm major the lockfile was generated with (npm 11) —
# npm 10 rejects this lockfile over optional-dep entries (utf-8-validate).
FROM node:24-alpine

WORKDIR /app

# Install server deps first (layer-cached)
COPY server/package.json server/package-lock.json ./server/
RUN cd server && npm ci

# Prisma schema lives at the repo root (server/prisma.config.ts points at ../prisma)
COPY prisma ./prisma
COPY server ./server

RUN cd server && npm run build

ENV NODE_ENV=production
WORKDIR /app/server
EXPOSE 4000
CMD ["npm", "start"]
