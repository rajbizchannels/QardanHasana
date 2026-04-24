const { query } = require('../config/database');

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
              l.overdue_amount, u.first_name || ' ' || u.last_name as debtor_name,
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
