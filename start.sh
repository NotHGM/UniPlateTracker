#!/bin/sh
# /start.sh

# Start the video buffer manager in the background
echo "Starting Video Buffer Manager..."
node worker/dist/buffer-manager.js &

# Start the webhook worker in the background
echo "Starting Webhook Worker..."
node worker/dist/index.js &

# Start the Next.js application in the foreground
echo "Starting Next.js Application..."
npm start