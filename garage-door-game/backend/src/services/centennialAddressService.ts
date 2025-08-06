import { db } from '../config/database';
import { GoogleApiService } from './googleApiService';
import { isHouse } from './overpassFilter';

/**
 * Optimized Address Pool for ML-Ready Game Performance
 * Eliminates expensive ORDER BY RANDOM() queries
 */
interface AddressPool {
  residential: number[];
  all: number[];
  lastRefresh: number;
}

// In-memory address pool cache (refreshed every 5 minutes)
let addressPool: AddressPool = {
  residential: [],
  all: [],
  lastRefresh: 0
};

const POOL_REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes

export interface CentennialAddress {
  id: number;
  name: string;
  description: string;
  address: string;
  latitude: number;
  longitude: number;
  has_garage_door: boolean;
  garage_door_count?: number;
  garage_door_width?: number;
  garage_door_height?: number;
  image_url?: string;
  street_view_url?: string;
  is_processed: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Refresh the address pool cache for optimized random selection
 */
const refreshAddressPool = async (): Promise<void> => {
  return new Promise((resolve, reject) => {
    // Get all residential address IDs using optimized index
    const residentialQuery = `
      SELECT id FROM centennial_addresses
      WHERE is_residential = 1
        AND (garage_not_visible IS NULL OR garage_not_visible = 0)
        AND address IS NOT NULL
        AND address != ''
      ORDER BY id
    `;

    db.all(residentialQuery, [], (err, residentialRows: any[]) => {
      if (err) {
        reject(err);
        return;
      }

      // Get all valid address IDs as fallback
      const allQuery = `
        SELECT id FROM centennial_addresses
        WHERE address IS NOT NULL
          AND address != ''
          AND (garage_not_visible IS NULL OR garage_not_visible = 0)
        ORDER BY id
      `;

      db.all(allQuery, [], (allErr, allRows: any[]) => {
        if (allErr) {
          reject(allErr);
          return;
        }

        addressPool = {
          residential: residentialRows.map(row => row.id),
          all: allRows.map(row => row.id),
          lastRefresh: Date.now()
        };

        console.log(`[PERF] Address pool refreshed: ${addressPool.residential.length} residential, ${addressPool.all.length} total`);
        resolve();
      });
    });
  });
};

/**
 * Get a random Centennial address using optimized pool selection
 * Performance: O(1) instead of O(n log n)
 */
export const getRandomCentennialAddress = async (): Promise<CentennialAddress | null> => {
  // Refresh pool if needed
  if (Date.now() - addressPool.lastRefresh > POOL_REFRESH_INTERVAL || addressPool.residential.length === 0) {
    try {
      await refreshAddressPool();
    } catch (error) {
      console.error('Error refreshing address pool:', error);
      // Fall back to old method if pool refresh fails
      return getRandomCentennialAddressLegacy();
    }
  }

  // Select random ID from pool
  const pool = addressPool.residential.length > 0 ? addressPool.residential : addressPool.all;
  if (pool.length === 0) {
    return null;
  }

  const randomIndex = Math.floor(Math.random() * pool.length);
  const selectedId = pool[randomIndex];

  // Fetch the address by ID (very fast with primary key)
  return new Promise((resolve, reject) => {
    const stmt = db.prepare(`SELECT * FROM centennial_addresses WHERE id = ?`);
    stmt.get([selectedId], (err, row) => {
      if (err) {
        reject(err);
      } else {
        resolve(row as CentennialAddress || null);
      }
    });
  });
};

/**
 * Legacy method as fallback (kept for reliability)
 */
const getRandomCentennialAddressLegacy = (): Promise<CentennialAddress | null> => {
  return new Promise((resolve, reject) => {
    const residentialStmt = db.prepare(`
      SELECT * FROM centennial_addresses
      WHERE address IS NOT NULL
        AND address != ''
        AND (garage_not_visible IS NULL OR garage_not_visible = 0)
        AND is_residential = 1
      ORDER BY RANDOM()
      LIMIT 1
    `);

    residentialStmt.get([], (err, row) => {
      if (err) {
        console.error('Error getting random residential Centennial address:', err);
        reject(err);
      } else if (row) {
        resolve(row as CentennialAddress);
      } else {
        const fallbackStmt = db.prepare(`
          SELECT * FROM centennial_addresses
          WHERE address IS NOT NULL
            AND address != ''
            AND (garage_not_visible IS NULL OR garage_not_visible = 0)
          ORDER BY RANDOM()
          LIMIT 1
        `);

        fallbackStmt.get([], (fallbackErr, fallbackRow) => {
          if (fallbackErr) {
            reject(fallbackErr);
          } else {
            resolve(fallbackRow as CentennialAddress || null);
          }
        });
      }
    });
  });
};

/**
 * Get a random Centennial address excluding a specific ID
 */
export const getRandomCentennialAddressExcluding = (excludeId: number): Promise<CentennialAddress | null> => {
  return new Promise((resolve, reject) => {
    // First try to get a residential address
    const residentialStmt = db.prepare(`
      SELECT * FROM centennial_addresses
      WHERE address IS NOT NULL
        AND address != ''
        AND id != ?
        AND (garage_not_visible IS NULL OR garage_not_visible = 0)
        AND is_residential = 1
      ORDER BY RANDOM()
      LIMIT 1
    `);

    residentialStmt.get([excludeId], (err, row) => {
      if (err) {
        console.error('Error getting random residential Centennial address:', err);
        reject(err);
      } else if (row) {
        resolve(row as CentennialAddress);
      } else {
        // Fallback to any address if no residential ones are available
        console.log('No residential addresses found, falling back to any address');
        const fallbackStmt = db.prepare(`
          SELECT * FROM centennial_addresses
          WHERE address IS NOT NULL
            AND address != ''
            AND id != ?
            AND (garage_not_visible IS NULL OR garage_not_visible = 0)
          ORDER BY RANDOM()
          LIMIT 1
        `);

        fallbackStmt.get([excludeId], (fallbackErr, fallbackRow) => {
          if (fallbackErr) {
            console.error('Error getting fallback Centennial address:', fallbackErr);
            reject(fallbackErr);
          } else {
            resolve(fallbackRow as CentennialAddress || null);
          }
        });
      }
    });
  });
};

/**
 * Mark a Centennial address as having garage not visible
 */
export const markAddressAsNotVisible = (addressId: number): Promise<void> => {
  return new Promise((resolve, reject) => {
    const stmt = db.prepare(`
      UPDATE centennial_addresses
      SET garage_not_visible = 1, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);

    stmt.run([addressId], function(err) {
      if (err) {
        console.error('Error marking address as not visible:', err);
        reject(err);
      } else {
        console.log(`✅ Marked address ${addressId} as garage not visible`);
        resolve();
      }
    });
  });
};

/**
 * Search Centennial addresses by text
 */
export const searchCentennialAddresses = (searchTerm: string, limit: number = 10): Promise<CentennialAddress[]> => {
  return new Promise((resolve, reject) => {
    const stmt = db.prepare(`
      SELECT * FROM centennial_addresses 
      WHERE address IS NOT NULL 
        AND address != ''
        AND (address LIKE ? OR name LIKE ?)
      ORDER BY address
      LIMIT ?
    `);

    const searchPattern = `%${searchTerm}%`;
    stmt.all([searchPattern, searchPattern, limit], (err, rows) => {
      if (err) {
        console.error('Error searching Centennial addresses:', err);
        reject(err);
      } else {
        resolve(rows as CentennialAddress[]);
      }
    });
  });
};

/**
 * Get Centennial address by ID
 */
export const getCentennialAddressById = (id: number): Promise<CentennialAddress | null> => {
  return new Promise((resolve, reject) => {
    const stmt = db.prepare(`
      SELECT * FROM centennial_addresses 
      WHERE id = ?
    `);

    stmt.get([id], (err, row) => {
      if (err) {
        console.error('Error getting Centennial address by ID:', err);
        reject(err);
      } else {
        resolve(row as CentennialAddress || null);
      }
    });
  });
};

/**
 * Update Centennial address with Street View URL
 */
export const updateCentennialAddressStreetView = (id: number, streetViewUrl: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    const stmt = db.prepare(`
      UPDATE centennial_addresses 
      SET street_view_url = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);

    stmt.run([streetViewUrl, id], (err) => {
      if (err) {
        console.error('Error updating Centennial address Street View URL:', err);
        reject(err);
      } else {
        resolve();
      }
    });
  });
};

/**
 * Get Centennial addresses with garage doors
 */
export const getCentennialAddressesWithGarageDoors = (limit: number = 50): Promise<CentennialAddress[]> => {
  return new Promise((resolve, reject) => {
    const stmt = db.prepare(`
      SELECT * FROM centennial_addresses 
      WHERE has_garage_door = 1
        AND address IS NOT NULL 
        AND address != ''
      ORDER BY RANDOM()
      LIMIT ?
    `);

    stmt.all([limit], (err, rows) => {
      if (err) {
        console.error('Error getting Centennial addresses with garage doors:', err);
        reject(err);
      } else {
        resolve(rows as CentennialAddress[]);
      }
    });
  });
};

/**
 * Get Centennial address with Street View URL generated
 */
export const getCentennialAddressWithStreetView = async (addressId?: number): Promise<{
  address: CentennialAddress;
  streetViewUrl: string;
} | null> => {
  try {
    let address: CentennialAddress | null;
    let attempts = 0;
    const maxAttempts = 5; // Try up to 5 addresses to find a residential one

    do {
      if (addressId) {
        address = await getCentennialAddressById(addressId);
      } else {
        address = await getRandomCentennialAddress();
      }

      if (!address) {
        return null;
      }

      // Check if this location is residential using Overpass API
      console.log(`Checking if address is residential: ${address.address} (${address.latitude}, ${address.longitude})`);
      const residential = await isHouse(address.latitude, address.longitude);

      if (residential) {
        console.log(`✅ Address confirmed as residential: ${address.address}`);
        break; // Found a residential address
      } else {
        console.log(`❌ Address not residential, trying another: ${address.address}`);
        address = null; // Reset to try another address
        attempts++;

        // If we have a specific addressId, don't retry
        if (addressId) {
          console.log(`Specific address ${addressId} is not residential, returning null`);
          return null;
        }
      }
    } while (!address && attempts < maxAttempts);

    if (!address) {
      console.log(`Could not find residential address after ${maxAttempts} attempts`);
      return null;
    }

    // Generate Street View URL only for residential addresses - optimized size for performance
    const googleService = new GoogleApiService();
    const streetViewUrl = googleService.buildStreetViewUrl({
      lat: address.latitude,
      lng: address.longitude,
      size: '480x480', // Optimized size: 44% smaller than 640x640
      heading: Math.floor(Math.random() * 360), // Random heading
      pitch: -10,
      fov: 90
    });

    // Update the address with the Street View URL if not already set
    if (!address.street_view_url) {
      await updateCentennialAddressStreetView(address.id, streetViewUrl);
      address.street_view_url = streetViewUrl;
    }

    return {
      address,
      streetViewUrl: address.street_view_url || streetViewUrl
    };

  } catch (error) {
    console.error('Error getting Centennial address with Street View:', error);
    return null;
  }
};

/**
 * Get statistics about Centennial addresses
 */
export const getCentennialAddressStats = (): Promise<{
  total: number;
  withGarageDoors: number;
  withStreetView: number;
  processed: number;
}> => {
  return new Promise((resolve, reject) => {
    const queries = [
      'SELECT COUNT(*) as count FROM centennial_addresses',
      'SELECT COUNT(*) as count FROM centennial_addresses WHERE has_garage_door = 1',
      'SELECT COUNT(*) as count FROM centennial_addresses WHERE street_view_url IS NOT NULL',
      'SELECT COUNT(*) as count FROM centennial_addresses WHERE is_processed = 1'
    ];

    let completed = 0;
    const results: number[] = [];

    queries.forEach((query, index) => {
      db.get(query, [], (err, row: any) => {
        if (err) {
          reject(err);
          return;
        }
        
        results[index] = row.count;
        completed++;

        if (completed === queries.length) {
          resolve({
            total: results[0] || 0,
            withGarageDoors: results[1] || 0,
            withStreetView: results[2] || 0,
            processed: results[3] || 0
          });
        }
      });
    });
  });
};
