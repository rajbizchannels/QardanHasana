const { query } = require('../config/database');
const { sendEmail } = require('../utils/email');
const audit = require('../utils/audit');
const { notify } = require('../utils/notificationService');

const getCurrency = async () => {
  const r = await query(`SELECT value FROM settings WHERE key = 'currency'`);
  return r.rows[0]?.value || 'INR';
};

exports.getApprovals = async (req, res) => {
  try {
    const { page = 1, limit = 20, status = 'pending', type } = req.query;
    const offset = (page - 1) * limit;

    let conditions = ['1=1'];
    const params = [];

    if (status) { params.push(status); conditions.push(`a.status = $${params.length}`); }
    if (type) { params.push(type); conditions.push(`a.reference_type = $${params.length}`); }

    const whereClause = conditions.join(' AND ');

    const countRes = await query(`SELECT COUNT(*) FROM approvals a WHERE ${whereClause}`, params);

    params.push(limit, offset);
    const approvalsRes = await query(
      `SELECT a.*,
              u.first_name || ' ' || u.last_name as requested_by_name,
              u.its_number as requested_by_its,
              ru.first_name || ' ' || ru.last_name as reviewed_by_name,
              CASE
                WHEN a.metadata IS NOT NULL THEN a.metadata
                WHEN a.reference_type = 'user_profile' THEN ref_u.profile_changes_pending
                WHEN a.reference_type IN ('transaction', 'transaction_deletion') THEN
                  jsonb_build_object(
                    'transactionNumber', ref_t.transaction_number,
                    'type', ref_t.type,
                    'amount', ref_t.amount,
                    'currency', ref_t.currency,
                    'description', ref_t.description,
                    'bankReference', ref_t.bank_reference,
                    'status', ref_t.status
                  )
                ELSE NULL
              END as effective_metadata
       FROM approvals a
       JOIN users u ON a.requested_by = u.id
       LEFT JOIN users ru ON a.reviewed_by = ru.id
       LEFT JOIN users ref_u ON a.reference_type = 'user_profile' AND ref_u.id = a.reference_id
       LEFT JOIN transactions ref_t ON a.reference_type IN ('transaction', 'transaction_deletion') AND ref_t.id = a.reference_id
       WHERE ${whereClause}
       ORDER BY CASE a.priority WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 WHEN 'normal' THEN 3 ELSE 4 END,
                a.created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    res.json({
      success: true,
      data: {
        approvals: approvalsRes.rows,
        total: parseInt(countRes.rows[0].count),
        page: parseInt(page),
        totalPages: Math.ceil(parseInt(countRes.rows[0].count) / limit),
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.reviewApproval = async (req, res) => {
  try {
    const { id } = req.params;
    const { action, notes } = req.body;

    const approvalRes = await query(`SELECT * FROM approvals WHERE id = $1`, [id]);
    if (!approvalRes.rows[0]) return res.status(404).json({ success: false, message: 'Approval not found' });

    const approval = approvalRes.rows[0];
    if (approval.status !== 'pending') {
      return res.status(400).json({ success: false, message: 'This item has already been reviewed' });
    }

    const newStatus = action === 'approve' ? 'approved' : 'rejected';

    await query(
      `UPDATE approvals SET status = $1, reviewed_by = $2, reviewed_at = NOW(), review_notes = $3, updated_at = NOW()
       WHERE id = $4`,
      [newStatus, req.user.id, notes || null, id]
    );

    // Handle downstream effects based on reference type
    if (approval.reference_type === 'user_profile' && newStatus === 'approved') {
      const userRes = await query(`SELECT profile_changes_pending FROM users WHERE id = $1`, [approval.reference_id]);
      const changes = userRes.rows[0]?.profile_changes_pending;
      if (changes) {
        await query(
          `UPDATE users SET
            first_name = COALESCE($1, first_name),
            last_name = COALESCE($2, last_name),
            phone = COALESCE($3, phone),
            date_of_birth = COALESCE($4, date_of_birth),
            gender = COALESCE($5, gender),
            address_line1 = COALESCE($6, address_line1),
            address_line2 = COALESCE($7, address_line2),
            city = COALESCE($8, city),
            state = COALESCE($9, state),
            country = COALESCE($10, country),
            postal_code = COALESCE($11, postal_code),
            involved_in_interest = COALESCE($12, involved_in_interest),
            involved_in_insurance = COALESCE($13, involved_in_insurance),
            involved_in_substance_abuse = COALESCE($14, involved_in_substance_abuse),
            involved_in_crypto = COALESCE($15, involved_in_crypto),
            involved_in_ponzi = COALESCE($16, involved_in_ponzi),
            involved_in_other_schemes = COALESCE($17, involved_in_other_schemes),
            other_schemes_description = COALESCE($18, other_schemes_description),
            its_number = COALESCE($19, its_number),
            whatsapp = COALESCE($20, whatsapp),
            profile_changes_pending = NULL,
            profile_change_approved_at = NOW(),
            profile_change_approved_by = $21,
            updated_at = NOW()
           WHERE id = $22`,
          [
            changes.firstName || null, changes.lastName || null, changes.phone || null,
            changes.dateOfBirth || null, changes.gender || null,
            changes.addressLine1 || null, changes.addressLine2 || null,
            changes.city || null, changes.state || null,
            changes.country || null, changes.postalCode || null,
            changes.involvedInInterest ?? null, changes.involvedInInsurance ?? null,
            changes.involvedInSubstanceAbuse ?? null, changes.involvedInCrypto ?? null,
            changes.involvedInPonzi ?? null, changes.involvedInOtherSchemes ?? null,
            changes.otherSchemesDescription || null,
            changes.itsNumber || null,
            changes.whatsapp || null,
            req.user.id, approval.reference_id,
          ]
        );
      }
    }

    if (approval.reference_type === 'document' && newStatus === 'approved') {
      await query(
        `UPDATE documents SET status = 'approved', approved_by = $1, approved_at = NOW(), posted_to_ledger = TRUE, posted_at = NOW() WHERE id = $2`,
        [req.user.id, approval.reference_id]
      );
    }

    if (approval.reference_type === 'document' && newStatus === 'rejected') {
      await query(`UPDATE documents SET status = 'rejected', approved_by = $1, approved_at = NOW() WHERE id = $2`, [req.user.id, approval.reference_id]);
    }

    if (approval.reference_type === 'transaction_deletion' && newStatus === 'approved') {
      await query(
        `UPDATE transactions SET deleted_at = NOW(), deletion_approved_by = $1, status = 'cancelled', updated_at = NOW() WHERE id = $2`,
        [req.user.id, approval.reference_id]
      );
    }

    if (approval.reference_type === 'loan') {
      const loanRes = await query(`SELECT * FROM loans WHERE id = $1`, [approval.reference_id]);
      const loan = loanRes.rows[0];
      if (loan) {
        const currency = await getCurrency();
        if (newStatus === 'approved') {
          await query(
            `UPDATE loans SET status = 'approved', approved_by = $1, approved_at = NOW(), updated_at = NOW() WHERE id = $2`,
            [req.user.id, loan.id]
          );
          await query(
            `UPDATE debtor_profiles SET total_borrowed = total_borrowed + $1, outstanding_balance = outstanding_balance + $1 WHERE id = $2`,
            [loan.principal_amount, loan.debtor_id]
          );
          const debtorUser = await query(
            `SELECT u.id FROM users u JOIN debtor_profiles dp ON u.id = dp.user_id WHERE dp.id = $1`,
            [loan.debtor_id]
          );
          if (debtorUser.rows[0]) {
            await notify({
              userId: debtorUser.rows[0].id,
              type: 'loan_status',
              title: `Loan Approved — ${loan.loan_number}`,
              message: `Your loan application ${loan.loan_number} has been approved.`,
              notifType: 'success', referenceType: 'loan', referenceId: loan.id,
              emailTemplate: 'loanUpdate',
              emailData: { loanNumber: loan.loan_number, status: 'approved', amount: loan.principal_amount, currency },
            });
          }
        } else {
          await query(
            `UPDATE loans SET status = 'rejected', updated_at = NOW() WHERE id = $1`,
            [loan.id]
          );
          const debtorUser = await query(
            `SELECT u.id FROM users u JOIN debtor_profiles dp ON u.id = dp.user_id WHERE dp.id = $1`,
            [loan.debtor_id]
          );
          if (debtorUser.rows[0]) {
            await notify({
              userId: debtorUser.rows[0].id,
              type: 'loan_status',
              title: `Loan Application Rejected — ${loan.loan_number}`,
              message: `Your loan application ${loan.loan_number} was not approved.${notes ? ` Notes: ${notes}` : ''}`,
              notifType: 'error', referenceType: 'loan', referenceId: loan.id,
              emailTemplate: 'loanUpdate',
              emailData: { loanNumber: loan.loan_number, status: 'rejected', amount: loan.principal_amount, currency, notes },
            });
          }
        }
      }
    }

    if (approval.reference_type === 'account_deletion' && newStatus === 'approved') {
      await query(`UPDATE users SET is_active = FALSE, updated_at = NOW() WHERE id = $1`, [approval.reference_id]);
    }

    // Notify the requester based on approval type
    const requesterRes = await query(`SELECT first_name, last_name FROM users WHERE id = $1`, [approval.requested_by]);
    const requesterName = requesterRes.rows[0] ? `${requesterRes.rows[0].first_name} ${requesterRes.rows[0].last_name}` : '';
    const reviewerName = `${req.user.firstName} ${req.user.lastName}`;

    if (approval.reference_type === 'user_profile') {
      await notify({
        userId: approval.requested_by,
        type: 'profile_reviewed',
        title: `Profile Update ${newStatus === 'approved' ? 'Approved' : 'Rejected'}`,
        message: `Your profile update request has been ${newStatus}${notes ? `: ${notes}` : '.'}`,
        notifType: newStatus === 'approved' ? 'success' : 'error',
        referenceType: 'approval', referenceId: id,
        emailTemplate: 'profileReviewed',
        emailData: { name: requesterName, status: newStatus, notes },
      });
    } else if (approval.reference_type === 'document') {
      const docRes = await query(`SELECT original_name FROM documents WHERE id = $1`, [approval.reference_id]);
      await notify({
        userId: approval.requested_by,
        type: 'document_reviewed',
        title: `Document ${newStatus === 'approved' ? 'Approved' : 'Rejected'}`,
        message: `Your document "${docRes.rows[0]?.original_name}" has been ${newStatus}${notes ? `: ${notes}` : '.'}`,
        notifType: newStatus === 'approved' ? 'success' : 'error',
        referenceType: 'approval', referenceId: id,
        emailTemplate: 'documentReviewed',
        emailData: { name: requesterName, status: newStatus, fileName: docRes.rows[0]?.original_name, notes },
      });
    } else if (approval.reference_type === 'transaction' || approval.reference_type === 'transaction_deletion') {
      await notify({
        userId: approval.requested_by,
        type: 'transaction_posted',
        title: `Transaction Request ${newStatus === 'approved' ? 'Approved' : 'Rejected'}`,
        message: `Your transaction request has been ${newStatus}${notes ? `: ${notes}` : '.'}`,
        notifType: newStatus === 'approved' ? 'success' : 'error',
        referenceType: 'approval', referenceId: id,
        emailTemplate: 'approvalStatus',
        emailData: { status: newStatus, title: approval.title, notes, reviewedBy: reviewerName },
      });
    } else {
      await notify({
        userId: approval.requested_by,
        type: 'account_activity',
        title: `Request ${newStatus === 'approved' ? 'Approved' : 'Rejected'}: ${approval.title}`,
        message: `Your request "${approval.title}" has been ${newStatus}${notes ? `: ${notes}` : '.'}`,
        notifType: newStatus === 'approved' ? 'success' : 'error',
        referenceType: 'approval', referenceId: id,
        emailTemplate: 'approvalStatus',
        emailData: { status: newStatus, title: approval.title, notes, reviewedBy: reviewerName },
      });
    }

    await audit({
      userId: req.user.id, action: `APPROVAL_${action.toUpperCase()}D`, entityType: 'approval',
      entityId: id, newValues: { approvalId: id, referenceType: approval.reference_type }, ipAddress: req.ip,
    });

    res.json({ success: true, message: `Request ${action}d successfully` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getApprovalStats = async (req, res) => {
  try {
    const result = await query(
      `SELECT
        COUNT(*) FILTER (WHERE status = 'pending') as pending,
        COUNT(*) FILTER (WHERE status = 'approved') as approved,
        COUNT(*) FILTER (WHERE status = 'rejected') as rejected,
        COUNT(*) FILTER (WHERE status = 'pending' AND priority = 'urgent') as urgent_pending,
        COUNT(*) FILTER (WHERE status = 'pending' AND priority = 'high') as high_pending
       FROM approvals`
    );
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
