# 🚀 Garage Door Game - Deployment Guide

## Overview
This guide covers deploying the Garage Door Game to Google Cloud Run and setting up the custom domain `itsgarages.itsfait.com`.

## Prerequisites

1. **Google Cloud Account** with billing enabled
2. **Google Cloud SDK** installed and configured
3. **Docker** installed locally
4. **Domain access** to itsfait.com for DNS configuration

## Step 1: Setup Google Cloud Project

```bash
# Create a new project (or use existing)
gcloud projects create your-garage-door-project --name="Garage Door Game"

# Set the project
gcloud config set project your-garage-door-project

# Enable billing (required for Cloud Run)
# Do this through the Google Cloud Console
```

## Step 2: Configure Environment Variables

1. Copy the production environment template:
```bash
cp backend/.env.production backend/.env
```

2. Update `backend/.env` with your actual values:
   - `GOOGLE_STREET_VIEW_API_KEY`: Get from Google Cloud Console
   - `GOOGLE_MAPS_API_KEY`: Get from Google Cloud Console  
   - `JWT_SECRET`: Generate a secure random string
   - `CORS_ORIGIN`: Set to https://itsgarages.itsfait.com

## Step 3: Deploy to Google Cloud Run

1. Make the deployment script executable:
```bash
chmod +x deploy-cloudrun.sh
```

2. Update the PROJECT_ID in `deploy-cloudrun.sh`

3. Run the deployment:
```bash
./deploy-cloudrun.sh
```

This will:
- Build and deploy the backend API
- Build and deploy the frontend application
- Configure environment variables
- Set up load balancing and auto-scaling

## Step 4: Setup Custom Domain

1. Make the domain script executable:
```bash
chmod +x setup-domain.sh
```

2. Update the PROJECT_ID in `setup-domain.sh`

3. Run the domain setup:
```bash
./setup-domain.sh
```

4. Add DNS record to your domain provider:
   - **Type**: CNAME
   - **Name**: itsgarages
   - **Value**: ghs.googlehosted.com
   - **TTL**: 300 (or default)

## Step 5: Verify Deployment

1. **Check backend health**:
```bash
curl https://your-backend-url/health
```

2. **Check frontend**:
```bash
curl https://itsgarages.itsfait.com
```

3. **Test game functionality**:
   - Visit https://itsgarages.itsfait.com
   - Register a new account
   - Play a game round
   - Verify scoring works

## Step 6: Monitoring & Maintenance

### View Logs
```bash
# Backend logs
gcloud logs read "resource.type=cloud_run_revision AND resource.labels.service_name=garage-door-backend" --limit 50

# Frontend logs  
gcloud logs read "resource.type=cloud_run_revision AND resource.labels.service_name=garage-door-frontend" --limit 50
```

### Update Deployment
```bash
# Redeploy after code changes
./deploy-cloudrun.sh
```

### Scale Services
```bash
# Adjust backend scaling
gcloud run services update garage-door-backend --max-instances=10 --region=us-central1

# Adjust frontend scaling
gcloud run services update garage-door-frontend --max-instances=5 --region=us-central1
```

## Architecture

```
Internet → Cloud Load Balancer → Cloud Run (Frontend) → Cloud Run (Backend) → SQLite
                ↓
        itsgarages.itsfait.com
```

## Security Features

- ✅ HTTPS enforced
- ✅ JWT authentication
- ✅ Rate limiting
- ✅ CORS protection
- ✅ Security headers (Helmet)
- ✅ Input validation
- ✅ SQL injection protection

## Cost Optimization

- **Pay-per-use**: Only charged when requests are processed
- **Auto-scaling**: Scales to zero when not in use
- **Resource limits**: CPU and memory limits prevent overcharging
- **Estimated cost**: $5-20/month for moderate traffic

## Troubleshooting

### Common Issues

1. **Build failures**: Check Dockerfile syntax and dependencies
2. **Environment variables**: Verify all required vars are set
3. **DNS propagation**: Can take up to 48 hours
4. **SSL certificate**: Automatically provisioned after DNS verification

### Support Commands

```bash
# Check service status
gcloud run services list

# View service details
gcloud run services describe garage-door-frontend --region=us-central1

# Check domain mapping
gcloud run domain-mappings list --region=us-central1
```

## Success Criteria

✅ Backend API responding at Cloud Run URL  
✅ Frontend app accessible at Cloud Run URL  
✅ Custom domain itsgarages.itsfait.com working  
✅ SSL certificate active  
✅ Game functionality working end-to-end  
✅ User registration and login working  
✅ Street View images loading  
✅ Scoring system functional  

## Next Steps

1. Set up monitoring and alerting
2. Configure automated backups
3. Implement CI/CD pipeline
4. Add performance monitoring
5. Set up error tracking (e.g., Sentry)
