#!/bin/bash
# Custom domain setup script for It's Garages

set -e  # Exit on any error

echo "🌐 It's Garages - Custom Domain Setup"
echo "====================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
DOMAIN="itsgarages.itsfait.com"
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

# Load deployment info if available
if [ -f ".deployment-info" ]; then
    source .deployment-info
    print_info "Loaded deployment information"
else
    print_warning "No deployment info found, using defaults"
fi

# Verify service exists
echo "🔍 Verifying Cloud Run service..."
if ! gcloud run services describe $SERVICE_NAME --region=$REGION --platform=managed &> /dev/null; then
    print_error "Cloud Run service '$SERVICE_NAME' not found in region '$REGION'"
    echo "Please deploy to Cloud Run first: ./scripts/deploy-to-cloudrun.sh"
    exit 1
fi
print_status "Cloud Run service verified"

# Check if domain mapping already exists
echo "🔍 Checking existing domain mappings..."
if gcloud run domain-mappings describe $DOMAIN --region=$REGION --platform=managed &> /dev/null; then
    print_warning "Domain mapping for '$DOMAIN' already exists"
    echo "Do you want to update it? (y/N)"
    read -r response
    if [[ ! "$response" =~ ^[Yy]$ ]]; then
        echo "Exiting without changes"
        exit 0
    fi
    
    echo "🗑️ Deleting existing domain mapping..."
    gcloud run domain-mappings delete $DOMAIN --region=$REGION --platform=managed --quiet
    print_status "Existing domain mapping deleted"
    
    # Wait a moment for cleanup
    sleep 5
fi

# Create domain mapping
echo "🔗 Creating domain mapping..."
print_info "Mapping '$DOMAIN' to service '$SERVICE_NAME'"

gcloud run domain-mappings create \
    --service $SERVICE_NAME \
    --domain $DOMAIN \
    --region $REGION \
    --platform managed

if [ $? -eq 0 ]; then
    print_status "Domain mapping created successfully"
else
    print_error "Failed to create domain mapping"
    exit 1
fi

# Get DNS configuration
echo "📋 Getting DNS configuration..."
sleep 5  # Wait for mapping to be processed

DNS_INFO=$(gcloud run domain-mappings describe $DOMAIN \
    --region=$REGION \
    --platform=managed \
    --format="value(status.resourceRecords[].name,status.resourceRecords[].rrdata)" 2>/dev/null || echo "")

if [ -z "$DNS_INFO" ]; then
    print_warning "DNS information not yet available"
    print_info "This is normal - it may take a few minutes to generate"
    
    echo "⏳ Waiting for DNS configuration (up to 2 minutes)..."
    for i in {1..24}; do
        sleep 5
        DNS_INFO=$(gcloud run domain-mappings describe $DOMAIN \
            --region=$REGION \
            --platform=managed \
            --format="value(status.resourceRecords[].name,status.resourceRecords[].rrdata)" 2>/dev/null || echo "")
        
        if [ -n "$DNS_INFO" ]; then
            break
        fi
        
        echo -n "."
    done
    echo ""
fi

# Display DNS configuration
echo ""
echo "📋 DNS Configuration Required"
echo "============================"

if [ -n "$DNS_INFO" ]; then
    print_status "DNS records generated successfully!"
    echo ""
    echo "Add these DNS records to your domain provider (itsfait.com):"
    echo ""
    
    # Parse and display DNS records
    gcloud run domain-mappings describe $DOMAIN \
        --region=$REGION \
        --platform=managed \
        --format="table(
            status.resourceRecords[].name:label='DNS_NAME',
            status.resourceRecords[].type:label='TYPE',
            status.resourceRecords[].rrdata:label='VALUE'
        )"
    
    echo ""
    print_info "Typical configuration:"
    echo "Name: garages"
    echo "Type: A or CNAME (as shown above)"
    echo "Value: (as shown above)"
    echo "TTL: 300 (5 minutes)"
    
else
    print_warning "DNS configuration not available yet"
    echo ""
    echo "To get DNS configuration later, run:"
    echo "gcloud run domain-mappings describe $DOMAIN --region=$REGION --platform=managed"
fi

# Check domain mapping status
echo ""
echo "🔍 Domain Mapping Status:"
gcloud run domain-mappings describe $DOMAIN \
    --region=$REGION \
    --platform=managed \
    --format="table(
        metadata.name:label='DOMAIN',
        status.conditions[0].type:label='STATUS',
        status.conditions[0].status:label='READY',
        status.conditions[0].reason:label='REASON'
    )"

echo ""
echo "📝 Next Steps:"
echo "=============="
echo "1. 🌐 Add the DNS records shown above to your domain provider"
echo "2. ⏳ Wait for DNS propagation (5-60 minutes)"
echo "3. 🧪 Test your domain: curl https://$DOMAIN/health"
echo "4. 🔒 SSL certificate will be automatically provisioned by Google"

echo ""
print_info "Domain setup initiated successfully!"
print_warning "Remember: DNS changes can take up to 60 minutes to propagate"

# Save domain info
echo "DOMAIN=$DOMAIN" >> .deployment-info
print_status "Domain information saved to .deployment-info"

echo ""
echo "🔍 To check status later:"
echo "gcloud run domain-mappings describe $DOMAIN --region=$REGION --platform=managed"

echo ""
echo "🧪 To test when ready:"
echo "curl https://$DOMAIN/health"
echo "open https://$DOMAIN"
