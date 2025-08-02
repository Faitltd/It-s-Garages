#!/usr/bin/env python3
"""
Street View Scraper for It's Garages

Scrapes Google Street View images for property addresses with rate limiting,
error handling, and resume capability.
"""

import os
import json
import time
import csv
import requests
import re
from urllib.parse import quote
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Optional
from tqdm import tqdm
from dotenv import load_dotenv

# Load environment variables
load_dotenv()


class StreetViewScraper:
    """Google Street View image scraper with rate limiting and error handling."""
    
    def __init__(self, api_key: str, output_dir: str = 'data/scraped_images'):
        self.api_key = api_key
        self.output_dir = Path(output_dir)
        self.base_url = 'https://maps.googleapis.com/maps/api/streetview'
        self.rate_limit_delay = float(os.getenv('RATE_LIMIT_DELAY', '0.1'))
        self.max_retries = int(os.getenv('MAX_RETRIES', '3'))
        self.image_size = os.getenv('IMAGE_SIZE', '640x640')
        self.headings = [int(h) for h in os.getenv('HEADINGS', '0,90,180,270').split(',')]
        
        # Create output directory
        self.output_dir.mkdir(parents=True, exist_ok=True)
        
        # Progress tracking
        self.progress_file = self.output_dir / 'scraping_progress.json'
        self.progress_data = self._load_progress()
        
        print(f"✅ Street View Scraper initialized")
        print(f"   Output directory: {self.output_dir}")
        print(f"   Rate limit delay: {self.rate_limit_delay}s")
        print(f"   Image size: {self.image_size}")
        print(f"   Headings: {self.headings}")
    
    def _load_progress(self) -> Dict:
        """Load scraping progress from file."""
        if self.progress_file.exists():
            try:
                with open(self.progress_file, 'r') as f:
                    return json.load(f)
            except (json.JSONDecodeError, IOError):
                pass
        
        return {
            'completed': [],
            'failed': [],
            'last_updated': None,
            'total_requests': 0,
            'successful_requests': 0
        }
    
    def _save_progress(self):
        """Save scraping progress to file."""
        self.progress_data['last_updated'] = datetime.now().isoformat()
        try:
            with open(self.progress_file, 'w') as f:
                json.dump(self.progress_data, f, indent=2)
        except IOError as e:
            print(f"⚠️  Warning: Could not save progress: {e}")
    
    def _sanitize_filename(self, address: str) -> str:
        """Convert address to safe filename."""
        # Remove special characters and normalize
        filename = re.sub(r'[<>:"/\\|?*]', '', address)
        filename = re.sub(r'[,\.]', '', filename)
        filename = re.sub(r'\s+', '_', filename.strip())
        filename = filename.lower()
        
        # Limit length
        if len(filename) > 100:
            filename = filename[:100]
        
        return filename
    
    def _make_request(self, address: str, heading: int, retry_count: int = 0) -> Optional[bytes]:
        """Make a single Street View API request with retry logic."""
        params = {
            'size': self.image_size,
            'location': address,
            'heading': heading,
            'pitch': 0,
            'fov': 90,
            'key': self.api_key
        }
        
        try:
            response = requests.get(self.base_url, params=params, timeout=30)
            self.progress_data['total_requests'] += 1
            
            if response.status_code == 200:
                # Check if we got an actual image (not an error image)
                content_type = response.headers.get('content-type', '')
                if 'image' in content_type and len(response.content) > 1000:
                    self.progress_data['successful_requests'] += 1
                    return response.content
                else:
                    print(f"   ⚠️  No image available for heading {heading}°")
                    return None
            else:
                print(f"   ❌ API error {response.status_code} for heading {heading}°")
                
        except requests.RequestException as e:
            print(f"   ❌ Network error for heading {heading}°: {e}")
        
        # Retry logic
        if retry_count < self.max_retries:
            print(f"   🔄 Retrying heading {heading}° (attempt {retry_count + 1}/{self.max_retries})")
            time.sleep(self.rate_limit_delay * (retry_count + 1))  # Exponential backoff
            return self._make_request(address, heading, retry_count + 1)
        
        return None
    
    def scrape_property(self, address: str, city: str = "", state: str = "", zip_code: str = "") -> bool:
        """
        Scrape Street View images for a single property.
        
        Args:
            address: Street address
            city: City name
            state: State abbreviation
            zip_code: ZIP code
            
        Returns:
            True if successful, False otherwise
        """
        # Construct full address
        full_address = address
        if city:
            full_address += f", {city}"
        if state:
            full_address += f", {state}"
        if zip_code:
            full_address += f" {zip_code}"
        
        # Create folder name
        folder_name = self._sanitize_filename(full_address)
        
        # Check if already completed
        if folder_name in self.progress_data['completed']:
            print(f"⏭️  Skipping {full_address} (already completed)")
            return True
        
        print(f"📸 Scraping: {full_address}")
        
        # Create property folder
        folder_path = self.output_dir / folder_name
        folder_path.mkdir(exist_ok=True)
        
        # Track successful images
        successful_images = []
        metadata = {
            'address': full_address,
            'folder_name': folder_name,
            'scraped_date': datetime.now().isoformat(),
            'images': [],
            'headings_attempted': self.headings,
            'headings_successful': []
        }
        
        # Scrape images for each heading
        for heading in self.headings:
            print(f"   📷 Heading {heading}°...")
            
            image_data = self._make_request(full_address, heading)
            
            if image_data:
                filename = f'streetview_{heading}deg.jpg'
                filepath = folder_path / filename
                
                try:
                    with open(filepath, 'wb') as f:
                        f.write(image_data)
                    
                    successful_images.append(filename)
                    metadata['images'].append(filename)
                    metadata['headings_successful'].append(heading)
                    print(f"   ✅ Saved {filename}")
                    
                except IOError as e:
                    print(f"   ❌ Failed to save {filename}: {e}")
            
            # Rate limiting
            time.sleep(self.rate_limit_delay)
        
        # Save metadata
        try:
            with open(folder_path / 'metadata.json', 'w') as f:
                json.dump(metadata, f, indent=2)
        except IOError as e:
            print(f"   ⚠️  Warning: Could not save metadata: {e}")
        
        # Update progress
        if successful_images:
            self.progress_data['completed'].append(folder_name)
            print(f"   ✅ Completed: {len(successful_images)}/{len(self.headings)} images")
            success = True
        else:
            self.progress_data['failed'].append(folder_name)
            print(f"   ❌ Failed: No images retrieved")
            success = False
        
        self._save_progress()
        return success
    
    def scrape_from_csv(self, csv_file: str) -> Dict:
        """
        Scrape properties from a CSV file.
        
        CSV format: address,city,state,zip
        
        Args:
            csv_file: Path to CSV file
            
        Returns:
            Dictionary with scraping results
        """
        csv_path = Path(csv_file)
        if not csv_path.exists():
            raise FileNotFoundError(f"CSV file not found: {csv_file}")
        
        print(f"📋 Loading addresses from: {csv_file}")
        
        # Read CSV file
        addresses = []
        try:
            with open(csv_path, 'r', newline='', encoding='utf-8') as f:
                reader = csv.DictReader(f)
                for row in reader:
                    addresses.append({
                        'address': row.get('address', '').strip(),
                        'city': row.get('city', '').strip(),
                        'state': row.get('state', '').strip(),
                        'zip': row.get('zip', '').strip()
                    })
        except Exception as e:
            raise ValueError(f"Error reading CSV file: {e}")
        
        if not addresses:
            raise ValueError("No addresses found in CSV file")
        
        print(f"📍 Found {len(addresses)} addresses")
        
        # Filter out already completed addresses
        remaining_addresses = []
        for addr_data in addresses:
            full_address = addr_data['address']
            if addr_data['city']:
                full_address += f", {addr_data['city']}"
            if addr_data['state']:
                full_address += f", {addr_data['state']}"
            if addr_data['zip']:
                full_address += f" {addr_data['zip']}"
            
            folder_name = self._sanitize_filename(full_address)
            if folder_name not in self.progress_data['completed']:
                remaining_addresses.append(addr_data)
        
        print(f"🔄 Remaining to scrape: {len(remaining_addresses)}")
        
        if not remaining_addresses:
            print("✅ All addresses already completed!")
            return self._get_summary()
        
        # Scrape with progress bar
        successful = 0
        failed = 0
        
        with tqdm(remaining_addresses, desc="Scraping properties") as pbar:
            for addr_data in pbar:
                pbar.set_description(f"Scraping: {addr_data['address'][:30]}...")
                
                success = self.scrape_property(
                    addr_data['address'],
                    addr_data['city'],
                    addr_data['state'],
                    addr_data['zip']
                )
                
                if success:
                    successful += 1
                else:
                    failed += 1
                
                pbar.set_postfix({
                    'Success': successful,
                    'Failed': failed,
                    'Rate': f"{successful/(successful+failed)*100:.1f}%" if (successful+failed) > 0 else "0%"
                })
        
        return self._get_summary()
    
    def _get_summary(self) -> Dict:
        """Get scraping summary statistics."""
        return {
            'total_completed': len(self.progress_data['completed']),
            'total_failed': len(self.progress_data['failed']),
            'total_requests': self.progress_data['total_requests'],
            'successful_requests': self.progress_data['successful_requests'],
            'success_rate': (
                self.progress_data['successful_requests'] / self.progress_data['total_requests'] * 100
                if self.progress_data['total_requests'] > 0 else 0
            ),
            'last_updated': self.progress_data['last_updated']
        }
    
    def get_progress(self) -> Dict:
        """Get current scraping progress."""
        return self._get_summary()


