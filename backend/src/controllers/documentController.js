const path = require('path');
const fs = require('fs');
const { query } = require('../config/database');
const { sendEmail } = require('../utils/email');
const audit = require('../utils/audit');

exports.uploadDocument = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });

    const { documentType, description, loanId, transactionId } = req.body;

    const docRes = await query(
      `INSERT INTO documents (user_id, loan_id, transaction_id, document_type, original_name, file_path, file_size, mime_type, description, status, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending', $1) RETURNING *`,
      [req.user.id, loanId || null, transactionId || null, documentType, req.file.originalname,
       req.file.path, req.file.size, req.file.mimetype, description || null]
    );

    const doc = docRes.rows[0];

    await query(
      `INSERT INTO approvals (reference_type, reference_id, title, description, requested_by, priority)
       VALUES ('document', $1, $2, $3, $4, 'normal')`,
      [doc.id, `Document Upload: ${documentType}`, `${req.user.firstName} ${req.user.lastName} uploaded a ${documentType}`, req.user.id]
    );

    const accountants = await query(`SELECT u.email FROM users u JOIN user_roles ur ON u.id = ur.user_id JOIN roles r ON ur.role_id = r.id WHERE r.name IN ('admin', 'accountant')`);
    for (const acc of accountants.rows) {
      await sendEmail({
        to: acc.email,
        templateName: 'documentUploaded',
        data: {
          userName: `${req.user.firstName} ${req.user.lastName}`,
          documentType,
          fileName: req.file.originalname,
          reviewLink: `${process.env.FRONTEND_URL}/approvals`,
        },
      });
    }

    await audit({
      userId: req.user.id, action: 'DOCUMENT_UPLOADED', entityType: 'document',
      entityId: doc.id, newValues: { documentType, fileName: req.file.originalname }, ipAddress: req.ip,
    });

    res.status(201).json({ success: true, data: doc });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getDocuments = async (req, res) => {
  try {
    const { userId, status, loanId, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    const isAdmin = req.user.roles.some(r => ['admin', 'accountant'].includes(r));

    let conditions = ['1=1'];
    const params = [];

    if (!isAdmin) {
      params.push(req.user.id);
      conditions.push(`d.user_id = $${params.length}`);
    } else if (userId) {
      params.push(userId);
      conditions.push(`d.user_id = $${params.length}`);
    }

    if (status) { params.push(status); conditions.push(`d.status = $${params.length}`); }
    if (loanId) { params.push(loanId); conditions.push(`d.loan_id = $${params.length}`); }

    const whereClause = conditions.join(' AND ');

    const countRes = await query(`SELECT COUNT(*) FROM documents d WHERE ${whereClause}`, params);

    params.push(limit, offset);
    const docsRes = await query(
      `SELECT d.*, u.first_name || ' ' || u.last_name as user_name, u.its_number,
              au.first_name || ' ' || au.last_name as approved_by_name,
              l.loan_number
       FROM documents d
       JOIN users u ON d.user_id = u.id
       LEFT JOIN users au ON d.approved_by = au.id
       LEFT JOIN loans l ON d.loan_id = l.id
       WHERE ${whereClause}
       ORDER BY d.created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    res.json({
      success: true,
      data: {
        documents: docsRes.rows,
        total: parseInt(countRes.rows[0].count),
        page: parseInt(page),
        totalPages: Math.ceil(parseInt(countRes.rows[0].count) / limit),
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.downloadDocument = async (req, res) => {
  try {
    const { id } = req.params;
    const isAdmin = req.user.roles.some(r => ['admin', 'accountant'].includes(r));

    const docRes = await query(`SELECT * FROM documents WHERE id = $1`, [id]);
    if (!docRes.rows[0]) return res.status(404).json({ success: false, message: 'Document not found' });

    const doc = docRes.rows[0];
    if (!isAdmin && doc.user_id !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    if (!fs.existsSync(doc.file_path)) {
      return res.status(404).json({ success: false, message: 'File not found on server' });
    }

    res.download(doc.file_path, doc.original_name);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.deleteDocument = async (req, res) => {
  try {
    const { id } = req.params;
    const isAdmin = req.user.roles.some(r => ['admin', 'accountant'].includes(r));

    const docRes = await query(`SELECT * FROM documents WHERE id = $1`, [id]);
    if (!docRes.rows[0]) return res.status(404).json({ success: false, message: 'Document not found' });

    const doc = docRes.rows[0];
    if (!isAdmin && doc.user_id !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    if (doc.file_path && fs.existsSync(doc.file_path)) {
      fs.unlinkSync(doc.file_path);
    }

    await query(`DELETE FROM documents WHERE id = $1`, [id]);
    await audit({ userId: req.user.id, action: 'DOCUMENT_DELETED', entityType: 'document', entityId: id, ipAddress: req.ip });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
