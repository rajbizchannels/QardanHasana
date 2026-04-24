const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const upload = require('../middleware/upload');
const ctrl = require('../controllers/documentController');

router.get('/', authenticate, ctrl.getDocuments);
router.post('/', authenticate, upload.single('file'), ctrl.uploadDocument);
router.get('/:id/download', authenticate, ctrl.downloadDocument);

module.exports = router;
