# 🗺️ Google Places API Setup Guide

This guide will help you set up the Google Places API for the garage door data entry application.

## 🆕 **Important Update - New Google Places API**

**As of March 1st, 2025**, Google is deprecating the legacy `google.maps.places.Autocomplete` API for new customers. This application has been updated to use the new `google.maps.places.PlaceAutocompleteElement` API with automatic fallback to the legacy API for existing users.

### ✅ **What's Fixed in This Version:**
- **New API Implementation**: Uses `PlaceAutocompleteElement` for future compatibility
- **Automatic Fallback**: Falls back to legacy API if new API is not available
- **Better Error Handling**: Graceful handling of missing/invalid API keys
- **Visual Issue Fixed**: No more exclamation points or error overlays
- **Performance Improved**: Uses `loading=async` for optimal loading
- **Manual Entry Fallback**: Works without API key for manual address entry

## 📋 Prerequisites

- Google Cloud Platform account
- Credit card (required for API access, but there's a generous free tier)
- Web server with HTTPS (required for production use)

## 🚀 Step-by-Step Setup

### 1. Create a Google Cloud Project

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Click "Select a project" → "New Project"
3. Enter a project name (e.g., "Garage Door Data Entry")
4. Click "Create"

### 2. Enable Required APIs

1. In the Google Cloud Console, go to "APIs & Services" → "Library"
2. Search for and enable these APIs:
   - **Places API** (for address autocomplete)
   - **Geocoding API** (for address validation)
   - **Maps JavaScript API** (required dependency)

### 3. Create API Credentials

1. Go to "APIs & Services" → "Credentials"
2. Click "Create Credentials" → "API Key"
3. Copy the generated API key
4. Click "Restrict Key" to secure it

### 4. Configure API Key Restrictions

**Application Restrictions:**
- Select "HTTP referrers (web sites)"
- Add your domain(s):
  - `https://yourdomain.com/*`
  - `https://itsgarages.itsfait.com/*`
  - For testing: `http://localhost:*` and `file://*`

**API Restrictions:**
- Select "Restrict key"
- Choose these APIs:
  - Places API
  - Geocoding API
  - Maps JavaScript API

### 5. Update the HTML File

Replace `YOUR_GOOGLE_PLACES_API_KEY` in both files with your actual API key:

**In `garage-door-data-entry.html`:**
```javascript
// Configuration - Set your API key here
const GOOGLE_PLACES_API_KEY = 'YOUR_ACTUAL_API_KEY_HERE';
```

**In `test-google-places.html`:**
```javascript
const GOOGLE_PLACES_API_KEY = 'YOUR_ACTUAL_API_KEY_HERE';
```

**⚠️ Important**: Replace `YOUR_ACTUAL_API_KEY_HERE` with your real API key from step 3.

## 🧪 Testing the Integration

### Method 1: Use the Test File

1. Open `test-google-places.html` in your browser
2. Check the status messages
3. Try typing an address to see if autocomplete works
4. Use the "Test API Status" button to debug issues

### Method 2: Browser Console Testing

1. Open the main application in your browser
2. Open Developer Tools (F12)
3. In the console, run: `checkGooglePlacesAPI()`
4. Check for any error messages

### Common Issues and Solutions

**❌ "Google Maps API authentication failed"**
- Check that your API key is correct in the JavaScript configuration
- Verify the API key restrictions allow your domain
- Ensure billing is enabled on your Google Cloud project
- **Solution**: The app now shows a clear error message and falls back to manual entry

**❌ "Google Places API not available"**
- Check that the Places API is enabled in Google Cloud Console
- Verify the script includes `&libraries=places&loading=async`
- Check browser console for network errors
- **Solution**: The app automatically detects this and provides manual address entry

**❌ Exclamation points appearing over address field**
- This was caused by Google Maps error overlays
- **Solution**: Fixed with CSS that hides error overlays and uses proper error handling

**❌ Autocomplete not working**
- Ensure you're testing on HTTPS (required for production)
- Check that the API key is properly set in the JavaScript configuration
- **Solution**: The app now tries both new and legacy APIs automatically

**❌ "This page can't load Google Maps correctly"**
- Check API key restrictions
- Ensure billing is enabled
- Verify the correct APIs are enabled
- **Solution**: The app gracefully handles this and allows manual address entry

**❌ Deprecated API warnings**
- Google is deprecating the old Autocomplete API
- **Solution**: This app now uses the new PlaceAutocompleteElement API with automatic fallback

## 💰 Pricing Information

Google Places API has a generous free tier:
- **$200 free credit per month**
- **Autocomplete requests**: $2.83 per 1,000 requests
- **Geocoding requests**: $5.00 per 1,000 requests

For a typical garage door data entry application, you're unlikely to exceed the free tier.

## 🔒 Security Best Practices

1. **Always restrict your API key** to specific domains
2. **Never commit API keys** to version control
3. **Use environment variables** for production deployments
4. **Monitor usage** in Google Cloud Console
5. **Set up billing alerts** to avoid unexpected charges

## 🛠️ Development vs Production

### Development Setup
```html
<!-- For local testing -->
<script src="https://maps.googleapis.com/maps/api/js?key=YOUR_DEV_API_KEY&libraries=places&callback=initGooglePlaces" async defer></script>
```

### Production Setup
```html
<!-- For production with environment variable -->
<script src="https://maps.googleapis.com/maps/api/js?key=${GOOGLE_PLACES_API_KEY}&libraries=places&callback=initGooglePlaces" async defer></script>
```

## 📱 Mobile Considerations

The Google Places API works well on mobile devices, but consider:

1. **Touch-friendly dropdowns** - The API automatically adapts
2. **Network connectivity** - Handle offline scenarios gracefully
3. **Performance** - Autocomplete requests are throttled automatically
4. **User experience** - Provide fallback manual entry options

## 🔧 Advanced Configuration

### Customize Autocomplete Behavior

```javascript
autocomplete = new google.maps.places.Autocomplete(addressInput, {
    types: ['address'],                    // Only show addresses
    componentRestrictions: { country: 'us' }, // US addresses only
    fields: ['formatted_address', 'geometry', 'name'], // Limit returned data
    strictBounds: false,                   // Allow results outside viewport
    bounds: new google.maps.LatLngBounds(  // Bias results to specific area
        new google.maps.LatLng(39.7392, -104.9903), // Southwest corner
        new google.maps.LatLng(39.7392, -104.9903)  // Northeast corner
    )
});
```

### Handle Different Address Formats

```javascript
autocomplete.addListener('place_changed', function() {
    const place = autocomplete.getPlace();
    
    // Try different address formats
    let address = place.formatted_address || 
                  place.name || 
                  place.vicinity || 
                  'Address not found';
    
    addressInput.value = address;
});
```

## 📞 Support and Troubleshooting

If you encounter issues:

1. Check the [Google Places API documentation](https://developers.google.com/maps/documentation/places/web-service)
2. Review the [JavaScript API documentation](https://developers.google.com/maps/documentation/javascript/places-autocomplete)
3. Use the browser's Developer Tools to check for errors
4. Test with the provided `test-google-places.html` file

## ✅ Verification Checklist

Before deploying to production:

- [ ] API key is created and properly restricted
- [ ] Required APIs are enabled in Google Cloud Console
- [ ] Billing is enabled on the Google Cloud project
- [ ] API key is replaced in the HTML file
- [ ] Autocomplete works on your domain
- [ ] HTTPS is configured for production
- [ ] Error handling is implemented
- [ ] Usage monitoring is set up

---

**Need Help?** 
- Google Cloud Support: [https://cloud.google.com/support](https://cloud.google.com/support)
- Stack Overflow: Search for "google-places-api" tag
- Google Maps Platform Community: [https://developers.google.com/maps/support](https://developers.google.com/maps/support)
