#!/bin/bash

# Test Deployment Configuration Script
# This script validates the deployment setup before pushing to GitHub

set -e

echo "🔍 Testing Garage Door Game Deployment Configuration..."

# Check if required files exist
echo "📁 Checking required files..."

required_files=(
    "garage-door-game/backend/Dockerfile"
    "garage-door-game/frontend/Dockerfile"
    "garage-door-game/backend/package.json"
    "garage-door-game/frontend/package.json"
    ".github/workflows/deploy.yml"
)

for file in "${required_files[@]}"; do
    if [[ -f "$file" ]]; then
        echo "✅ $file exists"
    else
        echo "❌ $file missing"
        exit 1
    fi
done

# Check Docker build locally (backend)
echo "🐳 Testing backend Docker build..."
cd garage-door-game/backend
if docker build -t test-backend . > /dev/null 2>&1; then
    echo "✅ Backend Docker build successful"
    docker rmi test-backend > /dev/null 2>&1
else
    echo "❌ Backend Docker build failed"
    exit 1
fi
cd ../..

# Check Docker build locally (frontend)
echo "🐳 Testing frontend Docker build..."
cd garage-door-game/frontend
if docker build -t test-frontend --build-arg VITE_API_BASE_URL=http://test/api . > /dev/null 2>&1; then
    echo "✅ Frontend Docker build successful"
    docker rmi test-frontend > /dev/null 2>&1
else
    echo "❌ Frontend Docker build failed"
    exit 1
fi
cd ../..

# Check GitHub workflow syntax
echo "📋 Checking GitHub workflow syntax..."
if command -v yamllint > /dev/null 2>&1; then
    if yamllint .github/workflows/deploy.yml > /dev/null 2>&1; then
        echo "✅ GitHub workflow YAML is valid"
    else
        echo "⚠️  GitHub workflow YAML has warnings (but may still work)"
    fi
else
    echo "⚠️  yamllint not installed, skipping YAML validation"
fi

# Check environment configuration
echo "🔧 Checking environment configuration..."
if [[ -f "garage-door-game/backend/.env.example" ]]; then
    echo "✅ Backend environment example exists"
else
    echo "⚠️  Backend .env.example missing"
fi

if [[ -f "garage-door-game/frontend/.env.example" ]]; then
    echo "✅ Frontend environment example exists"
else
    echo "⚠️  Frontend .env.example missing"
fi

echo ""
echo "🎉 Deployment configuration test completed!"
echo ""
echo "📝 Next steps:"
echo "1. Ensure GitHub secrets are configured (see GITHUB_SECRETS_SETUP.md)"
echo "2. Push changes to main branch to trigger deployment"
echo "3. Monitor deployment in GitHub Actions tab"
echo ""
echo "Required GitHub Secrets:"
echo "- GCP_SA_KEY (Google Cloud Service Account JSON)"
echo "- JWT_SECRET (Random secure string)"
echo "- GOOGLE_STREET_VIEW_API_KEY (Google API key)"
echo "- GOOGLE_MAPS_API_KEY (Google API key)"
