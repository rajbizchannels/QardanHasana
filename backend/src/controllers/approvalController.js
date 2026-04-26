const { query } = require('../config/database');
const { sendEmail } = require('../utils/email');
const audit = require('../utils/audit');

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
                ELSE NULL
              END as effective_metadata
       FROM approvals a
       JOIN users u ON a.requested_by = u.id
       LEFT JOIN users ru ON a.reviewed_by = ru.id
       LEFT JOIN users ref_u ON a.reference_type = 'user_profile' AND ref_u.id = a.reference_id
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
            address_line1 = COALESCE($4, address_line1),
            city = COALESCE($5, city),
            involved_in_interest = COALESCE($6, involved_in_interest),
            involved_in_crypto = COALESCE($7, involved_in_crypto),
            its_number = COALESCE($8, its_number),
            profile_changes_pending = NULL,
            profile_change_approved_at = NOW(),
            profile_change_approved_by = $9,
            updated_at = NOW()
           WHERE id = $10`,
          [changes.firstName, changes.lastName, changes.phone, changes.addressLine1,
           changes.city, changes.involvedInInterest, changes.involvedInCrypto,
           changes.itsNumber || null, req.user.id, approval.reference_id]
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

    if (approval.reference_type === 'account_deletion' && newStatus === 'approved') {
      await query(`UPDATE users SET is_active = FALSE, updated_at = NOW() WHERE id = $1`, [approval.reference_id]);
    }

    const requesterRes = await query(`SELECT email, first_name FROM users WHERE id = $1`, [approval.requested_by]);
    if (requesterRes.rows[0]) {
      await sendEmail({
        to: requesterRes.rows[0].email,
        templateName: 'approvalStatus',
        data: {
          status: newStatus,
          title: approval.title,
          notes,
          reviewedBy: `${req.user.firstName} ${req.user.lastName}`,
        },
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
