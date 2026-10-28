const assert = require('assert');
const { pool, query } = require('../config/db');
const authService = require('../src/services/auth_service');

async function testAuthFeatures() {
  console.log('Testing Password Change and User Management Services...');

  // 1. Test Super Admin login
  const adminLogin = await authService.loginOfficer('admin', 'Admin@123');
  assert.strictEqual(adminLogin.user.role, 'SUPER_ADMIN');
  console.log('  ✔ Admin login successful');

  // 2. Test Get Users list
  const usersList = await authService.getAllUsers({ page: 1, limit: 5 });
  assert.ok(usersList.records, 'Should return records array');
  assert.ok(typeof usersList.pagination.total === 'number', 'Should return pagination total');
  console.log(`  ✔ Users list fetched: total ${usersList.pagination.total}`);

  // 3. Test User Profile
  if (usersList.records.length > 0) {
    const firstUser = usersList.records[0];
    const profile = await authService.getUserProfile(firstUser.id);
    assert.strictEqual(profile.id, firstUser.id);
    console.log(`  ✔ User profile fetched for user ID ${profile.id}: ${profile.fullName}`);
  }

  // 4. Test User Logs
  const userLogs = await authService.getUserLogs({ page: 1, limit: 5 });
  assert.ok(userLogs.records, 'Should return userlog records');
  console.log(`  ✔ User logs fetched: total ${userLogs.pagination.total}`);

  // 5. Test Password Change Validation
  try {
    await authService.changeAdminPassword(adminLogin.user.id, 'WrongOldPassword', 'NewPass123!', 'NewPass123!');
    assert.fail('Should have failed with wrong old password');
  } catch (err) {
    assert.strictEqual(err.message, 'Old password does not match.');
    console.log('  ✔ Correctly rejected wrong old password');
  }

  try {
    await authService.changeAdminPassword(adminLogin.user.id, 'Admin@123', 'simple', 'simple');
    assert.fail('Should have failed with weak password');
  } catch (err) {
    assert.ok(err.message.includes('at least one number and one special character'));
    console.log('  ✔ Correctly enforced password complexity requirements');
  }

  // 6. Test Successful Password Change and Change Back
  const changeRes = await authService.changeAdminPassword(adminLogin.user.id, 'Admin@123', 'Admin@New2026!', 'Admin@New2026!');
  assert.strictEqual(changeRes.success, true);
  console.log('  ✔ Password changed successfully to new password');

  // Verify can login with new password
  const newLogin = await authService.loginOfficer('admin', 'Admin@New2026!');
  assert.strictEqual(newLogin.user.username, 'admin');
  console.log('  ✔ Successfully logged in with new password');

  // Revert password back to Admin@123 for test environment consistency
  await authService.changeAdminPassword(adminLogin.user.id, 'Admin@New2026!', 'Admin@123', 'Admin@123');
  console.log('  ✔ Password safely restored back to default Admin@123');

  await pool.end();
  console.log('All Auth & User Management tests passed!\n');
}

testAuthFeatures()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Test failed:', err);
    process.exit(1);
  });
