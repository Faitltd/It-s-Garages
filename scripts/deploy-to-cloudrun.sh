#!/bin/bash
# Cloud Run deployment script for It's Garages

set -e  # Exit on any error

echo "🚀 It's Garages - Cloud Run Deployment"
echo "======================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Project configuration
PROJECT_ID="its-garages"
REGION="us-central1"
SERVICE_NAME="its-garages-app"
IMAGE_NAME="gcr.io/$PROJECT_ID/$SERVICE_NAME"

# Function to print colored output
print_status() {
    echo -e "${GREEN}✅${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠️${NC} $1"
}

print_error() {
    echo -e "${RED}❌${NC} $1"
}

print_info() {
    echo -e "${BLUE}ℹ️${NC} $1"
}

# Function to check command success
check_success() {
    if [ $? -eq 0 ]; then
        print_status "$1"
    else
        print_error "$2"
        exit 1
    fi
}

# Validate environment first
echo "🔍 Running pre-deployment validation..."
if [ -f "scripts/validate-environment.sh" ]; then
    bash scripts/validate-environment.sh
    check_success "Environment validation passed" "Environment validation failed"
else
    print_warning "Validation script not found, proceeding anyway..."
fi

echo ""
echo "🏗️ Starting deployment process..."

# Set project (in case it changed)
gcloud config set project $PROJECT_ID

# Build and deploy using Cloud Build (recommended approach)
echo "📦 Building and deploying with Cloud Build..."
print_info "This may take 3-5 minutes..."

# Check if cloudbuild.yaml exists
if [ -f "cloudbuild.yaml" ]; then
    print_info "Using cloudbuild.yaml configuration"
    gcloud builds submit --config cloudbuild.yaml
    check_success "Cloud Build completed successfully" "Cloud Build failed"
else
    # Fallback to direct deployment
    print_info "Using direct Cloud Run deployment"
    gcloud run deploy $SERVICE_NAME \
        --source . \
        --platform managed \
        --region $REGION \
        --allow-unauthenticated \
        --port 8080 \
        --memory 512Mi \
        --cpu 1 \
        --max-instances 10 \
        --set-env-vars "FLASK_ENV=production,FLASK_DEBUG=False" \
        --quiet
    check_success "Cloud Run deployment completed" "Cloud Run deployment failed"
fi

# Get the service URL
echo "🔗 Getting service URL..."
SERVICE_URL=$(gcloud run services describe $SERVICE_NAME \
    --platform managed \
    --region $REGION \
    --format 'value(status.url)')

if [ -z "$SERVICE_URL" ]; then
    print_error "Failed to get service URL"
    exit 1
fi

print_status "Service deployed successfully!"
print_info "Service URL: $SERVICE_URL"

# Test the deployment
echo "🧪 Testing deployment..."
print_info "Testing health endpoint..."

# Wait a moment for the service to be ready
sleep 10

# Test health endpoint
if curl -f -s "$SERVICE_URL/health" > /dev/null; then
    print_status "Health check passed"
else
    print_warning "Health check failed - service might still be starting"
    print_info "You can test manually: curl $SERVICE_URL/health"
fi

# Test main page
if curl -f -s "$SERVICE_URL/" > /dev/null; then
    print_status "Main page accessible"
else
    print_warning "Main page test failed"
fi

# Display service information
echo ""
echo "📊 Deployment Information"
echo "========================"
echo "Project ID: $PROJECT_ID"
echo "Service Name: $SERVICE_NAME"
echo "Region: $REGION"
echo "Service URL: $SERVICE_URL"

# Get additional service details
echo ""
echo "🔍 Service Details:"
gcloud run services describe $SERVICE_NAME \
    --platform managed \
    --region $REGION \
    --format="table(
        metadata.name,
        status.url,
        status.conditions[0].type,
        status.conditions[0].status,
        spec.template.spec.containers[0].image
    )"

echo ""
print_status "Deployment completed successfully!"
print_info "Your application is now running at: $SERVICE_URL"

echo ""
echo "🌐 Next Steps:"
echo "1. Test your application: open $SERVICE_URL"
echo "2. Set up custom domain: run ./scripts/setup-custom-domain.sh"
echo "3. Configure GitHub Actions: run ./scripts/setup-github-actions.sh"

# Save deployment info for other scripts
echo "SERVICE_URL=$SERVICE_URL" > .deployment-info
echo "PROJECT_ID=$PROJECT_ID" >> .deployment-info
echo "REGION=$REGION" >> .deployment-info
echo "SERVICE_NAME=$SERVICE_NAME" >> .deployment-info

print_status "Deployment information saved to .deployment-info"
