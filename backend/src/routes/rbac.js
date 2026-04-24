const express = require('express');
const router = express.Router();
const { authenticate, requireRole } = require('../middleware/auth');
const ctrl = require('../controllers/rbacController');

router.get('/roles', authenticate, requireRole('admin'), ctrl.getRoles);
router.post('/roles', authenticate, requireRole('admin'), ctrl.createRole);
router.put('/roles/:id', authenticate, requireRole('admin'), ctrl.updateRole);
router.delete('/roles/:id', authenticate, requireRole('admin'), ctrl.deleteRole);
router.get('/permissions', authenticate, requireRole('admin'), ctrl.getPermissions);

module.exports = router;
