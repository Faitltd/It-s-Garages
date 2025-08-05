#!/bin/bash

# Garage Door Game - Google Cloud Run Deployment Script
# This script deploys both backend and frontend to Google Cloud Run

set -e

# Configuration
PROJECT_ID="its-garages"
REGION="us-central1"
BACKEND_SERVICE="garage-door-backend"
FRONTEND_SERVICE="garage-door-frontend"

echo "🚀 Starting deployment to Google Cloud Run..."

# Set the project
gcloud config set project $PROJECT_ID

# Enable required APIs
echo "📋 Enabling required APIs..."
gcloud services enable cloudbuild.googleapis.com
gcloud services enable run.googleapis.com
gcloud services enable containerregistry.googleapis.com

# Deploy Backend
echo "🔧 Deploying backend service..."
cd backend
gcloud builds submit --tag gcr.io/$PROJECT_ID/$BACKEND_SERVICE
gcloud run deploy $BACKEND_SERVICE \
  --image gcr.io/$PROJECT_ID/$BACKEND_SERVICE \
  --platform managed \
  --region $REGION \
  --allow-unauthenticated \
  --port 8080 \
  --memory 1Gi \
  --cpu 1 \
  --set-env-vars NODE_ENV=production \
  --set-env-vars DATABASE_URL=sqlite:./garage_game.db \
  --set-env-vars JWT_SECRET=garage-door-production-jwt-secret-2024 \
  --set-env-vars GOOGLE_STREET_VIEW_API_KEY=AIzaSyAGHVpNfxdylz_gRfaLxbVOYvaBz3woTec \
  --set-env-vars GOOGLE_MAPS_API_KEY=AIzaSyAGHVpNfxdylz_gRfaLxbVOYvaBz3woTec \
  --set-env-vars CORS_ORIGIN=https://itsgarages.itsfait.com

# Get backend URL
BACKEND_URL=$(gcloud run services describe $BACKEND_SERVICE --platform managed --region $REGION --format 'value(status.url)')
echo "✅ Backend deployed at: $BACKEND_URL"

cd ..

# Deploy Frontend
echo "🎨 Deploying frontend service..."
cd frontend

# Update the API base URL in the frontend build
export VITE_API_BASE_URL=$BACKEND_URL/api

gcloud builds submit --tag gcr.io/$PROJECT_ID/$FRONTEND_SERVICE
gcloud run deploy $FRONTEND_SERVICE \
  --image gcr.io/$PROJECT_ID/$FRONTEND_SERVICE \
  --platform managed \
  --region $REGION \
  --allow-unauthenticated \
  --port 8080 \
  --memory 512Mi \
  --cpu 1 \
  --set-env-vars NODE_ENV=production \
  --set-env-vars VITE_API_BASE_URL=$BACKEND_URL/api

# Get frontend URL
FRONTEND_URL=$(gcloud run services describe $FRONTEND_SERVICE --platform managed --region $REGION --format 'value(status.url)')
echo "✅ Frontend deployed at: $FRONTEND_URL"

cd ..

echo "🎉 Deployment complete!"
echo "🔧 Backend API: $BACKEND_URL"
echo "🎮 Frontend App: $FRONTEND_URL"
echo ""
echo "📝 Next steps:"
echo "1. Set up custom domain mapping for itsgarages.itsfait.com"
echo "2. Configure SSL certificate"
echo "3. Update DNS records"
echo "4. Set up monitoring and logging"
