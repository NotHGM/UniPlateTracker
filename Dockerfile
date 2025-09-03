# /Dockerfile (Corrected)

# =============================================
# Stage 1: Build Dependencies
# =============================================
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

# =============================================
# Stage 2: Build the Application
# =============================================
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Increase memory for the Node.js build process
ENV NODE_OPTIONS="--max-old-space-size=4096"

# Accept all build arguments required by the Next.js build process
ARG APP_REGION
ARG ENABLE_INTERNATIONAL_API
ARG NEXTAUTH_URL
ARG ENABLE_VIDEO_CAPTURE

# Set the environment variables for the build process to use
ENV APP_REGION=$APP_REGION
ENV ENABLE_INTERNATIONAL_API=$ENABLE_INTERNATIONAL_API
ENV NEXTAUTH_URL=$NEXTAUTH_URL
ENV ENABLE_VIDEO_CAPTURE=$ENABLE_VIDEO_CAPTURE

# This command builds both the Next.js app and the worker's TypeScript code
RUN npm run build

# =============================================
# Stage 3: Final Production Image
# =============================================
FROM node:20-alpine AS runner
WORKDIR /app

# Set environment to production
ENV NODE_ENV production

# Unset the build-time memory option for runtime
ENV NODE_OPTIONS=""

# Copy built Next.js app, worker, and dependencies
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/worker/dist ./worker/dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

# Copy and make the startup script executable
COPY --from=builder /app/start.sh ./start.sh
RUN chmod +x ./start.sh

# Expose ports for Next.js app and the worker
EXPOSE 3000
EXPOSE 4000

# This command will run the start.sh script
CMD ["./start.sh"]