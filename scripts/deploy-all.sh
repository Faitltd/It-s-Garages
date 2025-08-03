#!/bin/bash
# Master deployment script for It's Garages
# Runs the complete deployment process

set -e  # Exit on any error

echo "🚀 It's Garages - Complete Deployment"
echo "====================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# Function to print colored output
print_header() {
    echo -e "${BOLD}${BLUE}$1${NC}"
    echo "$(printf '=%.0s' {1..50})"
}

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

# Function to run script with error handling
run_script() {
    local script_name=$1
    local description=$2
    
    echo ""
    print_header "$description"
    
    if [ -f "$script_name" ]; then
        if bash "$script_name"; then
            print_status "$description completed successfully"
            return 0
        else
            print_error "$description failed"
            echo ""
            echo "❓ Do you want to continue with the next step? (y/N)"
            read -r response
            if [[ ! "$response" =~ ^[Yy]$ ]]; then
                echo "Deployment stopped by user"
                exit 1
            fi
            return 1
        fi
    else
        print_error "Script not found: $script_name"
        return 1
    fi
}

# Function to pause for user confirmation
pause_for_user() {
    echo ""
    echo "⏸️  $1"
    echo "Press Enter to continue..."
    read -r
}

# Welcome message
echo "This script will deploy It's Garages to Google Cloud Run with custom domain."
echo ""
echo "📋 Deployment Steps:"
echo "1. 🔍 Validate environment and prerequisites"
echo "2. 🚀 Deploy to Google Cloud Run"
echo "3. 🌐 Set up custom domain (garages.itsfait.com)"
echo "4. 🔧 Configure GitHub Actions (optional)"
echo ""
echo "⏱️  Estimated time: 10-15 minutes"
echo ""
echo "Do you want to proceed? (y/N)"
read -r response
if [[ ! "$response" =~ ^[Yy]$ ]]; then
    echo "Deployment cancelled"
    exit 0
fi

# Make scripts executable
echo "🔧 Making scripts executable..."
chmod +x scripts/*.sh
print_status "Scripts are now executable"

# Step 1: Validate Environment
run_script "scripts/validate-environment.sh" "Environment Validation"

pause_for_user "Environment validation complete. Ready to deploy to Cloud Run?"

# Step 2: Deploy to Cloud Run
run_script "scripts/deploy-to-cloudrun.sh" "Cloud Run Deployment"

# Load deployment info
if [ -f ".deployment-info" ]; then
    source .deployment-info
    echo ""
    print_status "🎉 Cloud Run deployment successful!"
    print_info "Your app is running at: $SERVICE_URL"
    
    # Test the deployment
    echo ""
    print_info "🧪 Testing deployment..."
    if curl -f -s "$SERVICE_URL/health" > /dev/null; then
        print_status "Application is responding correctly"
    else
        print_warning "Application health check failed (might still be starting)"
    fi
else
    print_warning "Could not load deployment information"
fi

pause_for_user "Cloud Run deployment complete. Ready to set up custom domain?"

# Step 3: Set up Custom Domain
run_script "scripts/setup-custom-domain.sh" "Custom Domain Setup"

echo ""
print_info "🌐 Custom domain setup initiated"
print_warning "Remember to add the DNS records to your domain provider!"

# Step 4: GitHub Actions (Optional)
echo ""
echo "🔧 GitHub Actions Setup (Optional)"
echo "================================="
echo "This will set up automatic deployment when you push to GitHub."
echo "Do you want to set up GitHub Actions? (y/N)"
read -r response
if [[ "$response" =~ ^[Yy]$ ]]; then
    run_script "scripts/setup-github-actions.sh" "GitHub Actions Setup"
else
    print_info "Skipping GitHub Actions setup"
fi

# Final Summary
echo ""
print_header "🎉 Deployment Complete!"

if [ -f ".deployment-info" ]; then
    source .deployment-info
    echo ""
    echo "📊 Deployment Summary:"
    echo "====================="
    echo "✅ Project: $PROJECT_ID"
    echo "✅ Service: $SERVICE_NAME"
    echo "✅ Region: $REGION"
    echo "✅ Cloud Run URL: $SERVICE_URL"
    if [ -n "$DOMAIN" ]; then
        echo "🌐 Custom Domain: https://$DOMAIN (pending DNS)"
    fi
    
    echo ""
    echo "🔗 Important Links:"
    echo "• Application: $SERVICE_URL"
    echo "• Cloud Console: https://console.cloud.google.com/run?project=$PROJECT_ID"
    echo "• GitHub Repo: https://github.com/Faitltd/It-s-Garages"
    if [ -n "$DOMAIN" ]; then
        echo "• Custom Domain: https://$DOMAIN (after DNS setup)"
    fi
fi

echo ""
echo "📋 Next Steps:"
echo "=============="
echo "1. 🧪 Test your application: open $SERVICE_URL"
echo "2. 🌐 Add DNS records for garages.itsfait.com (if not done already)"
echo "3. ⏳ Wait for DNS propagation (5-60 minutes)"
echo "4. 🔒 SSL certificate will be automatically provisioned"
echo "5. 🎯 Test custom domain: https://garages.itsfait.com"

if [ -f "github-actions-key.json" ]; then
    echo "6. 🔐 Add GCP_SA_KEY to GitHub secrets (see instructions above)"
    echo "7. 🗑️  Delete local key file: rm github-actions-key.json"
fi

echo ""
print_status "🚀 It's Garages is now deployed and ready to use!"

# Clean up
echo ""
echo "🧹 Cleanup"
echo "=========="
echo "Do you want to delete the local service account key file? (recommended) (y/N)"
read -r response
if [[ "$response" =~ ^[Yy]$ ]] && [ -f "github-actions-key.json" ]; then
    rm github-actions-key.json
    print_status "Local key file deleted"
fi

echo ""
print_info "Deployment logs and information saved in .deployment-info"
print_info "You can re-run individual scripts if needed"

echo ""
echo "🎉 Happy garage measuring! 🏠"
