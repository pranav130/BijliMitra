const fs = require('fs');
const curApp = fs.readFileSync('cms_migration/cur_app.js', 'utf8');
const lines = curApp.split('\n');
const dashboardLines = lines.slice(336, 834);

// Let's count all JSX elements precisely:
// Any `<Tag` (not starting with `</`, not `/>` self-closing) pushes to stack
// Any `</Tag>` pops from stack
const stack = [];
dashboardLines.forEach((line, lIdx) => {
  const lineNo = lIdx + 337;
  // Match tags carefully:
  // e.g. <div ...>, </div >, <Header ... />, etc.
  let pos = 0;
  while (pos < line.length) {
    const openIdx = line.indexOf('<', pos);
    if (openIdx === -1) break;
    
    // Check if this is a comment {/* ... */}
    if (line.substr(openIdx, 4) === '<!--' || line.substr(openIdx, 3) === '{/*') {
      pos = openIdx + 4;
      continue;
    }
    
    const closeIdx = line.indexOf('>', openIdx);
    if (closeIdx === -1) break;
    
    const tagContent = line.substring(openIdx, closeIdx + 1);
    pos = closeIdx + 1;
    
    // Check if this is a closing tag
    if (tagContent.startsWith('</')) {
      const match = tagContent.match(/<\/([a-zA-Z0-9]+)/);
      if (match) {
        const tagName = match[1];
        if (stack.length === 0) {
          console.log(`Line ${lineNo}: Extra closing tag </${tagName}>`);
        } else {
          const top = stack.pop();
          if (top.tagName.toLowerCase() !== tagName.toLowerCase()) {
            console.log(`Line ${lineNo}: MISMATCH! Found </${tagName}>, but expected </${top.tagName}> from line ${top.line}`);
          }
        }
      }
    } else {
      // Opening tag
      // Check if self closing: ends with '/>' or is void tag (input, img, hr, br, etc.)
      const isSelf = tagContent.endsWith('/>') || tagContent.match(/<(input|img|hr|br)[\s>]/i);
      const match = tagContent.match(/<([a-zA-Z0-9]+)/);
      if (match && !isSelf) {
        const tagName = match[1];
        stack.push({ tagName, line: lineNo });
      }
    }
  }
});

console.log('Unclosed tags remaining in dashboardReturn:');
console.log(stack);
