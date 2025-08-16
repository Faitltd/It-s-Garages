#!/usr/bin/env python3
"""
Garage Door Game - Python Flask Application
A simple, reliable web app for analyzing garage doors in Street View images
"""

import os
import sqlite3
import hashlib
import secrets
import random
import math
from datetime import datetime, timedelta
from functools import wraps
import json
import io
import zipfile
import csv

import requests
from flask import Flask, render_template, request, jsonify, session, redirect, url_for, flash, send_file
from werkzeug.security import generate_password_hash, check_password_hash

# Initialize Flask app
app = Flask(__name__)
app.secret_key = os.environ.get('SECRET_KEY', secrets.token_hex(32))
# Session and cookie configuration for persistent, secure sessions
app.config.update(
    SESSION_COOKIE_SECURE=True,
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SAMESITE='Lax',
    PERMANENT_SESSION_LIFETIME=timedelta(days=7)
)

# Configuration
BASE_DATA_DIR = os.environ.get('DATA_DIR', '/tmp/garage_app')
IMAGES_DIR = os.path.join(BASE_DATA_DIR, 'images')
DATABASE = os.path.join(BASE_DATA_DIR, 'garage_door_game.db')
GOOGLE_MAPS_API_KEY = os.environ.get('GOOGLE_MAPS_API_KEY', 'AIzaSyAGHVpNfxdylz_gRfaLxbVOYvaBz3woTec')

# Game locations with known residential areas
GAME_LOCATIONS = [
    {"address": "1234 Middlefield Rd, Palo Alto, CA", "lat": 37.4419, "lng": -122.1430},
    {"address": "2345 Castro St, Mountain View, CA", "lat": 37.3861, "lng": -122.0839},
    {"address": "3456 Stevens Creek Blvd, Cupertino, CA", "lat": 37.3230, "lng": -122.0322},
    {"address": "4567 El Camino Real, Los Altos, CA", "lat": 37.3688, "lng": -122.1077},
    {"address": "5678 Homestead Rd, Sunnyvale, CA", "lat": 37.3688, "lng": -122.0363},
    {"address": "6789 Almaden Expy, San Jose, CA", "lat": 37.3382, "lng": -121.8863},
    {"address": "7890 Fremont Blvd, Fremont, CA", "lat": 37.5485, "lng": -121.9886},
    {"address": "8901 Woodside Rd, Redwood City, CA", "lat": 37.4852, "lng": -122.2364},
]

# Database functions
def ensure_dirs():
    os.makedirs(BASE_DATA_DIR, exist_ok=True)
    os.makedirs(IMAGES_DIR, exist_ok=True)


def get_db():
    """Get database connection"""
    ensure_dirs()
    db = sqlite3.connect(DATABASE)
    db.row_factory = sqlite3.Row
    return db

def init_db():
    """Initialize database with tables and ensure required columns exist"""
    ensure_dirs()

    with get_db() as db:
        db.executescript('''
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                email TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                total_points INTEGER DEFAULT 0,
                games_played INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS game_sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                location_data TEXT NOT NULL,
                street_view_url TEXT NOT NULL,
                image_path TEXT,
                difficulty TEXT NOT NULL,
                time_limit INTEGER NOT NULL,
                started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                completed_at TIMESTAMP NULL,
                score INTEGER DEFAULT 0,
                FOREIGN KEY (user_id) REFERENCES users (id)
            );

            CREATE TABLE IF NOT EXISTS game_guesses (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id INTEGER NOT NULL,
                garage_count INTEGER NOT NULL,
                door_sizes TEXT,
                confidence INTEGER NOT NULL,
                skipped BOOLEAN DEFAULT 0,
                not_visible BOOLEAN DEFAULT 0,
                submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (session_id) REFERENCES game_sessions (id)
            );
        ''')
        # Ensure new columns exist for migrations
        def ensure_column(table, column, col_def):
            cols = db.execute(f"PRAGMA table_info({table})").fetchall()
            col_names = {c[1] for c in cols}
            if column not in col_names:
                db.execute(f"ALTER TABLE {table} ADD COLUMN {column} {col_def}")
        try:
            ensure_column('game_sessions', 'image_path', 'TEXT')
            ensure_column('game_guesses', 'door_sizes', 'TEXT')
        except Exception as e:
            # If ALTER fails (older SQLite or column already exists), ignore
            print(f"Migration note: {e}")
        db.commit()
        print("✅ Database tables created/migrated successfully")

def calculate_street_view_heading(lat, lng):
    """Calculate optimal heading for residential viewing"""
    # Use coordinate-based heuristics for residential viewing angles
    lat_variation = (lat * 100) % 360
    lng_variation = (lng * 100) % 360

    # Residential-friendly headings (NE, SE, SW, NW)
    residential_angles = [45, 135, 225, 315]

    # Select angle based on coordinates for consistency
    angle_index = int((abs(lat_variation + lng_variation)) % 4)
    base_heading = residential_angles[angle_index]

    # Add small variation for natural viewing
    variation = ((lat + lng) * 50) % 30 - 15  # ±15° variation
    final_heading = (base_heading + variation) % 360

    return final_heading

