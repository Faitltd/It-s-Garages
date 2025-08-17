import { getDb } from '../config/dbAccessor';
import { GoogleApiService } from './googleApiService';

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
 * Get a random Centennial address
 */
export const getRandomCentennialAddress = (): Promise<CentennialAddress | null> => {
  return new Promise((resolve, reject) => {
    const db = getDb();
    if (!db) return reject(new Error('Database not ready'));
    const stmt = db.prepare(`
      SELECT * FROM centennial_addresses
      WHERE address IS NOT NULL
        AND address != ''
        AND (garage_not_visible IS NULL OR garage_not_visible = 0)
      ORDER BY RANDOM()
      LIMIT 1
    `);

    stmt.get([], (err, row) => {
      if (err) {
        console.error('Error getting random Centennial address:', err);
        reject(err);
      } else {
        resolve(row as CentennialAddress || null);
      }
    });
  });
};

/**
 * Get a random Centennial address excluding a specific ID
 */
export const getRandomCentennialAddressExcluding = (excludeId: number): Promise<CentennialAddress | null> => {
  return new Promise((resolve, reject) => {
    const db = getDb();
    if (!db) return reject(new Error('Database not ready'));
    const stmt = db.prepare(`
      SELECT * FROM centennial_addresses
      WHERE address IS NOT NULL
        AND address != ''
        AND id != ?
        AND (garage_not_visible IS NULL OR garage_not_visible = 0)
      ORDER BY RANDOM()
      LIMIT 1
    `);

    stmt.get([excludeId], (err, row) => {
      if (err) {
        console.error('Error getting random Centennial address:', err);
        reject(err);
      } else {
        resolve(row as CentennialAddress || null);
      }
    });
  });
};

/**
 * Mark a Centennial address as having garage not visible
 */
export const markAddressAsNotVisible = (addressId: number): Promise<void> => {
  return new Promise((resolve, reject) => {
    const db = getDb();
    if (!db) return reject(new Error('Database not ready'));
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
    const db = getDb();
    if (!db) return reject(new Error('Database not ready'));
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
    const db = getDb();
    if (!db) return reject(new Error('Database not ready'));
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
    const db = getDb();
    if (!db) return reject(new Error('Database not ready'));
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
    const db = getDb();
    if (!db) return reject(new Error('Database not ready'));
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
    
    if (addressId) {
      address = await getCentennialAddressById(addressId);
    } else {
      address = await getRandomCentennialAddress();
    }

    if (!address) {
      return null;
    }

    // Generate Street View URL with optimal heading for garage door viewing
    const googleService = new GoogleApiService();
    const streetViewUrl = await googleService.buildOptimalStreetViewUrl({
      lat: address.latitude,
      lng: address.longitude,
      size: '640x640',
      pitch: 10, // Slightly upward to capture house fronts and garage doors
      fov: 90,
      preferredSide: 'right' // Try right side of street first
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
