# Base node image
ARG NODE_VERSION=22
FROM node:${NODE_VERSION}-slim AS base

# Set working directory
WORKDIR /app

# Install openssl for Prisma
RUN apt-get update && apt-get install -y openssl

# Install dependencies only when needed
FROM base AS deps
# Install dependencies needed for node-gyp
RUN apt-get update && apt-get install -y python3 make g++

# Copy package files
COPY package.json package-lock.json* ./

# Install dependencies
RUN npm ci

# Build the app
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma client and build the application
RUN npx prisma generate
RUN npm run build

# Production image, copy all the files and run the app
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

# Copy necessary files - modified to ensure all build artifacts are included
COPY --from=builder /app/build ./build
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/package-lock.json ./package-lock.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/start.sh ./start.sh

# Install only production dependencies
RUN npm ci --omit=dev

# Expose the port the app runs on
EXPOSE 3000

# Run the application
CMD ["./start.sh"]
