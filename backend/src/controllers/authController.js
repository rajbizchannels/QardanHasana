const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const { query } = require('../config/database');
const { sendEmail } = require('../utils/email');
const audit = require('../utils/audit');

const generateTokens = (userId) => {
  const accessToken = jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '7d',
  });
  const refreshToken = jwt.sign({ userId }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRE || '30d',
  });
  return { accessToken, refreshToken };
};

exports.login = async (req, res) => {
  try {
    const { itsNumber, password } = req.body;

    const result = await query(
      `SELECT u.*, array_agg(DISTINCT r.name) as role_names
       FROM users u
       LEFT JOIN user_roles ur ON u.id = ur.user_id
       LEFT JOIN roles r ON ur.role_id = r.id AND r.is_active = TRUE
       WHERE u.its_number = $1
       GROUP BY u.id`,
      [itsNumber]
    );

    const user = result.rows[0];

    if (!user) {
      await audit({ action: 'LOGIN_FAILED', ipAddress: req.ip, userAgent: req.get('User-Agent') });
      return res.status(401).json({ success: false, message: 'Invalid ITS number or password' });
    }

    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      return res.status(423).json({ success: false, message: 'Account locked. Try again later.' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      const attempts = (user.failed_login_attempts || 0) + 1;
      const lockData = attempts >= 5
        ? { failed_login_attempts: attempts, locked_until: new Date(Date.now() + 15 * 60 * 1000) }
        : { failed_login_attempts: attempts };

      await query(
        `UPDATE users SET failed_login_attempts = $1, locked_until = $2 WHERE id = $3`,
        [lockData.failed_login_attempts, lockData.locked_until || null, user.id]
      );

      await audit({
        userId: user.id, action: 'LOGIN_FAILED', ipAddress: req.ip,
        userAgent: req.get('User-Agent'), status: 'failed',
      });

      return res.status(401).json({ success: false, message: 'Invalid ITS number or password' });
    }

    if (!user.is_active) {
      return res.status(403).json({ success: false, message: 'Account is deactivated' });
    }

    await query(
      `UPDATE users SET failed_login_attempts = 0, locked_until = NULL, last_login = NOW() WHERE id = $1`,
      [user.id]
    );

    const { accessToken, refreshToken } = generateTokens(user.id);
    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');

    await query(
      `INSERT INTO refresh_tokens (user_id, token_hash, expires_at, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5)`,
      [user.id, tokenHash, new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), req.ip, req.get('User-Agent')]
    );

    await audit({
      userId: user.id, action: 'LOGIN', entityType: 'user', entityId: user.id,
      ipAddress: req.ip, userAgent: req.get('User-Agent'),
    });

    res.json({
      success: true,
      data: {
        accessToken,
        refreshToken,
        user: {
          id: user.id,
          itsNumber: user.its_number,
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name,
          roles: user.role_names.filter(Boolean),
        },
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.logout = async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (refreshToken) {
      const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
      await query(`UPDATE refresh_tokens SET is_revoked = TRUE, revoked_at = NOW() WHERE token_hash = $1`, [tokenHash]);
    }
    await audit({ userId: req.user.id, action: 'LOGOUT', ipAddress: req.ip });
    res.json({ success: true, message: 'Logged out successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(400).json({ success: false, message: 'Refresh token required' });

    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');

    const result = await query(
      `SELECT * FROM refresh_tokens WHERE token_hash = $1 AND is_revoked = FALSE AND expires_at > NOW()`,
      [tokenHash]
    );

    if (!result.rows[0]) {
      return res.status(401).json({ success: false, message: 'Invalid or expired refresh token' });
    }

    await query(`UPDATE refresh_tokens SET is_revoked = TRUE WHERE token_hash = $1`, [tokenHash]);

    const { accessToken, refreshToken: newRefresh } = generateTokens(decoded.userId);
    const newHash = crypto.createHash('sha256').update(newRefresh).digest('hex');

    await query(
      `INSERT INTO refresh_tokens (user_id, token_hash, expires_at, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5)`,
      [decoded.userId, newHash, new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), req.ip, req.get('User-Agent')]
    );

    res.json({ success: true, data: { accessToken, refreshToken: newRefresh } });
  } catch (err) {
    res.status(401).json({ success: false, message: 'Invalid refresh token' });
  }
};

exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const result = await query(`SELECT * FROM users WHERE email = $1 AND is_active = TRUE`, [email]);
    const user = result.rows[0];

    if (!user) {
      return res.json({ success: true, message: 'If this email exists, a reset link has been sent' });
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetHash = crypto.createHash('sha256').update(resetToken).digest('hex');
    const expires = new Date(Date.now() + 60 * 60 * 1000);

    await query(
      `UPDATE users SET password_reset_token = $1, password_reset_expires = $2 WHERE id = $3`,
      [resetHash, expires, user.id]
    );

    await sendEmail({
      to: user.email,
      templateName: 'passwordReset',
      data: {
        name: `${user.first_name} ${user.last_name}`,
        resetLink: `${process.env.FRONTEND_URL}/reset-password/${resetToken}`,
      },
    });

    await audit({ userId: user.id, action: 'PASSWORD_RESET_REQUESTED', ipAddress: req.ip });

    res.json({ success: true, message: 'If this email exists, a reset link has been sent' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const { token, password } = req.body;
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const result = await query(
      `SELECT * FROM users WHERE password_reset_token = $1 AND password_reset_expires > NOW()`,
      [tokenHash]
    );

    const user = result.rows[0];
    if (!user) {
      return res.status(400).json({ success: false, message: 'Invalid or expired reset token' });
    }

    const hashedPwd = await bcrypt.hash(password, 12);
    await query(
      `UPDATE users SET password_hash = $1, password_reset_token = NULL, password_reset_expires = NULL,
       failed_login_attempts = 0, locked_until = NULL WHERE id = $2`,
      [hashedPwd, user.id]
    );

    await query(`UPDATE refresh_tokens SET is_revoked = TRUE WHERE user_id = $1`, [user.id]);
    await audit({ userId: user.id, action: 'PASSWORD_RESET', ipAddress: req.ip });

    res.json({ success: true, message: 'Password reset successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getMe = async (req, res) => {
  try {
    const result = await query(
      `SELECT u.*,
              array_agg(DISTINCT r.name) as role_names,
              array_agg(DISTINCT r.display_name) as role_display_names,
              array_agg(DISTINCT p.name) as permission_names,
              cp.id as creditor_id, dp.id as debtor_id, gp.id as guarantor_id
       FROM users u
       LEFT JOIN user_roles ur ON u.id = ur.user_id
       LEFT JOIN roles r ON ur.role_id = r.id AND r.is_active = TRUE
       LEFT JOIN role_permissions rp ON r.id = rp.role_id
       LEFT JOIN permissions p ON rp.permission_id = p.id
       LEFT JOIN creditor_profiles cp ON u.id = cp.user_id AND cp.is_active = TRUE
       LEFT JOIN debtor_profiles dp ON u.id = dp.user_id AND dp.is_active = TRUE
       LEFT JOIN guarantor_profiles gp ON u.id = gp.user_id AND gp.is_active = TRUE
       WHERE u.id = $1
       GROUP BY u.id, cp.id, dp.id, gp.id`,
      [req.user.id]
    );

    const user = result.rows[0];
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const { password_hash, password_reset_token, two_factor_secret, ...safeUser } = user;
    res.json({ success: true, data: safeUser });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
