const fs = require('fs');
const readline = require('readline');

const rl = readline.createInterface({
  input: fs.createReadStream('C:\\Users\\STUDIO 2\\Downloads\\cms.sql'),
  crlfDelay: Infinity
});

let inAdmin = false;
let lines = [];
rl.on('line', (line) => {
  if (line.includes("INSERT INTO `admin`")) {
    inAdmin = true;
  }
  if (inAdmin) {
    lines.push(line);
    if (line.trim().endsWith(';')) {
      inAdmin = false;
      rl.close();
    }
  }
});

rl.on('close', () => {
  const full = lines.join('\n');
  // Match each row block: (id, 'username', 'password', ...)
  // Note: some strings might have escaped quotes or nulls
  const matches = full.matchAll(/\((\d+),\s*'([^']*)',\s*'([^']*)',\s*(\d+),\s*('[^']*'|NULL),\s*('[^']*'|NULL),\s*('[^']*'|NULL),\s*('[^']*'|NULL)/g);
  
  const admins = [];
  for (const match of matches) {
    admins.push({
      id: parseInt(match[1], 10),
      username: match[2],
      changepass: parseInt(match[4], 10),
      phn: match[5]?.replace(/'/g, ''),
      discom: match[6]?.replace(/'/g, ''),
      zone: match[7]?.replace(/'/g, ''),
      circle: match[8]?.replace(/'/g, '')
    });
  }

  console.log('Total parsed admin accounts:', admins.length);
  const byDiscom = {};
  admins.forEach(a => {
    byDiscom[a.discom] = (byDiscom[a.discom] || 0) + 1;
  });
  console.log('Admins by DISCOM:', byDiscom);

  // Look for special accounts
  console.log('Admins with id > 400:', admins.filter(a => a.id >= 400));
  console.log('Admins with zone or circle filled:', admins.filter(a => a.zone && a.zone !== 'NULL').slice(0, 10));
});
