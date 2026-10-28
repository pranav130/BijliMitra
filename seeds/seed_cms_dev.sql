-- ==============================================================================
-- CMS DEV SYNTHETIC SEED DATA SCRIPT
-- Strictly for local development & automated testing (No production data)
-- ==============================================================================

USE `cms_dev`;

-- 1. Create Dedicated Local Development User Account with restricted privileges
CREATE USER IF NOT EXISTS 'cms_dev_user'@'localhost' IDENTIFIED BY 'dev_secret_password_2026';
GRANT ALL PRIVILEGES ON `cms_dev`.* TO 'cms_dev_user'@'localhost';
FLUSH PRIVILEGES;

-- 2. Populate Standard Bilingual UP Districts into `state`
INSERT INTO `state` (`id`, `stateName`, `stateDescription`) VALUES
(1, 'LUCKNOW (लखनऊ)', 'Headquarters Zone'),
(2, 'AGRA (आगरा)', 'DVVNL Zone'),
(3, 'ALIGARH (अलीगढ़)', 'DVVNL Zone'),
(4, 'AYODHYA (अयोध्या)', 'MVVNL Zone'),
(5, 'BAREILLY (बरेली)', 'MVVNL Zone'),
(6, 'GORAKHPUR (गोरखपुर)', 'PuVVNL Zone'),
(7, 'KANPUR NAGAR (कानपुर नगर)', 'KESCO Zone'),
(8, 'MEERUT (मेरठ)', 'PVVNL Zone'),
(9, 'VARANASI (वाराणसी)', 'PuVVNL Zone'),
(10, 'GHAZIABAD (गाज़ियाबाद)', 'PVVNL Zone'),
(11, 'GAUTAM BUDDHA NAGAR (गौतम बुद्ध नगर)', 'PVVNL Zone'),
(12, 'PRAYAGRAJ (प्रयागराज)', 'PuVVNL Zone'),
(13, 'BARABANKI (बाराबंकी)', 'MVVNL Zone'),
(14, 'FIROZABAD (फिरोजाबाद)', 'DVVNL Zone'),
(15, 'JHANSI (झांसी)', 'DVVNL Zone')
ON DUPLICATE KEY UPDATE `stateName` = VALUES(`stateName`);

-- 3. Populate Master Categories & Subcategories
INSERT INTO `category` (`id`, `categoryName`, `categoryDescription`) VALUES
(1, 'Electricity Theft (विद्युत चोरी)', 'Direct hooking, katia, meter bypass, or illegal tapping'),
(2, 'Tariff Violation (टैरिफ उल्लंघन)', 'Domestic LMV-1 connection misused for Commercial LMV-2'),
(3, 'Excessive Load (अनाधिकृत भार)', 'Connected load significantly exceeding sanctioned capacity')
ON DUPLICATE KEY UPDATE `categoryName` = VALUES(`categoryName`);

INSERT INTO `subcategory` (`id`, `categoryid`, `subcategory`) VALUES
(1, 1, 'Direct Hooking / Katia (कटिया डालकर चोरी)'),
(2, 1, 'Meter Tampered / Bypassed (मीटर बाईपास)'),
(3, 2, 'Commercial Usage on Domestic Meter'),
(4, 3, 'Industrial Load on Agriculture Tariff')
ON DUPLICATE KEY UPDATE `subcategory` = VALUES(`subcategory`);

-- 4. Insert Synthetic Officers (Bcrypt hash for 'Admin@123' and 'Officer@123')
-- Bcrypt hash: $2b$10$tZ9wZ7zW0qO8c6P8bFq7fe5qA2o8n3hF3v1mY5hE6w8b2q9aA4rTC
INSERT INTO `admin` (`id`, `username`, `password`, `changepass`, `phn`, `DISCOM`, `zone`, `circle`) VALUES
(1, 'admin', '$2b$10$1jQ95p78xYV1e7v33UjOmeoP4K6s3gLh5F4p7.3X3gN1j6i1iO7x.', 1, '9415000000', 'UPPCL HQ', 'Headquarters', 'Enforcement Wing'),
(2, 'mvvnl_nodal', '$2b$10$1jQ95p78xYV1e7v33UjOmeoP4K6s3gLh5F4p7.3X3gN1j6i1iO7x.', 1, '9415000001', 'MVVNL', 'Lucknow', 'Lucknow-1'),
(3, 'pvvnl_nodal', '$2b$10$1jQ95p78xYV1e7v33UjOmeoP4K6s3gLh5F4p7.3X3gN1j6i1iO7x.', 1, '9415000002', 'PVVNL', 'Meerut', 'Meerut Cantt'),
(4, 'dvvnl_nodal', '$2b$10$1jQ95p78xYV1e7v33UjOmeoP4K6s3gLh5F4p7.3X3gN1j6i1iO7x.', 1, '9415000003', 'DVVNL', 'Agra', 'Agra City'),
(5, 'puvvnl_nodal', '$2b$10$1jQ95p78xYV1e7v33UjOmeoP4K6s3gLh5F4p7.3X3gN1j6i1iO7x.', 1, '9415000004', 'PuVVNL', 'Varanasi', 'Varanasi Central')
ON DUPLICATE KEY UPDATE `password` = VALUES(`password`);

