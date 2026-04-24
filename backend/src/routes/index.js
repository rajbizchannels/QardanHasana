const express = require('express');
const router = express.Router();

router.use('/auth', require('./auth'));
router.use('/users', require('./users'));
router.use('/profiles', require('./profiles'));
router.use('/loans', require('./loans'));
router.use('/transactions', require('./transactions'));
router.use('/ledger', require('./ledger'));
router.use('/reports', require('./reports'));
router.use('/documents', require('./documents'));
router.use('/approvals', require('./approvals'));
router.use('/settings', require('./settings'));
router.use('/rbac', require('./rbac'));
router.use('/backup', require('./backup'));
router.use('/notifications', require('./notifications'));

module.exports = router;
