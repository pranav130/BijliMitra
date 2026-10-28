const express = require('express');
const cors = require('cors');
const path = require('path');
const authRoutes = require('./routes/auth_routes');
const complaintRoutes = require('./routes/complaint_routes');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static assets from public and uploads directories
app.use(express.static(path.join(__dirname, '..', 'public')));
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// Healthcheck & metadata endpoint
app.get('/health', async (req, res) => {
  try {
    const { testConnection } = require('../config/db');
    const dbStatus = await testConnection();
    res.json({
      status: 'UP',
      service: 'UPPCL Bijli Mitra Node.js Migration Backend',
      database: dbStatus,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({ status: 'DOWN', error: err.message });
  }
});

// Mount modular API routes
app.use('/api/auth', authRoutes);
app.use('/api/complaints', complaintRoutes);

// Fallback to React SPA index.html for frontend client routes
app.use((req, res, next) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ error: 'Endpoint not found' });
  }
  const indexPath = path.join(__dirname, '..', 'public', 'index.html');
  if (require('fs').existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).json({ error: 'Endpoint not found' });
  }
});

// Centralized error handling
app.use((err, req, res, next) => {
  console.error('Unhandled Server Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error occurred.'
  });
});

module.exports = app;