def build_street_view_url(lat, lng, size="640x640"):
    """Build Google Street View URL"""
    heading = calculate_street_view_heading(lat, lng)

    params = {
        'location': f"{lat},{lng}",
        'size': size,
        'key': GOOGLE_MAPS_API_KEY,
        'heading': int(heading),
        'pitch': 5,  # Slightly upward for house viewing
        'fov': 80,   # Narrower field of view
        'source': 'outdoor'
    }

    url = "https://maps.googleapis.com/maps/api/streetview?" + "&".join([f"{k}={v}" for k, v in params.items()])
    return url

@app.route('/export')
@login_required
def export_page():
    return render_template('export.html')



def download_street_view_image(url: str, session_id: int) -> str:
    """Download Street View image to writable images dir and return file path"""
    try:
        ensure_dirs()
        resp = requests.get(url, timeout=15)
        resp.raise_for_status()
        filename = os.path.join(IMAGES_DIR, f"session_{session_id}.jpg")
        with open(filename, 'wb') as f:
            f.write(resp.content)
        return filename
    except Exception as e:
        print(f"Failed to download image for session {session_id}: {e}")
        return None

# Authentication decorator
def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            return redirect(url_for('login'))
        return f(*args, **kwargs)
    return decorated_function

# Routes
@app.route('/')
def index():
    """Home page"""
    return render_template('index.html')

@app.route('/register', methods=['GET', 'POST'])
def register():
    """User registration"""
    if request.method == 'POST':
        data = request.get_json() if request.is_json else request.form
        username = data.get('username', '').strip()
        email = data.get('email', '').strip()
        password = data.get('password', '')

        # Validation
        if not username or not email or not password:
            return jsonify({'success': False, 'error': 'All fields are required'}), 400

        if len(password) < 8:
            return jsonify({'success': False, 'error': 'Password must be at least 8 characters'}), 400

        try:
            with get_db() as db:
                # Check if user exists
                existing = db.execute('SELECT id FROM users WHERE username = ? OR email = ?',
                                    (username, email)).fetchone()
                if existing:
                    return jsonify({'success': False, 'error': 'Username or email already exists'}), 400

                # Create user
                password_hash = generate_password_hash(password)
                cursor = db.execute(
                    'INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)',
                    (username, email, password_hash)
                )
                user_id = cursor.lastrowid

                # Log in user
                session.permanent = True
                session['user_id'] = user_id
                session['username'] = username

                return jsonify({
                    'success': True,
                    'message': 'Registration successful',
                    'user': {'id': user_id, 'username': username, 'email': email}
                })

        except Exception as e:
            return jsonify({'success': False, 'error': str(e)}), 500

    return render_template('auth.html', mode='register')

@app.route('/login', methods=['GET', 'POST'])
def login():
    """User login"""
    if request.method == 'POST':
        data = request.get_json() if request.is_json else request.form
        email = data.get('email', '').strip()
        password = data.get('password', '')

        if not email or not password:
            return jsonify({'success': False, 'error': 'Email and password are required'}), 400

        try:
            with get_db() as db:
                user = db.execute(
                    'SELECT id, username, email, password_hash FROM users WHERE email = ?',
                    (email,)
                ).fetchone()

                if user and check_password_hash(user['password_hash'], password):
                    session.permanent = True
                    session['user_id'] = user['id']
                    session['username'] = user['username']

                    return jsonify({
                        'success': True,
                        'message': 'Login successful',
                        'user': {'id': user['id'], 'username': user['username'], 'email': user['email']}
                    })
                else:
                    return jsonify({'success': False, 'error': 'Invalid email or password'}), 401

        except Exception as e:
            return jsonify({'success': False, 'error': str(e)}), 500

    return render_template('auth.html', mode='login')

@app.route('/logout')
def logout():
    """User logout"""
    session.clear()
    return redirect(url_for('index'))

@app.route('/game')
@login_required
def game():
    """Game page"""
    return render_template('game.html', username=session.get('username'))

