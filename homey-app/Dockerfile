FROM node:20-alpine AS base

# Add labels
LABEL maintainer="Smart Home Pro"
LABEL description="Smart Home Pro - Advanced Dashboard & Automation Platform"
LABEL version="1.0.0"

# Set working directory
WORKDIR /app

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Copy package files first (layer caching)
COPY package.json package-lock.json* ./

# Install production dependencies only
RUN npm ci --omit=dev --ignore-scripts 2>/dev/null || npm install --omit=dev --ignore-scripts

# Copy application code
COPY . .

# Create non-root user
RUN addgroup -g 1001 -S smarthome && \
    adduser -S smarthome -u 1001 -G smarthome

# Create data directory for persistence
RUN mkdir -p /app/data && chown -R smarthome:smarthome /app/data

# Switch to non-root user
USER smarthome

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# Environment variables
ENV NODE_ENV=production
ENV PORT=3000

# Start with dumb-init for proper PID 1 signal handling
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "server.js"]
