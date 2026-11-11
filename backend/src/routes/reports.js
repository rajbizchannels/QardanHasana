const express = require('express');
const router = express.Router();
const { authenticate, requireRole } = require('../middleware/auth');
const ctrl = require('../controllers/reportController');

router.get('/cash-status', authenticate, requireRole('admin', 'accountant'), ctrl.getCashStatus);
router.get('/audit-logs', authenticate, requireRole('admin', 'accountant'), ctrl.getAuditLogs);
router.get('/monthly', authenticate, requireRole('admin', 'accountant'), ctrl.getMonthlyReport);
router.get('/transactions', authenticate, requireRole('admin', 'accountant'), ctrl.getTransactionReport);
router.get('/ledger-statement', authenticate, requireRole('admin', 'accountant'), ctrl.getLedgerStatement);
router.get('/forecast', authenticate, requireRole('admin', 'accountant'), ctrl.getForecastReport);
router.get('/users-for-select', authenticate, requireRole('admin', 'accountant'), ctrl.getUsersForSelect);

module.exports = router;
