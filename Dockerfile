# PULSE backend (Fastify + Prisma) — deployed on Railway
FROM node:22-alpine

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
