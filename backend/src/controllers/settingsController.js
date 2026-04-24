const { query } = require('../config/database');
const audit = require('../utils/audit');

exports.getSettings = async (req, res) => {
  try {
    const isAdmin = req.user.roles.includes('admin');
    const result = await query(
      `SELECT * FROM settings ${isAdmin ? '' : 'WHERE is_public = TRUE'} ORDER BY category, key`
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateSetting = async (req, res) => {
  try {
    const { key } = req.params;
    const { value } = req.body;

    const result = await query(
      `UPDATE settings SET value = $1, updated_at = NOW() WHERE key = $2 RETURNING *`,
      [value, key]
    );

    if (!result.rows[0]) {
      const ins = await query(
        `INSERT INTO settings (key, value) VALUES ($1, $2) RETURNING *`,
        [key, value]
      );
      await audit({ userId: req.user.id, action: 'SETTING_CREATED', entityType: 'setting', newValues: { key, value }, ipAddress: req.ip });
      return res.json({ success: true, data: ins.rows[0] });
    }

    await audit({ userId: req.user.id, action: 'SETTING_UPDATED', entityType: 'setting', newValues: { key, value }, ipAddress: req.ip });
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.bulkUpdateSettings = async (req, res) => {
  try {
    const { settings } = req.body;
    for (const { key, value } of settings) {
      await query(
        `INSERT INTO settings (key, value) VALUES ($1, $2)
         ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`,
        [key, value]
      );
    }
    await audit({ userId: req.user.id, action: 'SETTINGS_BULK_UPDATED', entityType: 'setting', newValues: { keys: settings.map(s => s.key) }, ipAddress: req.ip });
    res.json({ success: true, message: 'Settings updated successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
