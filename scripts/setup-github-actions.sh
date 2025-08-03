#!/bin/bash
# GitHub Actions setup script for It's Garages

set -e  # Exit on any error

echo "🔧 It's Garages - GitHub Actions Setup"
echo "======================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_ID="its-garages"
SA_NAME="github-actions"
SA_EMAIL="$SA_NAME@$PROJECT_ID.iam.gserviceaccount.com"
KEY_FILE="github-actions-key.json"

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

# Check if service account already exists
echo "🔍 Checking for existing service account..."
if gcloud iam service-accounts describe $SA_EMAIL &> /dev/null; then
    print_warning "Service account '$SA_EMAIL' already exists"
    echo "Do you want to recreate it? (y/N)"
    read -r response
    if [[ "$response" =~ ^[Yy]$ ]]; then
        echo "🗑️ Deleting existing service account..."
        gcloud iam service-accounts delete $SA_EMAIL --quiet
        print_status "Existing service account deleted"
        sleep 2
    else
        print_info "Using existing service account"
    fi
fi

# Create service account if it doesn't exist
if ! gcloud iam service-accounts describe $SA_EMAIL &> /dev/null; then
    echo "👤 Creating service account for GitHub Actions..."
    gcloud iam service-accounts create $SA_NAME \
        --description="Service account for GitHub Actions CI/CD" \
        --display-name="GitHub Actions"
    print_status "Service account created: $SA_EMAIL"
fi

# Grant necessary permissions
echo "🔐 Granting IAM permissions..."

ROLES=(
    "roles/cloudbuild.builds.editor"
    "roles/run.admin"
    "roles/storage.admin"
    "roles/iam.serviceAccountUser"
    "roles/viewer"
)

for role in "${ROLES[@]}"; do
    echo "Granting $role..."
    gcloud projects add-iam-policy-binding $PROJECT_ID \
        --member="serviceAccount:$SA_EMAIL" \
        --role="$role" \
        --quiet
    print_status "$role granted"
done

# Create service account key
echo "🔑 Creating service account key..."
if [ -f "$KEY_FILE" ]; then
    print_warning "Key file '$KEY_FILE' already exists"
    echo "Do you want to recreate it? (y/N)"
    read -r response
    if [[ "$response" =~ ^[Yy]$ ]]; then
        rm "$KEY_FILE"
    else
        print_info "Using existing key file"
    fi
fi

if [ ! -f "$KEY_FILE" ]; then
    gcloud iam service-accounts keys create $KEY_FILE \
        --iam-account=$SA_EMAIL
    print_status "Service account key created: $KEY_FILE"
fi

# Display the key content for GitHub secrets
echo ""
echo "🔐 GitHub Secret Configuration"
echo "============================="
print_info "Copy the following JSON content to GitHub Secrets:"
echo ""
echo "Secret Name: GCP_SA_KEY"
echo "Secret Value:"
echo "----------------------------------------"
cat $KEY_FILE
echo "----------------------------------------"

echo ""
echo "📋 GitHub Setup Instructions:"
echo "1. Go to: https://github.com/Faitltd/It-s-Garages/settings/secrets/actions"
echo "2. Click 'New repository secret'"
echo "3. Name: GCP_SA_KEY"
echo "4. Value: Copy the JSON content shown above"
echo "5. Click 'Add secret'"

echo ""
print_warning "SECURITY NOTE: The key file contains sensitive credentials!"
print_info "After adding to GitHub secrets, you should delete the local key file:"
echo "rm $KEY_FILE"

# Test the service account
echo ""
echo "🧪 Testing service account permissions..."
print_info "Impersonating service account to test permissions..."

# Test Cloud Build access
if gcloud builds list --limit=1 --impersonate-service-account=$SA_EMAIL &> /dev/null; then
    print_status "Cloud Build access: OK"
else
    print_warning "Cloud Build access: Limited (this is normal for new accounts)"
fi

# Test Cloud Run access
if gcloud run services list --region=us-central1 --impersonate-service-account=$SA_EMAIL &> /dev/null; then
    print_status "Cloud Run access: OK"
else
    print_warning "Cloud Run access: Limited"
fi

echo ""
echo "📊 Service Account Summary"
echo "========================="
echo "Service Account: $SA_EMAIL"
echo "Key File: $KEY_FILE"
echo "Project: $PROJECT_ID"

echo ""
echo "🔍 Verify permissions:"
gcloud projects get-iam-policy $PROJECT_ID \
    --flatten="bindings[].members" \
    --format="table(bindings.role)" \
    --filter="bindings.members:serviceAccount:$SA_EMAIL"

echo ""
echo "✅ GitHub Actions Setup Complete!"
echo ""
echo "🚀 Next Steps:"
echo "1. Add the GCP_SA_KEY secret to GitHub (instructions above)"
echo "2. Push code to main branch to trigger deployment"
echo "3. Monitor deployment: https://github.com/Faitltd/It-s-Garages/actions"

echo ""
print_info "Once GitHub secret is added, every push to main branch will:"
print_info "• Build the Docker image"
print_info "• Deploy to Cloud Run"
print_info "• Update https://garages.itsfait.com"

# Save service account info
echo "SA_EMAIL=$SA_EMAIL" >> .deployment-info
echo "KEY_FILE=$KEY_FILE" >> .deployment-info
print_status "Service account information saved to .deployment-info"

echo ""
print_warning "Remember to delete the key file after adding to GitHub:"
echo "rm $KEY_FILE"
