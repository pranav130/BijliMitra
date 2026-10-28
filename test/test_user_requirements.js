const assert = require('assert');
const { pool, query } = require('../config/db');
const authService = require('../src/services/auth_service');
const complaintService = require('../src/services/complaint_service');

async function testUserRequirements() {
  console.log('================================================================');
  console.log('VERIFYING DISCOM & SUPERADMIN WORKFLOW REQUIREMENTS');
  console.log('================================================================\n');

  // 1. Verify Superadmin if and only if DISCOM is HQ
  console.log('1. Testing Role Resolution against admin.sql:');
  const hqAdmin = await authService.loginOfficer('admin', 'Admin@123');
  assert.strictEqual(hqAdmin.user.role, 'SUPER_ADMIN', 'admin must be SUPER_ADMIN because DISCOM is HQ');
  assert.strictEqual(hqAdmin.user.discom, 'HQ');
  assert.ok(hqAdmin.user.permissions.includes('FORWARD_DIRECT_TO_DIVISION'));
  console.log('  ✔ HQ admin verified as SUPER_ADMIN');

  const hqAdmin1 = await authService.loginOfficer('admin1', 'admin123');
  assert.strictEqual(hqAdmin1.user.role, 'SUPER_ADMIN', 'admin1 must be SUPER_ADMIN because DISCOM is HQ');
  console.log('  ✔ HQ admin1 verified as SUPER_ADMIN');

  // 2. Verify DISCOMs (DVVNL, KeSCO, MVVNL, PuVVNL, PVVNL)
  console.log('\n2. Testing 5 DISCOM Accounts:');
  const discomNames = ['DVVNL', 'KeSCO', 'MVVNL', 'PuVVNL', 'PVVNL'];
  const discomUsers = {};
  for (const d of discomNames) {
    const login = await authService.loginOfficer(d, 'Admin@123');
    assert.strictEqual(login.user.role, 'DISCOM_ADMIN', `${d} must be DISCOM_ADMIN`);
    assert.strictEqual(login.user.isReadOnly, true, `${d} must be view-only monitoring`);
    assert.strictEqual(login.user.discom, d, `${d} DISCOM must match`);
    discomUsers[d] = login.user;
    console.log(`  ✔ DISCOM ${d} verified as view-only DISCOM_ADMIN`);
  }

  // 3. Verify Field Division Officer (eddrajapur under DVVNL)
  console.log('\n3. Testing Field Division Officer under DVVNL:');
  const divLogin = await authService.loginOfficer('eddrajapur', 'Admin@123');
  assert.strictEqual(divLogin.user.role, 'DIVISION_OFFICER');
  assert.strictEqual(divLogin.user.discom, 'DVVNL');
  assert.strictEqual(divLogin.user.isReadOnly, false);
  console.log('  ✔ eddrajapur verified as DIVISION_OFFICER under DVVNL');

  // 4. Verify Forwarding Dropdown contains usernames from admin.sql
  console.log('\n4. Testing Forwarding Dropdown List:');
  const officers = await complaintService.getDivisionOfficers();
  assert.ok(officers.length > 400, `Must have >400 division accounts (got ${officers.length})`);
  const dvvnlOfficers = await complaintService.getDivisionOfficers('DVVNL');
  assert.ok(dvvnlOfficers.length > 80, `Must have >80 DVVNL accounts (got ${dvvnlOfficers.length})`);
  assert.ok(dvvnlOfficers.some(o => o.username === 'eddrajapur'), 'eddrajapur must be in DVVNL division dropdown');
  console.log(`  ✔ Forwarding dropdown contains ${officers.length} division usernames across all 5 DISCOMs`);
  console.log(`  ✔ Filtered DVVNL dropdown contains ${dvvnlOfficers.length} division usernames`);

  // 5. Test Superadmin forwarding complaint to division (eddrajapur under DVVNL)
  console.log('\n5. Testing Super Admin forwarding to division eddrajapur:');
  // First ensure complaint 10001 exists
  await query(`
    INSERT INTO tblcomplaints (complaintNumber, thiefname, thiefaddress, district, substn, complaintDetails, status, regDate)
    VALUES (10001, 'सुरेश कुमार यादव', 'मकान नं 45, राजापुर, चित्रकूट', 'CHITRAKOOT', '33/11 राजापुर', 'सीधे एलटी लाइन से कटिया डालकर आटा चक्की चलाना', NULL, NOW())
    ON DUPLICATE KEY UPDATE status = NULL, username = NULL
  `);

  const fwdRes = await complaintService.forwardDirectToDivision({
    complaintNumber: 10001,
    targetDivisionUsername: 'eddrajapur',
    remark: 'स्थल पर तत्काल छापा मारकर 135 विद्युत अधिनियम के अंतर्गत कार्यवाही करें।',
    user: hqAdmin.user,
    ipAddress: '127.0.0.1'
  });
  assert.strictEqual(fwdRes.success, true);
  assert.strictEqual(fwdRes.status, 'forward');
  assert.strictEqual(fwdRes.assignedDivision, 'eddrajapur');
  assert.strictEqual(fwdRes.discom, 'DVVNL');
  console.log('  ✔ Super Admin successfully forwarded complaint #10001 to eddrajapur (DVVNL)');

  // 6. Verify DISCOM Monitoring: DVVNL sees complaint #10001, MVVNL does NOT
  console.log('\n6. Testing DISCOM Respective Division Monitoring:');
  const dvvnlQueue = await complaintService.getForwardedComplaints({ user: discomUsers['DVVNL'] });
  const hasInDvvnl = dvvnlQueue.records.some(r => r.complaintNumber === 10001);
  assert.strictEqual(hasInDvvnl, true, 'DVVNL must see complaints forwarded to its division (eddrajapur)');
  console.log('  ✔ DVVNL successfully monitors complaint #10001 assigned to its division eddrajapur');

  const mvvnlQueue = await complaintService.getForwardedComplaints({ user: discomUsers['MVVNL'] });
  const hasInMvvnl = mvvnlQueue.records.some(r => r.complaintNumber === 10001);
  assert.strictEqual(hasInMvvnl, false, 'MVVNL must NOT see complaints forwarded to DVVNL division');
  console.log('  ✔ MVVNL correctly isolated from DVVNL division complaints');

  const hqQueue = await complaintService.getForwardedComplaints({ user: hqAdmin.user });
  const hasInHq = hqQueue.records.some(r => r.complaintNumber === 10001);
  assert.strictEqual(hasInHq, true, 'Super Admin (HQ) monitors all complaints across all DISCOMs');
  console.log('  ✔ Super Admin (HQ) monitors all complaints statewide');

  // 7. Verify In-Process Status Removal & Rejection
  console.log('\n7. Testing In-Process Status Removal:');
  try {
    await complaintService.updateComplaintStatus({
      complaintNumber: 10001,
      newStatus: 'process',
      remark: 'Attempting in-process status',
      user: divLogin.user,
      ipAddress: '127.0.0.1'
    });
    assert.fail('Should reject process status');
  } catch (err) {
    assert.ok(err.message.includes('In-process status has been removed'), 'Must explicitly reject in-process');
    console.log('  ✔ Correctly rejected "process" status: ' + err.message);
  }

  // 8. Field division closes complaint with verified outcome
  console.log('\n8. Testing Field Division Closure with FIR verdict:');
  const closeRes = await complaintService.updateComplaintStatus({
    complaintNumber: 10001,
    newStatus: 'closed',
    remark: 'परिसर पर छापा मारकर 3.5 kW की कटिया चोरी पकड़ी गई। धारा 135 के तहत एफआईआर दर्ज।',
    info: 'Theft Found & FIR Done',
    category: 'LMV-2',
    loads: '3.5',
    assess: '45000',
    reali: '15000',
    user: divLogin.user,
    ipAddress: '127.0.0.1'
  });
  assert.strictEqual(closeRes.success, true);
  assert.strictEqual(closeRes.status, 'closed');
  assert.strictEqual(closeRes.info, 'Theft Found & FIR Done');
  console.log('  ✔ eddrajapur successfully closed complaint with "Theft Found & FIR Done"');

  console.log('\n9. Testing Field Division Revert Back to Super Admin with Suggested Division:');
  // Reset complaint 10003 for revert testing
  await query(`
    INSERT INTO tblcomplaints (complaintNumber, thiefname, thiefaddress, district, substn, complaintDetails, status, username, regDate)
    VALUES (10003, 'रामू यादव', 'ग्राम कुबेरपुर, महोबा', 'MAHOBA', '33/11 कबरई', 'अवैध आटा चक्की संचालन', 'forward', 'eddrajapur', NOW())
    ON DUPLICATE KEY UPDATE status = 'forward', username = 'eddrajapur', sdivision = NULL
  `);

  const revertRes = await complaintService.revertComplaintToSuperadmin({
    complaintNumber: 10003,
    suggestedDivision: 'edd2mahobakp',
    remark: 'यह परिसर ईडीडी राजापुर क्षेत्र में नहीं आता। यह ईडीडी-2 महोबा क्षेत्र का है। कृपया वहां अग्रसारित करें।',
    user: divLogin.user,
    ipAddress: '127.0.0.1'
  });
  assert.strictEqual(revertRes.success, true);
  assert.strictEqual(revertRes.status, 'reverted');
  assert.strictEqual(revertRes.suggestedDivision, 'edd2mahobakp');
  console.log('  ✔ eddrajapur successfully reverted complaint #10003 to Super Admin with suggested division "edd2mahobakp"');

  console.log('\n10. Testing Super Admin Reversion Monitoring & Re-forwarding:');
  const revertedQueue = await complaintService.getRevertedComplaints({ user: hqAdmin.user });
  assert.ok(revertedQueue.records.some(r => r.complaintNumber === 10003 && r.sdivision === 'edd2mahobakp'), 'Complaint #10003 must be in Reverted Complaints queue');
  console.log('  ✔ Super Admin monitors Reverted Complaints queue and sees suggested division "edd2mahobakp"');

  // Super Admin re-forwards to edd2mahobakp
  const refwdRes = await complaintService.forwardDirectToDivision({
    complaintNumber: 10003,
    targetDivisionUsername: 'edd2mahobakp',
    remark: 'पुनः जांच हेतु ईडीडी-2 महोबा को अग्रसारित।',
    user: hqAdmin.user,
    ipAddress: '127.0.0.1'
  });
  assert.strictEqual(refwdRes.success, true);
  assert.strictEqual(refwdRes.status, 'forward');
  assert.strictEqual(refwdRes.assignedDivision, 'edd2mahobakp');
  console.log('  ✔ Super Admin successfully re-forwarded complaint #10003 to suggested division edd2mahobakp');

  // 11. Testing Division Wise No. Of Complaints DATA (Exact match to division-wise-dataHQ.php)
  console.log('\n11. Testing Division Wise No. Of Complaints DATA:');
  const divWiseData = await complaintService.getDivisionWiseData(hqAdmin.user);
  assert.strictEqual(divWiseData.length, 395, 'Must return exactly 395 field divisions across UP');
  const sampleDiv = divWiseData[0];
  assert.ok('discom' in sampleDiv);
  assert.ok('zone' in sampleDiv);
  assert.ok('circle' in sampleDiv);
  assert.ok('division' in sampleDiv);
  assert.ok('notProcessed' in sampleDiv);
  assert.ok('pendingBeyond5Days' in sampleDiv);
  assert.ok('closed' in sampleDiv);
  assert.ok('totalRecieved' in sampleDiv);
  console.log(`  ✔ Returned exactly ${divWiseData.length} field divisions matching division-wise-dataHQ.php`);
  console.log(`  ✔ Verified columns: DISCOM, ZONE, CIRCLE, DIVISION, NOT PROCESSED, PENDING BEYOND 5 DAYS, CLOSED, TOTAL RECIEVED`);

  // 12. Testing Public Officers Metadata for 440 Officer Logins Landing Page
  console.log('\n12. Testing Public Officers Metadata for 440 Logins Landing Page:');
  const allOfficers = await complaintService.getDivisionOfficers();
  assert.ok(allOfficers.length >= 435, 'Must provide full officer roster for login dropdown');
  console.log(`  ✔ Public officer roster contains ${allOfficers.length} departmental usernames for login autocomplete`);

  await pool.end();
  console.log('\n================================================================');
  console.log('ALL REQUIREMENTS VERIFIED SUCCESSFULLY (100% PASS)');
  console.log('================================================================\n');
}

testUserRequirements()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Test failed:', err);
    process.exit(1);
  });
