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

module.exports = router;
