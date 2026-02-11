# ── Stage 1: Install dependencies ──
FROM node:22-alpine AS deps

WORKDIR /app

# Copy package files for layer caching
COPY package.json package-lock.json* ./

# Copy the homey shim package (needed for npm install)
COPY lib/standalone/homey-shim-pkg ./lib/standalone/homey-shim-pkg

# Install production dependencies only
RUN npm ci --omit=dev --ignore-scripts 2>/dev/null || npm install --omit=dev --ignore-scripts

# ── Stage 2: Production image ──
FROM node:22-alpine AS production

# Add labels
LABEL maintainer="Smart Home Pro"
LABEL description="Smart Home Pro - Advanced Dashboard & Automation Platform"
LABEL version="3.1.0"

# Install dumb-init + curl for health checks
RUN apk add --no-cache dumb-init curl

# Create non-root user early
RUN addgroup -g 1001 -S smarthome && \
    adduser -S smarthome -u 1001 -G smarthome

WORKDIR /app

# Copy only production node_modules from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy application code
COPY . .

# Create data directory for persistence
RUN mkdir -p /app/data && chown -R smarthome:smarthome /app/data

# Switch to non-root user
USER smarthome

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Environment variables
ENV NODE_ENV=production
ENV PORT=3000

# Start with dumb-init for proper PID 1 signal handling
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "server.js"]
