import express from 'express';
import { authenticate, AuthenticatedRequest } from '../middleware/auth';
import { validate } from '../middleware/validation';
import { auditDataAccess } from '../middleware/auditMiddleware';
import {
  getGlobalLeaderboard,
  getUserRank,
  getTopPerformers,
  getRecentActivity
} from '../services/leaderboardService';
import Joi from 'joi';

const router = express.Router();

// Validation schemas
const leaderboardQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(50).default(10)
});

// @desc    Get global leaderboard
// @route   GET /api/leaderboard
// @access  Public
router.get('/',
  auditDataAccess('leaderboard', 'view'),
  async (req, res, next) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);

      const result = await getGlobalLeaderboard(page, limit);

      res.json({
        success: true,
        data: {
          leaderboard: result.entries,
          stats: result.stats,
          pagination: result.pagination
        }
      });

    } catch (error) {
      next(error);
    }
  }
);

// @desc    Get user's rank
// @route   GET /api/leaderboard/my-rank
// @access  Private
router.get('/my-rank',
  authenticate,
  auditDataAccess('user_rank', 'view'),
  async (req: AuthenticatedRequest, res, next): Promise<void> => {
    try {
      const userId = req.user!.userId;

      const rank = await getUserRank(userId);

      if (!rank) {
        res.json({
          success: true,
          data: {
            rank: null,
            totalPlayers: 0,
            message: 'Play some games to get ranked!'
          }
        });
        return;
      }

      res.json({
        success: true,
        data: rank
      });

    } catch (error) {
      next(error);
    }
  }
);

// @desc    Get top performers by category
// @route   GET /api/leaderboard/top-performers
// @access  Public
router.get('/top-performers',
  auditDataAccess('top_performers', 'view'),
  async (req, res, next) => {
    try {
      const performers = await getTopPerformers();

      res.json({
        success: true,
        data: performers
      });

    } catch (error) {
      next(error);
    }
  }
);

// @desc    Get recent activity feed
// @route   GET /api/leaderboard/activity
// @access  Public
router.get('/activity',
  auditDataAccess('activity_feed', 'view'),
  async (req, res, next) => {
    try {
      const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);

      const activity = await getRecentActivity(limit);

      res.json({
        success: true,
        data: {
          activity,
          count: activity.length
        }
      });

    } catch (error) {
      next(error);
    }
  }
);

export default router;