def main():
    """Main function for command-line usage."""
    import argparse
    
    parser = argparse.ArgumentParser(description='Street View Scraper for It\'s Garages')
    parser.add_argument('csv_file', help='CSV file with addresses (address,city,state,zip)')
    parser.add_argument('--api-key', help='Google API key (or set GOOGLE_API_KEY env var)')
    parser.add_argument('--output-dir', default='data/scraped_images', help='Output directory')
    
    args = parser.parse_args()
    
    # Get API key
    api_key = args.api_key or os.getenv('GOOGLE_API_KEY')
    if not api_key:
        print("❌ Error: Google API key required")
        print("   Set GOOGLE_API_KEY environment variable or use --api-key")
        return 1
    
    try:
        # Initialize scraper
        scraper = StreetViewScraper(api_key, args.output_dir)
        
        # Start scraping
        print(f"\n🚀 Starting scraping process...")
        results = scraper.scrape_from_csv(args.csv_file)
        
        # Print summary
        print(f"\n📊 Scraping Summary:")
        print(f"   ✅ Completed: {results['total_completed']}")
        print(f"   ❌ Failed: {results['total_failed']}")
        print(f"   📡 Total API requests: {results['total_requests']}")
        print(f"   📈 Success rate: {results['success_rate']:.1f}%")
        
        return 0
        
    except Exception as e:
        print(f"❌ Error: {e}")
        return 1


if __name__ == '__main__':
    exit(main())
