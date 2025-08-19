# 🔑 Quick API Key Setup Guide

## 🚀 **5-Minute Setup**

### Step 1: Get Your Google Places API Key
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Go to "APIs & Services" → "Library"
4. Enable these APIs:
   - **Places API**
   - **Geocoding API** 
   - **Maps JavaScript API**
5. Go to "APIs & Services" → "Credentials"
6. Click "Create Credentials" → "API Key"
7. Copy your API key

### Step 2: Configure the Application
Open `garage-door-data-entry.html` and find this line (around line 16):
```javascript
const GOOGLE_PLACES_API_KEY = 'YOUR_GOOGLE_PLACES_API_KEY';
```

Replace it with your actual API key:
```javascript
const GOOGLE_PLACES_API_KEY = 'AIzaSyBvOkBwGyiwHDCCOXL1OQZN0zRA2K7omXs'; // Your real key here
```

### Step 3: Test the Setup
1. Open `test-google-places.html` in your browser
2. Update the API key in that file too (same way as above)
3. Test typing an address to see if autocomplete works
4. Click "Test API Status" to verify everything is working

## 🛡️ **Security Setup (Important!)**

### Restrict Your API Key
1. In Google Cloud Console, go to "APIs & Services" → "Credentials"
2. Click on your API key
3. Under "Application restrictions":
   - Select "HTTP referrers (web sites)"
   - Add your domains:
     ```
     https://yourdomain.com/*
     https://itsgarages.itsfait.com/*
     http://localhost:*  (for testing)
     ```

4. Under "API restrictions":
   - Select "Restrict key"
   - Choose: Places API, Geocoding API, Maps JavaScript API

## 🧪 **Testing Without API Key**

The application works even without an API key! It will:
- Show a warning message about manual entry
- Provide a regular text input for addresses
- Hide all Google Maps error messages
- Still collect all garage door data properly

## ❌ **Troubleshooting**

### "InvalidKey" or "InvalidKeyMapError"
- Your API key is incorrect or not properly configured
- Make sure you copied the entire key
- Check that the required APIs are enabled

### Exclamation points over address field
- **Fixed!** This version hides these error overlays
- The app will show a clear status message instead

### Address autocomplete not working
- Check your API key configuration
- Ensure you're on HTTPS for production
- Use the test file to debug issues

### "Authentication failed" 
- Your API key restrictions are too strict
- Add your domain to the allowed referrers
- Make sure billing is enabled in Google Cloud

## 💰 **Cost Information**

Google Places API pricing:
- **$200 free credit per month** (covers most small applications)
- Autocomplete: $2.83 per 1,000 requests
- Most garage door apps won't exceed the free tier

## 🔧 **Advanced Configuration**

### Environment Variables (Production)
For production deployments, use environment variables:

```javascript
const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY || 'YOUR_FALLBACK_KEY';
```

### Multiple Environments
```javascript
const GOOGLE_PLACES_API_KEY = window.location.hostname === 'localhost' 
    ? 'YOUR_DEV_API_KEY'
    : 'YOUR_PRODUCTION_API_KEY';
```

## ✅ **Verification Checklist**

Before going live:
- [ ] API key is configured in the JavaScript
- [ ] Required APIs are enabled in Google Cloud
- [ ] API key restrictions are properly set
- [ ] Billing is enabled (required for API access)
- [ ] Test file shows "Address autocomplete ready"
- [ ] Address suggestions appear when typing
- [ ] Selected addresses populate the field correctly
- [ ] No error messages or visual artifacts appear

## 📞 **Need Help?**

1. **Test your setup**: Use `test-google-places.html`
2. **Check browser console**: Look for error messages
3. **Verify API status**: The app shows clear status messages
4. **Manual entry works**: Even without API key, the app functions

The application is designed to work gracefully with or without the Google Places API, so you can deploy it immediately and add the API key later for enhanced functionality.

---

**Quick Start**: Just replace `YOUR_GOOGLE_PLACES_API_KEY` with your real API key and you're ready to go! 🚀
