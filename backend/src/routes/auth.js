const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const ctrl = require('../controllers/authController');

router.post('/login', ctrl.login);
router.post('/logout', authenticate, ctrl.logout);
router.post('/refresh', ctrl.refreshToken);
router.post('/forgot-password', ctrl.forgotPassword);
router.post('/reset-password', ctrl.resetPassword);
router.get('/me', authenticate, ctrl.getMe);

module.exports = router;
