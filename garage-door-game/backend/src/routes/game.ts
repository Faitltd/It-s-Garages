import express from 'express';
import { authenticate, AuthenticatedRequest } from '../middleware/auth';
import { validate } from '../middleware/validation';
import { auditDataAccess } from '../middleware/auditMiddleware';
import { checkGoogleApiLimits, validateGoogleApiConfig, logGoogleApiUsage } from '../middleware/googleApiSecurity';
import { googleApiLimiter } from '../services/googleApiService';
import { googleApiService } from '../services/googleApiService';
import {
  createGameSession,
  getGameSession,
  updateGameSession,
  calculateScore,
  getUserGameHistory,
  updateUserStats,
  generateRandomLocation,
  getTimeLimitForDifficulty,
  createQuestionGameSession,
  submitQuestionAnswer,
  getRandomQuestion
} from '../services/gameService';
import { createError } from '../middleware/errorHandler';
import Joi from 'joi';

const router = express.Router();

// Validation schemas
const startGameSchema = Joi.object({
  difficulty: Joi.string().valid('easy', 'medium', 'hard').default('medium'),
  location: Joi.object({
    lat: Joi.number().min(-90).max(90).required(),
    lng: Joi.number().min(-180).max(180).required(),
    address: Joi.string().optional()
  }).optional()
});

const submitGuessSchema = Joi.object({
  sessionId: Joi.number().integer().positive().required(),
  garageCount: Joi.number().integer().min(0).max(10).required(),
  garageWidth: Joi.number().positive().optional(),
  garageHeight: Joi.number().positive().optional(),
  garageType: Joi.string().valid('single', 'double', 'triple', 'commercial', 'other').optional(),
  confidence: Joi.number().min(0).max(100).default(50)
});

const startQuestionGameSchema = Joi.object({
  difficulty: Joi.string().valid('easy', 'medium', 'hard').default('medium')
});

const submitAnswerSchema = Joi.object({
  sessionId: Joi.string().required(),
  selectedAnswer: Joi.string().required()
});

// @desc    Start a new game session
// @route   POST /api/game/start
// @access  Private
router.post('/start',
  authenticate,
  googleApiLimiter,
  checkGoogleApiLimits,
  validateGoogleApiConfig,
  validate(startGameSchema),
  auditDataAccess('game', 'start'),
  logGoogleApiUsage('streetView'),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      if (!req.user) {
        return next(createError('User not found in request', 401));
      }

      const { difficulty, location } = req.body;

      // Generate random location if not provided
      let gameLocation = location;
      if (!gameLocation) {
        gameLocation = await generateRandomLocation(difficulty || 'medium');
        if (!gameLocation) {
          return next(createError('No addresses available for game', 404));
        }
      }

      // Build Street View URL optimized for residential garage door viewing
      const streetViewUrl = googleApiService.buildStreetViewUrl({
        lat: gameLocation.lat,
        lng: gameLocation.lng,
        size: '640x640',
        heading: Math.floor(Math.random() * 360), // Random heading to show different house angles
        pitch: -10, // Slightly downward angle to better capture garage doors
        fov: 90 // Standard field of view for house viewing
      });

      // Create game session in database
      const sessionId = await createGameSession(req.user.userId, gameLocation, difficulty || 'medium');

      res.json({
        success: true,
        data: {
          sessionId,
          streetViewUrl,
          location: {
            lat: gameLocation.lat,
            lng: gameLocation.lng,
            address: gameLocation.address
          },
          difficulty: difficulty || 'medium',
          timeLimit: getTimeLimitForDifficulty(difficulty || 'medium')
        }
      });

    } catch (error) {
      next(error);
    }
  }
);

// @desc    Submit a guess for the current game
// @route   POST /api/game/guess
// @access  Private
router.post('/guess',
  authenticate,
  validate(submitGuessSchema),
  auditDataAccess('game', 'guess'),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      if (!req.user) {
        return next(createError('User not found in request', 401));
      }

      const { sessionId, garageCount, garageWidth, garageHeight, garageType, confidence } = req.body;

      // Validate session belongs to user
      const session = await getGameSession(sessionId, req.user.userId);
      if (!session) {
        return next(createError('Game session not found or access denied', 404));
      }

      if (session.guess_door_count !== null) {
        return next(createError('Game session already completed', 400));
      }

      // Calculate score based on accuracy
      const score = await calculateScore(session, {
        garageCount,
        garageWidth,
        garageHeight,
        garageType,
        confidence
      });

      // Update session with guess and score
      await updateGameSession(sessionId, {
        garageCount,
        garageWidth,
        garageHeight,
        garageType,
        confidence,
        score: score.points,
        accuracy: score.accuracy,
        completed: true,
        completedAt: new Date()
      });

      // Update user stats
      await updateUserStats(req.user.userId, score.points, score.accuracy);

      res.json({
        success: true,
        data: {
          score: score.points,
          accuracy: score.accuracy,
          feedback: score.feedback,
          correctAnswer: score.correctAnswer,
          breakdown: score.breakdown
        }
      });

    } catch (error) {
      next(error);
    }
  }
);

