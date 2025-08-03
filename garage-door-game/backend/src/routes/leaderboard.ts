import express from 'express';
const router = express.Router();

// @desc    Get leaderboard
// @route   GET /api/leaderboard
// @access  Public
router.get('/', (req, res) => {
  res.json({ message: 'Get leaderboard - Coming soon' });
});

// @desc    Get user rank
// @route   GET /api/leaderboard/rank/:userId
// @access  Private
router.get('/rank/:userId', (req, res) => {
  res.json({ message: 'Get user rank - Coming soon' });
});

export default router;