-- 5. Insert Synthetic Complaints
INSERT INTO `tblcomplaints` 
(`complaintNumber`, `thiefname`, `thiefaddress`, `district`, `substn`, `complaintDetails`, `complaintFile`, `regDate`, `status`, `username`, `sdivision`) 
VALUES
(10001, 'राजेश कुमार (Rajesh Commercial Complex)', 'दुकान नं. 12, हजरतगंज मेन रोड', 'LUCKNOW (लखनऊ)', 'हजरतगंज 33/11 KV', 'मेन एलटी लाइन से अवैध कटिया डालकर 5 एसी चलाए जा रहे हैं।', 'evidence_10001.jpg', DATE_SUB(NOW(), INTERVAL 5 DAY), NULL, NULL, 'नगरीय वितरण खंड-1'),
(10002, 'शर्मा फ्लोर मिल (Sharma Flour Mill)', 'जीटी रोड, नियर बस स्टेशन, बाराबंकी', 'BARABANKI (बाराबंकी)', 'बाराबंकी टाउन सबस्टेशन', 'स्वीकृत भार 2 किलोवाट है, 10 एचपी आटा चक्की सीधे पोल से चल रही है।', 'evidence_10002.jpg', DATE_SUB(NOW(), INTERVAL 3 DAY), 'forward', 'mvvnl_nodal', 'वितरण खंड-बाराबंकी'),
(10003, 'वर्मा कोल्ड स्टोरेज (Verma Cold Store)', 'परतापुर इंडस्ट्रियल एरिया, मेरठ', 'MEERUT (मेरठ)', 'परतापुर 33/11 KV', 'रात में अंडरग्राउंड केबल से विद्युत चोरी की जा रही है।', 'evidence_10003.jpg', DATE_SUB(NOW(), INTERVAL 2 DAY), 'process', 'pvvnl_nodal', 'औद्योगिक वितरण खंड'),
(10004, 'गुप्ता स्वीट्स एवं रेस्टोरेंट', 'दशाश्वमेध घाट रोड, वाराणसी', 'VARANASI (वाराणसी)', 'दशाश्वमेध सबस्टेशन', 'घरेलू मीटर से रेस्टोरेंट का व्यावसायिक लोड चलाया जा रहा है।', 'evidence_10004.jpg', DATE_SUB(NOW(), INTERVAL 4 DAY), 'closed', 'puvvnl_nodal', 'दशाश्वमेध वितरण खंड'),
(10005, 'सिंह फार्म हाउस (Singh Farm House)', 'फतेहाबाद रोड, आगरा', 'AGRA (आगरा)', 'फतेहाबाद सबस्टेशन', 'निजी नलकूप मोटर सीधे 11 KV से हुक करके चलाने की शिकायत।', 'evidence_10005.jpg', DATE_SUB(NOW(), INTERVAL 1 DAY), 'revert', 'dvvnl_nodal', 'ग्रामीण वितरण खंड')
ON DUPLICATE KEY UPDATE `thiefname` = VALUES(`thiefname`);

-- 6. Insert Synthetic Enforcement Remarks (complaintremark)
INSERT INTO `complaintremark` 
(`id`, `complaintNumber`, `status`, `remark`, `remarkDate`, `username`, `info`, `category`, `loads`, `assess`, `reali`, `scat`, `acat`, `sload`, `aload`, `cn`, `filek`)
VALUES
(1, 10002, 'forward', 'शिकायत प्राप्त कर प्रारंभिक जांच हेतु क्षेत्रीय उपखंड अधिकारी को अग्रसारित की गई।', DATE_SUB(NOW(), INTERVAL 3 DAY), 'admin', 'Forwarded to Division', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
(2, 10003, 'process', 'सतर्कता दस्ते को छापा मारने हेतु नामित किया गया है। स्थल निरीक्षण आज रात्रि में नियत है।', DATE_SUB(NOW(), INTERVAL 1 DAY), 'pvvnl_nodal', 'In Process / Inspection Scheduled', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
(3, 10004, 'closed', 'सतर्कता टीम द्वारा औचक निरीक्षण किया गया। घरेलू मीटर पर व्यावसायिक लोड संचालित पाया गया। धारा 135 के तहत ₹1,25,000 का शमन शुल्क वसूला गया।', DATE_SUB(NOW(), INTERVAL 1 DAY), 'puvvnl_nodal', 'Theft Found & FIR Done', 'Commercial LMV-2', '8.5 kW', '125000.00', '125000.00', 'LMV-1', 'LMV-2', '2.0 kW', '8.5 kW', 'UPPCL-987211', 'uploads/inspection_sheet_10004.pdf'),
(4, 10005, 'revert', 'स्थल पर जेई व सतर्कता दल ने जांच की। मौके पर वैध विद्युत कनेक्शन व मीटर सही स्थिति में पाया गया। चोरी की पुष्टि नहीं हुई।', DATE_SUB(NOW(), INTERVAL 12 HOUR), 'dvvnl_nodal', 'No Theft Found', NULL, NULL, '0.00', '0.00', NULL, NULL, NULL, NULL, NULL, NULL)
ON DUPLICATE KEY UPDATE `remark` = VALUES(`remark`);
