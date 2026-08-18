# ==========================================================================
# Gentan Storage - Multi-stage Dockerfile
# ==========================================================================

# --- Stage 1: Build React Frontend ---
FROM node:20-alpine AS frontend-builder
WORKDIR /app/web
COPY web/package*.json ./
RUN npm install
COPY web/ ./
RUN npm run build

# --- Stage 2: Build Express Backend ---
FROM node:20-alpine AS backend-builder
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm install
COPY backend/ ./
RUN npm run build

# --- Stage 3: Production Runner ---
FROM node:20-alpine AS runner
WORKDIR /app
COPY --from=backend-builder /app/backend/package*.json ./backend/
RUN cd backend && npm install --omit=dev
COPY --from=backend-builder /app/backend/dist ./backend/dist
COPY --from=frontend-builder /app/web/dist ./web/dist

EXPOSE 5000
WORKDIR /app/backend
ENV PORT=5000
ENV NODE_ENV=production

# Mount point for database & upload cache
VOLUME ["/app/backend/data"]

CMD ["node", "dist/server.js"]
