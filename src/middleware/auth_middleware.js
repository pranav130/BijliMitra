const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_local_dev_key_uppcl_bijlimitra_2026';

/**
 * Authentication Middleware: Verifies JWT token and binds user to request
 */
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

  if (!token) {
    return res.status(401).json({ error: 'Access denied. Authentication token required.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded; // { id, username, discom, zone, circle, isSuperAdmin }
    next();
  } catch (err) {
    return res.status(403).json({ error: 'Invalid or expired authentication token.' });
  }
}

/**
 * Authorization Middleware: Checks if user has required DISCOM scope
 */
function requireDiscomScope(allowedDiscoms = []) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthenticated.' });
    }
    // Headquarters admin can access all DISCOMs
    if (req.user.isSuperAdmin || req.user.discom === 'UPPCL HQ' || req.user.discom === 'Headquarters') {
      return next();
    }
    if (allowedDiscoms.length > 0 && !allowedDiscoms.includes(req.user.discom)) {
      return res.status(403).json({ error: 'Forbidden: Insufficient DISCOM jurisdiction permissions.' });
    }
    next();
  };
}

module.exports = {
  authenticateToken,
  requireDiscomScope,
  JWT_SECRET
};
