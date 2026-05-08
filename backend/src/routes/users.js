const express = require('express');
const router = express.Router();
const { authenticate, authorize, requireRole } = require('../middleware/auth');
const ctrl = require('../controllers/userController');

router.get('/', authenticate, requireRole('admin', 'accountant'), ctrl.getUsers);
router.post('/', authenticate, requireRole('admin'), ctrl.createUser);
router.get('/:id', authenticate, ctrl.getUser);
router.put('/:id', authenticate, ctrl.updateUser);
router.delete('/:id', authenticate, ctrl.deleteUser);
router.put('/:id/roles', authenticate, requireRole('admin'), ctrl.assignRoles);
router.put('/:id/password', authenticate, ctrl.changePassword);
router.put('/:id/notification-preferences', authenticate, ctrl.updateNotificationPreferences);

module.exports = router;
