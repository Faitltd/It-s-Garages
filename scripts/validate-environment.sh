#!/bin/bash
# Pre-deployment validation script for It's Garages

set -e  # Exit on any error

echo "🔍 It's Garages - Pre-Deployment Validation"
echo "============================================"

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

# Check if gcloud is installed
echo "🔧 Checking prerequisites..."
if ! command -v gcloud &> /dev/null; then
    print_error "gcloud CLI is not installed"
    echo "Please install Google Cloud SDK: https://cloud.google.com/sdk/docs/install"
    exit 1
fi
print_status "gcloud CLI is installed"

# Check if authenticated
if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" | grep -q .; then
    print_error "Not authenticated with gcloud"
    echo "Please run: gcloud auth login"
    exit 1
fi
print_status "gcloud authentication verified"

# Set project
echo "🎯 Setting up project configuration..."
gcloud config set project $PROJECT_ID
print_status "Project set to: $PROJECT_ID"

# Check if project exists and is accessible
if ! gcloud projects describe $PROJECT_ID &> /dev/null; then
    print_error "Cannot access project: $PROJECT_ID"
    echo "Please verify:"
    echo "1. Project ID is correct"
    echo "2. You have access to the project"
    echo "3. Project is not deleted"
    exit 1
fi
print_status "Project access verified"

# Check billing
echo "💳 Checking billing status..."
BILLING_ACCOUNT=$(gcloud beta billing projects describe $PROJECT_ID --format="value(billingAccountName)" 2>/dev/null || echo "")
if [ -z "$BILLING_ACCOUNT" ]; then
    print_warning "Billing is not enabled for this project"
    echo "Please enable billing: https://console.cloud.google.com/billing/linkedaccount?project=$PROJECT_ID"
    echo "Continue anyway? (y/N)"
    read -r response
    if [[ ! "$response" =~ ^[Yy]$ ]]; then
        exit 1
    fi
else
    print_status "Billing is enabled"
fi

# Check required APIs
echo "🔌 Checking required APIs..."
REQUIRED_APIS=(
    "cloudbuild.googleapis.com"
    "run.googleapis.com"
    "containerregistry.googleapis.com"
)

MISSING_APIS=()
for api in "${REQUIRED_APIS[@]}"; do
    if gcloud services list --enabled --filter="name:$api" --format="value(name)" | grep -q "$api"; then
        print_status "$api is enabled"
    else
        print_warning "$api is not enabled"
        MISSING_APIS+=("$api")
    fi
done

if [ ${#MISSING_APIS[@]} -gt 0 ]; then
    echo "🔧 Enabling missing APIs..."
    for api in "${MISSING_APIS[@]}"; do
        echo "Enabling $api..."
        gcloud services enable "$api"
        print_status "$api enabled"
    done
fi

# Check Docker
echo "🐳 Checking Docker..."
if ! command -v docker &> /dev/null; then
    print_warning "Docker is not installed (optional for Cloud Build)"
else
    if docker info &> /dev/null; then
        print_status "Docker is running"
    else
        print_warning "Docker is installed but not running"
    fi
fi

# Check current directory
echo "📁 Checking project structure..."
if [ ! -f "app.py" ]; then
    print_error "app.py not found. Please run this script from the project root directory."
    exit 1
fi
print_status "Project structure verified"

if [ ! -f "Dockerfile" ]; then
    print_error "Dockerfile not found"
    exit 1
fi
print_status "Dockerfile found"

if [ ! -f "requirements.txt" ]; then
    print_error "requirements.txt not found"
    exit 1
fi
print_status "requirements.txt found"

# Check if service already exists
echo "🔍 Checking existing Cloud Run services..."
if gcloud run services describe $SERVICE_NAME --region=$REGION --platform=managed &> /dev/null; then
    print_warning "Service '$SERVICE_NAME' already exists in region '$REGION'"
    echo "This deployment will update the existing service."
else
    print_info "Service '$SERVICE_NAME' does not exist yet (will be created)"
fi

# Summary
echo ""
echo "📋 Validation Summary"
echo "===================="
print_status "Project: $PROJECT_ID"
print_status "Region: $REGION"
print_status "Service: $SERVICE_NAME"
print_status "All prerequisites met!"

echo ""
echo "🚀 Ready for deployment!"
echo "Next step: Run ./scripts/deploy-to-cloudrun.sh"
