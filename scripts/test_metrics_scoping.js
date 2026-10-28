const { query } = require('./config/db');
const complaintService = require('./src/services/complaint_service');
const authService = require('./src/services/auth_service');

async function testMetrics() {
  // 1. HQ Super Admin
  const hqUser = { role: 'SUPER_ADMIN', username: 'admin', discom: 'HQ' };
  const hqMetrics = await complaintService.getDashboardMetrics({ user: hqUser });
  console.log('HQ Metrics:', hqMetrics);

  // 2. DISCOM Admin (DVVNL)
  const dvvnlUser = { role: 'DISCOM_ADMIN', username: 'DVVNL', discom: 'DVVNL' };
  const dvvnlMetrics = await complaintService.getDashboardMetrics({ user: dvvnlUser });
  console.log('\nDVVNL Metrics:', dvvnlMetrics);

  // 3. Division Officer (eddrajapur)
  const rajapurUser = { role: 'DIVISION_OFFICER', username: 'eddrajapur', discom: 'DVVNL' };
  const rajapurMetrics = await complaintService.getDashboardMetrics({ user: rajapurUser });
  console.log('\neddrajapur Metrics:', rajapurMetrics);

  process.exit(0);
}

testMetrics().catch(e => {
  console.error(e);
  process.exit(1);
});
