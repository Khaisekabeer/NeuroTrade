# Dockerfile for the Neuro Trade dashboard (Next.js + Bun)
# Multi-stage build: install deps → build → run (small final image)

# ---- Stage 1: Install dependencies ----
FROM oven/bun:1.1 AS deps
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# ---- Stage 2: Build the Next.js app ----
FROM oven/bun:1.1 AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Generate Prisma client
RUN bun run db:generate
# Build Next.js (standalone output)
RUN bun run build

# ---- Stage 3: Production image (small) ----
FROM oven/bun:1.1 AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Copy standalone build + public + static
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Copy Prisma files (needed for database access)
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

# Create the database directory
RUN mkdir -p /app/db

# Expose port 3000
EXPOSE 3000

# Start the app
CMD ["bun", ".next/standalone/server.js"]
