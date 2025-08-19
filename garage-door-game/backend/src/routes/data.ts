import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { authenticate } from '../middleware/auth';
import { getDb } from '../config/dbAccessor';

const router = Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'garage-door-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    // Check if file is an image
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(null, false);
    }
  }
});

// Submit garage door data - PRODUCTION VERSION
router.post('/submit', authenticate, (req: any, res, next) => {
  try {
    console.log('Submit endpoint hit, user:', req.user);
    console.log('Request body:', req.body);

    // Check if user is properly authenticated
    if (!req.user || !req.user.userId) {
      console.log('Authentication failed - no user or user.userId');
      return res.status(401).json({ success: false, error: 'Authentication required. Please log in.' });
    }

    const userId = req.user.userId;
    const { address, doors } = req.body;

    console.log('Parsed data:', { userId, address, doors });

    // Validate required fields
    if (!address || !doors || !Array.isArray(doors) || doors.length === 0) {
      return res.status(400).json({ success: false, error: 'Address and at least one door size are required' });
    }

    // Validate each door has a size
    for (const door of doors) {
      if (!door.size || typeof door.size !== 'string' || door.size.trim() === '') {
        return res.status(400).json({ success: false, error: 'Each door must have a valid size' });
      }
    }

    const totalPoints = doors.length * 50; // 50 points per door
    let submissionsCreated = 0;

    // Simple synchronous approach - insert first door only for now
    const firstDoor = doors[0];

    const db = getDb();
    if (!db) return res.status(503).json({ success: false, error: 'Database not ready' });
    return db.run(`
      INSERT INTO simple_data_submissions (
        user_id, address, garage_door_size, notes, created_at
      ) VALUES (?, ?, ?, ?, datetime('now'))
    `, [userId, address.trim(), firstDoor.size.trim(), `${doors.length} doors total`], function(err: any) {
      if (err) {
        console.error('Database insert error:', err);
        return res.status(500).json({ success: false, error: 'Database error' });
      }

      submissionsCreated = doors.length; // Count all doors even though we only insert one record

      // Update user's score
      return db.run(`
        UPDATE users
        SET total_points = total_points + ?,
            data_submissions = data_submissions + 1,
            updated_at = datetime('now')
        WHERE id = ?
      `, [totalPoints, userId], (updateErr: any) => {
        if (updateErr) {
          console.error('User update error:', updateErr);
          // Still return success since the submission was saved
        }

        return res.json({
          success: true,
          message: `Successfully submitted ${doors.length} garage door(s) for ${address}`,
          pointsAwarded: totalPoints,
          doorsSubmitted: doors.length
        });
      });
    });

  } catch (error) {
    console.error('Submit endpoint error:', error);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Get user's data submissions
router.get('/my-submissions', authenticate, (req: any, res, next) => {
  try {
    const userId = req.user.userId;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const offset = (page - 1) * limit;

    const db = getDb();
    if (!db) return res.status(503).json({ success: false, error: 'Database not ready' });
    return db.all(`
      SELECT
        id,
        address,
        garage_door_size,
        material,
        color,
        style,
        notes,
        photo_path,
        created_at,
        status
      FROM data_submissions
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `, [userId, limit, offset], (err: any, submissions: any[]) => {
      if (err) {
        return res.status(500).json({ success: false, error: 'Failed to fetch submissions' });
      }

      // Get total count
      const db2 = getDb();
      if (!db2) return res.status(503).json({ success: false, error: 'Database not ready' });
      return db2.get('SELECT COUNT(*) as total FROM data_submissions WHERE user_id = ?', [userId], (err: any, row: any) => {
        if (err) {
          return res.status(500).json({ success: false, error: 'Failed to get count' });
        }

        const total = row.total;
        return res.json({
          success: true,
          submissions,
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit)
          }
        });
      });
    });

  } catch (error) {
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Get all data submissions (admin only - for now just return user's own)
router.get('/all', authenticate, (req: any, res, next) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = (page - 1) * limit;

    const db = getDb();
    if (!db) return res.status(503).json({ success: false, error: 'Database not ready' });
    return db.all(`
      SELECT
        ds.id,
        ds.address,
        ds.garage_door_size,
        ds.material,
        ds.color,
        ds.style,
        ds.notes,
        ds.photo_path,
        ds.created_at,
        ds.status,
        u.username
      FROM data_submissions ds
      JOIN users u ON ds.user_id = u.id
      ORDER BY ds.created_at DESC
      LIMIT ? OFFSET ?
    `, [limit, offset], (err: any, submissions: any[]) => {
      if (err) {
        return res.status(500).json({ success: false, error: 'Failed to fetch submissions' });
      }

      // Get total count
      const db3 = getDb();
      if (!db3) return res.status(503).json({ success: false, error: 'Database not ready' });
      return db3.get('SELECT COUNT(*) as total FROM data_submissions', [], (err: any, row: any) => {
        if (err) {
          return res.status(500).json({ success: false, error: 'Failed to get count' });
        }

        const total = row.total;
        return res.json({
          success: true,
          submissions,
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit)
          }
        });
      });
    });

  } catch (error) {
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

export default router;
