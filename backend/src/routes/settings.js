const express = require('express');
const router = express.Router();
const { authenticate, requireRole } = require('../middleware/auth');
const ctrl = require('../controllers/settingsController');

router.get('/', authenticate, ctrl.getSettings);
router.put('/bulk', authenticate, requireRole('admin'), ctrl.bulkUpdateSettings);
router.put('/:key', authenticate, requireRole('admin'), ctrl.updateSetting);

module.exports = router;
