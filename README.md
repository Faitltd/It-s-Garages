# 🏠 It's Garages - Data Entry System

A simple web interface for manually entering and managing garage measurement data.

## 🚀 Quick Start

### Prerequisites
- Python 3.7+
- pip (Python package installer)

### Installation

1. **Clone or download this project**
2. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

3. **Set up environment (optional):**
   ```bash
   cp .env.example .env
   # Edit .env if you want to customize settings
   ```

4. **Run the application:**
   ```bash
   python app.py
   ```

5. **Open your browser:**
   ```
   http://localhost:5000
   ```

## 📋 Features

### ✅ Data Entry
- Simple form for entering garage measurements
- Support for properties with and without garages
- Validation and error handling
- Confidence levels for measurements

### 📊 Dashboard
- Overview statistics
- Recent entries display
- Quick action buttons

### 📋 Data Management
- View all entries in a sortable table
- Search and filter functionality
- Edit existing entries
- Delete entries with confirmation

### 📤 Data Export
- Export all data as JSON
- Suitable for analysis or backup

## 🏗️ Project Structure

```
├── app.py              # Main Flask application
├── requirements.txt    # Python dependencies
├── .env.example       # Environment configuration template
├── README.md          # This file
├── data/              # Data storage directory
│   └── measurements.json  # JSON file storing all measurements
└── templates/         # HTML templates
    ├── base.html      # Base template with common layout
    ├── index.html     # Dashboard page
    ├── entry.html     # Data entry form
    └── measurements.html  # View all measurements
```

## 📏 Data Format

Each measurement entry contains:

```json
{
  "property_id": {
    "address": "123 Main St, City, State 12345",
    "garage_width_feet": 24.0,
    "garage_depth_feet": 22.0,
    "garage_height_feet": 8.0,
    "door_count": 2,
    "door_width_feet": 8.0,
    "door_height_feet": 7.0,
    "has_garage": true,
    "garage_type": "attached",
    "notes": "Two-car garage with storage",
    "confidence": "high",
    "measured_date": "2025-01-15T10:30:00",
    "property_id": "123_main_st_city_state_12345"
  }
}
```

## 🎯 Usage Guidelines

### Measurement Standards
- **Width:** Front-facing dimension of garage opening
- **Depth:** Distance from garage door to back wall
- **Height:** Floor to ceiling height at the garage door
- **Accuracy:** Measure to nearest 0.5 feet when possible

### Confidence Levels
- **High:** Very certain about measurements (±1 foot)
- **Medium:** Reasonably certain (±2 feet)
- **Low:** Best estimate (±3+ feet)

### Common Garage Sizes
- **Single:** 12' × 20' to 16' × 24'
- **Double:** 20' × 20' to 24' × 24'
- **Triple:** 30' × 20' to 36' × 24'

## 🔧 Configuration

### Environment Variables (.env file)
```bash
# Flask Configuration
FLASK_HOST=0.0.0.0
FLASK_PORT=5000
FLASK_DEBUG=True

# Data Storage
MEASUREMENTS_FILE=data/measurements.json
```

### Customization
- **Port:** Change `FLASK_PORT` in `.env` or modify `app.py`
- **Data Location:** Change `MEASUREMENTS_FILE` path
- **Styling:** Edit CSS in `templates/base.html`

## 📊 API Endpoints

- `GET /` - Dashboard
- `GET /entry` - Data entry form
- `POST /save_measurement` - Save new measurement
- `GET /measurements` - View all measurements
- `GET /edit/<property_id>` - Edit measurement form
- `POST /update_measurement/<property_id>` - Update measurement
- `POST /delete/<property_id>` - Delete measurement
- `GET /export` - Export data as JSON
- `GET /stats` - Get statistics
- `GET /health` - Health check

## 🔒 Data Security

- All data stored locally in JSON file
- No external database required
- No user authentication (single-user system)
- Regular backups recommended

## 🚀 Deployment

### Local Development
```bash
python app.py
```

### Production (Basic)
```bash
pip install gunicorn
gunicorn -w 4 -b 0.0.0.0:5000 app:app
```

### Docker (Optional)
```dockerfile
FROM python:3.9-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY . .
EXPOSE 5000
CMD ["python", "app.py"]
```

## 📝 Data Backup

### Manual Backup
- Copy `data/measurements.json` to safe location
- Use "Export Data" feature in web interface

### Automated Backup (Linux/Mac)
```bash
# Add to crontab for daily backup
0 2 * * * cp /path/to/data/measurements.json /path/to/backup/measurements_$(date +\%Y\%m\%d).json
```

## 🐛 Troubleshooting

### Common Issues

1. **Port already in use:**
   - Change port in `.env` or `app.py`
   - Kill existing process: `lsof -ti:5000 | xargs kill`

2. **Permission errors:**
   - Ensure write permissions for `data/` directory
   - Check file ownership

3. **Module not found:**
   - Install requirements: `pip install -r requirements.txt`
   - Check Python version compatibility

### Logs
- Application logs printed to console
- Check browser developer tools for client-side errors

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

MIT License - feel free to use and modify as needed.

## 📞 Support

For issues or questions:
1. Check the troubleshooting section
2. Review the code comments
3. Create an issue in the repository
