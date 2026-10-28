const express = require('express');
const router = express.Router();
const XLSX = require('xlsx');
const complaintService = require('../services/complaint_service');
const { authenticateToken } = require('../middleware/auth_middleware');

// POST /api/complaints/register (Replaces register-complaint2.php)
router.post('/register', async (req, res) => {
  try {
    const { thiefname, thiefaddress, district, substn, complaintDetails, complaintFile } = req.body;
    const result = await complaintService.registerPublicComplaint({
      thiefname,
      thiefaddress,
      district,
      substn,
      complaintDetails,
      complaintFile
    });
    res.status(201).json(result);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || 'Failed to submit grievance.' });
  }
});

// GET /api/complaints/export/excel (Replaces export_to_excel.php)
router.get('/export/excel', authenticateToken, async (req, res) => {
  try {
    const { status = 'not_processed', from_date, to_date, search, district } = req.query;
    const records = await complaintService.getComplaintsForExport({
      statusFilter: status,
      user: req.user,
      fromDate: from_date,
      toDate: to_date,
      search,
      district
    });

    const worksheet = XLSX.utils.json_to_sheet(records);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Complaints');

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=BijliMitra_Complaints_${Date.now()}.xlsx`);
    res.send(buffer);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || 'Failed to generate Excel export.' });
  }
});

// GET /api/complaints/reports/discom-summary (Replaces report.php)
router.get('/reports/discom-summary', authenticateToken, async (req, res) => {
  try {
    const { from_date, to_date } = req.query;
    const report = await complaintService.getDiscomMISReport({
      fromDate: from_date,
      toDate: to_date
    });
    res.json({ report });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to generate DISCOM report.' });
  }
});

// GET /api/complaints/reports/district-summary (Replaces view.php)
router.get('/reports/district-summary', authenticateToken, async (req, res) => {
  try {
    const summary = await complaintService.getDistrictSummary();
    res.json({ summary });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to generate district summary.' });
  }
});

// GET /api/complaints/reports/division-wise-data (Exact replica of division-wise-dataHQ.php & division-wise-dataDIS.php)
router.get('/reports/division-wise-data', authenticateToken, async (req, res) => {
  try {
    const divisions = await complaintService.getDivisionWiseData(req.user);
    res.json({ count: divisions.length, divisions });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to generate division-wise report.' });
  }
});

// GET /api/complaints/all (All Complaints Queue - Scoped by Role)
router.get('/all', authenticateToken, async (req, res) => {
  try {
    const { page, limit, from_date, to_date, search, district } = req.query;
    const result = await complaintService.getAllComplaints({
      user: req.user,
      page,
      limit,
      fromDate: from_date,
      toDate: to_date,
      search,
      district
    });
    res.json(result);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || 'Failed to retrieve all complaints.' });
  }
});

// GET /api/complaints/not-processed (Replaces notprocess-complaint.php & notprocess-complaintDIS.php)
router.get('/not-processed', authenticateToken, async (req, res) => {
  try {
    const { page, limit, from_date, to_date, search, district } = req.query;
    const result = await complaintService.getNotProcessedComplaints({
      user: req.user,
      page,
      limit,
      fromDate: from_date,
      toDate: to_date,
      search,
      district
    });
    res.json(result);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || 'Failed to retrieve unprocessed complaints.' });
  }
});

// GET /api/complaints/forwarded (Forwarded Complaints Queue / Division Working & DISCOM Monitoring)
router.get('/forwarded', authenticateToken, async (req, res) => {
  try {
    const { page, limit, from_date, to_date, search, district } = req.query;
    const result = await complaintService.getForwardedComplaints({
      user: req.user,
      page,
      limit,
      fromDate: from_date,
      toDate: to_date,
      search,
      district
    });
    res.json(result);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || 'Failed to retrieve forwarded complaints.' });
  }
});

// GET /api/complaints/reverted (Reverted Complaints Queue - Super Admin Reversion Monitoring & DISCOM Monitoring)
router.get('/reverted', authenticateToken, async (req, res) => {
  try {
    const { page, limit, from_date, to_date, search, district } = req.query;
    const result = await complaintService.getRevertedComplaints({
      user: req.user,
      page,
      limit,
      fromDate: from_date,
      toDate: to_date,
      search,
      district
    });
    res.json(result);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || 'Failed to retrieve reverted complaints.' });
  }
});

// GET /api/complaints/in-process (Mapped to forwarded complaints for backwards compatibility)
router.get('/in-process', authenticateToken, async (req, res) => {
  try {
    const { page, limit, from_date, to_date, search, district } = req.query;
    const result = await complaintService.getForwardedComplaints({
      user: req.user,
      page,
      limit,
      fromDate: from_date,
      toDate: to_date,
      search,
      district
    });
    res.json(result);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || 'Failed to retrieve complaints.' });
  }
});

// GET /api/complaints/closed (Replaces cclosed-complaint.php & closed-DISCOM.php)
router.get('/closed', authenticateToken, async (req, res) => {
  try {
    const { page, limit, from_date, to_date, search, district } = req.query;
    const result = await complaintService.getClosedComplaints({
      user: req.user,
      page,
      limit,
      fromDate: from_date,
      toDate: to_date,
      search,
      district
    });
    res.json(result);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || 'Failed to retrieve closed complaints.' });
  }
});

// GET /api/complaints/:cid (Replaces complaint-details.php & closed-complaint-editview.php)
router.get('/:cid', authenticateToken, async (req, res) => {
  try {
    const result = await complaintService.getComplaintDetails(req.params.cid, req.user);
    res.json(result);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || 'Failed to retrieve complaint details.' });
  }
});

// POST /api/complaints/:cid/forward-to-division (Super Admin Direct Forwarding to Field Division)
router.post('/:cid/forward-to-division', authenticateToken, async (req, res) => {
  try {
    const { target_division, targetDivisionUsername, remark } = req.body;
    const target = target_division || targetDivisionUsername;
    const result = await complaintService.forwardDirectToDivision({
      complaintNumber: req.params.cid,
      targetDivisionUsername: target,
      remark,
      user: req.user,
      ipAddress: req.ip || req.connection.remoteAddress
    });
    res.json(result);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || 'Failed to forward complaint to division.' });
  }
});

// GET /api/complaints/dashboard/metrics (Financial Assessment vs Realization & Operational Counts)
router.get('/dashboard/metrics', authenticateToken, async (req, res) => {
  try {
    const { from_date, to_date, discom } = req.query;
    const metrics = await complaintService.getDashboardMetrics({
      user: req.user,
      fromDate: from_date,
      toDate: to_date,
      discom
    });
    res.json(metrics);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || 'Failed to retrieve dashboard metrics.' });
  }
});

// POST /api/complaints/:cid/close-category (Admin / Field Officer Close under Respective Category)
router.post('/:cid/close-category', authenticateToken, async (req, res) => {
  try {
    const {
      info,
      remark,
      category,
      loads,
      assess,
      reali,
      scat,
      acat,
      sload,
      aload,
      cn,
      filek
    } = req.body;

    const result = await complaintService.closeComplaintByCategory({
      complaintNumber: req.params.cid,
      info,
      remark,
      category,
      loads,
      assess,
      reali,
      scat,
      acat,
      sload,
      aload,
      cn,
      filek,
      user: req.user,
      ipAddress: req.ip || req.connection.remoteAddress
    });
    res.json(result);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || 'Failed to close complaint under category.' });
  }
});

// POST /api/complaints/:cid/close-frivolous (Super Admin / Division Close as Frivolous)
router.post('/:cid/close-frivolous', authenticateToken, async (req, res) => {
  try {
    const { remark, filek } = req.body;
    const result = await complaintService.closeComplaintAsFrivolous({
      complaintNumber: req.params.cid,
      remark,
      filek,
      user: req.user,
      ipAddress: req.ip || req.connection.remoteAddress
    });
    res.json(result);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || 'Failed to close complaint as frivolous.' });
  }
});

// POST /api/complaints/:cid/revert-to-superadmin (Field Division Revert with Suggested Division)
router.post('/:cid/revert-to-superadmin', authenticateToken, async (req, res) => {
  try {
    const { suggestedDivision, remark } = req.body;
    const result = await complaintService.revertComplaintToSuperadmin({
      complaintNumber: req.params.cid,
      suggestedDivision,
      remark,
      user: req.user,
      ipAddress: req.ip || req.connection.remoteAddress
    });
    res.json(result);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || 'Failed to revert complaint.' });
  }
});

// POST /api/complaints/:cid/update-status (Field Division Execution with Dropdown Functionalities)
router.post('/:cid/update-status', authenticateToken, async (req, res) => {
  try {
    const {
      status,
      remark,
      assigned_username,
      info,
      category,
      loads,
      assess,
      reali,
      scat,
      acat,
      sload,
      aload,
      cn,
      filek
    } = req.body;

    const result = await complaintService.updateComplaintStatus({
      complaintNumber: req.params.cid,
      newStatus: status,
      remark,
      assignedUsername: assigned_username,
      info,
      category,
      loads,
      assess,
      reali,
      scat,
      acat,
      sload,
      aload,
      cn,
      filek,
      user: req.user,
      ipAddress: req.ip || req.connection.remoteAddress
    });

    res.json(result);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || 'Failed to update complaint status.' });
  }
});

// GET /api/complaints/meta/division-officers (Replaces select_division.php)
router.get('/meta/division-officers', authenticateToken, async (req, res) => {
  try {
    const { discom } = req.query;
    const officers = await complaintService.getDivisionOfficers(discom);
    res.json({ officers });
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve division officers list.' });
  }
});

// GET /api/complaints/meta/officers-all (Public metadata for 440 officer accounts on login screen)
router.get('/meta/officers-all', async (req, res) => {
  try {
    const officers = await complaintService.getDivisionOfficers();
    res.json({ officers });
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve officers list.' });
  }
});

// GET /api/complaints/meta/districts
router.get('/meta/districts', async (req, res) => {
  try {
    const districts = await complaintService.getDistricts();
    res.json({ districts });
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve district list.' });
  }
});

// GET /api/complaints/meta/categories
router.get('/meta/categories', async (req, res) => {
  try {
    const categories = await complaintService.getCategories();
    res.json({ categories });
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve category list.' });
  }
});

module.exports = router;
