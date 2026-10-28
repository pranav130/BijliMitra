const app = require('./app');
const { testConnection } = require('../config/db');

const PORT = process.env.PORT || 5050;

async function startServer() {
  try {
    const dbStatus = await testConnection();
    console.log(`[DB] Connected to ${dbStatus.currentDb} (${dbStatus.version})`);
    
    app.listen(PORT, () => {
      console.log(`[HTTP] Bijli Mitra Node.js Migration Backend listening on port ${PORT}`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

if (require.main === module) {
  startServer();
}

module.exports = { app, startServer };
