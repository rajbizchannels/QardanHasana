const express = require('express');
const router = express.Router();
const { authenticate, requireRole } = require('../middleware/auth');
const ctrl = require('../controllers/approvalController');

router.get('/', authenticate, requireRole('admin', 'accountant'), ctrl.getApprovals);
router.get('/stats', authenticate, requireRole('admin', 'accountant'), ctrl.getApprovalStats);
router.post('/:id/review', authenticate, requireRole('admin', 'accountant'), ctrl.reviewApproval);

module.exports = router;
