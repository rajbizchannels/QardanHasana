const express = require('express');
const router = express.Router();
const { authenticate, requireRole } = require('../middleware/auth');
const ctrl = require('../controllers/ledgerController');

router.get('/', authenticate, requireRole('admin', 'accountant'), ctrl.getAllLedgers);
router.get('/:userId', authenticate, ctrl.getLedger);

module.exports = router;
