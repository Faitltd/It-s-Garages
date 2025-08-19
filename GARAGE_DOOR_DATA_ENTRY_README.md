# 🚪 Garage Door Data Entry - Mobile-First Web Application

A single-page, mobile-first web application for collecting garage door data with an 8-bit retro aesthetic inspired by classic Mario games.

## ✨ Features

### 🎮 8-Bit Retro Design
- **Pixelated fonts** using "Press Start 2P" Google Font
- **Bright colors** and geometric shapes reminiscent of classic video games
- **Animated clouds** floating across the background
- **Mario-style text boxes** with distinctive borders and shadows
- **Retro button effects** with hover and press animations

### 📱 Mobile-First Design
- **100% mobile compatibility** with responsive design
- **Touch-friendly interface** with minimum 44px touch targets
- **Haptic feedback** on supported devices
- **Optimized for mobile networks** with fast loading times
- **iOS zoom prevention** with proper input font sizing
- **Accessibility support** including reduced motion and high contrast modes

### 🗺️ Google Places Integration
- **Address autocomplete** with Google Places API
- **Real-time address suggestions** as you type
- **US address filtering** for accurate results
- **Automatic address population** when selected from suggestions

### 📏 Dynamic Door Management
- **"Add Another Door" functionality** for unlimited door entries
- **Individual door removal** with confirmation
- **Preset buttons** for common sizes per door:
  - 8' × 7' (Single Standard)
  - 9' × 7' (Single Wide)
  - 16' × 7' (Double Standard)
  - 18' × 7' (Double Wide)
  - 8' × 8' (Single Tall)
  - 16' × 8' (Double Tall)
- **Custom size option** with dropdown menus per door:
  - Width: 6' to 20' in 1' increments
  - Height: 6' to 10' in 6" increments
- **Visual door counter** showing total doors added
- **Automatic door renumbering** when doors are removed

### 🎯 User Experience Features
- **Form validation** with clear error messages
- **Visual feedback** for all interactions
- **Loading states** during form submission
- **Success/error messaging** with auto-hide
- **Form reset** after successful submission
- **Optional notes field** for additional details

## 🚀 Setup Instructions

### 1. Google Places API Key
1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the **Places API**, **Geocoding API**, and **Maps JavaScript API**
4. Create an API key with appropriate restrictions
5. Replace `YOUR_GOOGLE_PLACES_API_KEY` in the HTML file with your actual API key
6. **See `GOOGLE_PLACES_SETUP_GUIDE.md` for detailed setup instructions**
7. **Use `test-google-places.html` to test your API integration**

### 2. Deploy the Application
1. Save the `garage-door-data-entry.html` file to your web server
2. Ensure the file is accessible via HTTPS (required for geolocation features)
3. Test on various mobile devices and screen sizes

### 3. Customize for Your Needs
- **API Integration**: Replace the simulated form submission with actual API calls
- **Styling**: Modify colors and animations in the CSS section
- **Validation**: Add additional form validation rules as needed
- **Data Fields**: Add more garage door characteristics if required

## 📱 Mobile Optimization Details

### Touch Targets
- All interactive elements are minimum 44px (iOS) / 48dp (Android)
- Buttons have adequate spacing to prevent accidental taps
- Form inputs are sized appropriately for thumb interaction

### Performance
- Single HTML file for fast loading
- Optimized CSS with mobile-first approach
- Minimal JavaScript for quick execution
- Google Fonts loaded with `display=swap` for better performance

### Accessibility
- Semantic HTML structure
- Proper ARIA labels and roles
- Support for reduced motion preferences
- High contrast mode compatibility
- Screen reader friendly

## 🎨 Design Philosophy

The application follows an 8-bit aesthetic while maintaining modern usability:

- **Colors**: Bright, saturated colors typical of 8-bit games
- **Typography**: Pixelated "Press Start 2P" font for authenticity
- **Animations**: Simple, game-like transitions and effects
- **Layout**: Clean, centered design with clear visual hierarchy
- **Feedback**: Immediate visual and haptic responses to user actions

## 🔧 Technical Specifications

- **HTML5** with semantic markup
- **CSS3** with Flexbox and Grid layouts
- **Vanilla JavaScript** (no frameworks required)
- **Google Places API** for address autocomplete
- **Responsive design** with mobile-first approach
- **Progressive enhancement** for better compatibility

## 📊 Data Collection

The form collects the following data:
- **Address** (with Google Places validation)
- **Dynamic door entries** (unlimited doors)
- **Per-door dimensions** (preset or custom for each door)
- **Door numbering** and organization
- **Additional notes** (optional)
- **Timestamp** and device information
- **User agent** and screen resolution

### Sample Data Structure
```json
{
  "address": "123 Main St, Denver, CO 80202",
  "doorCount": 2,
  "doors": [
    {
      "doorNumber": 1,
      "width": 16,
      "height": 7,
      "sizeCategory": "16x7",
      "isCustom": false
    },
    {
      "doorNumber": 2,
      "width": 8.5,
      "height": 8,
      "sizeCategory": "custom",
      "isCustom": true
    }
  ],
  "notes": "Two-car garage with one custom door",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

## 🚀 Future Enhancements

Potential improvements for future versions:
- Photo upload functionality
- Offline support with service workers
- Data export capabilities
- Integration with backend databases
- Advanced garage door characteristics
- GPS location services
- Multi-language support

## 📞 Support

For questions or issues with this application, please refer to the It's Garages documentation or contact the development team.

---

**Made with ❤️ for It's Garages**  
*Bringing 8-bit style to modern data collection*
