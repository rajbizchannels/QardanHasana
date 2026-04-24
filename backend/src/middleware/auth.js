const jwt = require('jsonwebtoken');
const { query } = require('../config/database');

const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const result = await query(
      `SELECT u.*, array_agg(DISTINCT r.name) as role_names,
              array_agg(DISTINCT p.name) as permission_names
       FROM users u
       LEFT JOIN user_roles ur ON u.id = ur.user_id
       LEFT JOIN roles r ON ur.role_id = r.id AND r.is_active = TRUE
       LEFT JOIN role_permissions rp ON r.id = rp.role_id
       LEFT JOIN permissions p ON rp.permission_id = p.id
       WHERE u.id = $1 AND u.is_active = TRUE
       GROUP BY u.id`,
      [decoded.userId]
    );

    if (!result.rows[0]) {
      return res.status(401).json({ success: false, message: 'User not found or inactive' });
    }

    const user = result.rows[0];

    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      return res.status(423).json({ success: false, message: 'Account is temporarily locked' });
    }

    req.user = {
      id: user.id,
      itsNumber: user.its_number,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      roles: user.role_names.filter(Boolean),
      permissions: user.permission_names.filter(Boolean),
    };

    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Token expired', code: 'TOKEN_EXPIRED' });
    }
    return res.status(401).json({ success: false, message: 'Invalid token' });
  }
};

const authorize = (...permissions) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const isAdmin = req.user.roles.includes('admin');
    if (isAdmin) return next();

    const hasPermission = permissions.some((perm) => req.user.permissions.includes(perm));
    if (!hasPermission) {
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions',
        required: permissions,
      });
    }
    next();
  };
};

const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const hasRole = roles.some((role) => req.user.roles.includes(role));
    if (!hasRole) {
      return res.status(403).json({
        success: false,
        message: 'Insufficient role',
        required: roles,
      });
    }
    next();
  };
};

module.exports = { authenticate, authorize, requireRole };
