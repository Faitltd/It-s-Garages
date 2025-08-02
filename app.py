#!/usr/bin/env python3
"""
It's Garages - Simple Data Entry Web Interface

A Flask web application for manually entering garage measurement data.
"""

from flask import Flask, render_template, request, jsonify, redirect, url_for
import os
import json
from datetime import datetime
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

app = Flask(__name__)

# Configuration
DATA_FILE = os.getenv('MEASUREMENTS_FILE', 'data/measurements.json')
DATA_DIR = Path('data')
DATA_DIR.mkdir(exist_ok=True)

def load_measurements():
    """Load measurements from JSON file."""
    data_path = Path(DATA_FILE)
    if data_path.exists():
        try:
            with open(data_path, 'r') as f:
                return json.load(f)
        except (json.JSONDecodeError, IOError) as e:
            print(f"Warning: Could not load measurements: {e}")
    return {}

def save_measurements(measurements):
    """Save measurements to JSON file."""
    try:
        with open(DATA_FILE, 'w') as f:
            json.dump(measurements, f, indent=2)
        return True
    except IOError as e:
        print(f"Error saving measurements: {e}")
        return False

def generate_property_id(address):
    """Generate a unique property ID from address."""
    import re
    # Clean and normalize address
    prop_id = re.sub(r'[^a-zA-Z0-9\s]', '', address.lower())
    prop_id = re.sub(r'\s+', '_', prop_id.strip())
    return prop_id[:50]  # Limit length

@app.route('/')
def index():
    """Main data entry page."""
    measurements = load_measurements()
    total_entries = len(measurements)
    
    # Get recent entries
    recent_entries = []
    for prop_id, data in list(measurements.items())[-5:]:
        recent_entries.append({
            'id': prop_id,
            'address': data.get('address', prop_id.replace('_', ' ')),
            'date': data.get('measured_date', 'Unknown'),
            'garage_width': data.get('garage_width_feet', 0),
            'garage_depth': data.get('garage_depth_feet', 0)
        })
    
    return render_template('index.html', 
                         total_entries=total_entries,
                         recent_entries=recent_entries)

@app.route('/entry')
def entry_form():
    """Data entry form page."""
    return render_template('entry.html')

@app.route('/save_measurement', methods=['POST'])
def save_measurement():
    """Save a new measurement entry."""
    try:
        data = request.get_json() if request.is_json else request.form.to_dict()
        
        # Validate required fields
        address = data.get('address', '').strip()
        if not address:
            return jsonify({'status': 'error', 'message': 'Address is required'}), 400
        
        # Generate property ID
        property_id = generate_property_id(address)
        
        # Prepare measurement data
        measurement_data = {
            'address': address,
            'garage_width_feet': float(data.get('garage_width_feet', 0) or 0),
            'garage_depth_feet': float(data.get('garage_depth_feet', 0) or 0),
            'garage_height_feet': float(data.get('garage_height_feet', 0) or 0),
            'door_count': int(data.get('door_count', 1) or 1),
            'door_width_feet': float(data.get('door_width_feet', 0) or 0),
            'door_height_feet': float(data.get('door_height_feet', 0) or 0),
            'has_garage': data.get('has_garage', 'true').lower() == 'true',
            'garage_type': data.get('garage_type', 'attached'),
            'notes': data.get('notes', '').strip(),
            'confidence': data.get('confidence', 'medium'),
            'measured_date': datetime.now().isoformat(),
            'property_id': property_id
        }
        
        # Load existing measurements
        measurements = load_measurements()
        
        # Save measurement
        measurements[property_id] = measurement_data
        
        if save_measurements(measurements):
            return jsonify({
                'status': 'success', 
                'message': 'Measurement saved successfully',
                'property_id': property_id
            })
        else:
            return jsonify({'status': 'error', 'message': 'Failed to save measurement'}), 500
            
    except ValueError as e:
        return jsonify({'status': 'error', 'message': f'Invalid data: {e}'}), 400
    except Exception as e:
        return jsonify({'status': 'error', 'message': f'Server error: {e}'}), 500

@app.route('/measurements')
def view_measurements():
    """View all measurements."""
    measurements = load_measurements()
    
    # Convert to list and sort by date
    measurement_list = []
    for prop_id, data in measurements.items():
        measurement_list.append({
            'property_id': prop_id,
            **data
        })
    
    # Sort by date (newest first)
    measurement_list.sort(key=lambda x: x.get('measured_date', ''), reverse=True)
    
    return render_template('measurements.html', measurements=measurement_list)

