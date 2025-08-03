# 🚀 Quick Deployment Instructions

## ✅ GitHub - COMPLETE
Your code is now pushed to GitHub at: https://github.com/Faitltd/It-s-Garages

## 🔧 Google Cloud Run Deployment

### Prerequisites
1. Install Google Cloud SDK: https://cloud.google.com/sdk/docs/install
2. Create Google Cloud Project with billing enabled
3. Get Google Maps/Street View API keys

### Step 1: Setup Google Cloud
```bash
# Login to Google Cloud
gcloud auth login

# Create project (replace with your preferred project ID)
gcloud projects create garage-door-game-prod --name="Garage Door Game"

# Set project
gcloud config set project garage-door-game-prod

# Enable billing in Google Cloud Console
```

### Step 2: Get API Keys
1. Go to Google Cloud Console → APIs & Services → Credentials
2. Create API Key for Google Maps JavaScript API
3. Create API Key for Street View Static API
4. Restrict keys to your domain for security

### Step 3: Configure Environment
```bash
cd garage-door-game

# Edit deploy-cloudrun.sh - update PROJECT_ID
nano deploy-cloudrun.sh

# Edit backend/.env.production - add your API keys
nano backend/.env.production
```

### Step 4: Deploy
```bash
# Make scripts executable
chmod +x deploy-cloudrun.sh setup-domain.sh

# Deploy to Cloud Run
./deploy-cloudrun.sh
```

### Step 5: Setup Custom Domain
```bash
# Run domain setup
./setup-domain.sh

# Add DNS record to itsfait.com:
# Type: CNAME
# Name: itsgarages  
# Value: ghs.googlehosted.com
```

## 🌐 Domain Configuration

### DNS Settings for itsfait.com
Add this CNAME record:
```
itsgarages.itsfait.com → ghs.googlehosted.com
```

### SSL Certificate
- Automatically provisioned by Google Cloud
- Takes 15-60 minutes after DNS propagation
- No manual configuration needed

## 🎯 Verification

After deployment, test:
1. **Backend API**: `curl https://your-backend-url/health`
2. **Frontend**: Visit `https://itsgarages.itsfait.com`
3. **Game Flow**: Register → Login → Play Game → Check Scoring

## 📊 Expected Costs
- **Development/Testing**: $0-5/month
- **Light Production**: $5-20/month  
- **Heavy Usage**: $20-100/month

## 🆘 Need Help?
1. Check `DEPLOYMENT.md` for detailed instructions
2. View logs: `gcloud logs read "resource.type=cloud_run_revision"`
3. Check service status: `gcloud run services list`

## 🎉 Success Checklist
- [ ] Code pushed to GitHub
- [ ] Google Cloud project created
- [ ] API keys configured
- [ ] Backend deployed to Cloud Run
- [ ] Frontend deployed to Cloud Run  
- [ ] DNS record added
- [ ] SSL certificate active
- [ ] Game working at itsgarages.itsfait.com
