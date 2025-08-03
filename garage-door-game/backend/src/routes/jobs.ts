import express from 'express';
const router = express.Router();

// @desc    Submit new job
// @route   POST /api/jobs
// @access  Private
router.post('/', (req, res) => {
  res.json({ message: 'Submit job - Coming soon' });
});

// @desc    Get user jobs
// @route   GET /api/jobs
// @access  Private
router.get('/', (req, res) => {
  res.json({ message: 'Get user jobs - Coming soon' });
});

// @desc    Get job by ID
// @route   GET /api/jobs/:id
// @access  Private
router.get('/:id', (req, res) => {
  res.json({ message: 'Get job by ID - Coming soon' });
});

// @desc    Update job
// @route   PUT /api/jobs/:id
// @access  Private
router.put('/:id', (req, res) => {
  res.json({ message: 'Update job - Coming soon' });
});

// @desc    Delete job
// @route   DELETE /api/jobs/:id
// @access  Private
router.delete('/:id', (req, res) => {
  res.json({ message: 'Delete job - Coming soon' });
});

export default router;
