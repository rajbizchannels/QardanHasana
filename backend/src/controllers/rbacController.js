const { query } = require('../config/database');
const audit = require('../utils/audit');

exports.getRoles = async (req, res) => {
  try {
    const result = await query(
      `SELECT r.*,
              array_agg(DISTINCT p.name) FILTER (WHERE p.name IS NOT NULL) as permissions,
              COUNT(DISTINCT ur.user_id) as user_count
       FROM roles r
       LEFT JOIN role_permissions rp ON r.id = rp.role_id
       LEFT JOIN permissions p ON rp.permission_id = p.id
       LEFT JOIN user_roles ur ON r.id = ur.role_id
       GROUP BY r.id
       ORDER BY r.is_system DESC, r.created_at`
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.createRole = async (req, res) => {
  try {
    const { name, displayName, description, permissions = [] } = req.body;

    const roleRes = await query(
      `INSERT INTO roles (name, display_name, description) VALUES ($1, $2, $3) RETURNING *`,
      [name.toLowerCase().replace(/\s+/g, '_'), displayName, description || null]
    );
    const role = roleRes.rows[0];

    for (const permName of permissions) {
      const permRes = await query(`SELECT id FROM permissions WHERE name = $1`, [permName]);
      if (permRes.rows[0]) {
        await query(`INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [role.id, permRes.rows[0].id]);
      }
    }

    await audit({ userId: req.user.id, action: 'ROLE_CREATED', entityType: 'role', entityId: role.id, newValues: { name, displayName }, ipAddress: req.ip });
    res.status(201).json({ success: true, data: role });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ success: false, message: 'Role name already exists' });
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateRole = async (req, res) => {
  try {
    const { id } = req.params;
    const { displayName, description, isActive, permissions } = req.body;

    const roleRes = await query(`SELECT * FROM roles WHERE id = $1`, [id]);
    if (!roleRes.rows[0]) return res.status(404).json({ success: false, message: 'Role not found' });
    if (roleRes.rows[0].is_system) return res.status(403).json({ success: false, message: 'Cannot modify system roles' });

    await query(
      `UPDATE roles SET display_name = COALESCE($1, display_name), description = COALESCE($2, description),
       is_active = COALESCE($3, is_active), updated_at = NOW() WHERE id = $4`,
      [displayName, description, isActive, id]
    );

    if (permissions !== undefined) {
      await query(`DELETE FROM role_permissions WHERE role_id = $1`, [id]);
      for (const permName of permissions) {
        const permRes = await query(`SELECT id FROM permissions WHERE name = $1`, [permName]);
        if (permRes.rows[0]) {
          await query(`INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [id, permRes.rows[0].id]);
        }
      }
    }

    await audit({ userId: req.user.id, action: 'ROLE_UPDATED', entityType: 'role', entityId: id, newValues: { displayName, permissions }, ipAddress: req.ip });
    const updated = await query(`SELECT * FROM roles WHERE id = $1`, [id]);
    res.json({ success: true, data: updated.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.deleteRole = async (req, res) => {
  try {
    const { id } = req.params;
    const roleRes = await query(`SELECT * FROM roles WHERE id = $1`, [id]);
    if (!roleRes.rows[0]) return res.status(404).json({ success: false, message: 'Role not found' });
    if (roleRes.rows[0].is_system) return res.status(403).json({ success: false, message: 'Cannot delete system roles' });

    const usageRes = await query(`SELECT COUNT(*) FROM user_roles WHERE role_id = $1`, [id]);
    if (parseInt(usageRes.rows[0].count) > 0) {
      return res.status(400).json({ success: false, message: 'Role is assigned to users and cannot be deleted' });
    }

    await query(`DELETE FROM roles WHERE id = $1`, [id]);
    await audit({ userId: req.user.id, action: 'ROLE_DELETED', entityType: 'role', entityId: id, ipAddress: req.ip });
    res.json({ success: true, message: 'Role deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getPermissions = async (req, res) => {
  try {
    const result = await query(`SELECT * FROM permissions ORDER BY module, action`);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
