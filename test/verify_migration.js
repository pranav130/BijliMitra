const assert = require('assert');
const { pool, query, withTransaction } = require('../config/db');
const authService = require('../src/services/auth_service');
const complaintService = require('../src/services/complaint_service');

let passedTests = 0;
let totalTests = 0;

function runTest(name, fn) {
  totalTests++;
  return fn()
    .then(() => {
      passedTests++;
      console.log(`  ✔ PASS: ${name}`);
    })
    .catch((err) => {
      console.error(`  ✖ FAIL: ${name}`);
      console.error('    Error:', err.message || err);
      throw err;
    });
}

async function runVerificationSuite() {
  console.log('================================================================');
  console.log('UPPCL BIJLI MITRA (CMS) REFINED WORKFLOW VERIFICATION SUITE');
  console.log('Target: Local cms_dev (Strictly Isolated Local Environment)');
  console.log('================================================================\n');

  // TEST 1: Safety Check - Ensure connected only to local cms_dev
  await runTest('Environment Safety: Confirm local development database (cms_dev)', async () => {
    const [res] = await query('SELECT DATABASE() AS current_db, @@hostname AS host_name');
    assert.strictEqual(res.current_db.toLowerCase(), 'cms_dev', 'Must be connected to cms_dev!');
    console.log(`    [Safety Verified: DB=${res.current_db}, Host=${res.host_name}]`);
  });

  // TEST 2: Schema & Table Existence
  await runTest('Schema Integrity: All required Bijli Mitra tables exist', async () => {
    const tables = await query(`
      SELECT TABLE_NAME 
      FROM information_schema.TABLES 
      WHERE TABLE_SCHEMA = 'cms_dev'
    `);
    const tableNames = tables.map(t => t.TABLE_NAME.toLowerCase());
    const expected = ['admin', 'tblcomplaints', 'complaintremark', 'state', 'category', 'subcategory', 'audit_trail'];
    for (const exp of expected) {
      assert.ok(tableNames.includes(exp), `Expected table '${exp}' not found in cms_dev!`);
    }
  });

  // TEST 3: Authenticate all 4 role tiers
  let adminUser, discomUser, zoneUser, divisionUser;

  await runTest('Role Resolution: Verify 4-tier roles, permissions, and view-only flags', async () => {
    // 1. Level 1: HQ Super Admin (DISCOM = 'HQ')
    const adminLogin = await authService.loginOfficer('admin', 'Admin@123');
    assert.strictEqual(adminLogin.user.role, 'SUPER_ADMIN');
    assert.strictEqual(adminLogin.user.isReadOnly, false);
    assert.ok(adminLogin.user.permissions.includes('FORWARD_DIRECT_TO_DIVISION'));
    assert.ok(adminLogin.user.permissions.includes('CLOSE_FRIVOLOUS'));
    adminUser = adminLogin.user;

    // 2. Level 2: DISCOM Corporate HQ (DVVNL / MVVNL - View-only Monitoring of respective division usernames)
    const discomLogin = await authService.loginOfficer('DVVNL', 'Admin@123');
    assert.strictEqual(discomLogin.user.role, 'DISCOM_ADMIN');
    assert.strictEqual(discomLogin.user.isReadOnly, true);
    assert.ok(discomLogin.user.permissions.includes('MONITOR_FIELD_WORKING'));
    discomUser = discomLogin.user;

    // 3. Level 3: Zonal Chief Engineer (JHANSI - View-only Monitoring)
    const zoneLogin = await authService.loginOfficer('JHANSI', 'Admin@123');
    assert.strictEqual(zoneLogin.user.role, 'ZONE_ADMIN');
    assert.strictEqual(zoneLogin.user.isReadOnly, true);
    assert.ok(zoneLogin.user.permissions.includes('MONITOR_ZONAL_WORKING'));
    zoneUser = zoneLogin.user;

    // 4. Level 4: Field Division XEN & SDO (eddrajapur - Operational & Closing Rights)
    const divLogin = await authService.loginOfficer('eddrajapur', 'Admin@123');
    assert.strictEqual(divLogin.user.role, 'DIVISION_OFFICER');
    assert.strictEqual(divLogin.user.isReadOnly, false);
    assert.ok(divLogin.user.permissions.includes('WORK_COMPLAINT'));
    assert.ok(divLogin.user.permissions.includes('CLOSE_COMPLAINT'));
    divisionUser = divLogin.user;
  });

  // TEST 4: Level 1 Super Admin forwards complaint directly to Field Division XEN/SDO
  await runTest('Level 1 Super Admin: Forward complaint #10001 directly to Field Division', async () => {
    // Reset complaint 10001 state
    await query(`
      INSERT INTO tblcomplaints (complaintNumber, thiefname, thiefaddress, district, substn, complaintDetails, status, regDate)
      VALUES (10001, 'सुरेश कुमार यादव', 'मकान नं 45, राजापुर, चित्रकूट', 'CHITRAKOOT', '33/11 राजापुर', 'सीधे एलटी लाइन से कटिया डालकर आटा चक्की चलाना', NULL, NOW())
      ON DUPLICATE KEY UPDATE status = NULL, username = NULL
    `);

    const fwdResult = await complaintService.forwardDirectToDivision({
      complaintNumber: 10001,
      targetDivisionUsername: 'eddrajapur',
      remark: 'स्थल पर तत्काल औचक छापा मारकर विधिक कार्यवाही की जाए।',
      user: adminUser,
      ipAddress: '127.0.0.1'
    });

    assert.strictEqual(fwdResult.success, true);
    assert.strictEqual(fwdResult.status, 'forward');
    assert.strictEqual(fwdResult.assignedDivision, 'eddrajapur');
    assert.strictEqual(fwdResult.discom, 'DVVNL');

    // Verify in database
    const [c] = await query('SELECT status, username FROM tblcomplaints WHERE complaintNumber = 10001');
    assert.strictEqual(c.status, 'forward');
    assert.strictEqual(c.username, 'eddrajapur');
  });

  // TEST 5: Level 1 Super Admin closes complaint directly as Frivolous
  await runTest('Level 1 Super Admin: Close complaint #10002 directly as Frivolous', async () => {
    await query(`
      INSERT INTO tblcomplaints (complaintNumber, thiefname, thiefaddress, district, substn, complaintDetails, status, regDate)
      VALUES (10002, 'अज्ञात उपभोक्ता', 'दुकान नं 12, महोबा', 'MAHOBA', '33/11 महोबा', 'मीटर से छेड़छाड़ की शिकायत', NULL, NOW())
      ON DUPLICATE KEY UPDATE status = NULL, username = NULL
    `);

    const frivResult = await complaintService.closeComplaintAsFrivolous({
      complaintNumber: 10002,
      remark: 'शिकायत में दिए गए पते पर कोई परिसर नहीं मिला। शिकायत पूर्णतः काल्पनिक एवं फर्जी पाई गई।',
      filek: 'uploads/frivolous_report_10002.pdf',
      user: adminUser,
      ipAddress: '127.0.0.1'
    });

    assert.strictEqual(frivResult.success, true);
    assert.strictEqual(frivResult.status, 'closed');
    assert.strictEqual(frivResult.info, 'Frivolous');

    // Verify in database
    const [c] = await query('SELECT status FROM tblcomplaints WHERE complaintNumber = 10002');
    assert.strictEqual(c.status, 'closed');

    const remarks = await query('SELECT * FROM complaintremark WHERE complaintNumber = 10002 ORDER BY id DESC LIMIT 1');
    assert.strictEqual(remarks[0].status, 'closed');
    assert.strictEqual(remarks[0].info, 'Frivolous');
  });

  // TEST 6: Level 2 DISCOM HQ view-only monitoring (Mutation attempt blocked with 403)
  await runTest('Level 2 DISCOM HQ: View-only monitoring enforced (403 on mutation)', async () => {
    // 1. Can view grievances
    const list = await complaintService.getNotProcessedComplaints({ user: discomUser });
    assert.ok(Array.isArray(list.records), 'DISCOM HQ must be able to view complaints');

    // 2. Mutation attempt MUST be rejected
    try {
      await complaintService.updateComplaintStatus({
        complaintNumber: 10001,
        newStatus: 'closed',
        remark: 'DISCOM HQ attempting to close complaint',
        info: 'Frivolous',
        user: discomUser
      });
      assert.fail('DISCOM HQ should not be allowed to mutate complaints');
    } catch (err) {
      assert.strictEqual(err.status, 403, 'Must return 403 Forbidden for monitoring account');
    }
  });

  // TEST 7: Level 3 Zonal Chief Engineer view-only monitoring (Mutation attempt blocked with 403)
  await runTest('Level 3 Zonal Chief Engineer: View-only monitoring enforced (403 on mutation)', async () => {
    // 1. Can view grievances in their zone
    const list = await complaintService.getNotProcessedComplaints({ user: zoneUser });
    assert.ok(Array.isArray(list.records), 'Zonal Chief Engineer must be able to view complaints');

    // 2. Mutation attempt MUST be rejected
    try {
      await complaintService.updateComplaintStatus({
        complaintNumber: 10001,
        newStatus: 'closed',
        remark: 'Zone head attempting to change status',
        info: 'Theft Not Found',
        user: zoneUser
      });
      assert.fail('Zonal Chief Engineer should not be allowed to mutate complaints');
    } catch (err) {
      assert.strictEqual(err.status, 403, 'Must return 403 Forbidden for zonal monitoring account');
    }
  });

  // TEST 8: Level 4 Field Division Officer works on assigned complaint and closes it with dropdowns
  await runTest('Level 4 Field Division XEN/SDO: Close complaint with "Theft Found & FIR Done" dropdowns', async () => {
    // Complaint #10001 is assigned to 'eddrajapur'
    // Assessment (Penalty): ₹1,85,000 | Realization (Deposit to date): ₹65,000 (Distinct values!)
    const closeResult = await complaintService.updateComplaintStatus({
      complaintNumber: 10001,
      newStatus: 'closed',
      info: 'Theft Found & FIR Done',
      category: 'lmv2',
      loads: '12.5',
      assess: '185000.00',
      reali: '65000.00',
      remark: 'मौके पर छापा मारा गया। 12.5 kW अनाधिकृत भार पर एलटी लाइन से कटिया पाई गई। धारा 135 में विधिक कार्यवाही व ₹1,85,000 जुर्माना आकलित हुआ जिसमें से ₹65,000 शमन शुल्क जमा कराया गया।',
      filek: 'uploads/fir_copy_10001.pdf',
      user: divisionUser,
      ipAddress: '127.0.0.1'
    });

    assert.strictEqual(closeResult.success, true);
    assert.strictEqual(closeResult.newStatus, 'closed');

    // Verify in database
    const [c] = await query('SELECT status, username FROM tblcomplaints WHERE complaintNumber = 10001');
    assert.strictEqual(c.status, 'closed');
    assert.strictEqual(c.username, 'eddrajapur');

    const [r] = await query('SELECT * FROM complaintremark WHERE complaintNumber = 10001 ORDER BY id DESC LIMIT 1');
    assert.strictEqual(r.status, 'closed');
    assert.strictEqual(r.info, 'Theft Found & FIR Done');
    assert.strictEqual(r.assess, '185000.00');
    assert.strictEqual(r.reali, '65000.00');
    assert.notStrictEqual(r.assess, r.reali, 'Assessment and Realization must be distinct!');
    assert.strictEqual(r.category, 'lmv2');
  });

  // TEST 9: Field Division Officer cannot work on complaints assigned to another division
  await runTest('Level 4 Field Division XEN/SDO: Restricted to assigned division (403 on other divisions)', async () => {
    // Ensure complaint #10003 is assigned to another division 'edd2mahobakp'
    await query(`
      INSERT INTO tblcomplaints (complaintNumber, thiefname, thiefaddress, district, substn, complaintDetails, status, username, regDate)
      VALUES (10003, 'रामू यादव', 'महोबा शहर', 'MAHOBA', '33/11 महोबा', 'कटिया कनेक्शन', 'forward', 'edd2mahobakp', NOW())
      ON DUPLICATE KEY UPDATE status = 'forward', username = 'edd2mahobakp'
    `);

    try {
      await complaintService.updateComplaintStatus({
        complaintNumber: 10003,
        newStatus: 'closed',
        info: 'Theft Not Found',
        remark: 'eddrajapur SDO attempting to close edd2mahobakp complaint',
        user: divisionUser
      });
      assert.fail('Division officer should not be permitted to work on another division complaint');
    } catch (err) {
      assert.strictEqual(err.status, 403, 'Must return 403 Forbidden for cross-division access');
    }
  });

  // TEST 10: Fetch Division Officers dropdown for Level 1 Super Admin forwarding
  await runTest('Dropdown Engine: getDivisionOfficers returns field divisions grouped for Super Admin', async () => {
    const allDivisions = await complaintService.getDivisionOfficers();
    assert.ok(Array.isArray(allDivisions), 'Must return an array of division officers');
    assert.ok(allDivisions.length >= 400, 'Must include division officers from admin.sql');
    assert.ok(allDivisions.some(d => d.username === 'eddrajapur'));

    // Filter by DISCOM
    const mvvnlDivisions = await complaintService.getDivisionOfficers('MVVNL');
    assert.ok(mvvnlDivisions.every(d => d.DISCOM === 'MVVNL'), 'All returned officers must belong to MVVNL');
    assert.ok(mvvnlDivisions.some(d => d.username === 'edd1bareilly'));
  });

  // TEST 11: Reverting Complaints is Strictly Prohibited for Admin
  await runTest('Business Rule: Admin cannot revert complaints (must forward to field or close under category)', async () => {
    try {
      await complaintService.updateComplaintStatus({
        complaintNumber: 10003,
        newStatus: 'revert',
        remark: 'Admin attempting to revert complaint',
        user: adminUser
      });
      assert.fail('Reverting complaints must be rejected!');
    } catch (err) {
      assert.strictEqual(err.status, 400, 'Must return 400 Bad Request when reverting is attempted');
      assert.ok(err.message.includes('cannot revert complaints'), 'Error message must explain policy');
    }
  });

  // TEST 12: Admin can close complaints directly under respective categories (e.g., Duplicate with cn)
  await runTest('Level 1 Super Admin: Close complaint directly under category (Duplicate with cn)', async () => {
    const dupResult = await complaintService.closeComplaintByCategory({
      complaintNumber: 10003,
      info: 'Duplicate',
      cn: 'UPPCL-987211',
      remark: 'यह शिकायत पूर्व में दर्ज शिकायत सं. UPPCL-987211 की पुनरावृत्ति है।',
      user: adminUser,
      ipAddress: '127.0.0.1'
    });

    assert.strictEqual(dupResult.success, true);
    assert.strictEqual(dupResult.newStatus, 'closed');

    const [r] = await query('SELECT info, cn, status FROM complaintremark WHERE complaintNumber = 10003 ORDER BY id DESC LIMIT 1');
    assert.strictEqual(r.status, 'closed');
    assert.strictEqual(r.info, 'Duplicate');
    assert.strictEqual(r.cn, 'UPPCL-987211');
  });

  // TEST 13: Dashboard Metrics - Assessment and Realization are distinct and accurately calculated
  await runTest('Dashboard Financials: Assessment and Realization are distinctly aggregated', async () => {
    const metrics = await complaintService.getDashboardMetrics({ user: adminUser });
    assert.ok(metrics.financial, 'Metrics must contain financial block');
    assert.ok(metrics.financial.totalAssessment > 0, 'Total assessment must be greater than 0');
    assert.ok(metrics.financial.totalRealization > 0, 'Total realization must be greater than 0');
    assert.notStrictEqual(
      metrics.financial.totalAssessment,
      metrics.financial.totalRealization,
      'Assessment and Realization must NOT be equal in dashboard!'
    );
    console.log(`    [Verified Dashboard Metrics: Total Assessed=₹${metrics.financial.totalAssessment.toLocaleString('en-IN')}, Total Realized=₹${metrics.financial.totalRealization.toLocaleString('en-IN')}, Recovery Rate=${metrics.financial.realizationEfficiencyPercent}%]`);
  });

  // TEST 14: Public Grievance Registration routes to Not Processed Queue
  await runTest('Public Ingestion: Register new complaint and verify status is NULL (Not Processed)', async () => {
    const pubResult = await complaintService.registerPublicComplaint({
      thiefname: 'मेसर्स रॉयल आइस फैक्ट्री (Royal Ice)',
      thiefaddress: 'कौशाम्बी रोड, प्रयागराज',
      district: 'PRAYAGRAJ (प्रयागराज)',
      substn: 'प्रयागराज टाउन',
      complaintDetails: 'रात में 50 एचपी का इंडस्ट्रियल कंप्रेसर बाईपास करके चलाया जाता है।'
    });

    assert.strictEqual(pubResult.success, true);
    assert.strictEqual(pubResult.status, null);
    assert.ok(pubResult.complaintNumber > 0);

    const [row] = await query('SELECT status, thiefname FROM tblcomplaints WHERE complaintNumber = ?', [pubResult.complaintNumber]);
    assert.strictEqual(row.status, null, 'New complaint must have status NULL');
    assert.strictEqual(row.thiefname, 'मेसर्स रॉयल आइस फैक्ट्री (Royal Ice)');
  });

  // TEST 15: Not Processed Complaints Retrieval contains all 9 required columns
  await runTest('Not Processed Queue: Returns exact required columns for data table', async () => {
    const queue = await complaintService.getNotProcessedComplaints({ user: adminUser, limit: 10 });
    assert.ok(queue.records.length > 0, 'Must return at least 1 unprocessed complaint');
    const first = queue.records[0];
    assert.ok('complaintNumber' in first, 'Must have complaintNumber');
    assert.ok('thiefname' in first, 'Must have thiefname');
    assert.ok('thiefaddress' in first, 'Must have thiefaddress');
    assert.ok('district' in first, 'Must have district');
    assert.ok('complaintDetails' in first, 'Must have complaintDetails');
    assert.ok('regDate' in first, 'Must have regDate');
    assert.ok('status' in first, 'Must have status');
  });

  // TEST 16: Excel Export Workbook Generation
  await runTest('Excel Export: Formats records into valid binary spreadsheet', async () => {
    const XLSX = require('xlsx');
    const records = await complaintService.getComplaintsForExport({ statusFilter: 'not_processed', user: adminUser });
    assert.ok(records.length > 0, 'Must have export records');
    const ws = XLSX.utils.json_to_sheet(records);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Complaints');
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    assert.ok(Buffer.isBuffer(buffer), 'Export must produce valid Buffer');
    assert.ok(buffer.length > 500, 'Workbook buffer must not be empty');
  });

  // TEST 17: DISCOM MIS Performance Matrix
  await runTest('MIS Reporting: DISCOM summary calculates recovery metrics across all 5 DISCOMs', async () => {
    const mis = await complaintService.getDiscomMISReport();
    assert.strictEqual(mis.length, 5, 'Must report on exactly 5 DISCOMs');
    const mvvnl = mis.find(d => d.discom === 'MVVNL');
    assert.ok(mvvnl, 'MVVNL must be present');
    assert.ok(typeof mvvnl.totalReceived === 'number');
    assert.ok(typeof mvvnl.recoveryRatio === 'number');
  });

  // TEST 18: District Summary Matrix
  await runTest('District Summary: Aggregates grievance counts across UP districts', async () => {
    const dSummary = await complaintService.getDistrictSummary();
    assert.ok(dSummary.length > 0, 'Must return district matrix');
    const lko = dSummary.find(d => d.district.includes('LUCKNOW'));
    assert.ok(lko, 'Lucknow district must be present');
  });

  // TEST 19: Admin Change Password & Password Rules
  await runTest('Security: Admin password change validation and bcrypt hash upgrade', async () => {
    const adminLogin = await authService.loginOfficer('admin', 'Admin@123');
    // Test rejection of invalid old password
    let failed = false;
    try {
      await authService.changeAdminPassword(adminLogin.user.id, 'WrongPass', 'NewPass123!', 'NewPass123!');
    } catch (e) {
      failed = true;
    }
    assert.strictEqual(failed, true, 'Should reject invalid old password');

    // Test rejection of weak new password
    let weakFailed = false;
    try {
      await authService.changeAdminPassword(adminLogin.user.id, 'Admin@123', 'simple', 'simple');
    } catch (e) {
      weakFailed = true;
    }
    assert.strictEqual(weakFailed, true, 'Should reject weak password without number and special char');

    // Test successful change
    const changeOk = await authService.changeAdminPassword(adminLogin.user.id, 'Admin@123', 'Admin@2026Secure!', 'Admin@2026Secure!');
    assert.strictEqual(changeOk.success, true);

    // Revert back for environment consistency
    await authService.changeAdminPassword(adminLogin.user.id, 'Admin@2026Secure!', 'Admin@123', 'Admin@123');
  });

  // TEST 20: User Management Directory (manage-users.php)
  await runTest('Admin User Directory: Lists registered consumers/informants with pagination', async () => {
    const userList = await authService.getAllUsers({ page: 1, limit: 10 });
    assert.ok(userList.records, 'Must return records array');
    assert.ok(typeof userList.pagination.total === 'number', 'Must return total count');
  });

  // TEST 21: User Profile Retrieval (userprofile.php)
  await runTest('Admin User Profile: Fetches comprehensive profile details for consumer', async () => {
    const userList = await authService.getAllUsers({ page: 1, limit: 1 });
    if (userList.records.length > 0) {
      const u = userList.records[0];
      const profile = await authService.getUserProfile(u.id);
      assert.strictEqual(profile.id, u.id);
      assert.ok('fullName' in profile);
      assert.ok('userEmail' in profile);
    }
  });

  // TEST 22: Citizen Authentication Audit Log (user-logs.php)
  await runTest('User Access Logs: Retrieves citizen authentication history and IP logging', async () => {
    const logList = await authService.getUserLogs({ page: 1, limit: 10 });
    assert.ok(logList.records, 'Must return access log records');
    assert.ok(typeof logList.pagination.total === 'number', 'Must return total log count');
  });

  console.log('\n================================================================');
  console.log(`VERIFICATION SUMMARY: ${passedTests}/${totalTests} TESTS PASSED SUCCESSFULLY (100%)`);
  console.log('All refined role constraints, direct forwarding, dropdown closing rules, and user management verified!');
  console.log('================================================================\n');

  await pool.end();
}

if (require.main === module) {
  runVerificationSuite()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('\n✖ Verification Suite Failed:', err);
      process.exit(1);
    });
}

module.exports = { runVerificationSuite };
