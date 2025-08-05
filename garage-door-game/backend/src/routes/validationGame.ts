import express from 'express';
import { authenticate, AuthenticatedRequest } from '../middleware/auth';
import { validate } from '../middleware/validation';
import { auditDataAccess } from '../middleware/auditMiddleware';
import {
  startValidationGame,
  submitValidationGuess,
  getValidationStats,
  getUserValidationHistory,
  getNextValidationQuestion,
  endValidationGameSession
} from '../services/validationGameService';
import Joi from 'joi';

const router = express.Router();

// Validation schemas
const submitGuessSchema = Joi.object({
  sessionId: Joi.string().required(),
  garage_door_count: Joi.number().integer().min(1).max(10).when('skipped', { is: true, then: Joi.optional(), otherwise: Joi.when('notVisible', { is: true, then: Joi.optional(), otherwise: Joi.required() }) }),
  garage_door_width: Joi.number().positive().when('skipped', { is: true, then: Joi.optional(), otherwise: Joi.when('notVisible', { is: true, then: Joi.optional(), otherwise: Joi.required() }) }),
  garage_door_height: Joi.number().positive().when('skipped', { is: true, then: Joi.optional(), otherwise: Joi.when('notVisible', { is: true, then: Joi.optional(), otherwise: Joi.required() }) }),
  garage_door_type: Joi.string().valid('single', 'double', 'triple', 'commercial', 'custom').when('skipped', { is: true, then: Joi.optional(), otherwise: Joi.when('notVisible', { is: true, then: Joi.optional(), otherwise: Joi.required() }) }),
  confidence: Joi.number().min(1).max(5).when('skipped', { is: true, then: Joi.optional(), otherwise: Joi.when('notVisible', { is: true, then: Joi.optional(), otherwise: Joi.required() }) }),
  skipped: Joi.boolean().default(false),
  notVisible: Joi.boolean().default(false)
});

/**
 * Start a new validation game session
 */
router.post('/start',
  authenticate,
  auditDataAccess('validation_game', 'start'),
  async (req: AuthenticatedRequest, res, next): Promise<void> => {
    try {
      const userId = req.user!.userId;

      const session = await startValidationGame(userId);

      if (!session) {
        res.status(404).json({
          success: false,
          error: {
            message: 'No verified data available for validation game',
            code: 'NO_VERIFIED_DATA'
          }
        });
        return;
      }

      // Return session data without revealing correct answer
      res.json({
        success: true,
        data: {
          sessionId: session.sessionId,
          address: session.address,
          imageUrl: session.imageUrl,
          timeLimit: session.timeLimit,
          instructions: 'Look at the garage door in the image and estimate the measurements'
        }
      });

    } catch (error) {
      next(error);
    }
  }
);

/**
 * Submit a guess for validation
 */
router.post('/guess',
  authenticate,
  validate(submitGuessSchema),
  auditDataAccess('validation_game', 'guess'),
  async (req: AuthenticatedRequest, res, next): Promise<void> => {
    try {
      const userId = req.user!.userId;
      const { sessionId, garage_door_count, garage_door_width, garage_door_height, garage_door_type, confidence } = req.body;

      const guess = {
        garage_door_count,
        garage_door_width,
        garage_door_height,
        garage_door_type,
        confidence
      };

      const result = await submitValidationGuess(sessionId, guess, userId);

      if (!result) {
        res.status(404).json({
          success: false,
          error: {
            message: 'Game session not found or expired',
            code: 'SESSION_NOT_FOUND'
          }
        });
        return;
      }

      res.json({
        success: true,
        data: {
          submitted: result.submitted,
          pointsEarned: result.pointsEarned,
          feedback: result.feedback,
          questionsAnswered: result.questionsAnswered,
          totalScore: result.totalScore
        }
      });

    } catch (error) {
      next(error);
    }
  }
);

/**
 * Get validation game statistics
 */
router.get('/stats',
  authenticate,
  auditDataAccess('validation_game', 'stats'),
  async (req: AuthenticatedRequest, res, next): Promise<void> => {
    try {
      const stats = await getValidationStats();

      res.json({
        success: true,
        data: stats
      });

    } catch (error) {
      next(error);
    }
  }
);

/**
 * Get user's validation game history
 */
router.get('/history',
  authenticate,
  auditDataAccess('validation_game', 'history'),
  async (req: AuthenticatedRequest, res, next): Promise<void> => {
    try {
      const userId = req.user!.userId;
      const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);

      const history = await getUserValidationHistory(userId, limit);

      res.json({
        success: true,
        data: {
          history,
          count: history.length
        }
      });

    } catch (error) {
      next(error);
    }
  }
);

/**
 * Get leaderboard for validation game
 */
router.get('/leaderboard',
  auditDataAccess('validation_game', 'leaderboard'),
  async (req, res, next): Promise<void> => {
    try {
      const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);

      // Get top players by validation accuracy and games played
      const leaderboard = await getValidationLeaderboard(limit);

      res.json({
        success: true,
        data: {
          leaderboard,
          count: leaderboard.length
        }
      });

    } catch (error) {
      next(error);
    }
  }
);

// Helper function for leaderboard
async function getValidationLeaderboard(limit: number): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const query = `
      SELECT 
        u.id,
        u.username,
        u.validation_games_played,
        u.validation_accuracy_rate,
        u.total_points,
        RANK() OVER (ORDER BY u.validation_accuracy_rate DESC, u.validation_games_played DESC) as rank
      FROM users u
      WHERE u.validation_games_played > 0
      ORDER BY u.validation_accuracy_rate DESC, u.validation_games_played DESC
      LIMIT ?
    `;

    const { db } = require('../config/database');
    db.all(query, [limit], (err: any, rows: any) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(rows || []);
    });
  });
}

/**
 * Get next question in validation game
 */
router.post('/next-question',
  authenticate,
  auditDataAccess('validation_game', 'next_question'),
  async (req: AuthenticatedRequest, res, next): Promise<void> => {
    try {
      const userId = req.user!.userId;
      const { sessionId } = req.body;

      if (!sessionId) {
        res.status(400).json({
          success: false,
          error: {
            message: 'Session ID is required',
            code: 'MISSING_SESSION_ID'
          }
        });
        return;
      }

      const session = await getNextValidationQuestion(sessionId, userId);

      if (!session) {
        res.status(404).json({
          success: false,
          error: {
            message: 'No more questions available or invalid session',
            code: 'NO_MORE_QUESTIONS'
          }
        });
        return;
      }

      // Return session data without revealing correct answer
      res.json({
        success: true,
        data: {
          sessionId: session.sessionId,
          address: session.address,
          imageUrl: session.imageUrl,
          timeLimit: session.timeLimit,
          questionsAnswered: session.questionsAnswered,
          totalScore: session.totalScore,
          instructions: 'Look at the garage door in the image and estimate the measurements'
        }
      });

    } catch (error) {
      next(error);
    }
  }
);

/**
 * End validation game session
 */
router.post('/end-session',
  authenticate,
  auditDataAccess('validation_game', 'end_session'),
  async (req: AuthenticatedRequest, res, next): Promise<void> => {
    try {
      const userId = req.user!.userId;
      const { sessionId } = req.body;

      if (!sessionId) {
        res.status(400).json({
          success: false,
          error: {
            message: 'Session ID is required',
            code: 'MISSING_SESSION_ID'
          }
        });
        return;
      }

      const ended = endValidationGameSession(sessionId, userId);

      res.json({
        success: ended,
        message: ended ? 'Session ended successfully' : 'Session not found or already ended'
      });

    } catch (error) {
      next(error);
    }
  }
);

export default router;
