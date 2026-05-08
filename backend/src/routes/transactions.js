const express = require('express');
const router = express.Router();
const { authenticate, requireRole } = require('../middleware/auth');
const ctrl = require('../controllers/transactionController');

router.get('/', authenticate, ctrl.getTransactions);
router.post('/', authenticate, ctrl.createTransaction);
router.get('/:id', authenticate, ctrl.getTransaction);
router.put('/:id', authenticate, requireRole('admin', 'accountant'), ctrl.updateTransaction);
router.post('/:id/approve', authenticate, requireRole('admin', 'accountant'), ctrl.approveTransaction);
router.delete('/:id', authenticate, ctrl.deleteTransaction);

module.exports = router;
