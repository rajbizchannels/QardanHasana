const { query } = require('../config/database');
const { sendEmail } = require('../utils/email');
const audit = require('../utils/audit');

const generateLoanNumber = () => `LN${Date.now().toString().slice(-8)}`;

exports.getLoans = async (req, res) => {
  try {
    const { page = 1, limit = 20, status, debtorId } = req.query;
    const offset = (page - 1) * limit;
    const isAdmin = req.user.roles.some(r => ['admin', 'accountant'].includes(r));

    let conditions = ['1=1'];
    const params = [];

    if (!isAdmin) {
      params.push(req.user.id);
      conditions.push(`(dp.user_id = $${params.length} OR cp.user_id = $${params.length})`);
    }
    if (status) { params.push(status); conditions.push(`l.status = $${params.length}`); }
    if (debtorId) { params.push(debtorId); conditions.push(`l.debtor_id = $${params.length}`); }

    const whereClause = conditions.join(' AND ');

    const countRes = await query(
      `SELECT COUNT(*) FROM loans l
       JOIN debtor_profiles dp ON l.debtor_id = dp.id
       LEFT JOIN creditor_profiles cp ON l.creditor_id = cp.id
       WHERE ${whereClause}`, params
    );

    params.push(limit, offset);
    const loansRes = await query(
      `SELECT l.*,
              u.first_name || ' ' || u.last_name as debtor_name,
              u.its_number as debtor_its,
              cu.first_name || ' ' || cu.last_name as creditor_name,
              (SELECT COUNT(*) FROM loan_guarantors lg WHERE lg.loan_id = l.id) as guarantor_count,
              (SELECT COUNT(*) FROM documents d WHERE d.loan_id = l.id) as document_count
       FROM loans l
       JOIN debtor_profiles dp ON l.debtor_id = dp.id
       JOIN users u ON dp.user_id = u.id
       LEFT JOIN creditor_profiles cp ON l.creditor_id = cp.id
       LEFT JOIN users cu ON cp.user_id = cu.id
       WHERE ${whereClause}
       ORDER BY l.created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    res.json({
      success: true,
      data: {
        loans: loansRes.rows,
        total: parseInt(countRes.rows[0].count),
        page: parseInt(page),
        totalPages: Math.ceil(parseInt(countRes.rows[0].count) / limit),
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getLoan = async (req, res) => {
  try {
    const { id } = req.params;

    const loanRes = await query(
      `SELECT l.*,
              u.first_name || ' ' || u.last_name as debtor_name, u.its_number as debtor_its,
              u.email as debtor_email, u.phone as debtor_phone,
              cu.first_name || ' ' || cu.last_name as creditor_name,
              au.first_name || ' ' || au.last_name as approved_by_name
       FROM loans l
       JOIN debtor_profiles dp ON l.debtor_id = dp.id
       JOIN users u ON dp.user_id = u.id
       LEFT JOIN creditor_profiles cp ON l.creditor_id = cp.id
       LEFT JOIN users cu ON cp.user_id = cu.id
       LEFT JOIN users au ON l.approved_by = au.id
       WHERE l.id = $1`,
      [id]
    );

    if (!loanRes.rows[0]) return res.status(404).json({ success: false, message: 'Loan not found' });

    const loan = loanRes.rows[0];
    const isAdmin = req.user.roles.some(r => ['admin', 'accountant'].includes(r));

    if (!isAdmin) {
      const debtorCheck = await query(`SELECT user_id FROM debtor_profiles WHERE id = $1`, [loan.debtor_id]);
      const creditorCheck = loan.creditor_id ? await query(`SELECT user_id FROM creditor_profiles WHERE id = $1`, [loan.creditor_id]) : { rows: [] };
      if (debtorCheck.rows[0]?.user_id !== req.user.id && creditorCheck.rows[0]?.user_id !== req.user.id) {
        return res.status(403).json({ success: false, message: 'Access denied' });
      }
    }

    const guarantors = await query(`SELECT * FROM loan_guarantors WHERE loan_id = $1`, [id]);
    const documents = await query(`SELECT id, document_type, original_name, status, created_at FROM documents WHERE loan_id = $1`, [id]);
    const transactions = await query(
      `SELECT t.*, u.first_name || ' ' || u.last_name as created_by_name
       FROM transactions t LEFT JOIN users u ON t.created_by = u.id
       WHERE t.loan_id = $1 ORDER BY t.created_at DESC`, [id]
    );

    res.json({
      success: true,
      data: { ...loan, guarantors: guarantors.rows, documents: documents.rows, transactions: transactions.rows },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.createLoan = async (req, res) => {
  try {
    const {
      debtorId, creditorId, principalAmount, firstInstallmentDate,
      monthlyInstallment, totalInstallments, securityDescription,
      purpose, guarantors = [], notes,
    } = req.body;

    const loanNumber = generateLoanNumber();

    const loanRes = await query(
      `INSERT INTO loans (loan_number, debtor_id, creditor_id, principal_amount, outstanding_balance,
        first_installment_date, monthly_installment, total_installments, security_description,
        purpose, notes, status, next_due_date, created_by)
       VALUES ($1, $2, $3, $4, $4, $5, $6, $7, $8, $9, $10, 'pending', $5, $11) RETURNING *`,
      [loanNumber, debtorId, creditorId || null, principalAmount, firstInstallmentDate,
       monthlyInstallment, totalInstallments, securityDescription || null, purpose || null, notes || null, req.user.id]
    );

    const loan = loanRes.rows[0];

    for (const g of guarantors) {
      await query(
        `INSERT INTO loan_guarantors (loan_id, guarantor_profile_id, name, its_number, phone, address, email, relationship)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [loan.id, g.guarantorProfileId || null, g.name, g.itsNumber || null, g.phone, g.address, g.email || null, g.relationship || null]
      );
    }

    const approvalRes = await query(
      `INSERT INTO approvals (reference_type, reference_id, title, description, requested_by, priority)
       VALUES ('loan', $1, $2, $3, $4, 'high') RETURNING id`,
      [loan.id, `Loan Application ${loanNumber}`, `New loan application for ${principalAmount}`, req.user.id]
    );

    const admins = await query(`SELECT u.email FROM users u JOIN user_roles ur ON u.id = ur.user_id JOIN roles r ON ur.role_id = r.id WHERE r.name IN ('admin', 'accountant')`);
    for (const admin of admins.rows) {
      await sendEmail({
        to: admin.email,
        templateName: 'approvalRequired',
        data: {
          title: `Loan Application ${loanNumber}`,
          description: `New loan application for amount ${principalAmount}`,
          requestedBy: `${req.user.firstName} ${req.user.lastName}`,
          approvalLink: `${process.env.FRONTEND_URL}/approvals/${approvalRes.rows[0].id}`,
          priority: 'High',
        },
      });
    }

    await audit({
      userId: req.user.id, action: 'LOAN_CREATED', entityType: 'loan',
      entityId: loan.id, newValues: { loanNumber, principalAmount }, ipAddress: req.ip,
    });

    res.status(201).json({ success: true, data: loan });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateLoan = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, approvedBy, rejectionReason, notes } = req.body;
    const isAdmin = req.user.roles.some(r => ['admin', 'accountant'].includes(r));

    const loanRes = await query(`SELECT * FROM loans WHERE id = $1`, [id]);
    if (!loanRes.rows[0]) return res.status(404).json({ success: false, message: 'Loan not found' });

    const updateFields = [];
    const params = [];

    if (status && isAdmin) {
      params.push(status); updateFields.push(`status = $${params.length}`);
      if (status === 'approved') {
        params.push(req.user.id); updateFields.push(`approved_by = $${params.length}`);
        updateFields.push(`approved_at = NOW()`);

        await query(
          `UPDATE debtor_profiles SET total_borrowed = total_borrowed + $1, outstanding_balance = outstanding_balance + $1 WHERE id = $2`,
          [loanRes.rows[0].principal_amount, loanRes.rows[0].debtor_id]
        );

        const debtorUser = await query(
          `SELECT u.email, u.first_name, u.last_name FROM users u JOIN debtor_profiles dp ON u.id = dp.user_id WHERE dp.id = $1`,
          [loanRes.rows[0].debtor_id]
        );
        await sendEmail({
          to: debtorUser.rows[0]?.email,
          templateName: 'loanUpdate',
          data: { loanNumber: loanRes.rows[0].loan_number, status: 'approved', amount: loanRes.rows[0].principal_amount, currency: 'INR' },
        });
      }
      if (status === 'rejected' && rejectionReason) {
        params.push(rejectionReason); updateFields.push(`rejection_reason = $${params.length}`);
      }
    }

    if (notes) { params.push(notes); updateFields.push(`notes = $${params.length}`); }
    updateFields.push(`updated_at = NOW()`);
    params.push(id);

    await query(`UPDATE loans SET ${updateFields.join(', ')} WHERE id = $${params.length}`, params);

    await audit({
      userId: req.user.id, action: 'LOAN_UPDATED', entityType: 'loan',
      entityId: id, newValues: { status }, ipAddress: req.ip,
    });

    const updated = await query(`SELECT * FROM loans WHERE id = $1`, [id]);
    res.json({ success: true, data: updated.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
