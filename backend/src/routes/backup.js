const express = require('express');
const router = express.Router();
const { authenticate, requireRole } = require('../middleware/auth');
const ctrl = require('../controllers/backupController');

router.get('/auth-url', authenticate, requireRole('admin'), ctrl.getAuthUrl);
router.get('/oauth2callback', ctrl.oauth2Callback);
router.post('/create', authenticate, requireRole('admin'), ctrl.createBackup);

module.exports = router;
