const express = require('express');
const router = express.Router();
const { authenticate, requireRole } = require('../middleware/auth');
const ctrl = require('../controllers/profileController');

router.get('/', authenticate, requireRole('admin', 'accountant'), ctrl.getProfiles);
router.post('/creditor', authenticate, ctrl.createCreditorProfile);
router.put('/creditor/:id', authenticate, requireRole('admin', 'accountant'), ctrl.updateCreditorProfile);
router.post('/debtor', authenticate, ctrl.createDebtorProfile);
router.put('/debtor/:id', authenticate, requireRole('admin', 'accountant'), ctrl.updateDebtorProfile);
router.post('/guarantor', authenticate, ctrl.createGuarantorProfile);
router.get('/maturity-alerts', authenticate, requireRole('admin', 'accountant'), ctrl.getMaturityAlerts);

// Per-deposit maturity tracking
router.get('/creditor/:creditorId/deposits', authenticate, requireRole('admin', 'accountant'), ctrl.getDeposits);
router.post('/creditor/:creditorId/deposits', authenticate, requireRole('admin', 'accountant'), ctrl.createDeposit);
router.put('/deposits/:id', authenticate, requireRole('admin', 'accountant'), ctrl.updateDeposit);
router.delete('/deposits/:id', authenticate, requireRole('admin', 'accountant'), ctrl.deleteDeposit);

module.exports = router;
