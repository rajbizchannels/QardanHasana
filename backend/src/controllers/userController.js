const bcrypt = require('bcryptjs');
const { query } = require('../config/database');
const { sendEmail } = require('../utils/email');
const audit = require('../utils/audit');

const safeUser = (u) => {
  const { password_hash, password_reset_token, two_factor_secret, email_verification_token, ...rest } = u;
  return rest;
};

exports.getUsers = async (req, res) => {
  try {
    const { page = 1, limit = 20, search, role, isActive } = req.query;
    const offset = (page - 1) * limit;
    let conditions = ['1=1'];
    const params = [];

    if (search) {
      params.push(`%${search}%`);
      conditions.push(`(u.first_name ILIKE $${params.length} OR u.last_name ILIKE $${params.length} OR u.email ILIKE $${params.length} OR u.its_number ILIKE $${params.length})`);
    }
    if (isActive !== undefined) {
      params.push(isActive === 'true');
      conditions.push(`u.is_active = $${params.length}`);
    }

    const whereClause = conditions.join(' AND ');

    const countRes = await query(
      `SELECT COUNT(DISTINCT u.id) FROM users u WHERE ${whereClause}`,
      params
    );

    params.push(limit, offset);
    const usersRes = await query(
      `SELECT u.id, u.its_number, u.email, u.first_name, u.last_name, u.phone,
              u.is_active, u.last_login, u.created_at,
              array_agg(DISTINCT r.display_name) FILTER (WHERE r.display_name IS NOT NULL) as roles
       FROM users u
       LEFT JOIN user_roles ur ON u.id = ur.user_id
       LEFT JOIN roles r ON ur.role_id = r.id AND r.is_active = TRUE
       WHERE ${whereClause}
       GROUP BY u.id
       ORDER BY u.created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    res.json({
      success: true,
      data: {
        users: usersRes.rows,
        total: parseInt(countRes.rows[0].count),
        page: parseInt(page),
        totalPages: Math.ceil(parseInt(countRes.rows[0].count) / limit),
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getUser = async (req, res) => {
  try {
    const { id } = req.params;
    const isOwnProfile = req.user.id === id;
    const isAdminOrAccountant = req.user.roles.some(r => ['admin', 'accountant'].includes(r));

    if (!isOwnProfile && !isAdminOrAccountant) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const result = await query(
      `SELECT u.*,
              array_agg(DISTINCT r.name) as role_names,
              array_agg(DISTINCT r.display_name) as role_display_names,
              array_agg(DISTINCT p.name) as permission_names,
              cp.id as creditor_id, cp.creditor_number, cp.status as creditor_status,
              cp.total_given, cp.total_recovered, cp.outstanding_amount as creditor_outstanding,
              dp.id as debtor_id, dp.debtor_number, dp.status as debtor_status,
              dp.total_borrowed, dp.total_repaid, dp.outstanding_balance,
              gp.id as guarantor_id, gp.guarantor_number, gp.status as guarantor_status,
              gp.total_guaranteed, gp.active_guarantees
       FROM users u
       LEFT JOIN user_roles ur ON u.id = ur.user_id
       LEFT JOIN roles r ON ur.role_id = r.id AND r.is_active = TRUE
       LEFT JOIN role_permissions rp ON r.id = rp.role_id
       LEFT JOIN permissions p ON rp.permission_id = p.id
       LEFT JOIN creditor_profiles cp ON u.id = cp.user_id
       LEFT JOIN debtor_profiles dp ON u.id = dp.user_id
       LEFT JOIN guarantor_profiles gp ON u.id = gp.user_id
       WHERE u.id = $1
       GROUP BY u.id, cp.id, dp.id, gp.id`,
      [id]
    );

    if (!result.rows[0]) return res.status(404).json({ success: false, message: 'User not found' });

    res.json({ success: true, data: safeUser(result.rows[0]) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.createUser = async (req, res) => {
  try {
    const {
      itsNumber, email, password, firstName, lastName, phone,
      dateOfBirth, gender, roles: userRoles = ['member'],
    } = req.body;

    const existing = await query(
      `SELECT id FROM users WHERE its_number = $1 OR email = $2`,
      [itsNumber, email]
    );
    if (existing.rows[0]) {
      return res.status(409).json({ success: false, message: 'ITS number or email already exists' });
    }

    const passwordHash = await bcrypt.hash(password || itsNumber, 12);

    const userRes = await query(
      `INSERT INTO users (its_number, email, password_hash, first_name, last_name, phone, date_of_birth, gender)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [itsNumber, email, passwordHash, firstName, lastName, phone || null, dateOfBirth || null, gender || null]
    );

    const newUser = userRes.rows[0];

    for (const roleName of userRoles) {
      const roleRes = await query(`SELECT id FROM roles WHERE name = $1`, [roleName]);
      if (roleRes.rows[0]) {
        await query(
          `INSERT INTO user_roles (user_id, role_id, assigned_by) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
          [newUser.id, roleRes.rows[0].id, req.user?.id || null]
        );
      }
    }

    await sendEmail({
      to: email,
      templateName: 'welcome',
      data: { name: `${firstName} ${lastName}`, itsNumber, email },
    });

    await audit({
      userId: req.user?.id, action: 'USER_CREATED', entityType: 'user',
      entityId: newUser.id, newValues: { itsNumber, email, firstName, lastName },
      ipAddress: req.ip,
    });

    res.status(201).json({ success: true, data: safeUser(newUser), message: 'User created successfully' });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ success: false, message: 'ITS number or email already exists' });
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const isOwnProfile = req.user.id === id;
    const isAdmin = req.user.roles.includes('admin');

    const currentRes = await query(`SELECT * FROM users WHERE id = $1`, [id]);
    const current = currentRes.rows[0];
    if (!current) return res.status(404).json({ success: false, message: 'User not found' });

    const {
      itsNumber, firstName, lastName, phone, dateOfBirth, gender,
      addressLine1, addressLine2, city, state, country, postalCode,
      involvedInInterest, involvedInInsurance, involvedInSubstanceAbuse,
      involvedInCrypto, involvedInPonzi, involvedInOtherSchemes, otherSchemesDescription,
      isActive,
    } = req.body;

    // Check ITS uniqueness if being changed
    if (itsNumber && itsNumber !== current.its_number) {
      const itsCheck = await query(`SELECT id FROM users WHERE its_number = $1 AND id != $2`, [itsNumber, id]);
      if (itsCheck.rows[0]) return res.status(409).json({ success: false, message: 'ITS number already in use' });
    }

    if (isOwnProfile && !isAdmin) {
      const changes = {
        itsNumber, firstName, lastName, phone, dateOfBirth, gender,
        addressLine1, addressLine2, city, state, country, postalCode,
        involvedInInterest, involvedInInsurance, involvedInSubstanceAbuse,
        involvedInCrypto, involvedInPonzi, involvedInOtherSchemes, otherSchemesDescription,
      };

      await query(
        `UPDATE users SET profile_changes_pending = $1, updated_at = NOW() WHERE id = $2`,
        [JSON.stringify(changes), id]
      );

      const approvalRes = await query(
        `INSERT INTO approvals (reference_type, reference_id, title, description, requested_by, priority, metadata)
         VALUES ('user_profile', $1, $2, $3, $4, 'normal', $5) RETURNING id`,
        [id, `Profile Update Request - ${current.first_name} ${current.last_name}`,
         `User ${current.its_number} has requested profile changes`, id,
         JSON.stringify(changes)]
      );

      const admins = await query(`SELECT u.email, u.first_name FROM users u JOIN user_roles ur ON u.id = ur.user_id JOIN roles r ON ur.role_id = r.id WHERE r.name IN ('admin', 'accountant')`);
      for (const admin of admins.rows) {
        await sendEmail({
          to: admin.email,
          templateName: 'approvalRequired',
          data: {
            title: `Profile Update Request - ${current.first_name} ${current.last_name}`,
            description: `User ${current.its_number} has requested profile changes`,
            requestedBy: `${current.first_name} ${current.last_name}`,
            approvalLink: `${process.env.FRONTEND_URL}/approvals/${approvalRes.rows[0].id}`,
          },
        });
      }

      return res.json({ success: true, message: 'Profile update submitted for approval' });
    }

    const updated = await query(
      `UPDATE users SET
        its_number = COALESCE($1, its_number),
        first_name = COALESCE($2, first_name),
        last_name = COALESCE($3, last_name),
        phone = COALESCE($4, phone),
        date_of_birth = COALESCE($5, date_of_birth),
        gender = COALESCE($6, gender),
        address_line1 = COALESCE($7, address_line1),
        address_line2 = COALESCE($8, address_line2),
        city = COALESCE($9, city),
        state = COALESCE($10, state),
        country = COALESCE($11, country),
        postal_code = COALESCE($12, postal_code),
        involved_in_interest = COALESCE($13, involved_in_interest),
        involved_in_insurance = COALESCE($14, involved_in_insurance),
        involved_in_substance_abuse = COALESCE($15, involved_in_substance_abuse),
        involved_in_crypto = COALESCE($16, involved_in_crypto),
        involved_in_ponzi = COALESCE($17, involved_in_ponzi),
        involved_in_other_schemes = COALESCE($18, involved_in_other_schemes),
        other_schemes_description = COALESCE($19, other_schemes_description),
        is_active = COALESCE($20, is_active),
        profile_changes_pending = NULL,
        profile_change_approved_at = NOW(),
        profile_change_approved_by = $21,
        updated_at = NOW()
       WHERE id = $22 RETURNING *`,
      [itsNumber || null, firstName, lastName, phone, dateOfBirth || null, gender,
       addressLine1, addressLine2, city, state, country, postalCode,
       involvedInInterest, involvedInInsurance, involvedInSubstanceAbuse,
       involvedInCrypto, involvedInPonzi, involvedInOtherSchemes, otherSchemesDescription,
       isActive, req.user.id, id]
    );

    await audit({
      userId: req.user.id, action: 'USER_UPDATED', entityType: 'user',
      entityId: id, oldValues: safeUser(current), newValues: req.body, ipAddress: req.ip,
    });

    res.json({ success: true, data: safeUser(updated.rows[0]) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    const isAdmin = req.user.roles.includes('admin');

    const userRes = await query(`SELECT * FROM users WHERE id = $1`, [id]);
    if (!userRes.rows[0]) return res.status(404).json({ success: false, message: 'User not found' });

    if (!isAdmin) {
      await query(
        `INSERT INTO approvals (reference_type, reference_id, title, description, requested_by, priority)
         VALUES ('account_deletion', $1, $2, $3, $4, 'high')`,
        [id, `Account Deletion Request`, `User deletion requested for ${userRes.rows[0].its_number}`, req.user.id]
      );
      return res.json({ success: true, message: 'Account deletion submitted for approval' });
    }

    await query(`UPDATE users SET is_active = FALSE, updated_at = NOW() WHERE id = $1`, [id]);
    await audit({ userId: req.user.id, action: 'USER_DELETED', entityType: 'user', entityId: id, ipAddress: req.ip });

    res.json({ success: true, message: 'User deactivated successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.assignRoles = async (req, res) => {
  try {
    const { id } = req.params;
    const { roles: newRoles } = req.body;

    await query(`DELETE FROM user_roles WHERE user_id = $1`, [id]);

    for (const roleName of newRoles) {
      const roleRes = await query(`SELECT id FROM roles WHERE name = $1`, [roleName]);
      if (roleRes.rows[0]) {
        await query(
          `INSERT INTO user_roles (user_id, role_id, assigned_by) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
          [id, roleRes.rows[0].id, req.user.id]
        );
      }
    }

    await audit({
      userId: req.user.id, action: 'ROLES_ASSIGNED', entityType: 'user',
      entityId: id, newValues: { roles: newRoles }, ipAddress: req.ip,
    });

    res.json({ success: true, message: 'Roles assigned successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    const result = await query(`SELECT * FROM users WHERE id = $1`, [req.user.id]);
    const user = result.rows[0];

    const valid = await bcrypt.compare(currentPassword, user.password_hash);
    if (!valid) return res.status(400).json({ success: false, message: 'Current password is incorrect' });

    const hash = await bcrypt.hash(newPassword, 12);
    await query(`UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2`, [hash, req.user.id]);

    await query(`UPDATE refresh_tokens SET is_revoked = TRUE WHERE user_id = $1`, [req.user.id]);
    await audit({ userId: req.user.id, action: 'PASSWORD_CHANGED', ipAddress: req.ip });

    res.json({ success: true, message: 'Password changed successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
