#!/bin/bash

# Domain Setup Script for itsgarages.itsfait.com
# This script sets up custom domain mapping for Google Cloud Run

set -e

# Configuration
PROJECT_ID="its-garages"
REGION="us-central1"
DOMAIN="itsgarages.itsfait.com"
FRONTEND_SERVICE="garage-door-frontend"

echo "🌐 Setting up custom domain: $DOMAIN"

# Set the project
gcloud config set project $PROJECT_ID

# Enable Domain Mapping API
echo "📋 Enabling Domain Mapping API..."
gcloud services enable domains.googleapis.com

# Create domain mapping
echo "🔗 Creating domain mapping..."
gcloud beta run domain-mappings create \
  --service $FRONTEND_SERVICE \
  --domain $DOMAIN \
  --region $REGION

# Get the required DNS records
echo "📋 Getting DNS configuration..."
gcloud beta run domain-mappings describe $DOMAIN --region $REGION

echo ""
echo "🎯 Domain setup initiated!"
echo ""
echo "📝 Manual steps required:"
echo "1. Add the following DNS records to your domain provider:"
echo "   - Type: CNAME"
echo "   - Name: itsgarages"
echo "   - Value: ghs.googlehosted.com"
echo ""
echo "2. Wait for DNS propagation (can take up to 48 hours)"
echo "3. SSL certificate will be automatically provisioned"
echo ""
echo "🔍 Check status with:"
echo "gcloud beta run domain-mappings describe $DOMAIN --region $REGION"