@app.route('/edit/<property_id>')
def edit_measurement(property_id):
    """Edit an existing measurement."""
    measurements = load_measurements()
    
    if property_id not in measurements:
        return redirect(url_for('index'))
    
    measurement = measurements[property_id]
    return render_template('entry.html', measurement=measurement, property_id=property_id)

@app.route('/update_measurement/<property_id>', methods=['POST'])
def update_measurement(property_id):
    """Update an existing measurement."""
    try:
        measurements = load_measurements()
        
        if property_id not in measurements:
            return jsonify({'status': 'error', 'message': 'Measurement not found'}), 404
        
        data = request.get_json() if request.is_json else request.form.to_dict()
        
        # Update measurement data
        existing_data = measurements[property_id]
        existing_data.update({
            'address': data.get('address', existing_data.get('address', '')).strip(),
            'garage_width_feet': float(data.get('garage_width_feet', 0) or 0),
            'garage_depth_feet': float(data.get('garage_depth_feet', 0) or 0),
            'garage_height_feet': float(data.get('garage_height_feet', 0) or 0),
            'door_count': int(data.get('door_count', 1) or 1),
            'door_width_feet': float(data.get('door_width_feet', 0) or 0),
            'door_height_feet': float(data.get('door_height_feet', 0) or 0),
            'has_garage': data.get('has_garage', 'true').lower() == 'true',
            'garage_type': data.get('garage_type', 'attached'),
            'notes': data.get('notes', '').strip(),
            'confidence': data.get('confidence', 'medium'),
            'last_updated': datetime.now().isoformat()
        })
        
        if save_measurements(measurements):
            return jsonify({
                'status': 'success', 
                'message': 'Measurement updated successfully'
            })
        else:
            return jsonify({'status': 'error', 'message': 'Failed to update measurement'}), 500
            
    except Exception as e:
        return jsonify({'status': 'error', 'message': f'Server error: {e}'}), 500

@app.route('/delete/<property_id>', methods=['POST'])
def delete_measurement(property_id):
    """Delete a measurement."""
    try:
        measurements = load_measurements()
        
        if property_id in measurements:
            del measurements[property_id]
            
            if save_measurements(measurements):
                return jsonify({'status': 'success', 'message': 'Measurement deleted'})
            else:
                return jsonify({'status': 'error', 'message': 'Failed to delete measurement'}), 500
        else:
            return jsonify({'status': 'error', 'message': 'Measurement not found'}), 404
            
    except Exception as e:
        return jsonify({'status': 'error', 'message': f'Server error: {e}'}), 500

@app.route('/export')
def export_data():
    """Export all measurements as JSON."""
    measurements = load_measurements()
    return jsonify(measurements)

@app.route('/stats')
def stats():
    """Get statistics about the data."""
    measurements = load_measurements()
    
    if not measurements:
        return jsonify({
            'total_properties': 0,
            'with_garage': 0,
            'without_garage': 0,
            'average_width': 0,
            'average_depth': 0
        })
    
    # Calculate statistics
    total_properties = len(measurements)
    with_garage = sum(1 for m in measurements.values() if m.get('has_garage', True))
    without_garage = total_properties - with_garage
    
    # Calculate averages for properties with garages
    garage_measurements = [m for m in measurements.values() if m.get('has_garage', True)]
    
    if garage_measurements:
        avg_width = sum(m.get('garage_width_feet', 0) for m in garage_measurements) / len(garage_measurements)
        avg_depth = sum(m.get('garage_depth_feet', 0) for m in garage_measurements) / len(garage_measurements)
    else:
        avg_width = avg_depth = 0
    
    return jsonify({
        'total_properties': total_properties,
        'with_garage': with_garage,
        'without_garage': without_garage,
        'average_width': round(avg_width, 1),
        'average_depth': round(avg_depth, 1),
        'garage_percentage': round((with_garage / total_properties * 100) if total_properties > 0 else 0, 1)
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

    print(f"🏠 It's Garages - Data Entry Interface")
    print(f"   Starting server at http://{host}:{port}")
    print(f"   Data file: {DATA_FILE}")
    print(f"   Debug mode: {debug}")
    print(f"   Environment: {'Production' if not debug else 'Development'}")

    app.run(host=host, port=port, debug=debug)
