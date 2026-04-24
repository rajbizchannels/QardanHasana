const { query } = require('../config/database');

const audit = async ({
  userId,
  action,
  entityType,
  entityId,
  oldValues,
  newValues,
  ipAddress,
  userAgent,
  sessionId,
  status = 'success',
  errorMessage,
}) => {
  try {
    await query(
      `INSERT INTO audit_logs
         (user_id, action, entity_type, entity_id, old_values, new_values,
          ip_address, user_agent, session_id, status, error_message)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [
        userId || null,
        action,
        entityType || null,
        entityId || null,
        oldValues ? JSON.stringify(oldValues) : null,
        newValues ? JSON.stringify(newValues) : null,
        ipAddress || null,
        userAgent || null,
        sessionId || null,
        status,
        errorMessage || null,
      ]
    );
  } catch (err) {
    console.error('Audit log failed:', err.message);
  }
};

module.exports = audit;
