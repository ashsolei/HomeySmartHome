# ── Stage 1: Install dependencies ──
FROM node:22-alpine AS deps

WORKDIR /app

# Copy package files for layer caching
COPY package.json package-lock.json* ./

# Install production dependencies only
RUN npm ci --omit=dev 2>/dev/null || npm install --omit=dev

# ── Stage 2: Production image ──
FROM node:22-alpine AS production

# Add labels
LABEL maintainer="Smart Home Pro"
LABEL description="Smart Home Dashboard - Real-time Dashboard & Analytics"
LABEL version="3.3.0"

# Install dumb-init for PID 1 handling (wget is included in alpine)
RUN apk add --no-cache dumb-init

# Create non-root user early
RUN addgroup -g 1001 -S dashboard && \
    adduser -S dashboard -u 1001 -G dashboard

WORKDIR /app

# Copy only production node_modules from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy application code
COPY . .

# Create data directory for persistence
RUN mkdir -p /app/data && chown -R dashboard:dashboard /app/data

# Switch to non-root user
USER dashboard

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3001/health || exit 1

# Environment variables
ENV NODE_ENV=production
ENV PORT=3001

# Start with dumb-init for proper PID 1 signal handling
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "server.js"]
