const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { query } = require('../config/database');

router.get('/', authenticate, async (req, res) => {
  try {
    const { page = 1, limit = 20, unread } = req.query;
    const offset = (page - 1) * limit;
    let conditions = [`user_id = $1`];
    const params = [req.user.id];

    if (unread === 'true') conditions.push(`is_read = FALSE`);

    const whereClause = conditions.join(' AND ');
    const result = await query(
      `SELECT * FROM notifications WHERE ${whereClause} ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );
    const countRes = await query(`SELECT COUNT(*) FROM notifications WHERE ${whereClause}`, params);

    res.json({ success: true, data: { notifications: result.rows, total: parseInt(countRes.rows[0].count) } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/:id/read', authenticate, async (req, res) => {
  try {
    await query(`UPDATE notifications SET is_read = TRUE, read_at = NOW() WHERE id = $1 AND user_id = $2`, [req.params.id, req.user.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/mark-all-read', authenticate, async (req, res) => {
  try {
    await query(`UPDATE notifications SET is_read = TRUE, read_at = NOW() WHERE user_id = $1 AND is_read = FALSE`, [req.user.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
