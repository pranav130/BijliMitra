const { pool, withTransaction } = require('../config/db');
const bcrypt = require('bcryptjs');

async function seedDevDatabase() {
  console.log('--- Starting CMS Dev Synthetic Seeding ---');

  // Verify connected to cms_dev and not a production database
  const [dbInfo] = await pool.query('SELECT DATABASE() AS current_db');
  const currentDb = dbInfo[0].current_db;
  if (!currentDb || currentDb.toLowerCase() !== 'cms_dev') {
    throw new Error(`SAFETY ABORT: Expected to seed 'cms_dev', but connected to '${currentDb}'!`);
  }
  console.log(`Verified safety: Connected to isolated dev database: ${currentDb}`);

  await withTransaction(async (conn) => {
    // 1. Districts
    console.log('Seeding official UP bilingual districts into `state`...');
    const districts = [
      [1, 'LUCKNOW (लखनऊ)', 'Headquarters Zone'],
      [2, 'AGRA (आगरा)', 'DVVNL Zone'],
      [3, 'ALIGARH (अलीगढ़)', 'DVVNL Zone'],
      [4, 'AYODHYA (अयोध्या)', 'MVVNL Zone'],
      [5, 'BAREILLY (बरेली)', 'MVVNL Zone'],
      [6, 'GORAKHPUR (गोरखपुर)', 'PuVVNL Zone'],
      [7, 'KANPUR NAGAR (कानपुर नगर)', 'KESCO Zone'],
      [8, 'MEERUT (मेरठ)', 'PVVNL Zone'],
      [9, 'VARANASI (वाराणसी)', 'PuVVNL Zone'],
      [10, 'GHAZIABAD (गाज़ियाबाद)', 'PVVNL Zone'],
      [11, 'GAUTAM BUDDHA NAGAR (गौतम बुद्ध नगर)', 'PVVNL Zone'],
      [12, 'PRAYAGRAJ (प्रयागराज)', 'PuVVNL Zone'],
      [13, 'BARABANKI (बाराबंकी)', 'MVVNL Zone'],
      [14, 'FIROZABAD (फिरोजाबाद)', 'DVVNL Zone'],
      [15, 'JHANSI (झांसी)', 'DVVNL Zone']
    ];
    for (const [id, name, desc] of districts) {
      await conn.execute(
        `INSERT INTO state (id, stateName, stateDescription) VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE stateName = VALUES(stateName), stateDescription = VALUES(stateDescription)`,
        [id, name, desc]
      );
    }

    // 2. Categories & Subcategories
    console.log('Seeding complaint categories and subcategories...');
    const categories = [
      [1, 'Electricity Theft (विद्युत चोरी)', 'Direct hooking, katia, meter bypass, or illegal tapping'],
      [2, 'Tariff Violation (टैरिफ उल्लंघन)', 'Domestic LMV-1 connection misused for Commercial LMV-2'],
      [3, 'Excessive Load (अनाधिकृत भार)', 'Connected load significantly exceeding sanctioned capacity']
    ];
    for (const [id, name, desc] of categories) {
      await conn.execute(
        `INSERT INTO category (id, categoryName, categoryDescription) VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE categoryName = VALUES(categoryName), categoryDescription = VALUES(categoryDescription)`,
        [id, name, desc]
      );
    }

    const subcategories = [
      [1, 1, 'Direct Hooking / Katia (कटिया डालकर चोरी)'],
      [2, 1, 'Meter Tampered / Bypassed (मीटर बाईपास)'],
      [3, 2, 'Commercial Usage on Domestic Meter'],
      [4, 3, 'Industrial Load on Agriculture Tariff']
    ];
    for (const [id, catId, name] of subcategories) {
      await conn.execute(
        `INSERT INTO subcategory (id, categoryid, subcategory) VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE subcategory = VALUES(subcategory)`,
        [id, catId, name]
      );
    }

    // 3. Officers & Administrative Users
    console.log('Seeding synthetic officers across DISCOMs with bcrypt hashing...');
    const adminPasswordHash = await bcrypt.hash('Admin@123', 10);
    const officerPasswordHash = await bcrypt.hash('Officer@123', 10);
    const citizenPasswordHash = await bcrypt.hash('Citizen@123', 10);

    // 3a. Citizen account
    await conn.execute(
      `INSERT INTO users (id, fullName, userEmail, password, contactNo, address, State, country, pincode, regDate, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), 1)
       ON DUPLICATE KEY UPDATE fullName = VALUES(fullName), password = VALUES(password)`,
      [1, 'अमित वर्मा (Amit Verma)', 'citizen@uppcl.org', citizenPasswordHash, '9876543210', 'हजरतगंज, लखनऊ', 'Uttar Pradesh', 'India', 226001]
    );

    const officers = [
      // Level 1: UPPCL HQ Super Admin
      [1, 'admin', adminPasswordHash, 1, '9415000000', 'UPPCL HQ', 'Headquarters', 'Enforcement Wing'],
      // Level 2: DISCOM Corporate HQ (View-only Monitoring)
      [2, 'mvvnl_nodal', officerPasswordHash, 1, '9415000001', 'MVVNL', 'Lucknow', 'Lucknow-1'],
      [3, 'pvvnl_nodal', officerPasswordHash, 1, '9415000002', 'PVVNL', 'Meerut', 'Meerut Cantt'],
      [4, 'dvvnl_nodal', officerPasswordHash, 1, '9415000003', 'DVVNL', 'Agra', 'Agra City'],
      [5, 'puvvnl_nodal', officerPasswordHash, 1, '9415000004', 'PuVVNL', 'Varanasi', 'Varanasi Central'],
      // Level 3: Zonal Chief Engineer (View-only Monitoring)
      [405, 'zone_lucknow', officerPasswordHash, 1, '9415000405', 'MVVNL', 'Lucknow', null],
      // Level 4: Field Division Executive Engineers & SDOs (Execution & Closing rights)
      [101, 'edd_hazratganj', officerPasswordHash, 1, '9415000101', 'MVVNL', 'Lucknow', 'Lucknow-1'],
      [102, 'edd_varanasi', officerPasswordHash, 1, '9415000102', 'PuVVNL', 'Varanasi', 'Varanasi Central']
    ];

    for (const [id, username, pwd, changepass, phn, discom, zone, circle] of officers) {
      await conn.execute(
        `INSERT INTO admin (id, username, password, changepass, phn, DISCOM, zone, circle)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE password = VALUES(password), DISCOM = VALUES(DISCOM), zone = VALUES(zone), circle = VALUES(circle)`,
        [id, username, pwd, changepass, phn, discom, zone, circle]
      );
    }

    // 4. Clean previous synthetic test complaints
    await conn.execute('DELETE FROM complaintremark WHERE complaintNumber >= 10001 AND complaintNumber <= 10020');
    await conn.execute('DELETE FROM tblcomplaints WHERE complaintNumber >= 10001 AND complaintNumber <= 10020');

    // 5. Synthetic Complaints
    console.log('Seeding 5 synthetic complaints representing all 5 operational statuses...');
    const complaints = [
      {
        num: 10001,
        name: 'राजेश कुमार (Rajesh Commercial Complex)',
        addr: 'दुकान नं. 12, हजरतगंज मेन रोड',
        district: 'LUCKNOW (लखनऊ)',
        substn: 'हजरतगंज 33/11 KV',
        details: 'मेन एलटी लाइन से अवैध कटिया डालकर 5 एसी चलाए जा रहे हैं।',
        file: 'evidence_10001.jpg',
        regDaysAgo: 5,
        status: null, // Unprocessed / Not Processed
        user: null,
        sdiv: 'नगरीय वितरण खंड-1'
      },
      {
        num: 10002,
        name: 'शर्मा फ्लोर मिल (Sharma Flour Mill)',
        addr: 'जीटी रोड, नियर बस स्टेशन, बाराबंकी',
        district: 'BARABANKI (बाराबंकी)',
        substn: 'बाराबंकी टाउन सबस्टेशन',
        details: 'स्वीकृत भार 2 किलोवाट है, 10 एचपी आटा चक्की सीधे पोल से चल रही है।',
        file: 'evidence_10002.jpg',
        regDaysAgo: 3,
        status: 'forward', // Forwarded to division
        user: 'mvvnl_nodal',
        sdiv: 'वितरण खंड-बाराबंकी'
      },
      {
        num: 10003,
        name: 'वर्मा कोल्ड स्टोरेज (Verma Cold Store)',
        addr: 'परतापुर इंडस्ट्रियल एरिया, मेरठ',
        district: 'MEERUT (मेरठ)',
        substn: 'परतापुर 33/11 KV',
        details: 'रात में अंडरग्राउंड केबल से विद्युत चोरी की जा रही है।',
        file: 'evidence_10003.jpg',
        regDaysAgo: 2,
        status: 'process', // In Process / Scheduled raid
        user: 'pvvnl_nodal',
        sdiv: 'औद्योगिक वितरण खंड'
      },
      {
        num: 10004,
        name: 'गुप्ता स्वीट्स एवं रेस्टोरेंट',
        addr: 'दशाश्वमेध घाट रोड, वाराणसी',
        district: 'VARANASI (वाराणसी)',
        substn: 'दशाश्वमेध सबस्टेशन',
        details: 'घरेलू मीटर से रेस्टोरेंट का व्यावसायिक लोड चलाया जा रहा है।',
        file: 'evidence_10004.jpg',
        regDaysAgo: 4,
        status: 'closed', // Closed / Resolved with penalty
        user: 'puvvnl_nodal',
        sdiv: 'दशाश्वमेध वितरण खंड'
      },
      {
        num: 10005,
        name: 'सिंह फार्म हाउस (Singh Farm House)',
        addr: 'फतेहाबाद रोड, आगरा',
        district: 'AGRA (आगरा)',
        substn: 'फतेहाबाद सबस्टेशन',
        details: 'निजी नलकूप मोटर सीधे 11 KV से हुक करके चलाने की शिकायत।',
        file: 'evidence_10005.jpg',
        regDaysAgo: 1,
        status: 'closed', // Closed under Theft Not Found (valid connection found)
        user: 'dvvnl_nodal',
        sdiv: 'ग्रामीण वितरण खंड'
      },
      {
        num: 10006,
        name: 'राजेश कुमार कोल्ड स्टोरेज',
        addr: 'जीटी रोड, अलीगढ़',
        district: 'ALIGARH (अलीगढ़)',
        substn: 'सासनी गेट सबस्टेशन',
        details: 'औद्योगिक श्रेणी में कृषि टैरिफ का दुरुपयोग।',
        file: 'evidence_10006.jpg',
        regDaysAgo: 5,
        status: 'closed',
        user: 'dvvnl_nodal',
        sdiv: 'सासनी वितरण खंड'
      },
      {
        num: 10007,
        name: 'शर्मा फैब्रिकेशन वर्क्स',
        addr: 'ट्रांसपोर्ट नगर, मेरठ',
        district: 'MEERUT (मेरठ)',
        substn: 'ट्रांसपोर्ट नगर सबस्टेशन',
        details: 'मीटर बाईपास कर 15 kW वेल्डिंग लोड का अनाधिकृत संचालन।',
        file: 'evidence_10007.jpg',
        regDaysAgo: 6,
        status: 'closed',
        user: 'pvvnl_nodal',
        sdiv: 'टीपी नगर वितरण खंड'
      }
    ];

    for (const c of complaints) {
      await conn.execute(
        `INSERT INTO tblcomplaints 
         (complaintNumber, thiefname, thiefaddress, district, substn, complaintDetails, complaintFile, regDate, status, username, sdivision)
         VALUES (?, ?, ?, ?, ?, ?, ?, DATE_SUB(NOW(), INTERVAL ? DAY), ?, ?, ?)`,
        [c.num, c.name, c.addr, c.district, c.substn, c.details, c.file, c.regDaysAgo, c.status, c.user, c.sdiv]
      );
    }

    // 6. Synthetic Remarks
    console.log('Seeding synthetic enforcement remarks...');
    const remarks = [
      [
        1, 10002, 'forward',
        'शिकायत प्राप्त कर प्रारंभिक जांच हेतु क्षेत्रीय उपखंड अधिकारी को अग्रसारित की गई।',
        'admin', 'Forwarded to Division', null, null, null, null, null, null, null, null, null, null
      ],
      [
        2, 10003, 'process',
        'सतर्कता दस्ते को छापा मारने हेतु नामित किया गया है। स्थल निरीक्षण आज रात्रि में नियत है।',
        'pvvnl_nodal', 'In Process / Inspection Scheduled', null, null, null, null, null, null, null, null, null, null
      ],
      [
        3, 10004, 'closed',
        'सतर्कता टीम द्वारा औचक निरीक्षण किया गया। घरेलू मीटर पर व्यावसायिक लोड संचालित पाया गया। धारा 135 के तहत ₹1,25,000 का शमन शुल्क आकलित हुआ व ₹45,000 जमा कराया गया।',
        'puvvnl_nodal', 'Theft Found & FIR Done', 'Commercial LMV-2', '8.5 kW', '125000.00', '45000.00', 'LMV-1', 'LMV-2', '2.0 kW', '8.5 kW', 'UPPCL-987211', 'uploads/inspection_sheet_10004.pdf'
      ],
      [
        4, 10005, 'closed',
        'स्थल पर जेई व क्षेत्रीय दल ने जांच की। मौके पर वैध विद्युत कनेक्शन व मीटर सही स्थिति में पाया गया। चोरी की पुष्टि नहीं हुई।',
        'dvvnl_nodal', 'Theft Not Found', null, null, null, null, null, null, null, null, null, null
      ],
      [
        5, 10006, 'closed',
        'जांचोपरांत गलत टैरिफ (Wrong Tariff) का मामला प्रमाणित हुआ। ₹85,000 का अंतर शुल्क आकलित कर पूर्ण धनराशि जमा कराई गई।',
        'dvvnl_nodal', 'Wrong Tariff', 'LMV-6', '25.0 kW', '85000.00', '85000.00', 'LMV-5', 'LMV-6', '10.0 kW', '25.0 kW', null, 'uploads/tariff_assessment_10006.pdf'
      ],
      [
        6, 10007, 'closed',
        'मीटर से छेड़छाड़ कर कटिया पाई गई। धारा 135 में एफआईआर दर्ज की गई। ₹2,40,000 का निर्धारण हुआ तथा ₹60,000 प्रारंभिक शमन शुल्क जमा हुआ।',
        'pvvnl_nodal', 'Theft Found & FIR Done', 'LMV-2', '15.0 kW', '240000.00', '60000.00', 'LMV-1', 'LMV-2', '3.0 kW', '15.0 kW', null, 'uploads/fir_copy_10007.pdf'
      ]
    ];

    for (const r of remarks) {
      await conn.execute(
        `INSERT INTO complaintremark
         (id, complaintNumber, status, remark, remarkDate, username, info, category, loads, assess, reali, scat, acat, sload, aload, cn, filek)
         VALUES (?, ?, ?, ?, NOW(), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        r
      );
    }
  });

  console.log('? CMS Dev Synthetic Seeding completed successfully!');
  await pool.end();
}

if (require.main === module) {
  seedDevDatabase()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('? Seeding error:', err);
      process.exit(1);
    });
}

module.exports = { seedDevDatabase };
