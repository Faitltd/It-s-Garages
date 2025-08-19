#!/usr/bin/env python3
"""
Garage Door Data Entry - Simple Interface

A simple Flask web application for entering garage door measurements
with Google Places API integration.
"""

from flask import Flask, render_template, request, jsonify
import os
import json
from datetime import datetime
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

app = Flask(__name__)

# Configuration
DATA_FILE = os.getenv('MEASUREMENTS_FILE', 'data/garage_doors.json')
DATA_DIR = Path('data')
DATA_DIR.mkdir(exist_ok=True)
GOOGLE_PLACES_API_KEY = os.getenv('GOOGLE_PLACES_API_KEY', '')

def load_garage_doors():
    """Load garage door measurements from JSON file."""
    data_path = Path(DATA_FILE)
    if data_path.exists():
        try:
            with open(data_path, 'r') as f:
                return json.load(f)
        except (json.JSONDecodeError, IOError) as e:
            print(f"Warning: Could not load garage doors: {e}")
    return []

def save_garage_doors(garage_doors):
    """Save garage door measurements to JSON file."""
    try:
        with open(DATA_FILE, 'w') as f:
            json.dump(garage_doors, f, indent=2)
        return True
    except IOError as e:
        print(f"Error saving garage doors: {e}")
        return False

def generate_entry_id():
    """Generate a unique entry ID."""
    import time
    return f"garage_{int(time.time() * 1000)}"

@app.route('/')
def index():
    """Main garage door data entry page."""
    garage_doors = load_garage_doors()
    total_entries = len(garage_doors)

    # Get recent entries (last 5)
    recent_entries = garage_doors[-5:] if garage_doors else []

    return render_template('index.html',
                         total_entries=total_entries,
                         recent_entries=recent_entries,
                         google_places_api_key=GOOGLE_PLACES_API_KEY)

@app.route('/save_garage_door', methods=['POST'])
def save_garage_door():
    """Save garage door entries."""
    try:
        data = request.get_json() if request.is_json else request.form.to_dict()

        # Validate required fields
        address = data.get('address', '').strip()
        if not address:
            return jsonify({'status': 'error', 'message': 'Address is required'}), 400

        # Handle multiple doors
        doors = data.get('doors', [])
        if not doors:
            return jsonify({'status': 'error', 'message': 'At least one door is required'}), 400

        # Load existing garage doors
        garage_doors = load_garage_doors()

        # Save each door as a separate entry
        saved_count = 0
        for door in doors:
            garage_door_data = {
                'id': generate_entry_id(),
                'address': address,
                'door_size': door.get('size', '16x7'),
                'notes': data.get('notes', '').strip(),
                'timestamp': datetime.now().isoformat(),
                'date_added': datetime.now().strftime('%Y-%m-%d %H:%M')
            }
            garage_doors.append(garage_door_data)
            saved_count += 1

        if save_garage_doors(garage_doors):
            return jsonify({
                'status': 'success',
                'message': f'Saved {saved_count} garage door(s) successfully!',
                'count': saved_count
            })
        else:
            return jsonify({'status': 'error', 'message': 'Failed to save garage doors'}), 500

    except ValueError as e:
        return jsonify({'status': 'error', 'message': f'Invalid data: {e}'}), 400
    except Exception as e:
        return jsonify({'status': 'error', 'message': f'Server error: {e}'}), 500

@app.route('/garage_doors')
def view_garage_doors():
    """Get all garage door entries as JSON."""
    garage_doors = load_garage_doors()
    return jsonify(garage_doors)

@app.route('/stats')
def stats():
    """Get basic statistics."""
    garage_doors = load_garage_doors()

    if not garage_doors:
        return jsonify({
            'total_doors': 0,
            'total_properties': 0
        })

    total_doors = len(garage_doors)
    # Count unique addresses
    unique_addresses = len(set(door.get('address', '') for door in garage_doors))

    return jsonify({
        'total_doors': total_doors,
        'total_properties': unique_addresses
    })

@app.route('/health')
def health_check():
    """Health check endpoint."""
    return jsonify({
        'status': 'healthy',
        'timestamp': datetime.now().isoformat(),
        'data_file': DATA_FILE,
        'data_file_exists': Path(DATA_FILE).exists()
    })

if __name__ == '__main__':
    # Production configuration
    host = os.getenv('FLASK_HOST', '0.0.0.0')
    port = int(os.getenv('PORT', os.getenv('FLASK_PORT', '8080')))  # Cloud Run uses PORT env var
    debug = os.getenv('FLASK_DEBUG', 'False').lower() == 'true'

    print(f"🚪 Garage Door Data Entry")
    print(f"   Starting server at http://{host}:{port}")
    print(f"   Data file: {DATA_FILE}")
    print(f"   Google Places API: {'Configured' if GOOGLE_PLACES_API_KEY else 'Not configured'}")
    print(f"   Debug mode: {debug}")
    print(f"   Environment: {'Production' if not debug else 'Development'}")

    app.run(host=host, port=port, debug=debug)
