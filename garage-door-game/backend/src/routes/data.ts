import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { authenticateToken } from '../middleware/auth';
import { createError } from '../utils/errors';
import { db } from '../database/database';

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
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

// Submit garage door data
router.post('/submit', authenticateToken, upload.single('photo'), async (req, res, next) => {
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
      throw createError('All required fields must be provided', 400);
    }

    // Get photo path if uploaded
    const photoPath = req.file ? req.file.filename : null;

    // Insert data submission into database
    const stmt = db.prepare(`
      INSERT INTO data_submissions (
        user_id, address, garage_door_size, material, color, style, notes, photo_path, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `);

    const result = stmt.run(
      userId,
      address,
      garageDoorSize,
      material,
      color,
      style,
      notes || null,
      photoPath
    );

    // Award points for data submission
    const pointsAwarded = 50; // Base points for data submission
    const bonusPoints = photoPath ? 25 : 0; // Bonus for including photo
    const totalPoints = pointsAwarded + bonusPoints;

    // Update user's score
    const updateScoreStmt = db.prepare(`
      UPDATE users 
      SET total_score = total_score + ?, 
          data_submissions = data_submissions + 1,
          updated_at = datetime('now')
      WHERE id = ?
    `);
    updateScoreStmt.run(totalPoints, userId);

    // Log the points awarded
    const logStmt = db.prepare(`
      INSERT INTO score_logs (user_id, points_awarded, reason, created_at)
      VALUES (?, ?, ?, datetime('now'))
    `);
    logStmt.run(userId, totalPoints, 'Data submission');

    res.json({
      success: true,
      message: 'Data submitted successfully',
      pointsAwarded: totalPoints,
      submissionId: result.lastInsertRowid
    });

  } catch (error) {
    next(error);
  }
});

// Get user's data submissions
router.get('/my-submissions', authenticateToken, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const offset = (page - 1) * limit;

    const stmt = db.prepare(`
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
    `);

    const submissions = stmt.all(userId, limit, offset);

    // Get total count
    const countStmt = db.prepare('SELECT COUNT(*) as total FROM data_submissions WHERE user_id = ?');
    const { total } = countStmt.get(userId) as { total: number };

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

  } catch (error) {
    next(error);
  }
});

// Get all data submissions (admin only - for now just return user's own)
router.get('/all', authenticateToken, async (req, res, next) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = (page - 1) * limit;

    const stmt = db.prepare(`
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
    `);

    const submissions = stmt.all(limit, offset);

    // Get total count
    const countStmt = db.prepare('SELECT COUNT(*) as total FROM data_submissions');
    const { total } = countStmt.get() as { total: number };

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

  } catch (error) {
    next(error);
  }
});

export default router;
