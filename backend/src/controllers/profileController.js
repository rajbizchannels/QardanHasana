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

// CREDITOR DEPOSITS
exports.createDeposit = async (req, res) => {
  try {
    const { creditorId } = req.params;
    const { amount, depositDate, maturityDate, notes } = req.body;

    if (!amount || !maturityDate) {
      return res.status(400).json({ success: false, message: 'Amount and maturity date are required' });
    }

    const creditor = await query(`SELECT id FROM creditor_profiles WHERE id = $1`, [creditorId]);
    if (!creditor.rows[0]) return res.status(404).json({ success: false, message: 'Creditor profile not found' });

    const result = await query(
      `INSERT INTO creditor_deposits (creditor_id, amount, deposit_date, maturity_date, notes, created_by)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [creditorId, amount, depositDate || new Date().toISOString().split('T')[0], maturityDate, notes || null, req.user.id]
    );

    await audit({ userId: req.user.id, action: 'CREDITOR_DEPOSIT_CREATED', entityType: 'creditor_deposit', entityId: result.rows[0].id, ipAddress: req.ip });
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getDeposits = async (req, res) => {
  try {
    const { creditorId } = req.params;

    const result = await query(
      `SELECT cd.*,
              u.first_name || ' ' || u.last_name as created_by_name,
              cd.maturity_date - CURRENT_DATE as days_until_maturity
       FROM creditor_deposits cd
       LEFT JOIN users u ON cd.created_by = u.id
       WHERE cd.creditor_id = $1
       ORDER BY cd.deposit_date DESC`,
      [creditorId]
    );

    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateDeposit = async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, depositDate, maturityDate, status, notes } = req.body;

    const result = await query(
      `UPDATE creditor_deposits SET
        amount = COALESCE($1, amount),
        deposit_date = COALESCE($2, deposit_date),
        maturity_date = COALESCE($3, maturity_date),
        status = COALESCE($4, status),
        notes = COALESCE($5, notes),
        updated_at = NOW()
       WHERE id = $6 RETURNING *`,
      [amount, depositDate || null, maturityDate || null, status, notes, id]
    );

    if (!result.rows[0]) return res.status(404).json({ success: false, message: 'Deposit not found' });
    await audit({ userId: req.user.id, action: 'CREDITOR_DEPOSIT_UPDATED', entityType: 'creditor_deposit', entityId: id, ipAddress: req.ip });
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.deleteDeposit = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query(`DELETE FROM creditor_deposits WHERE id = $1 RETURNING id`, [id]);
    if (!result.rows[0]) return res.status(404).json({ success: false, message: 'Deposit not found' });

    await audit({ userId: req.user.id, action: 'CREDITOR_DEPOSIT_DELETED', entityType: 'creditor_deposit', entityId: id, ipAddress: req.ip });
    res.json({ success: true });
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
        `SELECT cp.*, u.first_name || ' ' || u.last_name as name, u.its_number, u.email, u.phone,
                (SELECT COUNT(*) FROM creditor_deposits cd WHERE cd.creditor_id = cp.id AND cd.status = 'active') as active_deposit_count,
                (SELECT MIN(cd.maturity_date) FROM creditor_deposits cd WHERE cd.creditor_id = cp.id AND cd.status = 'active' AND cd.maturity_date >= CURRENT_DATE) as next_maturity_date,
                (SELECT COUNT(*) FROM creditor_deposits cd WHERE cd.creditor_id = cp.id AND cd.status = 'active' AND cd.maturity_date < CURRENT_DATE) as overdue_deposits
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

exports.getMaturityAlerts = async (req, res) => {
  try {
    const result = await query(
      `SELECT cd.*,
              cp.creditor_number,
              cp.outstanding_amount,
              u.first_name || ' ' || u.last_name as creditor_name,
              u.its_number, u.email, u.phone,
              u.id as user_id,
              cd.maturity_date - CURRENT_DATE as days_until_maturity
       FROM creditor_deposits cd
       JOIN creditor_profiles cp ON cd.creditor_id = cp.id
       JOIN users u ON cp.user_id = u.id
       WHERE cd.status = 'active'
         AND cd.maturity_date <= CURRENT_DATE + INTERVAL '30 days'
       ORDER BY cd.maturity_date ASC`
    );

    // Auto-create deduplicated in-app notifications for admins/accountants
    if (result.rows.length > 0) {
      const staffRes = await query(
        `SELECT DISTINCT u.id FROM users u
         JOIN user_roles ur ON u.id = ur.user_id
         JOIN roles r ON ur.role_id = r.id
         WHERE r.name IN ('admin', 'accountant') AND u.is_active = TRUE`
      );
      for (const deposit of result.rows) {
        const days = parseInt(deposit.days_until_maturity);
        let notifType = 'info';
        let title, message;
        if (days < 0) {
          notifType = 'error';
          title = `Deposit Repayment Overdue: ${deposit.creditor_name}`;
          message = `${deposit.creditor_name} (${deposit.creditor_number}) deposit of ${deposit.amount} matured ${Math.abs(days)} day(s) ago.`;
        } else if (days === 0) {
          notifType = 'warning';
          title = `Deposit Due Today: ${deposit.creditor_name}`;
          message = `${deposit.creditor_name} (${deposit.creditor_number}) deposit of ${deposit.amount} matures today.`;
        } else if (days <= 7) {
          notifType = 'warning';
          title = `Deposit Due in ${days} Day(s): ${deposit.creditor_name}`;
          message = `${deposit.creditor_name} (${deposit.creditor_number}) deposit of ${deposit.amount} matures on ${deposit.maturity_date}.`;
        } else {
          notifType = 'info';
          title = `Deposit Due in ${days} Days: ${deposit.creditor_name}`;
          message = `${deposit.creditor_name} (${deposit.creditor_number}) deposit of ${deposit.amount} matures on ${deposit.maturity_date}.`;
        }
        for (const staff of staffRes.rows) {
          const existing = await query(
            `SELECT id FROM notifications
             WHERE user_id = $1 AND reference_type = 'creditor_maturity'
               AND reference_id = $2 AND created_at >= CURRENT_DATE`,
            [staff.id, deposit.id]
          );
          if (!existing.rows[0]) {
            await query(
              `INSERT INTO notifications (user_id, title, message, type, category, reference_type, reference_id)
               VALUES ($1, $2, $3, $4, 'creditor_maturity', 'creditor_maturity', $5)`,
              [staff.id, title, message, notifType, deposit.id]
            );
          }
        }
      }
    }

    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
