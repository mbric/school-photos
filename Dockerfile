# ── Stage 1: Install dependencies ──
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ── Stage 2: Build ──
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build Next.js (standalone output)
RUN npm run build

# ── Stage 3: Production ──
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy standalone build
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Copy Prisma schema + migrations + full node_modules needed for migrate
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules ./node_modules

# Copy entrypoint
COPY --from=builder /app/start.sh ./start.sh
RUN chmod +x ./start.sh

# Create data directory for SQLite + photo storage (will be mounted as volume)
RUN mkdir -p /data/photos && chown -R nextjs:nodejs /data

USER nextjs

EXPOSE 3000

CMD ["./start.sh"]
