const fs = require('fs');
const babelCode = fs.readFileSync('cms_migration/babel_standalone.js', 'utf8');
global.window = global;
global.navigator = { userAgent: 'node' };
const vm = require('vm');
vm.runInThisContext(babelCode);

const curApp = fs.readFileSync('cms_migration/cur_app.js', 'utf8');
const lines = curApp.split('\n');

// Let's test lines 1 to N
let min = 1, max = lines.length;
// Let's test binary search on lines inside curApp:
function testLines(code) {
  try {
    Babel.transform(code, { presets: ['react'] });
    return true;
  } catch (e) {
    return e.message;
  }
}

// Let's see what happens if we replace the return statement with a simple div:
const testBase = lines.slice(0, 335).join('\n') + '\nreturn <div>Simple Test</div>;\n}';
console.log('testBase result:', testLines(testBase));
