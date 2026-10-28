const express = require('express');
const router = express.Router();
const authService = require('../services/auth_service');
const { authenticateToken } = require('../middleware/auth_middleware');

// POST /api/auth/admin/login (Departmental Officers & DISCOM Admins)
router.post('/admin/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const clientIp = req.ip || req.connection.remoteAddress;
    const result = await authService.loginOfficer(username, password, clientIp);
    res.json(result);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || 'Authentication failed.' });
  }
});

// POST /api/auth/citizen/login (Consumer / Informant Login)
router.post('/citizen/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const clientIp = req.ip || req.connection.remoteAddress;
    const result = await authService.loginCitizen(email, password, clientIp);
    res.json(result);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || 'Citizen login failed.' });
  }
});

// POST /api/auth/login (Backward-compatible default to officer login)
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const clientIp = req.ip || req.connection.remoteAddress;
    const result = await authService.loginOfficer(username, password, clientIp);
    res.json(result);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || 'Authentication failed.' });
  }
});

// GET /api/auth/me (Returns authenticated session and role claims)
router.get('/me', authenticateToken, (req, res) => {
  res.json({ user: req.user });
});

// POST /api/auth/change-password (Officer / Admin Change Password)
router.post('/change-password', authenticateToken, async (req, res) => {
  try {
    const { oldPassword, newPassword, confirmPassword } = req.body;
    const result = await authService.changeAdminPassword(req.user.id, oldPassword, newPassword, confirmPassword);
    res.json(result);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || 'Failed to change password.' });
  }
});

// Middleware helper for Super Admin operations
function requireSuperAdmin(req, res, next) {
  if (req.user && (req.user.role === 'SUPER_ADMIN' || (req.user.permissions && req.user.permissions.includes('MANAGE_USERS')))) {
    return next();
  }
  return res.status(403).json({ error: 'Access denied. Super Admin privileges required.' });
}

// GET /api/auth/users (Manage Users list)
router.get('/users', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const { page, limit, search } = req.query;
    const result = await authService.getAllUsers({ page, limit, search });
    res.json(result);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || 'Failed to fetch users.' });
  }
});

// GET /api/auth/users/:id (View User Details)
router.get('/users/:id', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const result = await authService.getUserProfile(req.params.id);
    res.json(result);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || 'Failed to fetch user details.' });
  }
});

// DELETE /api/auth/users/:id (Delete User)
router.delete('/users/:id', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const result = await authService.deleteUser(req.params.id);
    res.json(result);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || 'Failed to delete user.' });
  }
});

// GET /api/auth/user-logs (Audit Trail of User Logins)
router.get('/user-logs', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const { page, limit, search } = req.query;
    const result = await authService.getUserLogs({ page, limit, search });
    res.json(result);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || 'Failed to fetch user logs.' });
  }
});

module.exports = router;
