const { query, getClient } = require('../config/database');
const { sendEmail } = require('../utils/email');
const audit = require('../utils/audit');

const generateTxnNumber = () => `TXN${Date.now().toString().slice(-8)}`;

exports.getTransactions = async (req, res) => {
  try {
    const { page = 1, limit = 20, status, type, userId, startDate, endDate } = req.query;
    const offset = (page - 1) * limit;
    const isAdmin = req.user.roles.some(r => ['admin', 'accountant'].includes(r));

    let conditions = [`t.deleted_at IS NULL`];
    const params = [];

    if (!isAdmin) {
      params.push(req.user.id);
      conditions.push(`(t.from_account_id = $${params.length} OR t.to_account_id = $${params.length} OR t.created_by = $${params.length})`);
    }
    if (status) { params.push(status); conditions.push(`t.status = $${params.length}`); }
    if (type) { params.push(type); conditions.push(`t.type = $${params.length}`); }
    if (userId && isAdmin) { params.push(userId); conditions.push(`(t.from_account_id = $${params.length} OR t.to_account_id = $${params.length})`); }
    if (startDate) { params.push(startDate); conditions.push(`t.transaction_date >= $${params.length}`); }
    if (endDate) { params.push(endDate); conditions.push(`t.transaction_date <= $${params.length}`); }

    const whereClause = conditions.join(' AND ');

    const countRes = await query(`SELECT COUNT(*) FROM transactions t WHERE ${whereClause}`, params);

    params.push(limit, offset);
    const txnRes = await query(
      `SELECT t.*,
              fu.first_name || ' ' || fu.last_name as from_name,
              tu.first_name || ' ' || tu.last_name as to_name,
              cu.first_name || ' ' || cu.last_name as created_by_name,
              au.first_name || ' ' || au.last_name as approved_by_name,
              l.loan_number
       FROM transactions t
       LEFT JOIN users fu ON t.from_account_id = fu.id
       LEFT JOIN users tu ON t.to_account_id = tu.id
       LEFT JOIN users cu ON t.created_by = cu.id
       LEFT JOIN users au ON t.approved_by = au.id
       LEFT JOIN loans l ON t.loan_id = l.id
       WHERE ${whereClause}
       ORDER BY t.created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    res.json({
      success: true,
      data: {
        transactions: txnRes.rows,
        total: parseInt(countRes.rows[0].count),
        page: parseInt(page),
        totalPages: Math.ceil(parseInt(countRes.rows[0].count) / limit),
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getTransaction = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await query(
      `SELECT t.*,
              fu.first_name || ' ' || fu.last_name as from_name,
              tu.first_name || ' ' || tu.last_name as to_name,
              cu.first_name || ' ' || cu.last_name as created_by_name,
              au.first_name || ' ' || au.last_name as approved_by_name,
              l.loan_number
       FROM transactions t
       LEFT JOIN users fu ON t.from_account_id = fu.id
       LEFT JOIN users tu ON t.to_account_id = tu.id
       LEFT JOIN users cu ON t.created_by = cu.id
       LEFT JOIN users au ON t.approved_by = au.id
       LEFT JOIN loans l ON t.loan_id = l.id
       WHERE t.id = $1 AND t.deleted_at IS NULL`,
      [id]
    );

    if (!result.rows[0]) return res.status(404).json({ success: false, message: 'Transaction not found' });

    const isAdmin = req.user.roles.some(r => ['admin', 'accountant'].includes(r));
    const txn = result.rows[0];
    if (!isAdmin && txn.from_account_id !== req.user.id && txn.to_account_id !== req.user.id && txn.created_by !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    res.json({ success: true, data: txn });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.createTransaction = async (req, res) => {
  try {
    const {
      type, amount, description, fromAccountId, toAccountId,
      loanId, bankReference, notes, valueDate, referenceNumber,
    } = req.body;

    const txnNumber = generateTxnNumber();
    const currRes = await query(`SELECT value FROM settings WHERE key = 'currency'`);
    const currency = currRes.rows[0]?.value || 'INR';

    const isAdmin = req.user.roles.some(r => ['admin', 'accountant'].includes(r));
    const status = isAdmin ? 'approved' : 'pending';

    const txnRes = await query(
      `INSERT INTO transactions (transaction_number, type, amount, currency, description,
        from_account_id, to_account_id, loan_id, bank_reference, notes, value_date,
        reference_number, status, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
      [txnNumber, type, amount, currency, description, fromAccountId || null,
       toAccountId || null, loanId || null, bankReference || null, notes || null,
       valueDate || null, referenceNumber || null, status, req.user.id]
    );

    const txn = txnRes.rows[0];

    if (status === 'approved') {
      await postToLedger(txn, req.user.id);
    } else {
      await query(
        `INSERT INTO approvals (reference_type, reference_id, title, description, requested_by, priority)
         VALUES ('transaction', $1, $2, $3, $4, 'normal')`,
        [txn.id, `Transaction ${txnNumber}`, `New ${type} transaction for ${currency} ${amount}`, req.user.id]
      );

      const admins = await query(`SELECT u.email FROM users u JOIN user_roles ur ON u.id = ur.user_id JOIN roles r ON ur.role_id = r.id WHERE r.name IN ('admin', 'accountant')`);
      for (const admin of admins.rows) {
        await sendEmail({
          to: admin.email,
          templateName: 'approvalRequired',
          data: {
            title: `Transaction ${txnNumber}`,
            description: `New ${type} transaction for ${currency} ${amount}`,
            requestedBy: `${req.user.firstName} ${req.user.lastName}`,
            approvalLink: `${process.env.FRONTEND_URL}/approvals`,
          },
        });
      }
    }

    await audit({
      userId: req.user.id, action: 'TRANSACTION_CREATED', entityType: 'transaction',
      entityId: txn.id, newValues: { txnNumber, type, amount }, ipAddress: req.ip,
    });

    res.status(201).json({ success: true, data: txn });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.approveTransaction = async (req, res) => {
  try {
    const { id } = req.params;
    const { action, notes } = req.body;

    const txnRes = await query(`SELECT * FROM transactions WHERE id = $1`, [id]);
    if (!txnRes.rows[0]) return res.status(404).json({ success: false, message: 'Transaction not found' });

    const txn = txnRes.rows[0];
    if (txn.status !== 'pending') return res.status(400).json({ success: false, message: 'Transaction is not pending' });

    const newStatus = action === 'approve' ? 'approved' : 'rejected';

    await query(
      `UPDATE transactions SET status = $1, approved_by = $2, approved_at = NOW(), updated_at = NOW() WHERE id = $3`,
      [newStatus, req.user.id, id]
    );

    if (newStatus === 'approved') {
      await postToLedger(txn, req.user.id);
    }

    await query(
      `UPDATE approvals SET status = $1, reviewed_by = $2, reviewed_at = NOW(), review_notes = $3
       WHERE reference_type = 'transaction' AND reference_id = $4 AND status = 'pending'`,
      [action === 'approve' ? 'approved' : 'rejected', req.user.id, notes || null, id]
    );

    if (txn.created_by) {
      const creatorRes = await query(`SELECT email FROM users WHERE id = $1`, [txn.created_by]);
      await sendEmail({
        to: creatorRes.rows[0]?.email,
        templateName: 'approvalStatus',
        data: {
          status: newStatus,
          title: `Transaction ${txn.transaction_number}`,
          notes,
          reviewedBy: `${req.user.firstName} ${req.user.lastName}`,
        },
      });
    }

    await audit({
      userId: req.user.id, action: `TRANSACTION_${action.toUpperCase()}D`, entityType: 'transaction',
      entityId: id, newValues: { status: newStatus }, ipAddress: req.ip,
    });

    res.json({ success: true, message: `Transaction ${action}d successfully` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.deleteTransaction = async (req, res) => {
  try {
    const { id } = req.params;
    const isAdmin = req.user.roles.some(r => ['admin', 'accountant'].includes(r));

    const txnRes = await query(`SELECT * FROM transactions WHERE id = $1`, [id]);
    if (!txnRes.rows[0]) return res.status(404).json({ success: false, message: 'Transaction not found' });

    if (isAdmin) {
      await query(
        `UPDATE transactions SET deleted_at = NOW(), deletion_approved_by = $1, status = 'cancelled', updated_at = NOW() WHERE id = $2`,
        [req.user.id, id]
      );
      await audit({ userId: req.user.id, action: 'TRANSACTION_DELETED', entityType: 'transaction', entityId: id, ipAddress: req.ip });
      return res.json({ success: true, message: 'Transaction deleted' });
    }

    await query(
      `UPDATE transactions SET status = 'pending_deletion', deletion_requested_by = $1, deletion_requested_at = NOW() WHERE id = $2`,
      [req.user.id, id]
    );

    await query(
      `INSERT INTO approvals (reference_type, reference_id, title, description, requested_by, priority)
       VALUES ('transaction_deletion', $1, $2, $3, $4, 'normal')`,
      [id, `Delete Transaction ${txnRes.rows[0].transaction_number}`, `Deletion requested`, req.user.id]
    );

    res.json({ success: true, message: 'Deletion request submitted for approval' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

async function postToLedger(txn, approvedBy) {
  const currRes = await query(`SELECT value FROM settings WHERE key = 'currency'`);
  const currency = currRes.rows[0]?.value || 'INR';

  if (txn.from_account_id) {
    const fromBalance = await query(
      `SELECT COALESCE(SUM(CASE WHEN entry_type='credit' THEN amount ELSE -amount END), 0) as balance
       FROM ledger_entries WHERE user_id = $1`,
      [txn.from_account_id]
    );
    const newBal = parseFloat(fromBalance.rows[0].balance) - parseFloat(txn.amount);
    await query(
      `INSERT INTO ledger_entries (user_id, transaction_id, loan_id, entry_type, amount, currency, balance_after, description, reference, created_by)
       VALUES ($1,$2,$3,'debit',$4,$5,$6,$7,$8,$9)`,
      [txn.from_account_id, txn.id, txn.loan_id, txn.amount, currency, newBal, txn.description, txn.transaction_number, approvedBy]
    );
  }

  if (txn.to_account_id) {
    const toBalance = await query(
      `SELECT COALESCE(SUM(CASE WHEN entry_type='credit' THEN amount ELSE -amount END), 0) as balance
       FROM ledger_entries WHERE user_id = $1`,
      [txn.to_account_id]
    );
    const newBal = parseFloat(toBalance.rows[0].balance) + parseFloat(txn.amount);
    await query(
      `INSERT INTO ledger_entries (user_id, transaction_id, loan_id, entry_type, amount, currency, balance_after, description, reference, created_by)
       VALUES ($1,$2,$3,'credit',$4,$5,$6,$7,$8,$9)`,
      [txn.to_account_id, txn.id, txn.loan_id, txn.amount, currency, newBal, txn.description, txn.transaction_number, approvedBy]
    );
  }

  await query(`UPDATE transactions SET status = 'completed', updated_at = NOW() WHERE id = $1`, [txn.id]);
}
