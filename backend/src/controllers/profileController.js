const { query } = require('../config/database');
const audit = require('../utils/audit');

const generateNumber = (prefix) => `${prefix}${Date.now().toString().slice(-8)}`;

// CREDITOR PROFILES
exports.createCreditorProfile = async (req, res) => {
  try {
    const { userId, creditLimit, notes } = req.body;
    const targetUserId = userId || req.user.id;

    const existing = await query(`SELECT id FROM creditor_profiles WHERE user_id = $1`, [targetUserId]);
    if (existing.rows[0]) {
      return res.status(409).json({ success: false, message: 'Creditor profile already exists for this user' });
    }

    const result = await query(
      `INSERT INTO creditor_profiles (user_id, creditor_number, credit_limit, available_credit, notes, created_by)
       VALUES ($1, $2, $3, $3, $4, $5) RETURNING *`,
      [targetUserId, generateNumber('CR'), creditLimit || 0, notes || null, req.user.id]
    );

    await audit({ userId: req.user.id, action: 'CREDITOR_PROFILE_CREATED', entityType: 'creditor_profile', entityId: result.rows[0].id, ipAddress: req.ip });
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateCreditorProfile = async (req, res) => {
  try {
    const { id } = req.params;
    const { creditLimit, status, notes } = req.body;

    const result = await query(
      `UPDATE creditor_profiles SET
        credit_limit = COALESCE($1, credit_limit),
        status = COALESCE($2, status),
        notes = COALESCE($3, notes),
        updated_at = NOW()
       WHERE id = $4 RETURNING *`,
      [creditLimit, status, notes, id]
    );

    if (!result.rows[0]) return res.status(404).json({ success: false, message: 'Creditor profile not found' });
    await audit({ userId: req.user.id, action: 'CREDITOR_PROFILE_UPDATED', entityType: 'creditor_profile', entityId: id, ipAddress: req.ip });
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// DEBTOR PROFILES
exports.createDebtorProfile = async (req, res) => {
  try {
    const { userId, notes } = req.body;
    const targetUserId = userId || req.user.id;

    const existing = await query(`SELECT id FROM debtor_profiles WHERE user_id = $1`, [targetUserId]);
    if (existing.rows[0]) {
      return res.status(409).json({ success: false, message: 'Debtor profile already exists for this user' });
    }

    const result = await query(
      `INSERT INTO debtor_profiles (user_id, debtor_number, notes, created_by)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [targetUserId, generateNumber('DB'), notes || null, req.user.id]
    );

    await audit({ userId: req.user.id, action: 'DEBTOR_PROFILE_CREATED', entityType: 'debtor_profile', entityId: result.rows[0].id, ipAddress: req.ip });
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateDebtorProfile = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, notes, creditScore } = req.body;

    const result = await query(
      `UPDATE debtor_profiles SET
        status = COALESCE($1, status),
        notes = COALESCE($2, notes),
        credit_score = COALESCE($3, credit_score),
        updated_at = NOW()
       WHERE id = $4 RETURNING *`,
      [status, notes, creditScore, id]
    );

    if (!result.rows[0]) return res.status(404).json({ success: false, message: 'Debtor profile not found' });
    await audit({ userId: req.user.id, action: 'DEBTOR_PROFILE_UPDATED', entityType: 'debtor_profile', entityId: id, ipAddress: req.ip });
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GUARANTOR PROFILES
exports.createGuarantorProfile = async (req, res) => {
  try {
    const { userId, notes } = req.body;
    const targetUserId = userId || req.user.id;

    const existing = await query(`SELECT id FROM guarantor_profiles WHERE user_id = $1`, [targetUserId]);
    if (existing.rows[0]) {
      return res.status(409).json({ success: false, message: 'Guarantor profile already exists for this user' });
    }

    const result = await query(
      `INSERT INTO guarantor_profiles (user_id, guarantor_number, notes, created_by)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [targetUserId, generateNumber('GR'), notes || null, req.user.id]
    );

    await audit({ userId: req.user.id, action: 'GUARANTOR_PROFILE_CREATED', entityType: 'guarantor_profile', entityId: result.rows[0].id, ipAddress: req.ip });
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getProfiles = async (req, res) => {
  try {
    const { type, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    let data = {};

    if (!type || type === 'creditors') {
      const res1 = await query(
        `SELECT cp.*, u.first_name || ' ' || u.last_name as name, u.its_number, u.email, u.phone
         FROM creditor_profiles cp JOIN users u ON cp.user_id = u.id
         WHERE cp.is_active = TRUE ORDER BY cp.created_at DESC LIMIT $1 OFFSET $2`,
        [limit, offset]
      );
      data.creditors = res1.rows;
    }

    if (!type || type === 'debtors') {
      const res2 = await query(
        `SELECT dp.*, u.first_name || ' ' || u.last_name as name, u.its_number, u.email, u.phone
         FROM debtor_profiles dp JOIN users u ON dp.user_id = u.id
         WHERE dp.is_active = TRUE ORDER BY dp.created_at DESC LIMIT $1 OFFSET $2`,
        [limit, offset]
      );
      data.debtors = res2.rows;
    }

    if (!type || type === 'guarantors') {
      const res3 = await query(
        `SELECT gp.*, u.first_name || ' ' || u.last_name as name, u.its_number, u.email, u.phone
         FROM guarantor_profiles gp JOIN users u ON gp.user_id = u.id
         WHERE gp.is_active = TRUE ORDER BY gp.created_at DESC LIMIT $1 OFFSET $2`,
        [limit, offset]
      );
      data.guarantors = res3.rows;
    }

    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
