# 🚀 Deployment Guide - It's Garages

## ✅ GitHub Repository
**Status**: ✅ **COMPLETE**
- Repository: https://github.com/Faitltd/It-s-Garages.git
- Code pushed successfully
- GitHub Actions workflow configured

## ☁️ Google Cloud Run Deployment

### **Step 1: Enable Required APIs**
```bash
gcloud config set project its-garages

# Enable required APIs
gcloud services enable cloudbuild.googleapis.com
gcloud services enable run.googleapis.com
gcloud services enable containerregistry.googleapis.com
```

### **Step 2: Create Service Account (Optional)**
```bash
# Create service account for Cloud Run
gcloud iam service-accounts create its-garages-service \
    --description="Service account for It's Garages app" \
    --display-name="Its Garages Service"

# Grant necessary permissions
gcloud projects add-iam-policy-binding its-garages \
    --member="serviceAccount:its-garages-service@its-garages.iam.gserviceaccount.com" \
    --role="roles/cloudsql.client"
```

### **Step 3: Manual Deployment (First Time)**
```bash
# Build and deploy using Cloud Build
gcloud builds submit --config cloudbuild.yaml

# Or deploy directly
gcloud run deploy its-garages-app \
    --source . \
    --platform managed \
    --region us-central1 \
    --allow-unauthenticated \
    --port 8080 \
    --memory 512Mi \
    --cpu 1 \
    --max-instances 10 \
    --set-env-vars FLASK_ENV=production,FLASK_DEBUG=False
```

### **Step 4: Get Service URL**
```bash
gcloud run services describe its-garages-app \
    --platform managed \
    --region us-central1 \
    --format 'value(status.url)'
```

## 🌐 Custom Domain Setup (garages.itsfait.com)

### **Step 1: Map Custom Domain**
```bash
# Map domain to Cloud Run service
gcloud run domain-mappings create \
    --service its-garages-app \
    --domain garages.itsfait.com \
    --region us-central1 \
    --platform managed
```

### **Step 2: Get DNS Configuration**
```bash
# Get the DNS records to configure
gcloud run domain-mappings describe garages.itsfait.com \
    --region us-central1 \
    --platform managed
```

### **Step 3: Configure DNS Records**
Add these DNS records to your domain provider (where itsfait.com is managed):

**A Record:**
```
Name: garages
Type: A
Value: [IP address from step 2]
TTL: 300
```

**AAAA Record (if provided):**
```
Name: garages
Type: AAAA
Value: [IPv6 address from step 2]
TTL: 300
```

**CNAME Record (alternative):**
```
Name: garages
Type: CNAME
Value: ghs.googlehosted.com
TTL: 300
```

## 🔧 GitHub Actions Setup

### **Step 1: Create Service Account for GitHub**
```bash
# Create service account for GitHub Actions
gcloud iam service-accounts create github-actions \
    --description="Service account for GitHub Actions" \
    --display-name="GitHub Actions"

# Grant necessary permissions
gcloud projects add-iam-policy-binding its-garages \
    --member="serviceAccount:github-actions@its-garages.iam.gserviceaccount.com" \
    --role="roles/cloudbuild.builds.editor"

gcloud projects add-iam-policy-binding its-garages \
    --member="serviceAccount:github-actions@its-garages.iam.gserviceaccount.com" \
    --role="roles/run.admin"

gcloud projects add-iam-policy-binding its-garages \
    --member="serviceAccount:github-actions@its-garages.iam.gserviceaccount.com" \
    --role="roles/storage.admin"

gcloud projects add-iam-policy-binding its-garages \
    --member="serviceAccount:github-actions@its-garages.iam.gserviceaccount.com" \
    --role="roles/iam.serviceAccountUser"
```

### **Step 2: Create and Download Service Account Key**
```bash
# Create key file
gcloud iam service-accounts keys create github-actions-key.json \
    --iam-account=github-actions@its-garages.iam.gserviceaccount.com

# Display the key content (copy this for GitHub secrets)
cat github-actions-key.json
```

### **Step 3: Add GitHub Secrets**
Go to: https://github.com/Faitltd/It-s-Garages/settings/secrets/actions

Add this secret:
- **Name**: `GCP_SA_KEY`
- **Value**: [Content of github-actions-key.json file]

## 🔍 Verification Steps

### **1. Test Local Deployment**
```bash
# Test locally first
python app.py
# Visit: http://localhost:8080
```

### **2. Test Cloud Run Deployment**
```bash
# Get the Cloud Run URL
CLOUD_RUN_URL=$(gcloud run services describe its-garages-app \
    --platform managed \
    --region us-central1 \
    --format 'value(status.url)')

# Test the deployment
curl $CLOUD_RUN_URL/health
```

### **3. Test Custom Domain**
```bash
# Test custom domain (after DNS propagation)
curl https://garages.itsfait.com/health
```

## 📊 Monitoring & Logs

### **View Logs**
```bash
# View Cloud Run logs
gcloud logs read "resource.type=cloud_run_revision AND resource.labels.service_name=its-garages-app" \
    --limit 50 \
    --format "table(timestamp,textPayload)"
```

### **Monitor Performance**
- **Cloud Run Console**: https://console.cloud.google.com/run
- **Cloud Build History**: https://console.cloud.google.com/cloud-build/builds
- **Domain Mappings**: https://console.cloud.google.com/run/domains

## 🔄 Continuous Deployment

Once GitHub Actions is set up:
1. **Push to main branch** → Automatic deployment
2. **Pull requests** → Build verification
3. **Manual deployment** → Use GitHub Actions "Run workflow"

## 🛠️ Troubleshooting

### **Common Issues**

1. **Build Failures**
   ```bash
   # Check build logs
   gcloud builds list --limit=5
   gcloud builds log [BUILD_ID]
   ```

2. **Service Not Accessible**
   ```bash
   # Check service status
   gcloud run services describe its-garages-app \
       --platform managed \
       --region us-central1
   ```

3. **Domain Not Working**
   ```bash
   # Check domain mapping status
   gcloud run domain-mappings describe garages.itsfait.com \
       --region us-central1 \
       --platform managed
   ```

4. **DNS Issues**
   ```bash
   # Check DNS propagation
   nslookup garages.itsfait.com
   dig garages.itsfait.com
   ```

## 📋 Next Steps

1. ✅ **GitHub Repository** - Complete
2. ⏳ **Enable GCP APIs** - Run the commands above
3. ⏳ **Deploy to Cloud Run** - Run deployment commands
4. ⏳ **Set up Custom Domain** - Configure DNS records
5. ⏳ **Configure GitHub Actions** - Add service account key
6. ⏳ **Test Everything** - Verify all endpoints work

## 🔗 Important URLs

- **GitHub Repository**: https://github.com/Faitltd/It-s-Garages.git
- **GCP Console**: https://console.cloud.google.com/run?project=its-garages
- **Target URL**: https://garages.itsfait.com
- **Cloud Run Service**: its-garages-app (us-central1)
