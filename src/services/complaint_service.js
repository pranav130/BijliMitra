const { query, withTransaction } = require('../../config/db');

/**
 * Helper to build where clauses with parameter binding
 */
function buildComplaintFilters({ statusFilter, user, fromDate, toDate, search, district }) {
  const conditions = [];
  const params = [];

  // Status conditions
  if (statusFilter === 'not_processed') {
    conditions.push('(c.status IS NULL OR c.status = "" OR c.status = "0")');
  } else if (statusFilter === 'forwarded' || statusFilter === 'forward' || statusFilter === 'process') {
    conditions.push('c.status = "forward"');
  } else if (statusFilter === 'closed') {
    conditions.push('c.status = "closed"');
  } else if (statusFilter) {
    conditions.push('c.status = ?');
    params.push(statusFilter);
  }

  // DISCOM / Zonal / Divisional Scoping
  // Rule: if DISCOM is HQ then only it is superadmin who forwards & monitors all complaints
  if (user && !user.isSuperAdmin && user.role !== 'SUPER_ADMIN') {
    if (user.role === 'DISCOM_ADMIN' && user.discom) {
      // DISCOM Corporate HQ views complaints belonging to its respective division usernames or districts
      conditions.push('(a.DISCOM = ? OR c.username IN (SELECT username FROM admin WHERE DISCOM = ?) OR c.district IN (SELECT stateName FROM state WHERE stateDescription LIKE CONCAT("%", ?, "%")))');
      params.push(user.discom, user.discom, user.discom);
    } else if (user.role === 'ZONE_ADMIN' && user.zone) {
      conditions.push('a.zone = ?');
      params.push(user.zone);
    } else if (user.role === 'DIVISION_OFFICER') {
      // Field Division SDO/XEN views grievances assigned to their division username
      conditions.push('(c.username = ? OR a.username = ?)');
      params.push(user.username, user.username);
    }
  }

  // Date Range Filter (regDate between from_date and to_date)
  if (fromDate && toDate) {
    conditions.push('DATE(c.regDate) BETWEEN ? AND ?');
    params.push(fromDate, toDate);
  } else if (fromDate) {
    conditions.push('DATE(c.regDate) >= ?');
    params.push(fromDate);
  } else if (toDate) {
    conditions.push('DATE(c.regDate) <= ?');
    params.push(toDate);
  }

  // District filter
  if (district) {
    conditions.push('c.district = ?');
    params.push(district);
  }

  // Free text search
  if (search) {
    const term = `%${search.trim()}%`;
    conditions.push('(c.complaintNumber LIKE ? OR c.thiefname LIKE ? OR c.thiefaddress LIKE ? OR c.substn LIKE ?)');
    params.push(term, term, term, term);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  return { whereClause, params };
}

/**
 * List Not Processed Complaints (Replacing notprocess-complaint.php & notprocess-complaintDIS.php)
 */
async function getNotProcessedComplaints({ user, page = 1, limit = 20, fromDate, toDate, search, district }) {
  const p = Math.max(1, parseInt(page, 10));
  const l = Math.max(1, Math.min(100, parseInt(limit, 10)));
  const offset = (p - 1) * l;

  const { whereClause, params } = buildComplaintFilters({
    statusFilter: 'not_processed',
    user,
    fromDate,
    toDate,
    search,
    district
  });

  const countSql = `
    SELECT COUNT(*) AS total
    FROM tblcomplaints c
    LEFT JOIN admin a ON c.username = a.username
    ${whereClause}
  `;
  const [countResult] = await query(countSql, params);
  const total = countResult ? countResult.total : 0;

  const dataSql = `
    SELECT 
      c.complaintNumber,
      c.thiefname,
      c.thiefaddress,
      c.district,
      c.substn,
      c.complaintDetails,
      c.complaintFile,
      c.regDate,
      c.status,
      c.lastUpdationDate,
      c.username AS assigned_username,
      c.sdivision,
      a.DISCOM AS discom_name,
      a.zone AS zone_name,
      a.circle AS circle_name
    FROM tblcomplaints c
    LEFT JOIN admin a ON c.username = a.username
    ${whereClause}
    ORDER BY c.regDate DESC
    LIMIT ${l} OFFSET ${offset}
  `;
  const records = await query(dataSql, params);

  return {
    records,
    pagination: {
      total,
      page: p,
      limit: l,
      totalPages: Math.ceil(total / l)
    }
  };
}

/**
 * List Forwarded Complaints (Field Division Working Queue & DISCOM Monitoring)
 */
async function getForwardedComplaints(options) {
  const p = Math.max(1, parseInt(options.page || 1, 10));
  const l = Math.max(1, Math.min(100, parseInt(options.limit || 20, 10)));
  const offset = (p - 1) * l;

  const { whereClause, params } = buildComplaintFilters({
    statusFilter: 'forwarded',
    user: options.user,
    fromDate: options.fromDate,
    toDate: options.toDate,
    search: options.search,
    district: options.district
  });

  const countSql = `
    SELECT COUNT(*) AS total
    FROM tblcomplaints c
    LEFT JOIN admin a ON c.username = a.username
    ${whereClause}
  `;
  const [countResult] = await query(countSql, params);
  const total = countResult ? countResult.total : 0;

  const dataSql = `
    SELECT 
      c.complaintNumber,
      c.thiefname,
      c.thiefaddress,
      c.district,
      c.substn,
      c.complaintDetails,
      c.complaintFile,
      c.regDate,
      c.status,
      c.lastUpdationDate,
      c.username AS assigned_username,
      c.sdivision,
      a.DISCOM AS discom_name,
      a.zone AS zone_name,
      a.circle AS circle_name
    FROM tblcomplaints c
    LEFT JOIN admin a ON c.username = a.username
    ${whereClause}
    ORDER BY c.lastUpdationDate DESC, c.regDate DESC
    LIMIT ${l} OFFSET ${offset}
  `;
  const records = await query(dataSql, params);

  return {
    records,
    pagination: { total, page: p, limit: l, totalPages: Math.ceil(total / l) }
  };
}

// Backward compatibility alias
const getInProcessComplaints = getForwardedComplaints;

/**
 * List Reverted Complaints (Super Admin Reversion Monitoring Queue & DISCOM Monitoring)
 * (Matching notprocess-reverted.php)
 */
async function getRevertedComplaints(options) {
  const p = Math.max(1, parseInt(options.page || 1, 10));
  const l = Math.max(1, Math.min(100, parseInt(options.limit || 20, 10)));
  const offset = (p - 1) * l;

  const { whereClause, params } = buildComplaintFilters({
    statusFilter: 'reverted',
    user: options.user,
    fromDate: options.fromDate,
    toDate: options.toDate,
    search: options.search,
    district: options.district
  });

  const countSql = `
    SELECT COUNT(*) AS total
    FROM tblcomplaints c
    LEFT JOIN admin a ON c.username = a.username
    ${whereClause}
  `;
  const [countResult] = await query(countSql, params);
  const total = countResult ? countResult.total : 0;

  const dataSql = `
    SELECT 
      c.complaintNumber,
      c.thiefname,
      c.thiefaddress,
      c.district,
      c.substn,
      c.complaintDetails,
      c.complaintFile,
      c.regDate,
      c.status,
      c.lastUpdationDate,
      c.username AS assigned_username,
      c.sdivision,
      a.DISCOM AS discom_name,
      a.zone AS zone_name,
      a.circle AS circle_name,
      (SELECT remark FROM complaintremark WHERE complaintNumber = c.complaintNumber ORDER BY id DESC LIMIT 1) AS revert_remark,
      (SELECT remarkDate FROM complaintremark WHERE complaintNumber = c.complaintNumber ORDER BY id DESC LIMIT 1) AS revert_date
    FROM tblcomplaints c
    LEFT JOIN admin a ON c.username = a.username
    ${whereClause}
    ORDER BY c.lastUpdationDate DESC, c.regDate DESC
    LIMIT ${l} OFFSET ${offset}
  `;
  const records = await query(dataSql, params);

  return {
    records,
    pagination: { total, page: p, limit: l, totalPages: Math.ceil(total / l) }
  };
}

/**
 * List Closed Complaints (Replacing cclosed-complaint.php & closed-DISCOM.php)
 */
async function getClosedComplaints(options) {
  const p = Math.max(1, parseInt(options.page || 1, 10));
  const l = Math.max(1, Math.min(100, parseInt(options.limit || 20, 10)));
  const offset = (p - 1) * l;

  const { whereClause, params } = buildComplaintFilters({
    statusFilter: 'closed',
    user: options.user,
    fromDate: options.fromDate,
    toDate: options.toDate,
    search: options.search,
    district: options.district
  });

  const countSql = `
    SELECT COUNT(*) AS total
    FROM tblcomplaints c
    LEFT JOIN admin a ON c.username = a.username
    ${whereClause}
  `;
  const [countResult] = await query(countSql, params);
  const total = countResult ? countResult.total : 0;

  const dataSql = `
    SELECT 
      c.complaintNumber,
      c.thiefname,
      c.thiefaddress,
      c.district,
      c.substn,
      c.complaintDetails,
      c.complaintFile,
      c.regDate,
      c.status,
      c.lastUpdationDate,
      c.username AS assigned_username,
      c.sdivision,
      r.assess AS penalty_assessed,
      r.reali AS penalty_realized,
      r.info AS enforcement_verdict,
      r.filek AS inspection_document
    FROM tblcomplaints c
    LEFT JOIN admin a ON c.username = a.username
    LEFT JOIN (
      SELECT r1.* FROM complaintremark r1
      INNER JOIN (
        SELECT complaintNumber, MAX(id) AS max_id 
        FROM complaintremark 
        WHERE status = 'closed'
        GROUP BY complaintNumber
      ) r2 ON r1.id = r2.max_id
    ) r ON c.complaintNumber = r.complaintNumber
    ${whereClause}
    ORDER BY c.lastUpdationDate DESC
    LIMIT ${l} OFFSET ${offset}
  `;
  const records = await query(dataSql, params);

  return {
    records,
    pagination: { total, page: p, limit: l, totalPages: Math.ceil(total / l) }
  };
}

/**
 * List All Complaints (Scoped by Role: Superadmin sees statewide, DISCOM sees discom, Division sees division)
 */
async function getAllComplaints(options) {
  const p = Math.max(1, parseInt(options.page || 1, 10));
  const l = Math.max(1, Math.min(100, parseInt(options.limit || 20, 10)));
  const offset = (p - 1) * l;

  const { whereClause, params } = buildComplaintFilters({
    statusFilter: null, // all statuses
    user: options.user,
    fromDate: options.fromDate,
    toDate: options.toDate,
    search: options.search,
    district: options.district
  });

  const countSql = `
    SELECT COUNT(*) AS total
    FROM tblcomplaints c
    LEFT JOIN admin a ON c.username = a.username
    ${whereClause}
  `;
  const [countResult] = await query(countSql, params);
  const total = countResult ? countResult.total : 0;

  const dataSql = `
    SELECT 
      c.complaintNumber,
      c.thiefname,
      c.thiefaddress,
      c.district,
      c.substn,
      c.complaintDetails,
      c.complaintFile,
      c.regDate,
      c.status,
      c.lastUpdationDate,
      c.username AS assigned_username,
      c.sdivision,
      a.DISCOM AS discom_name,
      a.zone AS zone_name,
      a.circle AS circle_name
    FROM tblcomplaints c
    LEFT JOIN admin a ON c.username = a.username
    ${whereClause}
    ORDER BY c.regDate DESC
    LIMIT ${l} OFFSET ${offset}
  `;
  const records = await query(dataSql, params);

  return {
    records,
    pagination: {
      total,
      page: p,
      limit: l,
      totalPages: Math.ceil(total / l)
    }
  };
}

/**
 * Fetch Full Complaint Dossier with Audit Remarks Timeline
 */
async function getComplaintDetails(complaintNumber, user) {
  const num = parseInt(complaintNumber, 10);
  if (isNaN(num)) throw { status: 400, message: 'Invalid complaint number.' };

  const [complaint] = await query(
    `SELECT 
      c.*,
      a.DISCOM AS discom_name,
      a.zone AS zone_name,
      a.circle AS circle_name
     FROM tblcomplaints c
     LEFT JOIN admin a ON c.username = a.username
     WHERE c.complaintNumber = ? LIMIT 1`,
    [num]
  );

  if (!complaint) {
    throw { status: 404, message: `Complaint #${num} not found.` };
  }

  // Scoped read authorization check
  if (user && !user.isSuperAdmin) {
    if (user.role === 'DISCOM_ADMIN' && complaint.discom_name && complaint.discom_name !== user.discom) {
      throw { status: 403, message: 'Access denied: Grievance outside officer DISCOM jurisdiction.' };
    }
    if (user.role === 'ZONE_ADMIN' && complaint.zone_name && complaint.zone_name !== user.zone) {
      throw { status: 403, message: 'Access denied: Grievance outside officer Zonal jurisdiction.' };
    }
    if (user.role === 'DIVISION_OFFICER' && complaint.username && complaint.username !== user.username) {
      throw { status: 403, message: 'Access denied: Grievance outside officer Division jurisdiction.' };
    }
  }

  const remarks = await query(
    `SELECT 
      id, complaintNumber, status, remark, remarkDate, username, info,
      category, loads, assess, reali, scat, acat, sload, aload, cn, filek
     FROM complaintremark
     WHERE complaintNumber = ?
     ORDER BY remarkDate ASC, id ASC`,
    [num]
  );

  return {
    complaint,
    timeline: remarks
  };
}

/**
 * Super Admin Action: Forward complaint directly to Level 4 Field Division XEN & SDO
 * (Replacing updatecomplaintf.php & select_division.php)
 */
async function forwardDirectToDivision({ complaintNumber, targetDivisionUsername, remark, user, ipAddress }) {
  if (user.role !== 'SUPER_ADMIN') {
    throw { status: 403, message: 'Forbidden: Only Level 1 UPPCL HQ Super Admin can forward complaints directly to Field Divisions.' };
  }
  const num = parseInt(complaintNumber, 10);
  if (isNaN(num)) throw { status: 400, message: 'Invalid complaint number.' };
  if (!targetDivisionUsername) throw { status: 400, message: 'Target field division officer username is required.' };
  if (!remark || remark.trim().length === 0) throw { status: 400, message: 'Forwarding remarks are mandatory.' };

  // Validate target officer exists in admin table and belongs to one of the 5 DISCOMs
  const targetRows = await query(
    'SELECT id, username, DISCOM, zone, circle FROM admin WHERE username = ? AND DISCOM IN ("DVVNL", "KeSCO", "MVVNL", "PuVVNL", "PVVNL") LIMIT 1',
    [targetDivisionUsername.trim()]
  );
  if (targetRows.length === 0) {
    throw { status: 400, message: `Invalid field division officer '${targetDivisionUsername}'. Must be a valid divisional account under DVVNL, KeSCO, MVVNL, PuVVNL, or PVVNL.` };
  }
  const targetOfficer = targetRows[0];

  return await withTransaction(async (conn) => {
    const [existing] = await conn.execute(
      'SELECT complaintNumber, status, username FROM tblcomplaints WHERE complaintNumber = ? FOR UPDATE',
      [num]
    );
    if (existing.length === 0) throw { status: 404, message: `Complaint #${num} not found.` };

    const current = existing[0];

    // 1. Insert into complaintremark
    const [insRemark] = await conn.execute(
      `INSERT INTO complaintremark 
       (complaintNumber, status, remark, remarkDate, username, info)
       VALUES (?, 'forward', ?, NOW(), ?, ?)`,
      [num, remark.trim(), user.username, `Forwarded Directly to Field Division (${targetOfficer.username} - ${targetOfficer.DISCOM})`]
    );

    // 2. Update tblcomplaints
    await conn.execute(
      'UPDATE tblcomplaints SET status = "forward", username = ?, lastUpdationDate = NOW() WHERE complaintNumber = ?',
      [targetOfficer.username, num]
    );

    // 3. Record in audit_trail
    await conn.execute(
      `INSERT INTO audit_trail (complaintNumber, action, performed_by, discom, details_json, ip_address, created_at)
       VALUES (?, 'FORWARD_DIRECT_TO_DIVISION', ?, ?, ?, ?, NOW())`,
      [
        num,
        user.username,
        user.discom || 'HQ',
        JSON.stringify({ previousStatus: current.status, targetDivision: targetOfficer.username, discom: targetOfficer.DISCOM, zone: targetOfficer.zone }),
        ipAddress || '127.0.0.1'
      ]
    );

    return {
      success: true,
      complaintNumber: num,
      status: 'forward',
      assignedDivision: targetOfficer.username,
      discom: targetOfficer.DISCOM,
      zone: targetOfficer.zone,
      remarkId: insRemark.insertId
    };
  });
}

/**
 * Close Complaint under Respective Category
 * Executable by Level 1 HQ Super Admin or Level 4 Field Division Officer
 * Allowed closing categories (from upclosedcomplaint.php):
 *  - Frivolous (फर्जी/आधारहीन)
 *  - Duplicate (पुनरावृत्ति शिकायत - requires duplicate ticket 'cn')
 *  - Theft Not Found (मौके पर चोरी नहीं पाई गई / वैध कनेक्शन)
 *  - Wrong Tariff (गलत टैरिफ - requires scat, acat, sload, aload, assess, reali)
 *  - Load Enhancement Case (लोड वृद्धि केस - requires sload, aload)
 *  - Reading Storage Case (रीडिंग स्टोर केस)
 *  - Theft Found & FIR Done (चोरी पुष्ट एवं एफआईआर दर्ज - requires category, load, assess, optional reali)
 */
async function closeComplaintByCategory({
  complaintNumber,
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
  user,
  ipAddress
}) {
  return await updateComplaintStatus({
    complaintNumber,
    newStatus: 'closed',
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
    user,
    ipAddress
  });
}

/**
 * Revert Complaint Back to Super Admin with Suggested Division
 * (Matching updatecomplaintvr.php & complaint-detailsv.php)
 * Field division usernames can revert complaints with suggested division username.
 */
async function revertComplaintToSuperadmin({ complaintNumber, suggestedDivision, remark, user, ipAddress }) {
  if (!user) throw { status: 401, message: 'Authentication required.' };

  // DISCOM HQ and Zone Admins are view-only
  if (user.isReadOnly || user.role === 'DISCOM_ADMIN' || user.role === 'ZONE_ADMIN') {
    throw {
      status: 403,
      message: 'Forbidden: Monitoring accounts have view-only access and cannot revert complaints.'
    };
  }

  // Admin cannot revert complaints (only field division officers can revert back to Super Admin)
  if (user.role === 'SUPER_ADMIN') {
    throw {
      status: 400,
      message: 'Admin cannot revert complaints (must forward to field or close under category).'
    };
  }

  const num = parseInt(complaintNumber, 10);
  if (isNaN(num)) throw { status: 400, message: 'Invalid complaint number.' };
  if (!remark || remark.trim().length === 0) {
    throw { status: 400, message: 'Remark text is mandatory explaining the reason for reverting.' };
  }
  if (!suggestedDivision || suggestedDivision.trim().length === 0) {
    throw { status: 400, message: 'Suggested division username is mandatory when reverting to Super Admin.' };
  }

  const sDiv = suggestedDivision.trim();

  return await withTransaction(async (conn) => {
    const [rows] = await conn.execute(
      'SELECT complaintNumber, status, username FROM tblcomplaints WHERE complaintNumber = ? FOR UPDATE',
      [num]
    );

    if (rows.length === 0) {
      throw { status: 404, message: `Complaint #${num} not found.` };
    }

    const current = rows[0];

    // Field division officers can only revert complaints assigned to them
    if (user.role === 'DIVISION_OFFICER' && current.username && current.username !== user.username) {
      throw {
        status: 403,
        message: `Access denied: Complaint #${num} is assigned to '${current.username}'. Field officers can only revert their own assigned complaints.`
      };
    }

    // Update tblcomplaints: status = 'reverted', sdivision = sDiv
    await conn.execute(
      'UPDATE tblcomplaints SET status = ?, sdivision = ?, lastUpdationDate = NOW() WHERE complaintNumber = ?',
      ['reverted', sDiv, num]
    );

    // Insert complaintremark: status = 'reverted', sdivision recorded in info / remark
    await conn.execute(
      `INSERT INTO complaintremark (complaintNumber, status, remark, username, info, remarkDate)
       VALUES (?, ?, ?, ?, ?, NOW())`,
      [num, 'reverted', remark.trim(), user.username, `Reverted with suggested division: ${sDiv}`]
    );

    // Audit trail
    await conn.execute(
      `INSERT INTO audit_trail (complaintNumber, action, performed_by, discom, details_json, ip_address, created_at)
       VALUES (?, ?, ?, ?, ?, ?, NOW())`,
      [
        num,
        'REVERT_TO_SUPERADMIN',
        user.username,
        user.discom || null,
        JSON.stringify({ suggestedDivision: sDiv, remark: remark.trim() }),
        ipAddress || '127.0.0.1'
      ]
    );

    return {
      success: true,
      complaintNumber: num,
      status: 'reverted',
      suggestedDivision: sDiv,
      message: `Complaint #${num} reverted back to Super Admin with suggested division '${sDiv}'.`
    };
  });
}

/**
 * Close Complaint as Frivolous (Direct shortcut for Super Admin or Field Division)
 */
async function closeComplaintAsFrivolous({ complaintNumber, remark, filek, user, ipAddress }) {
  return await closeComplaintByCategory({
    complaintNumber,
    info: 'Frivolous',
    remark,
    filek,
    user,
    ipAddress
  });
}

/**
 * Execute Field Working & Close Complaint using actual PHP Dropdown Functionalities
 * (Matching upclosedcomplaint.php / view_complaint.php)
 */
async function updateComplaintStatus({
  complaintNumber,
  newStatus,
  remark,
  assignedUsername,
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
  user,
  ipAddress
}) {
  // CRITICAL SECURITY RULE: Level 2 DISCOM HQ & Level 3 Zonal Chief Engineers are VIEW-ONLY
  if (user.isReadOnly || user.role === 'DISCOM_ADMIN' || user.role === 'ZONE_ADMIN' || user.role === 'MONITORING_OFFICER') {
    throw {
      status: 403,
      message: 'Forbidden: Monitoring accounts (DISCOM Corporate HQ and Zonal Chief Engineers) have VIEW-ONLY rights to monitor field working. Complaints can only be worked on and closed by Level 4 Field Division XEN/SDOs or Level 1 HQ Super Admin.'
    };
  }

  const num = parseInt(complaintNumber, 10);
  if (isNaN(num)) throw { status: 400, message: 'Invalid complaint number.' };
  if (!newStatus) throw { status: 400, message: 'New status is required.' };
  if (!remark || remark.trim().length === 0) throw { status: 400, message: 'Remark text is mandatory for all status transitions.' };

  // In-process status has been removed from the platform per requirement
  if (newStatus === 'process' || newStatus === 'in Process') {
    throw {
      status: 400,
      message: 'In-process status has been removed from the platform. Complaints can be forwarded to a division or closed under the respective verdict category.'
    };
  }

  // If reverting is attempted:
  if (newStatus === 'revert' || newStatus === 'reverted') {
    if (user.role === 'SUPER_ADMIN') {
      throw {
        status: 400,
        message: 'Admin cannot revert complaints (must forward to field or close under category).'
      };
    }
    const sDiv = assignedUsername || info;
    return await revertComplaintToSuperadmin({
      complaintNumber: num,
      suggestedDivision: sDiv,
      remark,
      user,
      ipAddress
    });
  }

  const validStatuses = ['forward', 'closed'];
  if (!validStatuses.includes(newStatus)) {
    throw { status: 400, message: `Invalid target status '${newStatus}'. Allowed: ${validStatuses.join(', ')}` };
  }

  // Exact validation of the 7 closing outcomes from upclosedcomplaint.php
  if (newStatus === 'closed') {
    const validOutcomes = [
      'Theft Found & FIR Done',
      'Wrong Tariff',
      'Load Enhancement Case',
      'Duplicate',
      'Frivolous',
      'Theft Not Found',
      'Reading Storage Case'
    ];
    if (!info || !validOutcomes.includes(info)) {
      throw { status: 400, message: `Closing a complaint requires a valid Theft Info outcome: ${validOutcomes.join(', ')}` };
    }

    if (info === 'Theft Found & FIR Done') {
      if (!category && !acat) throw { status: 400, message: 'Category is mandatory when theft is found.' };
      if (!loads && !aload) throw { status: 400, message: 'Detected load (in kW) is mandatory when theft is found.' };
      if (assess === undefined || assess === null || isNaN(Number(assess))) {
        throw { status: 400, message: 'Assessment penalty ₹ must be a valid numeric value.' };
      }
    } else if (info === 'Wrong Tariff') {
      if (!scat) throw { status: 400, message: 'Sanctioned category is mandatory for Wrong Tariff.' };
      if (!acat) throw { status: 400, message: 'Actual category detected is mandatory for Wrong Tariff.' };
    } else if (info === 'Load Enhancement Case') {
      if (!sload) throw { status: 400, message: 'Sanctioned load is mandatory for Load Enhancement.' };
      if (!aload) throw { status: 400, message: 'Actual load detected is mandatory for Load Enhancement.' };
    } else if (info === 'Duplicate') {
      if (!cn || String(cn).trim().length === 0) throw { status: 400, message: 'Duplicate complaint number reference is required.' };
    }
  }

  return await withTransaction(async (conn) => {
    // Lock row for update
    const [existingRows] = await conn.execute(
      'SELECT complaintNumber, status, username, district FROM tblcomplaints WHERE complaintNumber = ? FOR UPDATE',
      [num]
    );

    if (existingRows.length === 0) {
      throw { status: 404, message: `Complaint #${num} not found.` };
    }

    const current = existingRows[0];

    // Field Division officers can only work on grievances assigned to them
    if (user.role === 'DIVISION_OFFICER' && current.username && current.username !== user.username) {
      throw { status: 403, message: `Access denied: Complaint #${num} is assigned to '${current.username}'. Field officers can only work on their own division's complaints.` };
    }

    const targetUsername = assignedUsername || current.username || user.username;

    // 1. Insert into complaintremark
    const [remarkResult] = await conn.execute(
      `INSERT INTO complaintremark 
       (complaintNumber, status, remark, remarkDate, username, info, category, loads, assess, reali, scat, acat, sload, aload, cn, filek)
       VALUES (?, ?, ?, NOW(), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        num,
        newStatus,
        remark.trim(),
        user.username,
        info || (newStatus === 'forward' ? 'Forwarded to Division' : newStatus === 'process' ? 'In Process' : 'Closed'),
        category || acat || null,
        loads || aload || null,
        assess !== undefined && assess !== null && assess !== '' ? String(assess) : null,
        reali !== undefined && reali !== null && reali !== '' ? String(reali) : null,
        scat || null,
        acat || null,
        sload || null,
        aload || null,
        cn || null,
        filek || null
      ]
    );

    // 2. Update tblcomplaints
    await conn.execute(
      'UPDATE tblcomplaints SET status = ?, username = ?, lastUpdationDate = NOW() WHERE complaintNumber = ?',
      [newStatus, targetUsername, num]
    );

    // 3. Insert audit log
    await conn.execute(
      `INSERT INTO audit_trail (complaintNumber, action, performed_by, discom, details_json, ip_address, created_at)
       VALUES (?, ?, ?, ?, ?, ?, NOW())`,
      [
        num,
        `STATUS_CHANGE_TO_${newStatus.toUpperCase()}`,
        user.username,
        user.discom || 'N/A',
        JSON.stringify({ oldStatus: current.status, newStatus, info, assess, reali }),
        ipAddress || '127.0.0.1'
      ]
    );

    return {
      success: true,
      complaintNumber: num,
      previousStatus: current.status,
      status: newStatus,
      newStatus,
      info: info || null,
      remarkId: remarkResult.insertId,
      assignedUsername: targetUsername,
      updatedAt: new Date().toISOString()
    };
  });
}

/**
 * Fetch list of all Field Division Officers (Level 4) for Super Admin forwarding dropdown
 * (Replacing select_division.php)
 */
async function getDivisionOfficers(discomFilter = null) {
  let sql = `
    SELECT id, username, DISCOM, zone, circle, phn
    FROM admin
    WHERE DISCOM IN ('DVVNL', 'KeSCO', 'MVVNL', 'PuVVNL', 'PVVNL')
  `;
  const params = [];

  if (discomFilter && discomFilter !== 'All' && discomFilter !== 'ALL') {
    sql += ' AND DISCOM = ?';
    params.push(discomFilter);
  }

  sql += ' ORDER BY DISCOM ASC, username ASC';
  return await query(sql, params);
}

/**
 * Fetch UP Bilingual Districts Master List
 */
async function getDistricts() {
  return await query('SELECT id, stateName, stateDescription FROM state ORDER BY id ASC');
}

/**
 * Fetch Complaint Categories Master List
 */
async function getCategories() {
  const cats = await query('SELECT id, categoryName, categoryDescription FROM category ORDER BY id ASC');
  const subcats = await query('SELECT id, categoryid, subcategory FROM subcategory ORDER BY id ASC');

  return cats.map(cat => ({
    ...cat,
    subcategories: subcats.filter(s => s.categoryid === cat.id)
  }));
}

/**
 * Real-time Financial Vigilance & Operational Metrics
 * Strictly differentiates Assessed Penalty (₹) vs Realized Revenue (₹)
 */
async function getDashboardMetrics({ user, fromDate, toDate, discom } = {}) {
  const whereClauses = [];
  const params = [];

  // Scoping for Level 2 & Level 3
  if (user && !user.isSuperAdmin && user.role !== 'SUPER_ADMIN') {
    if (user.role === 'DISCOM_ADMIN' && user.discom && user.discom !== 'ALL') {
      whereClauses.push('(admin.DISCOM = ? OR tblcomplaints.username IN (SELECT username FROM admin WHERE DISCOM = ?) OR tblcomplaints.district IN (SELECT stateName FROM state WHERE stateDescription LIKE CONCAT("%", ?, "%")))');
      params.push(user.discom, user.discom, user.discom);
    } else if (user.role === 'ZONE_ADMIN' && user.zone) {
      whereClauses.push('admin.zone = ?');
      params.push(user.zone);
    } else if (user.role === 'DIVISION_OFFICER' && user.username) {
      whereClauses.push('(tblcomplaints.username = ? OR admin.username = ?)');
      params.push(user.username, user.username);
    } else if (discom && discom !== 'ALL') {
      whereClauses.push('(admin.DISCOM = ? OR tblcomplaints.username IN (SELECT username FROM admin WHERE DISCOM = ?) OR tblcomplaints.district IN (SELECT stateName FROM state WHERE stateDescription LIKE CONCAT("%", ?, "%")))');
      params.push(discom, discom, discom);
    }
  }

  if (fromDate && toDate) {
    whereClauses.push('tblcomplaints.regDate BETWEEN ? AND ?');
    params.push(`${fromDate} 00:00:00`, `${toDate} 23:59:59`);
  }

  const whereStr = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  // 1. Complaint Status Operational Counts (Not Processed, Forwarded, Reverted, Closed)
  const [counts] = await query(`
    SELECT
      COUNT(DISTINCT tblcomplaints.complaintNumber) AS totalReceived,
      COUNT(DISTINCT CASE WHEN tblcomplaints.status IS NULL OR tblcomplaints.status = '' OR tblcomplaints.status = '0' THEN tblcomplaints.complaintNumber END) AS notProcessedCount,
      COUNT(DISTINCT CASE WHEN tblcomplaints.status = 'forward' THEN tblcomplaints.complaintNumber END) AS forwardCount,
      COUNT(DISTINCT CASE WHEN tblcomplaints.status = 'reverted' THEN tblcomplaints.complaintNumber END) AS revertedCount,
      COUNT(DISTINCT CASE WHEN tblcomplaints.status = 'closed' THEN tblcomplaints.complaintNumber END) AS closedCount,
      COUNT(DISTINCT tblcomplaints.complaintNumber) AS registeredTillDate
    FROM tblcomplaints
    LEFT JOIN admin ON tblcomplaints.username = admin.username
    ${whereStr}
  `, params);

  // 2. Financial Metrics from complaintremark
  // Assessed Penalty = Calculated penalty levied under Section 135
  // Realized Revenue = Actual money deposited into corporation account to date
  const [financials] = await query(`
    SELECT
      COALESCE(SUM(CASE 
        WHEN cr.assess IS NOT NULL AND cr.assess != '' 
        THEN CAST(cr.assess AS DECIMAL(15, 2)) 
        ELSE 0 
      END), 0) AS totalAssessment,
      COALESCE(SUM(CASE 
        WHEN cr.reali IS NOT NULL AND cr.reali != '' 
        THEN CAST(cr.reali AS DECIMAL(15, 2)) 
        ELSE 0 
      END), 0) AS totalRealization,
      COUNT(DISTINCT CASE WHEN cr.info = 'Theft Found & FIR Done' THEN cr.complaintNumber END) AS theftFoundCount,
      COUNT(DISTINCT CASE 
        WHEN cr.reali IS NOT NULL AND cr.reali != '' AND CAST(cr.reali AS DECIMAL(15, 2)) > 0 
        THEN cr.complaintNumber 
      END) AS realizedCasesCount
    FROM complaintremark cr
    JOIN tblcomplaints ON cr.complaintNumber = tblcomplaints.complaintNumber
    LEFT JOIN admin ON tblcomplaints.username = admin.username
    ${whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')} AND cr.status = 'closed'` : `WHERE cr.status = 'closed'`}
  `, params);

  const totalAssess = parseFloat(financials.totalAssessment) || 0;
  const totalReali = parseFloat(financials.totalRealization) || 0;
  const efficiency = totalAssess > 0 ? ((totalReali / totalAssess) * 100).toFixed(1) : '0.0';

  return {
    operational: {
      totalReceived: Number(counts.totalReceived) || 0,
      notProcessedCount: Number(counts.notProcessedCount) || 0,
      forwardCount: Number(counts.forwardCount) || 0,
      revertedCount: Number(counts.revertedCount) || 0,
      closedCount: Number(counts.closedCount) || 0,
      inProcessCount: Number(counts.forwardCount) || 0,
      registeredTillDate: Number(counts.registeredTillDate) || Number(counts.totalReceived) || 0
    },
    financial: {
      totalAssessment: totalAssess,
      totalAssessmentCr: (totalAssess / 10000000).toFixed(4),
      totalRealization: totalReali,
      totalRealizationCr: (totalReali / 10000000).toFixed(4),
      realizationEfficiencyPercent: parseFloat(efficiency),
      theftFoundCount: Number(financials.theftFoundCount) || 0,
      realizedCasesCount: Number(financials.realizedCasesCount) || 0
    }
  };
}

/**
 * Register Public Grievance (Replaces register-complaint2.php)
 */
async function registerPublicComplaint({ thiefname, thiefaddress, district, substn, complaintDetails, complaintFile }) {
  if (!thiefname || !thiefname.trim()) {
    throw { status: 400, message: 'Accused/consumer name is required.' };
  }
  if (!thiefaddress || !thiefaddress.trim()) {
    throw { status: 400, message: 'Address/premises location is required.' };
  }

  const res = await query(
    `INSERT INTO tblcomplaints (thiefname, thiefaddress, district, substn, complaintDetails, complaintFile, regDate, status)
     VALUES (?, ?, ?, ?, ?, ?, NOW(), NULL)`,
    [
      thiefname.trim(),
      thiefaddress.trim(),
      district ? district.trim() : null,
      substn ? substn.trim() : null,
      complaintDetails ? complaintDetails.trim() : null,
      complaintFile || null
    ]
  );

  return {
    success: true,
    complaintNumber: res.insertId,
    status: null,
    message: 'Grievance submitted successfully. It has been routed to the Not Processed queue.'
  };
}

/**
 * Get DISCOM MIS Performance Summary (Replaces report.php)
 */
async function getDiscomMISReport({ fromDate, toDate } = {}) {
  const discoms = ['MVVNL', 'PVVNL', 'DVVNL', 'PuVVNL', 'KESCO'];
  const whereClauses = [];
  const params = [];

  if (fromDate && toDate) {
    whereClauses.push('c.regDate BETWEEN ? AND ?');
    params.push(`${fromDate} 00:00:00`, `${toDate} 23:59:59`);
  }

  const dateFilter = whereClauses.length > 0 ? `AND ${whereClauses.join(' AND ')}` : '';

  const report = [];

  for (const discom of discoms) {
    const [counts] = await query(
      `SELECT
        COUNT(DISTINCT c.complaintNumber) AS totalReceived,
        COUNT(DISTINCT CASE WHEN c.status = 'forward' THEN c.complaintNumber END) AS forwardedCount,
        COUNT(DISTINCT CASE WHEN c.status = 'process' THEN c.complaintNumber END) AS inProcessCount,
        COUNT(DISTINCT CASE WHEN c.status = 'closed' THEN c.complaintNumber END) AS closedCount
       FROM tblcomplaints c
       LEFT JOIN admin a ON c.username = a.username
       WHERE (a.DISCOM = ? OR c.district IN (SELECT stateName FROM state WHERE stateDescription LIKE ?))
       ${dateFilter}`,
      [discom, `%${discom}%`, ...params]
    );

    const [financials] = await query(
      `SELECT
        COALESCE(SUM(CASE WHEN cr.assess IS NOT NULL AND cr.assess != '' THEN CAST(cr.assess AS DECIMAL(15,2)) ELSE 0 END), 0) AS totalAssessment,
        COALESCE(SUM(CASE WHEN cr.reali IS NOT NULL AND cr.reali != '' THEN CAST(cr.reali AS DECIMAL(15,2)) ELSE 0 END), 0) AS totalRealization,
        COUNT(DISTINCT CASE WHEN cr.info = 'Theft Found & FIR Done' THEN cr.complaintNumber END) AS firCases
       FROM complaintremark cr
       JOIN tblcomplaints c ON cr.complaintNumber = c.complaintNumber
       LEFT JOIN admin a ON c.username = a.username
       WHERE (a.DISCOM = ? OR c.district IN (SELECT stateName FROM state WHERE stateDescription LIKE ?))
         AND cr.status = 'closed'
         ${dateFilter}`,
      [discom, `%${discom}%`, ...params]
    );

    const assessVal = parseFloat(financials.totalAssessment) || 0;
    const realiVal = parseFloat(financials.totalRealization) || 0;
    const recoveryRatio = assessVal > 0 ? ((realiVal / assessVal) * 100).toFixed(1) : '0.0';

    report.push({
      discom,
      totalReceived: Number(counts.totalReceived) || 0,
      forwarded: Number(counts.forwardedCount) || 0,
      inProcess: Number(counts.inProcessCount) || 0,
      closed: Number(counts.closedCount) || 0,
      firCases: Number(financials.firCases) || 0,
      totalAssessment: assessVal,
      totalAssessmentCr: (assessVal / 10000000).toFixed(4),
      totalRealization: realiVal,
      totalRealizationCr: (realiVal / 10000000).toFixed(4),
      recoveryRatio: parseFloat(recoveryRatio)
    });
  }

  return report;
}

/**
 * Get District Summary Matrix (Replaces view.php)
 */
async function getDistrictSummary() {
  const districts = await query('SELECT id, stateName, stateDescription FROM state ORDER BY stateName ASC');
  const summary = [];

  for (const d of districts) {
    const [counts] = await query(
      `SELECT
        COUNT(*) AS totalReceived,
        COUNT(CASE WHEN status IS NULL OR status = '' THEN 1 END) AS notProcessed,
        COUNT(CASE WHEN status IN ('forward', 'process') THEN 1 END) AS inProcess,
        COUNT(CASE WHEN status = 'closed' THEN 1 END) AS closed
       FROM tblcomplaints
       WHERE district = ? OR district LIKE ?`,
      [d.stateName, `${d.stateName.split(' ')[0]}%`]
    );

    summary.push({
      id: d.id,
      district: d.stateName,
      region: d.stateDescription,
      totalReceived: Number(counts.totalReceived) || 0,
      notProcessed: Number(counts.notProcessed) || 0,
      inProcess: Number(counts.inProcess) || 0,
      closed: Number(counts.closed) || 0
    });
  }

  return summary;
}

/**
 * Division Wise No. Of Complaints DATA (Exact replica of division-wise-dataHQ.php & division-wise-dataDIS.php)
 * Queries all 395 field divisions across UP with accurate real-time aggregates.
 * Columns: DISCOM, ZONE, CIRCLE, DIVISION, NOT PROCESSED, PENDING BEYOND 5 DAYS, CLOSED, TOTAL RECIEVED
 */
async function getDivisionWiseData(user = null) {
  let discomFilter = '';
  const params = [];

  if (user && user.role === 'DISCOM_ADMIN' && user.discom) {
    discomFilter = 'AND a.DISCOM = ?';
    params.push(user.discom);
  } else if (user && user.role === 'DIVISION_OFFICER' && user.username) {
    discomFilter = 'AND a.username = ?';
    params.push(user.username);
  }

  const sql = `
    SELECT 
      a.id,
      a.DISCOM AS discom,
      COALESCE(NULLIF(TRIM(a.zone), ''), '-') AS zone,
      COALESCE(NULLIF(TRIM(a.circle), ''), '-') AS circle,
      a.username AS division,
      COALESCE(SUM(CASE WHEN c.status = 'forward' THEN 1 ELSE 0 END), 0) AS not_processed,
      COALESCE(SUM(CASE WHEN c.status = 'forward' AND DATEDIFF(CURDATE(), COALESCE(c.lastUpdationDate, c.regDate)) > 5 THEN 1 ELSE 0 END), 0) AS pending_beyond_5_days,
      COALESCE(SUM(CASE WHEN c.status = 'closed' THEN 1 ELSE 0 END), 0) AS closed,
      COALESCE(COUNT(c.complaintNumber), 0) AS total_recieved
    FROM admin a
    LEFT JOIN tblcomplaints c ON c.username = a.username
    WHERE (a.id < 403 OR (a.id > 426 AND a.id < 431) OR a.id = 444)
      AND (a.DISCOM = 'MVVNL' OR a.DISCOM = 'DVVNL' OR a.DISCOM = 'PVVNL' 
           OR a.DISCOM = 'PuVVNL' OR a.DISCOM = 'KeSCO' OR a.DISCOM = 'VIGILANCE')
      AND a.username NOT IN ('DVVNL', 'PVVNL', 'KeSCO', 'PuVVNL', 'MVVNL')
      ${discomFilter}
    GROUP BY a.id, a.DISCOM, a.zone, a.circle, a.username
    ORDER BY a.username ASC
  `;

  const rows = await query(sql, params);
  return rows.map(r => ({
    id: r.id,
    discom: r.discom,
    zone: r.zone,
    circle: r.circle,
    division: r.division,
    notProcessed: Number(r.not_processed) || 0,
    pendingBeyond5Days: Number(r.pending_beyond_5_days) || 0,
    closed: Number(r.closed) || 0,
    totalRecieved: Number(r.total_recieved) || 0
  }));
}

/**
 * Fetch Complaints for Excel Export
 */
async function getComplaintsForExport({ statusFilter, user, fromDate, toDate, search, district }) {
  const { whereClause, params } = buildComplaintFilters({
    statusFilter,
    user,
    fromDate,
    toDate,
    search,
    district
  });

  const sql = `
    SELECT 
      c.complaintNumber AS \`Complaint No\`,
      c.thiefname AS \`Accused Name\`,
      c.thiefaddress AS \`Address\`,
      c.district AS \`District\`,
      c.substn AS \`Substation\`,
      c.complaintDetails AS \`Details\`,
      c.regDate AS \`Registration Date\`,
      COALESCE(c.status, 'NOT PROCESSED') AS \`Status\`,
      COALESCE(c.username, 'UNASSIGNED') AS \`Assigned Division\`
    FROM tblcomplaints c
    LEFT JOIN admin a ON c.username = a.username
    ${whereClause}
    ORDER BY c.regDate DESC
  `;

  return await query(sql, params);
}

module.exports = {
  getAllComplaints,
  getNotProcessedComplaints,
  getForwardedComplaints,
  getRevertedComplaints,
  revertComplaintToSuperadmin,
  getInProcessComplaints,
  getClosedComplaints,
  getComplaintDetails,
  forwardDirectToDivision,
  closeComplaintAsFrivolous,
  closeComplaintByCategory,
  updateComplaintStatus,
  getDashboardMetrics,
  getDivisionOfficers,
  getDistricts,
  getCategories,
  registerPublicComplaint,
  getDiscomMISReport,
  getDistrictSummary,
  getDivisionWiseData,
  getComplaintsForExport
};
