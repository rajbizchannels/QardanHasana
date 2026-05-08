const { query } = require('../config/database');

exports.getLedger = async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 50, startDate, endDate } = req.query;
    const offset = (page - 1) * limit;
    const isAdmin = req.user.roles.some(r => ['admin', 'accountant'].includes(r));

    if (!isAdmin && req.user.id !== userId) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    let conditions = [`le.user_id = $1`];
    const params = [userId];

    if (startDate) { params.push(startDate); conditions.push(`le.entry_date >= $${params.length}`); }
    if (endDate) { params.push(endDate); conditions.push(`le.entry_date <= $${params.length}`); }

    const whereClause = conditions.join(' AND ');

    const countRes = await query(`SELECT COUNT(*) FROM ledger_entries le WHERE ${whereClause}`, params);

    const balRes = await query(
      `SELECT COALESCE(SUM(CASE WHEN entry_type='credit' THEN amount ELSE -amount END), 0) as current_balance
       FROM ledger_entries WHERE user_id = $1`,
      [userId]
    );

    params.push(limit, offset);
    const entriesRes = await query(
      `SELECT le.*,
              t.transaction_number, t.type as transaction_type,
              l.loan_number,
              u.first_name || ' ' || u.last_name as created_by_name
       FROM ledger_entries le
       LEFT JOIN transactions t ON le.transaction_id = t.id
       LEFT JOIN loans l ON le.loan_id = l.id
       LEFT JOIN users u ON le.created_by = u.id
       WHERE ${whereClause}
       ORDER BY le.entry_date DESC, le.created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    res.json({
      success: true,
      data: {
        entries: entriesRes.rows,
        currentBalance: parseFloat(balRes.rows[0].current_balance),
        total: parseInt(countRes.rows[0].count),
        page: parseInt(page),
        totalPages: Math.ceil(parseInt(countRes.rows[0].count) / limit),
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getAllLedgers = async (req, res) => {
  try {
    const { page = 1, limit = 20, role } = req.query;
    const offset = (page - 1) * limit;

    const conditions = ['u.is_active = TRUE', '(cp.id IS NOT NULL OR dp.id IS NOT NULL)'];
    const params = [];

    if (role === 'creditor') { conditions.push('cp.id IS NOT NULL'); }
    if (role === 'debtor')   { conditions.push('dp.id IS NOT NULL'); }

    const where = conditions.join(' AND ');

    const countRes = await query(
      `SELECT COUNT(DISTINCT u.id)
       FROM users u
       LEFT JOIN creditor_profiles cp ON u.id = cp.user_id
       LEFT JOIN debtor_profiles dp ON u.id = dp.user_id
       WHERE ${where}`,
      params
    );

    params.push(limit, offset);
    const result = await query(
      `SELECT u.id, u.its_number,
              u.first_name || ' ' || u.last_name as name,
              u.email,
              COALESCE(SUM(CASE WHEN le.entry_type='credit' THEN le.amount ELSE -le.amount END), 0) as balance,
              COUNT(le.id) as entry_count,
              MAX(le.entry_date) as last_activity,
              cp.id as creditor_profile_id, cp.creditor_number,
              dp.id as debtor_profile_id,   dp.debtor_number,
              CASE
                WHEN cp.id IS NOT NULL AND dp.id IS NOT NULL THEN 'both'
                WHEN cp.id IS NOT NULL THEN 'creditor'
                ELSE 'debtor'
              END as profile_type
       FROM users u
       LEFT JOIN ledger_entries le ON u.id = le.user_id
       LEFT JOIN creditor_profiles cp ON u.id = cp.user_id
       LEFT JOIN debtor_profiles dp ON u.id = dp.user_id
       WHERE ${where}
       GROUP BY u.id, cp.id, cp.creditor_number, dp.id, dp.debtor_number
       ORDER BY u.first_name, u.last_name
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    res.json({
      success: true,
      data: {
        accounts: result.rows,
        total: parseInt(countRes.rows[0].count),
        page: parseInt(page),
        totalPages: Math.ceil(parseInt(countRes.rows[0].count) / limit),
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
