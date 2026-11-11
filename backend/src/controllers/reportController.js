const { query } = require('../config/database');

const getCurrency = async () => {
  const r = await query(`SELECT value FROM settings WHERE key = 'currency'`);
  return r.rows[0]?.value || 'INR';
};

exports.getMonthlyReport = async (req, res) => {
  try {
    const currency = await getCurrency();
    const now = new Date();
    const year = parseInt(req.query.year) || now.getFullYear();
    const month = parseInt(req.query.month) || now.getMonth() + 1;
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = new Date(year, month, 0).toISOString().split('T')[0];

    const [
      loanPortfolio,
      disbursementsThisMonth,
      repaymentsThisMonth,
      newApplications,
      depositsThisMonth,
      overdueAccounts,
      creditorDeposits,
    ] = await Promise.all([
      query(`SELECT
        COUNT(*) FILTER (WHERE status = 'active') AS active_loans,
        COUNT(*) FILTER (WHERE status = 'completed') AS completed_loans,
        COUNT(*) FILTER (WHERE status IN ('pending','under_review')) AS pending_loans,
        COALESCE(SUM(principal_amount) FILTER (WHERE status NOT IN ('rejected','cancelled')), 0) AS total_disbursed,
        COALESCE(SUM(outstanding_balance) FILTER (WHERE status = 'active'), 0) AS total_outstanding,
        COALESCE(SUM(outstanding_balance) FILTER (WHERE is_overdue = TRUE AND status = 'active'), 0) AS overdue_amount,
        COUNT(*) FILTER (WHERE is_overdue = TRUE AND status = 'active') AS overdue_count
        FROM loans`),
      query(`SELECT COALESCE(SUM(amount), 0) AS total, COUNT(*) AS count
        FROM transactions
        WHERE type = 'loan_disbursement' AND status = 'completed'
          AND transaction_date BETWEEN $1 AND $2`, [startDate, endDate]),
      query(`SELECT COALESCE(SUM(amount), 0) AS total, COUNT(*) AS count
        FROM transactions
        WHERE type = 'loan_repayment' AND status = 'completed'
          AND transaction_date BETWEEN $1 AND $2`, [startDate, endDate]),
      query(`SELECT COUNT(*) AS count, COALESCE(SUM(principal_amount), 0) AS total
        FROM loans WHERE created_at::date BETWEEN $1 AND $2`, [startDate, endDate]),
      query(`SELECT COALESCE(SUM(amount), 0) AS total, COUNT(*) AS count
        FROM transactions
        WHERE type = 'deposit' AND status = 'completed'
          AND transaction_date BETWEEN $1 AND $2`, [startDate, endDate]),
      query(`SELECT l.loan_number, l.outstanding_balance, l.next_due_date, l.monthly_installment,
              u.first_name || ' ' || u.last_name AS debtor_name, u.its_number, u.phone
        FROM loans l
        JOIN debtor_profiles dp ON l.debtor_id = dp.id
        JOIN users u ON dp.user_id = u.id
        WHERE l.is_overdue = TRUE AND l.status = 'active'
        ORDER BY l.next_due_date`),
      query(`SELECT COALESCE(SUM(cd.amount), 0) AS total_deposits,
              COALESCE(SUM(cd.amount) FILTER (WHERE cd.maturity_date <= CURRENT_DATE AND cd.status = 'active'), 0) AS matured,
              COUNT(*) FILTER (WHERE cd.status = 'active') AS active_deposits
        FROM creditor_deposits cd`),
    ]);

    const p = loanPortfolio.rows[0];
    const recoveryRate = parseFloat(p.total_disbursed) > 0
      ? (((parseFloat(p.total_disbursed) - parseFloat(p.total_outstanding)) / parseFloat(p.total_disbursed)) * 100).toFixed(1)
      : 0;

    res.json({
      success: true,
      data: {
        currency,
        period: { year, month, startDate, endDate },
        summary: {
          activeLoans: parseInt(p.active_loans),
          completedLoans: parseInt(p.completed_loans),
          pendingLoans: parseInt(p.pending_loans),
          totalDisbursed: parseFloat(p.total_disbursed),
          totalOutstanding: parseFloat(p.total_outstanding),
          overdueAmount: parseFloat(p.overdue_amount),
          overdueCount: parseInt(p.overdue_count),
          recoveryRate: parseFloat(recoveryRate),
        },
        monthActivity: {
          disbursements: { total: parseFloat(disbursementsThisMonth.rows[0].total), count: parseInt(disbursementsThisMonth.rows[0].count) },
          repayments: { total: parseFloat(repaymentsThisMonth.rows[0].total), count: parseInt(repaymentsThisMonth.rows[0].count) },
          newApplications: { count: parseInt(newApplications.rows[0].count), total: parseFloat(newApplications.rows[0].total) },
          deposits: { total: parseFloat(depositsThisMonth.rows[0].total), count: parseInt(depositsThisMonth.rows[0].count) },
        },
        overdueAccounts: overdueAccounts.rows,
        creditorDeposits: creditorDeposits.rows[0],
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getTransactionReport = async (req, res) => {
  try {
    const currency = await getCurrency();
    const { startDate, endDate, type, userId, page = 1, limit = 100 } = req.query;
    const offset = (page - 1) * limit;

    const conditions = ['t.status = $1'];
    const params = ['completed'];

    if (startDate) { params.push(startDate); conditions.push(`t.transaction_date >= $${params.length}`); }
    if (endDate) { params.push(endDate); conditions.push(`t.transaction_date <= $${params.length}`); }
    if (type) { params.push(type); conditions.push(`t.type = $${params.length}`); }
    if (userId) { params.push(userId); conditions.push(`(t.from_account_id = $${params.length} OR t.to_account_id = $${params.length - 1})`); }

    const where = conditions.join(' AND ');

    const countRes = await query(`SELECT COUNT(*) FROM transactions t WHERE ${where}`, params);
    const totalAmount = await query(`SELECT COALESCE(SUM(amount), 0) AS total FROM transactions t WHERE ${where}`, params);

    const breakdown = await query(`SELECT t.type, COUNT(*) AS count, COALESCE(SUM(t.amount), 0) AS total
      FROM transactions t WHERE ${where}
      GROUP BY t.type ORDER BY total DESC`, params);

    params.push(limit, offset);
    const txns = await query(
      `SELECT t.transaction_number, t.type, t.amount, t.transaction_date, t.description,
              l.loan_number,
              fu.first_name || ' ' || fu.last_name AS from_name, fu.its_number AS from_its,
              tu.first_name || ' ' || tu.last_name AS to_name, tu.its_number AS to_its
       FROM transactions t
       LEFT JOIN loans l ON t.loan_id = l.id
       LEFT JOIN users fu ON t.from_account_id = fu.id
       LEFT JOIN users tu ON t.to_account_id = tu.id
       WHERE ${where}
       ORDER BY t.transaction_date DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    res.json({
      success: true,
      data: {
        currency,
        total: parseInt(countRes.rows[0].count),
        totalAmount: parseFloat(totalAmount.rows[0].total),
        page: parseInt(page),
        totalPages: Math.ceil(parseInt(countRes.rows[0].count) / limit),
        breakdown: breakdown.rows,
        transactions: txns.rows,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getLedgerStatement = async (req, res) => {
  try {
    const currency = await getCurrency();
    const { userId, startDate, endDate, page = 1, limit = 200 } = req.query;
    if (!userId) return res.status(400).json({ success: false, message: 'userId required' });
    const offset = (page - 1) * limit;

    const userRes = await query(
      `SELECT u.first_name || ' ' || u.last_name AS name, u.its_number, u.email, u.phone,
              cp.creditor_number, dp.debtor_number, cp.total_given, cp.outstanding_amount,
              dp.total_borrowed, dp.outstanding_balance
       FROM users u
       LEFT JOIN creditor_profiles cp ON cp.user_id = u.id
       LEFT JOIN debtor_profiles dp ON dp.user_id = u.id
       WHERE u.id = $1`, [userId]
    );

    const conditions = ['le.user_id = $1'];
    const params = [userId];
    if (startDate) { params.push(startDate); conditions.push(`le.entry_date >= $${params.length}`); }
    if (endDate) { params.push(endDate); conditions.push(`le.entry_date <= $${params.length}`); }
    const where = conditions.join(' AND ');

    const totals = await query(
      `SELECT COALESCE(SUM(amount) FILTER (WHERE entry_type = 'credit'), 0) AS total_credits,
              COALESCE(SUM(amount) FILTER (WHERE entry_type = 'debit'), 0) AS total_debits
       FROM ledger_entries le WHERE ${where}`, params
    );

    const countRes = await query(`SELECT COUNT(*) FROM ledger_entries le WHERE ${where}`, params);
    params.push(limit, offset);
    const entries = await query(
      `SELECT le.entry_date, le.description, le.reference, le.entry_type, le.amount, le.balance_after,
              t.transaction_number, l.loan_number
       FROM ledger_entries le
       LEFT JOIN transactions t ON le.transaction_id = t.id
       LEFT JOIN loans l ON t.loan_id = l.id
       WHERE ${where}
       ORDER BY le.entry_date ASC, le.created_at ASC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    res.json({
      success: true,
      data: {
        currency,
        user: userRes.rows[0] || {},
        totalCredits: parseFloat(totals.rows[0].total_credits),
        totalDebits: parseFloat(totals.rows[0].total_debits),
        netBalance: parseFloat(totals.rows[0].total_credits) - parseFloat(totals.rows[0].total_debits),
        total: parseInt(countRes.rows[0].count),
        page: parseInt(page),
        entries: entries.rows,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getForecastReport = async (req, res) => {
  try {
    const currency = await getCurrency();
    const months = Math.min(parseInt(req.query.months) || 6, 24);

    const forecasts = [];
    for (let m = 0; m < months; m++) {
      const d = new Date();
      d.setDate(1);
      d.setMonth(d.getMonth() + m);
      const yr = d.getFullYear();
      const mo = d.getMonth() + 1;
      const start = `${yr}-${String(mo).padStart(2, '0')}-01`;
      const end = new Date(yr, mo, 0).toISOString().split('T')[0];

      const res = await query(
        `SELECT COUNT(*) AS loan_count, COALESCE(SUM(monthly_installment), 0) AS expected_total
         FROM loans WHERE status = 'active' AND next_due_date BETWEEN $1 AND $2`,
        [start, end]
      );
      forecasts.push({
        year: yr,
        month: mo,
        label: new Date(yr, mo - 1, 1).toLocaleString('default', { month: 'long', year: 'numeric' }),
        loanCount: parseInt(res.rows[0].loan_count),
        expectedTotal: parseFloat(res.rows[0].expected_total),
      });
    }

    const upcoming = await query(
      `SELECT l.loan_number, l.monthly_installment, l.next_due_date, l.outstanding_balance, l.is_overdue,
              u.first_name || ' ' || u.last_name AS debtor_name, u.its_number, u.phone, u.email
       FROM loans l
       JOIN debtor_profiles dp ON l.debtor_id = dp.id
       JOIN users u ON dp.user_id = u.id
       WHERE l.status = 'active'
         AND l.next_due_date <= CURRENT_DATE + ($1 * INTERVAL '1 month')
       ORDER BY l.next_due_date, l.is_overdue DESC`,
      [months]
    );

    res.json({
      success: true,
      data: {
        currency,
        months,
        monthlyForecasts: forecasts,
        upcomingInstallments: upcoming.rows,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getUsersForSelect = async (req, res) => {
  try {
    const role = req.query.role;
    let sql = `SELECT u.id, u.first_name || ' ' || u.last_name AS name, u.its_number,
                      cp.creditor_number, dp.debtor_number
               FROM users u
               LEFT JOIN creditor_profiles cp ON cp.user_id = u.id
               LEFT JOIN debtor_profiles dp ON dp.user_id = u.id
               WHERE u.is_active = TRUE AND (cp.id IS NOT NULL OR dp.id IS NOT NULL)`;
    if (role === 'creditor') sql += ' AND cp.id IS NOT NULL';
    if (role === 'debtor') sql += ' AND dp.id IS NOT NULL';
    sql += ' ORDER BY u.first_name, u.last_name';
    const r = await query(sql);
    res.json({ success: true, data: r.rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getCashStatus = async (req, res) => {
  try {
    const currRes = await query(`SELECT value FROM settings WHERE key = 'currency'`);
    const currency = currRes.rows[0]?.value || 'INR';

    const [totalLoans, totalRepaid, overdueLoans, activeLoans] = await Promise.all([
      query(`SELECT COALESCE(SUM(principal_amount), 0) as total FROM loans WHERE status NOT IN ('rejected', 'cancelled')`),
      query(`SELECT COALESCE(SUM(principal_amount - outstanding_balance), 0) as total FROM loans WHERE status IN ('active', 'completed')`),
      query(`SELECT COALESCE(SUM(outstanding_balance), 0) as total, COUNT(*) as count FROM loans WHERE is_overdue = TRUE AND status = 'active'`),
      query(`SELECT COUNT(*) as count, COALESCE(SUM(outstanding_balance), 0) as total FROM loans WHERE status = 'active'`),
    ]);

    const collections = await query(
      `SELECT t.transaction_number, t.amount, t.currency, t.transaction_date,
              u.first_name || ' ' || u.last_name as payer_name, u.its_number,
              l.loan_number
       FROM transactions t
       LEFT JOIN users u ON t.from_account_id = u.id
       LEFT JOIN loans l ON t.loan_id = l.id
       WHERE t.type = 'loan_repayment' AND t.status = 'completed'
         AND t.transaction_date >= NOW() - INTERVAL '30 days'
       ORDER BY t.transaction_date DESC
       LIMIT 20`
    );

    const dueThisCycle = await query(
      `SELECT l.loan_number, l.monthly_installment, l.next_due_date, l.outstanding_balance,
              u.first_name || ' ' || u.last_name as debtor_name, u.its_number, u.email, u.phone
       FROM loans l
       JOIN debtor_profiles dp ON l.debtor_id = dp.id
       JOIN users u ON dp.user_id = u.id
       WHERE l.status = 'active'
         AND l.next_due_date >= CURRENT_DATE
         AND l.next_due_date <= CURRENT_DATE + INTERVAL '30 days'
       ORDER BY l.next_due_date`
    );

    const overdueDetails = await query(
      `SELECT l.loan_number, l.monthly_installment, l.next_due_date, l.outstanding_balance,
              dp.overdue_amount, u.first_name || ' ' || u.last_name as debtor_name,
              u.its_number, u.email, u.phone
       FROM loans l
       JOIN debtor_profiles dp ON l.debtor_id = dp.id
       JOIN users u ON dp.user_id = u.id
       WHERE l.is_overdue = TRUE AND l.status = 'active'
       ORDER BY l.next_due_date`
    );

    const creditorSummary = await query(
      `SELECT u.first_name || ' ' || u.last_name as name, u.its_number,
              cp.total_given, cp.total_recovered, cp.outstanding_amount,
              cp.creditor_number
       FROM creditor_profiles cp
       JOIN users u ON cp.user_id = u.id
       WHERE cp.is_active = TRUE
       ORDER BY cp.outstanding_amount DESC`
    );

    res.json({
      success: true,
      data: {
        currency,
        summary: {
          totalDisbursed: parseFloat(totalLoans.rows[0].total),
          totalRepaid: parseFloat(totalRepaid.rows[0].total),
          totalOutstanding: parseFloat(activeLoans.rows[0].total),
          overdueAmount: parseFloat(overdueLoans.rows[0].total),
          overdueCount: parseInt(overdueLoans.rows[0].count),
          activeLoansCount: parseInt(activeLoans.rows[0].count),
        },
        recentCollections: collections.rows,
        dueThisCycle: dueThisCycle.rows,
        overdueAccounts: overdueDetails.rows,
        creditorSummary: creditorSummary.rows,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getAuditLogs = async (req, res) => {
  try {
    const { page = 1, limit = 50, userId, action, entityType, startDate, endDate } = req.query;
    const offset = (page - 1) * limit;

    let conditions = ['1=1'];
    const params = [];

    if (userId) { params.push(userId); conditions.push(`al.user_id = $${params.length}`); }
    if (action) { params.push(`%${action}%`); conditions.push(`al.action ILIKE $${params.length}`); }
    if (entityType) { params.push(entityType); conditions.push(`al.entity_type = $${params.length}`); }
    if (startDate) { params.push(startDate); conditions.push(`al.created_at >= $${params.length}`); }
    if (endDate) { params.push(endDate); conditions.push(`al.created_at <= $${params.length}`); }

    const whereClause = conditions.join(' AND ');

    const countRes = await query(`SELECT COUNT(*) FROM audit_logs al WHERE ${whereClause}`, params);

    params.push(limit, offset);
    const logsRes = await query(
      `SELECT al.*, u.first_name || ' ' || u.last_name as user_name, u.its_number
       FROM audit_logs al
       LEFT JOIN users u ON al.user_id = u.id
       WHERE ${whereClause}
       ORDER BY al.created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    res.json({
      success: true,
      data: {
        logs: logsRes.rows,
        total: parseInt(countRes.rows[0].count),
        page: parseInt(page),
        totalPages: Math.ceil(parseInt(countRes.rows[0].count) / limit),
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
