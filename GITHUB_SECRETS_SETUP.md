# GitHub Secrets Setup for Cloud Run Deployment

## Required Secrets

To deploy the Garage Door Game to Google Cloud Run, you need to set up the following secrets in your GitHub repository:

### 1. Google Cloud Platform Authentication
- **Secret Name**: `GCP_SA_KEY`
- **Description**: Service Account JSON key for Google Cloud Platform
- **How to get it**:
  1. Go to [Google Cloud Console](https://console.cloud.google.com/)
  2. Navigate to IAM & Admin > Service Accounts
  3. Create a new service account or use existing one
  4. Grant the following roles:
     - Cloud Run Admin
     - Cloud Build Editor
     - Container Registry Service Agent
     - Storage Admin
  5. Create a JSON key for the service account
  6. Copy the entire JSON content and paste it as the secret value

### 2. Application Secrets
- **Secret Name**: `JWT_SECRET`
- **Description**: Secret key for JWT token signing
- **Value**: Generate a secure random string (e.g., `openssl rand -base64 32`)

- **Secret Name**: `GOOGLE_STREET_VIEW_API_KEY`
- **Description**: Google Street View API key
- **How to get it**:
  1. Go to [Google Cloud Console](https://console.cloud.google.com/)
  2. Navigate to APIs & Services > Credentials
  3. Create API Key
  4. Enable Street View Static API
  5. Restrict the key to your domain if needed

- **Secret Name**: `GOOGLE_MAPS_API_KEY`
- **Description**: Google Maps API key (can be same as Street View key)
- **How to get it**: Same process as Street View API key

## Setting Up Secrets in GitHub

1. Go to your GitHub repository
2. Click on **Settings** tab
3. In the left sidebar, click **Secrets and variables** > **Actions**
4. Click **New repository secret**
5. Add each secret with the exact name and value

## Verifying Setup

After setting up the secrets, the next push to the `main` branch should trigger a successful deployment. You can monitor the deployment in the **Actions** tab of your GitHub repository.

## Troubleshooting

### Common Issues:
1. **Authentication Failed**: Check that `GCP_SA_KEY` is valid JSON and the service account has proper permissions
2. **API Key Issues**: Ensure Google APIs are enabled and keys have proper restrictions
3. **Build Failures**: Check that all required secrets are set with correct names

### Checking Deployment Status:
```bash
# Check Cloud Run services
gcloud run services list --region=us-central1

# Check service logs
gcloud logs read "resource.type=cloud_run_revision" --limit=50
```

## Security Notes

- Never commit API keys or secrets to the repository
- Use environment-specific API keys (development vs production)
- Regularly rotate JWT secrets and API keys
- Monitor API usage and set up billing alerts