@app.route('/api/game/start', methods=['POST'])
@login_required
def start_game():
    """Start a new game session"""
    try:
        data = request.get_json() or {}
        difficulty = data.get('difficulty', 'medium')

        # Time limits by difficulty
        time_limits = {'easy': 60, 'medium': 45, 'hard': 30}
        time_limit = time_limits.get(difficulty, 45)

        # Select random location
        location = random.choice(GAME_LOCATIONS)
        street_view_url = build_street_view_url(location['lat'], location['lng'])

        # Create game session
        with get_db() as db:
            cursor = db.execute(
                'INSERT INTO game_sessions (user_id, location_data, street_view_url, difficulty, time_limit) VALUES (?, ?, ?, ?, ?)',
                (session['user_id'], str(location), street_view_url, difficulty, time_limit)
            )
            session_id = cursor.lastrowid
            # Try to download the image and store its path
            image_path = download_street_view_image(street_view_url, session_id)
            if image_path:
                db.execute('UPDATE game_sessions SET image_path = ? WHERE id = ?', (image_path, session_id))

        return jsonify({
            'success': True,
            'data': {
                'sessionId': session_id,
                'streetViewUrl': street_view_url,
                'location': location,
                'difficulty': difficulty,
                'timeLimit': time_limit
            }
        })

    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/game/submit', methods=['POST'])
@login_required
def submit_guess():
    """Submit a game guess"""
    try:
        data = request.get_json()
        session_id = data.get('sessionId')
        garage_count = int(data.get('garageCount', 0))
        door_sizes = data.get('doorSizes', [])  # list of strings
        confidence = int(data.get('confidence', 0))
        skipped = bool(data.get('skipped', False))
        not_visible = bool(data.get('notVisible', False))

        # Validate session belongs to user
        with get_db() as db:
            session_check = db.execute(
                'SELECT id FROM game_sessions WHERE id = ? AND user_id = ?',
                (session_id, session['user_id'])
            ).fetchone()

            if not session_check:
                return jsonify({'success': False, 'error': 'Invalid session'}), 400

            # Save guess (only door count and sizes matter)
            db.execute(
                'INSERT INTO game_guesses (session_id, garage_count, door_sizes, confidence, skipped, not_visible) VALUES (?, ?, ?, ?, ?, ?)',
                (session_id, garage_count, json.dumps(door_sizes), confidence, skipped, not_visible)
            )

            # Calculate basic score (this is simplified)
            score = 0 if skipped or not_visible else confidence

            # Update session
            db.execute(
                'UPDATE game_sessions SET completed_at = CURRENT_TIMESTAMP, score = ? WHERE id = ?',
                (score, session_id)
            )

            # Update user stats
            db.execute(
                'UPDATE users SET games_played = games_played + 1, total_points = total_points + ? WHERE id = ?',
                (score, session['user_id'])
            )

        return jsonify({
            'success': True,
            'data': {
                'score': score,
                'message': 'Guess submitted successfully'
            }
        })

@app.route('/api/export/roboflow', methods=['GET'])
@login_required
def export_roboflow():
    """Export collected samples as a Roboflow-ready ZIP for classification tasks.
    We will output images and a labels.csv with columns: filename,door_count,door_sizes (semicolon-separated)
    """
    try:
        with get_db() as db:
            rows = db.execute('''
                SELECT s.id as session_id, s.image_path, g.garage_count, g.door_sizes
                FROM game_sessions s
                JOIN game_guesses g ON g.session_id = s.id
                WHERE s.user_id = ? AND s.image_path IS NOT NULL AND g.skipped = 0 AND g.not_visible = 0
                ORDER BY s.id DESC
            ''', (session['user_id'],)).fetchall()

        if not rows:
            return jsonify({'success': False, 'error': 'No labeled samples to export yet'}), 400

        memfile = io.BytesIO()
        with zipfile.ZipFile(memfile, mode='w', compression=zipfile.ZIP_DEFLATED) as zf:
            # Prepare labels.csv
            labels_io = io.StringIO()
            writer = csv.writer(labels_io)
            writer.writerow(['filename', 'door_count', 'door_sizes'])

            for r in rows:
                img_path = r['image_path']
                if not img_path or not os.path.exists(img_path):
                    continue
                # Add image file to zip
                arcname = os.path.basename(img_path)
                zf.write(img_path, arcname)

                # Prepare labels row
                sizes = []
                try:
                    sizes = json.loads(r['door_sizes']) if r['door_sizes'] else []
                except Exception:
                    sizes = []
                writer.writerow([arcname, r['garage_count'], ';'.join(sizes)])

            # Add labels.csv
            zf.writestr('labels.csv', labels_io.getvalue())

        memfile.seek(0)
        return send_file(
            memfile,
            mimetype='application/zip',
            as_attachment=True,
            download_name=f'garage_doors_roboflow_export_{datetime.now().strftime("%Y%m%d_%H%M%S")}.zip'
        )
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/health')
def health():
    """Health check endpoint"""
    return jsonify({'status': 'healthy', 'timestamp': datetime.now().isoformat()})

@app.route('/init-db')
def init_db_route():
    """Manual database initialization endpoint"""
    try:
        init_db()
        return jsonify({'success': True, 'message': 'Database initialized successfully'})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

# Initialize database on startup
try:
    init_db()
except Exception as e:
    print(f"❌ Failed to initialize database on startup: {e}")

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 8080))
    app.run(host='0.0.0.0', port=port, debug=False)
