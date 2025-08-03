import express from 'express';
import rateLimit from 'express-rate-limit';
import { validate } from '../middleware/validation';
import { authenticate } from '../middleware/auth';
import { auditAuthEvents } from '../middleware/auditMiddleware';
import { registerSchema, loginSchema, changePasswordSchema, refreshTokenSchema } from '../validation/auth';
import {
  createUser,
  authenticateUser,
  getUserById,
  updateUserPassword
} from '../services/userService';
import {
  generateToken,
  generateRefreshToken,
  verifyRefreshToken,
  AuthenticatedRequest
} from '../utils/auth';
import { createError } from '../middleware/errorHandler';

const router = express.Router();

// Rate limiting for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 requests per windowMs
  message: {
    error: 'Too many authentication attempts, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // limit each IP to 3 registration attempts per hour
  message: {
    error: 'Too many registration attempts, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// @desc    Register user
// @route   POST /api/auth/register
// @access  Public
router.post('/register', registerLimiter, validate(registerSchema), auditAuthEvents('register'), async (req, res, next) => {
  try {
    const { username, email, password } = req.body;

    const user = await createUser({ username, email, password });

    // Generate tokens
    const token = generateToken({
      userId: user.id,
      username: user.username,
      email: user.email,
      role: user.role
    });

    const refreshToken = generateRefreshToken({
      userId: user.id,
      username: user.username,
      email: user.email,
      role: user.role
    });

    // Set secure HTTP-only cookie for refresh token
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
    });

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
        user,
        token
      }
    });
  } catch (error) {
    next(error);
  }
});

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
router.post('/login', authLimiter, validate(loginSchema), auditAuthEvents('login'), async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const user = await authenticateUser(email, password);

    if (!user) {
      return next(createError('Invalid email or password', 401));
    }

    // Generate tokens
    const token = generateToken({
      userId: user.id,
      username: user.username,
      email: user.email,
      role: user.role
    });

    const refreshToken = generateRefreshToken({
      userId: user.id,
      username: user.username,
      email: user.email,
      role: user.role
    });

    // Set secure HTTP-only cookie for refresh token
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
    });

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user,
        token
      }
    });
  } catch (error) {
    next(error);
  }
});

// @desc    Refresh access token
// @route   POST /api/auth/refresh
// @access  Public (requires refresh token in cookie)
router.post('/refresh', validate(refreshTokenSchema), async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    const cookieRefreshToken = req.cookies?.refreshToken;

    // Use refresh token from cookie if not provided in body
    const tokenToVerify = refreshToken || cookieRefreshToken;

    if (!tokenToVerify) {
      return next(createError('Refresh token required', 401));
    }

    const decoded = verifyRefreshToken(tokenToVerify);

    // Get fresh user data
    const user = await getUserById(decoded.userId);

    // Generate new access token
    const newToken = generateToken({
      userId: user.id,
      username: user.username,
      email: user.email,
      role: user.role
    });

    res.json({
      success: true,
      message: 'Token refreshed successfully',
      data: {
        token: newToken
      }
    });
  } catch (error) {
    // Clear invalid refresh token cookie
    res.clearCookie('refreshToken');
    next(error);
  }
});

// @desc    Logout user
// @route   POST /api/auth/logout
// @access  Private
router.post('/logout', authenticate, (req, res) => {
  // Clear refresh token cookie
  res.clearCookie('refreshToken');

  res.json({
    success: true,
    message: 'Logout successful'
  });
});

// @desc    Get current user
// @route   GET /api/auth/me
// @access  Private
router.get('/me', authenticate, async (req: AuthenticatedRequest, res, next) => {
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

// @desc    Change password
// @route   PUT /api/auth/password
// @access  Private
router.put('/password', authenticate, validate(changePasswordSchema), async (req: AuthenticatedRequest, res, next) => {
  try {
    if (!req.user) {
      return next(createError('User not found in request', 401));
    }

    const { currentPassword, newPassword } = req.body;

    await updateUserPassword(req.user.userId, currentPassword, newPassword);

    res.json({
      success: true,
      message: 'Password updated successfully'
    });
  } catch (error) {
    next(error);
  }
});

export default router;
