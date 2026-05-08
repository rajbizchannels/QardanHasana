const express = require('express');
const router = express.Router();
const { authenticate, requireRole } = require('../middleware/auth');
const ctrl = require('../controllers/loanController');

router.get('/', authenticate, ctrl.getLoans);
router.post('/', authenticate, ctrl.createLoan);
router.get('/:id', authenticate, ctrl.getLoan);
router.put('/:id', authenticate, ctrl.updateLoan);
router.delete('/:id', authenticate, requireRole('admin', 'accountant'), ctrl.deleteLoan);

module.exports = router;
