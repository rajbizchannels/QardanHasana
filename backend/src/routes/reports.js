const express = require('express');
const router = express.Router();
const { authenticate, requireRole } = require('../middleware/auth');
const ctrl = require('../controllers/reportController');

router.get('/cash-status', authenticate, requireRole('admin', 'accountant'), ctrl.getCashStatus);
router.get('/audit-logs', authenticate, requireRole('admin', 'accountant'), ctrl.getAuditLogs);

module.exports = router;
