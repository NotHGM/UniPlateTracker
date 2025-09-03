# /Dockerfile

# =============================================
# Stage 1: Build Dependencies for BOTH projects
# =============================================
FROM node:20-alpine AS deps
WORKDIR /app

# Install root (Next.js) dependencies first
COPY package.json package-lock.json* ./
RUN npm ci

# Install worker dependencies separately
COPY worker/package.json worker/package-lock.json* ./worker/
RUN cd worker && npm ci

# =============================================
# Stage 2: Build the Application
# =============================================
FROM node:20-alpine AS builder
WORKDIR /app

# Copy dependencies for BOTH projects from the previous stage
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/worker/node_modules ./worker/node_modules

# Copy all source code over
COPY . .

# Pass and set the required build-time environment variables
ARG APP_REGION
ARG ENABLE_INTERNATIONAL_API
ARG NEXTAUTH_URL
ARG ENABLE_VIDEO_CAPTURE
ENV APP_REGION=$APP_REGION
ENV ENABLE_INTERNATIONAL_API=$ENABLE_INTERNATIONAL_API
ENV NEXTAUTH_URL=$NEXTAUTH_URL
ENV ENABLE_VIDEO_CAPTURE=$ENABLE_VIDEO_CAPTURE

# Increase memory for the build process just in case
ENV NODE_OPTIONS="--max-old-space-size=4096"

# Run the build script which will now succeed
RUN npm run build

# =============================================
# Stage 3: Final Production Image
# =============================================
FROM node:20-alpine AS runner
WORKDIR /app

# Set environment to production
ENV NODE_ENV production

# Copy Next.js files
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/start.sh ./start.sh

# Copy Worker files
COPY --from=builder /app/worker/dist ./worker/dist
COPY --from=builder /app/worker/package.json ./worker/package.json
COPY --from=builder /app/worker/node_modules ./worker/node_modules
COPY --from=builder /app/scripts ./scripts

# Make the startup script executable
RUN chmod +x ./start.sh

# Expose ports for Next.js app and the worker
EXPOSE 3000
EXPOSE 4000

# This command will run the start.sh script
CMD ["./start.sh"]