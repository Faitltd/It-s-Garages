import express from 'express';
import { authenticate, AuthenticatedRequest } from '../middleware/auth';
import { validate } from '../middleware/validation';
import { getUserById, updateUserProfile } from '../services/userService';
import { createError } from '../middleware/errorHandler';
import Joi from 'joi';

const router = express.Router();

// Profile update validation schema
const updateProfileSchema = Joi.object({
  username: Joi.string()
    .alphanum()
    .min(3)
    .max(30)
    .optional()
    .messages({
      'string.alphanum': 'Username must only contain alphanumeric characters',
      'string.min': 'Username must be at least 3 characters long',
      'string.max': 'Username must not exceed 30 characters'
    }),

  email: Joi.string()
    .email({ tlds: { allow: false } })
    .optional()
    .messages({
      'string.email': 'Please provide a valid email address'
    })
});

// @desc    Get user profile
// @route   GET /api/users/profile
// @access  Private
router.get('/profile', authenticate, async (req: AuthenticatedRequest, res, next) => {
  try {
    if (!req.user) {
      return next(createError('User not found in request', 401));
    }

    const user = await getUserById(req.user.userId);

    res.json({
      success: true,
      data: {
        user
      }
    });
  } catch (error) {
    next(error);
  }
});

// @desc    Update user profile
// @route   PUT /api/users/profile
// @access  Private
router.put('/profile', authenticate, validate(updateProfileSchema), async (req: AuthenticatedRequest, res, next) => {
  try {
    if (!req.user) {
      return next(createError('User not found in request', 401));
    }

    const updates = req.body;

    if (Object.keys(updates).length === 0) {
      return next(createError('No fields to update', 400));
    }

    const updatedUser = await updateUserProfile(req.user.userId, updates);

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        user: updatedUser
      }
    });
  } catch (error) {
    next(error);
  }
});

// @desc    Get user stats
// @route   GET /api/users/stats
// @access  Private
router.get('/stats', authenticate, async (req: AuthenticatedRequest, res, next) => {
  try {
    if (!req.user) {
      return next(createError('User not found in request', 401));
    }

    const user = await getUserById(req.user.userId);

    res.json({
      success: true,
      data: {
        stats: {
          total_points: user.total_points,
          games_played: user.games_played,
          jobs_submitted: user.jobs_submitted,
          accuracy_rate: user.accuracy_rate
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

export default router;