// @desc    Get current game session
// @route   GET /api/game/session/:id
// @access  Private
router.get('/session/:id',
  authenticate,
  auditDataAccess('game', 'view_session'),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      if (!req.user) {
        return next(createError('User not found in request', 401));
      }

      const sessionId = parseInt(req.params.id || '0');
      const session = await getGameSession(sessionId, req.user.userId);

      if (!session) {
        return next(createError('Game session not found or access denied', 404));
      }

      res.json({
        success: true,
        data: {
          session
        }
      });

    } catch (error) {
      next(error);
    }
  }
);

// @desc    Get user's game history
// @route   GET /api/game/history
// @access  Private
router.get('/history',
  authenticate,
  auditDataAccess('game', 'view_history'),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      if (!req.user) {
        return next(createError('User not found in request', 401));
      }

      const page = parseInt(req.query.page as string) || 1;
      const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);

      const history = await getUserGameHistory(req.user.userId, page, limit);

      res.json({
        success: true,
        data: {
          games: history.games,
          pagination: {
            page,
            limit,
            total: history.total,
            pages: Math.ceil(history.total / limit)
          }
        }
      });

    } catch (error) {
      next(error);
    }
  }
);

// @desc    Start a new question-based game session
// @route   POST /api/game/question/start
// @access  Private
router.post('/question/start',
  authenticate,
  validate(startQuestionGameSchema),
  auditDataAccess('game_question', 'start'),
  async (req: AuthenticatedRequest, res, next): Promise<void> => {
    try {
      const { difficulty } = req.body;
      const userId = req.user!.userId;

      // Create question-based game session
      const session = await createQuestionGameSession(userId, difficulty);

      if (!session) {
        res.status(404).json({
          success: false,
          error: {
            message: 'No questions available for the selected difficulty level',
            code: 'NO_QUESTIONS_AVAILABLE'
          }
        });
        return;
      }

      // Return session data without revealing correct answer
      res.json({
        success: true,
        data: {
          sessionId: session.sessionId,
          imageUrl: session.imageUrl,
          difficulty: session.difficulty,
          timeLimit: session.timeLimit,
          pointsValue: session.pointsValue,
          address: session.address,
          options: session.options
        }
      });

    } catch (error) {
      next(error);
    }
  }
);

// @desc    Submit answer for question-based game
// @route   POST /api/game/question/answer
// @access  Private
router.post('/question/answer',
  authenticate,
  validate(submitAnswerSchema),
  auditDataAccess('game_question', 'answer'),
  async (req: AuthenticatedRequest, res, next): Promise<void> => {
    try {
      const { sessionId, selectedAnswer } = req.body;
      const userId = req.user!.userId;

      // Submit answer
      const result = await submitQuestionAnswer(sessionId, selectedAnswer, userId);

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
          correct: result.correct,
          correctAnswer: result.correctAnswer,
          pointsEarned: result.pointsEarned,
          accuracy: result.accuracy
        }
      });

    } catch (error) {
      next(error);
    }
  }
);

// @desc    Get random question for preview (no session)
// @route   GET /api/game/question/random
// @access  Private
router.get('/question/random',
  authenticate,
  auditDataAccess('game_question', 'preview'),
  async (req: AuthenticatedRequest, res, next): Promise<void> => {
    try {
      const difficulty = req.query.difficulty as string || 'medium';

      const question = await getRandomQuestion(difficulty);

      if (!question) {
        res.status(404).json({
          success: false,
          error: {
            message: 'No questions available',
            code: 'NO_QUESTIONS_AVAILABLE'
          }
        });
        return;
      }

      // Return question without revealing correct answer
      res.json({
        success: true,
        data: {
          id: question.id,
          address: question.address,
          imageUrl: question.image_url,
          difficulty: question.difficulty,
          pointsValue: question.points_value,
          options: [question.option_a, question.option_b, question.option_c, question.option_d]
        }
      });

    } catch (error) {
      next(error);
    }
  }
);

export default router;
