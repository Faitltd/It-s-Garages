#!/usr/bin/env python3
"""
Garage Door Data Entry - Simple Interface

A simple Flask web application for entering garage door measurements
with Google Places API integration.
"""

from flask import Flask, render_template, request, jsonify
import os
import json
import threading
from collections import defaultdict, deque
from time import time
from datetime import datetime
from pathlib import Path
from dotenv import load_dotenv

# Optional import: Google Cloud Storage
try:
    from google.cloud import storage  # type: ignore
except Exception:  # pragma: no cover
    storage = None
# Load environment variables
load_dotenv()

app = Flask(__name__)

# Configuration
DATA_FILE = os.getenv('MEASUREMENTS_FILE', 'data/garage_doors.json')
DATA_DIR = Path('data')
DATA_DIR.mkdir(exist_ok=True)
GOOGLE_PLACES_API_KEY = os.getenv('GOOGLE_PLACES_API_KEY', '')
GOOGLE_GEOCODING_API_KEY = os.getenv('GOOGLE_GEOCODING_API_KEY', '')  # server-side key for reverse geocoding


# Cloud Storage configuration
GCS_BUCKET = os.getenv('GCS_BUCKET')  # e.g., 'its-garages-data'
GCS_OBJECT = os.getenv('GCS_OBJECT', 'garage_doors.json')
USE_GCS = bool(GCS_BUCKET)

_gcs_client = None

# Simple in-memory rate limiter (per-IP/token bucket)
RATE_LIMIT_WINDOW_SECONDS = int(os.getenv('RATE_LIMIT_WINDOW_SECONDS', '60'))
RATE_LIMIT_MAX_REQUESTS = int(os.getenv('RATE_LIMIT_MAX_REQUESTS', '30'))  # per window per IP
_rate_lock = threading.Lock()
_requests_log = defaultdict(deque)  # ip -> deque[timestamps]

def _get_gcs_client():
    global _gcs_client
    if _gcs_client is None:
        if not storage:
            raise RuntimeError('google-cloud-storage not installed')
        _gcs_client = storage.Client()  # uses ADC in Cloud Run
    return _gcs_client


def _load_from_gcs():
    try:
        client = _get_gcs_client()
        bucket = client.bucket(GCS_BUCKET)
        blob = bucket.blob(GCS_OBJECT)
        if not blob.exists():
            return []
        data = blob.download_as_text()
        return json.loads(data) if data else []
    except Exception as e:
        print(f"Warning: Could not load from GCS: {e}")
        return []


def _save_to_gcs(payload):
    try:
        client = _get_gcs_client()
        bucket = client.bucket(GCS_BUCKET)
        blob = bucket.blob(GCS_OBJECT)
        blob.upload_from_string(json.dumps(payload, indent=2), content_type='application/json')
        return True
    except Exception as e:
        print(f"Error saving to GCS: {e}")
        return False


def load_garage_doors():
    """Load garage door measurements from GCS if configured, otherwise local file."""
    if USE_GCS:
        return _load_from_gcs()
    # Fallback to local JSON
    data_path = Path(DATA_FILE)
    if data_path.exists():
        try:
            with open(data_path, 'r') as f:
                return json.load(f)
        except (json.JSONDecodeError, IOError) as e:
            print(f"Warning: Could not load garage doors: {e}")
    return []


def save_garage_doors(garage_doors):
    """Save garage door measurements to GCS if configured, otherwise local JSON file."""
    if USE_GCS:
        return _save_to_gcs(garage_doors)
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

def _rate_limited(ip: str) -> bool:
    now = time()
    window_start = now - RATE_LIMIT_WINDOW_SECONDS
    with _rate_lock:
        dq = _requests_log[ip]
        # drop old timestamps
        while dq and dq[0] < window_start:
            dq.popleft()
        if len(dq) >= RATE_LIMIT_MAX_REQUESTS:
            return True
        dq.append(now)
        return False


@app.route('/save_garage_door', methods=['POST'])
def save_garage_door():
    """Save garage door entries."""
    # Basic rate limiting per-IP
    ip = request.headers.get('X-Forwarded-For', request.remote_addr or 'unknown').split(',')[0].strip()
    if _rate_limited(ip):
        return jsonify({'status': 'error', 'message': 'Too many requests, please slow down.'}), 429

    try:
        # Be tolerant to various content-types and avoid BadRequest on JSON parse
        data = request.get_json(silent=True)
        if not data:
            # Try raw body as JSON
            try:
                raw = request.get_data(cache=False, as_text=True)
                data = json.loads(raw) if raw else None
            except Exception:
                data = None
        if not data:
            # Fallback to form-encoded
            data = request.form.to_dict(flat=True)
            # If doors comes as JSON string, decode it
            if isinstance(data.get('doors'), str):
                try:
                    data['doors'] = json.loads(data['doors'])
                except Exception:
                    pass

        # Validate required fields (support body, form, or query)
        address = data.get('address', '').strip() if isinstance(data, dict) else ''
        if not address:
            address = (request.values.get('address') or '').strip()
        if not address:
            return jsonify({'status': 'error', 'message': 'Address is required'}), 400

        # Handle multiple doors
        doors = data.get('doors', []) if isinstance(data, dict) else []
        if not doors:
            # Try query/form param 'doors' as JSON string
            raw_doors = request.values.get('doors')
            if raw_doors:
                try:
                    doors = json.loads(raw_doors)
                except Exception:
                    doors = []
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

@app.route('/reverse_geocode', methods=['POST'])
def reverse_geocode():
    """Server-side reverse geocoding fallback. Body: { lat, lng }"""
    try:
        data = request.get_json(silent=True) or {}
        lat = data.get('lat')
        lng = data.get('lng')
        if lat is None or lng is None:
            return jsonify({'status': 'error', 'message': 'lat and lng are required'}), 400
        if not GOOGLE_GEOCODING_API_KEY:
            return jsonify({'status': 'error', 'message': 'Server geocoding key not configured'}), 500

        import requests
        resp = requests.get(
            'https://maps.googleapis.com/maps/api/geocode/json',
            params={'latlng': f'{lat},{lng}', 'key': GOOGLE_GEOCODING_API_KEY},
            timeout=10
        )
        if resp.status_code != 200:
            return jsonify({'status': 'error', 'message': f'Geocode HTTP {resp.status_code}'}), 502
        payload = resp.json()
        if payload.get('status') != 'OK' or not payload.get('results'):
            return jsonify({'status': 'error', 'message': f"Geocode failed: {payload.get('status')}"}), 502
        formatted = payload['results'][0]['formatted_address']
        return jsonify({'status': 'ok', 'formatted_address': formatted})
    except Exception as e:
        return jsonify({'status': 'error', 'message': f'Server error: {e}'}), 500

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
