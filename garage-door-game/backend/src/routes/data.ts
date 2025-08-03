import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { authenticate } from '../middleware/auth';
import { db } from '../config/database';

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

// Submit garage door data
router.post('/submit', authenticate, upload.single('photo'), (req: any, res, next) => {
  try {
    const userId = req.user.id;
    const {
      address,
      garageDoorSize,
      material,
      color,
      style,
      notes
    } = req.body;

    // Validate required fields
    if (!address || !garageDoorSize || !material || !color || !style) {
      return res.status(400).json({ success: false, error: 'All required fields must be provided' });
    }

    // Get photo path if uploaded
    const photoPath = req.file ? req.file.filename : null;

    // Insert data submission into database
    db.run(`
      INSERT INTO data_submissions (
        user_id, address, garage_door_size, material, color, style, notes, photo_path, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `, [userId, address, garageDoorSize, material, color, style, notes || null, photoPath], function(err) {
      if (err) {
        return res.status(500).json({ success: false, error: 'Failed to submit data' });
      }

      const submissionId = this.lastID;

      // Award points for data submission
      const pointsAwarded = 50; // Base points for data submission
      const bonusPoints = photoPath ? 25 : 0; // Bonus for including photo
      const totalPoints = pointsAwarded + bonusPoints;

      // Update user's score
      db.run(`
        UPDATE users
        SET total_points = total_points + ?,
            data_submissions = data_submissions + 1,
            updated_at = datetime('now')
        WHERE id = ?
      `, [totalPoints, userId], (err) => {
        if (err) {
          console.error('Error updating user score:', err);
        }
      });

      // Log the points awarded
      db.run(`
        INSERT INTO score_logs (user_id, points_awarded, reason, created_at)
        VALUES (?, ?, ?, datetime('now'))
      `, [userId, totalPoints, 'Data submission'], (err) => {
        if (err) {
          console.error('Error logging points:', err);
        }
      });

      res.json({
        success: true,
        message: 'Data submitted successfully',
        pointsAwarded: totalPoints,
        submissionId: submissionId
      });
    });

  } catch (error) {
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Get user's data submissions
router.get('/my-submissions', authenticate, (req: any, res, next) => {
  try {
    const userId = req.user.id;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const offset = (page - 1) * limit;

    db.all(`
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
    `, [userId, limit, offset], (err, submissions) => {
      if (err) {
        return res.status(500).json({ success: false, error: 'Failed to fetch submissions' });
      }

      // Get total count
      db.get('SELECT COUNT(*) as total FROM data_submissions WHERE user_id = ?', [userId], (err, row: any) => {
        if (err) {
          return res.status(500).json({ success: false, error: 'Failed to get count' });
        }

        const total = row.total;
        res.json({
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

    db.all(`
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
    `, [limit, offset], (err, submissions) => {
      if (err) {
        return res.status(500).json({ success: false, error: 'Failed to fetch submissions' });
      }

      // Get total count
      db.get('SELECT COUNT(*) as total FROM data_submissions', [], (err, row: any) => {
        if (err) {
          return res.status(500).json({ success: false, error: 'Failed to get count' });
        }

        const total = row.total;
        res.json({
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
