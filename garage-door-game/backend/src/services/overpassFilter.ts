import fetch, { RequestInit } from 'node-fetch';
import Bottleneck from 'bottleneck';
import { db } from '../config/database';

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';

// Rate limiter: ~3 requests per second to be respectful to Overpass API
const limiter = new Bottleneck({ 
  minTime: 300, // 300ms between requests
  maxConcurrent: 1 
});

interface OverpassElement {
  type: string;
  id: number;
  center?: {
    lat: number;
    lon: number;
  };
  tags?: {
    [key: string]: string;
  };
}

interface OverpassResponse {
  elements: OverpassElement[];
}

interface ResidentialCache {
  lat: number;
  lng: number;
  is_residential: boolean;
  checked_at: string;
}

/**
 * Build Overpass query to find residential buildings near coordinates
 */
function buildOverpassQuery(lat: number, lng: number): string {
  const delta = 0.0003; // ~30m search area
  const south = lat - delta;
  const west = lng - delta;
  const north = lat + delta;
  const east = lng + delta;

  return `
    [out:json][timeout:10];
    (
      way["building"="house"](${south},${west},${north},${east});
      way["building"="residential"](${south},${west},${north},${east});
      way["building"="detached"](${south},${west},${north},${east});
      way["building"="semidetached_house"](${south},${west},${north},${east});
      way["building"="terrace"](${south},${west},${north},${east});
      relation["building"="house"](${south},${west},${north},${east});
      relation["building"="residential"](${south},${west},${north},${east});
    );
    out center;
  `;
}

/**
 * Check cache for previous residential determination
 */
function getCachedResult(lat: number, lng: number): Promise<boolean | null> {
  return new Promise((resolve, reject) => {
    // Round coordinates to avoid cache misses from tiny differences
    const roundedLat = Math.round(lat * 10000) / 10000;
    const roundedLng = Math.round(lng * 10000) / 10000;
    
    const stmt = db.prepare(`
      SELECT is_residential FROM residential_cache 
      WHERE lat = ? AND lng = ? 
      AND datetime(checked_at) > datetime('now', '-7 days')
    `);

    stmt.get([roundedLat, roundedLng], (err, row: any) => {
      if (err) {
        console.error('Error checking residential cache:', err);
        reject(err);
      } else {
        resolve(row ? Boolean(row.is_residential) : null);
      }
    });
  });
}

/**
 * Cache residential determination result
 */
function cacheResult(lat: number, lng: number, isResidential: boolean): Promise<void> {
  return new Promise((resolve, reject) => {
    const roundedLat = Math.round(lat * 10000) / 10000;
    const roundedLng = Math.round(lng * 10000) / 10000;
    
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO residential_cache (lat, lng, is_residential, checked_at)
      VALUES (?, ?, ?, datetime('now'))
    `);

    stmt.run([roundedLat, roundedLng, isResidential ? 1 : 0], (err) => {
      if (err) {
        console.error('Error caching residential result:', err);
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

/**
 * Query Overpass API to determine if location is residential
 */
async function queryOverpass(lat: number, lng: number): Promise<boolean> {
  const query = buildOverpassQuery(lat, lng);
  
  try {
    const response = await fetch(OVERPASS_URL, {
      method: 'POST',
      body: `data=${encodeURIComponent(query)}`,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'GarageDoorGame/1.0 (https://itsgarages.itsfait.com)'
      }
    } as RequestInit);

    if (!response.ok) {
      throw new Error(`Overpass API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as OverpassResponse;
    const isResidential = data.elements && data.elements.length > 0;
    
    // Cache the result
    await cacheResult(lat, lng, isResidential);
    
    return isResidential;
  } catch (error) {
    console.error('Overpass query error:', error);
    // On error, assume it might be residential to avoid false negatives
    return true;
  }
}

/**
 * Check if coordinates represent a residential house
 * Uses cache first, then queries Overpass API if needed
 */
export async function isHouse(lat: number, lng: number): Promise<boolean> {
  try {
    // Check cache first
    const cached = await getCachedResult(lat, lng);
    if (cached !== null) {
      console.log(`Residential check (cached): ${lat}, ${lng} -> ${cached}`);
      return cached;
    }

    // Query Overpass API with rate limiting
    const result = await limiter.schedule(() => queryOverpass(lat, lng));
    console.log(`Residential check (API): ${lat}, ${lng} -> ${result}`);
    return result;
  } catch (error) {
    console.error('Error checking if location is house:', error);
    // On error, assume it might be residential to avoid false negatives
    return true;
  }
}

/**
 * Batch check multiple locations for residential status
 */
export async function batchCheckResidential(locations: Array<{lat: number, lng: number, id?: string}>): Promise<Array<{lat: number, lng: number, id?: string, isResidential: boolean}>> {
  const results = [];
  
  for (const location of locations) {
    const isResidential = await isHouse(location.lat, location.lng);
    results.push({
      ...location,
      isResidential
    });
  }
  
  return results;
}

/**
 * Initialize residential cache table
 */
export function initializeResidentialCache(): void {
  const stmt = db.prepare(`
    CREATE TABLE IF NOT EXISTS residential_cache (
      lat REAL NOT NULL,
      lng REAL NOT NULL,
      is_residential INTEGER NOT NULL,
      checked_at TEXT NOT NULL,
      PRIMARY KEY (lat, lng)
    )
  `);
  
  stmt.run((err) => {
    if (err) {
      console.error('Error creating residential cache table:', err);
    } else {
      console.log('Residential cache table initialized');
    }
  });
}
