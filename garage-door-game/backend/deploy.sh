#!/bin/bash

# Build and deploy script for garage-door-backend
set -e

echo "Building TypeScript..."
npm run build

echo "Building Docker image..."
docker build -t gcr.io/its-garages/garage-door-backend .

echo "Pushing Docker image..."
docker push gcr.io/its-garages/garage-door-backend

echo "Deploying to Cloud Run..."
gcloud run deploy garage-door-backend \
  --image gcr.io/its-garages/garage-door-backend \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars NODE_ENV=production

echo "Deployment complete!"
