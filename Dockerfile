# =============================================
# STAGE 1: Build Backend (NestJS)
# =============================================
FROM node:20-alpine AS backend-builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/
COPY prisma.config.ts ./

# Install dependencies
RUN npm ci --only=production=false

# Generate Prisma client
RUN npx prisma generate

# Copy source code
COPY . .

# Build NestJS
RUN npm run build

# =============================================
# STAGE 2: Production Image
# =============================================
FROM node:20-alpine AS production

WORKDIR /app

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Copy built files
COPY --from=backend-builder /app/dist ./dist
COPY --from=backend-builder /app/node_modules ./node_modules
COPY --from=backend-builder /app/prisma ./prisma
COPY --from=backend-builder /app/prisma.config.ts ./prisma.config.ts
COPY --from=backend-builder /app/package.json ./

# Create uploads directory
RUN mkdir -p uploads/receipts uploads/avatars uploads/parameters

# Set environment
ENV NODE_ENV=production

# Expose port
EXPOSE 3000

# Start app (migration sẽ được Railway chạy riêng qua preDeployCommand)
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/main"]
