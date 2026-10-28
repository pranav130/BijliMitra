const fs = require('fs');
const html = fs.readFileSync('cms_migration/public/index.html', 'utf8');
const match = html.match(/<script type="text\/babel">([\s\S]*?)<\/script>/);
const lines = match[1].split('\n');
for (let i = 825; i <= 845; i++) {
  console.log((i + 1) + ': ' + lines[i]);
}
