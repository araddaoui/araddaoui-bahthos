const fs = require('fs');
const code = fs.readFileSync('server.ts', 'utf8');
const lines = code.split('\n');
const line = lines[717]; // Line 718

let inTemplate = false;
let chars = line.split('');
for (let j = 0; j < chars.length; j++) {
  if (chars[j] === '`') {
    const escaped = j > 0 && chars[j - 1] === '\\';
    inTemplate = !inTemplate;
    console.log(`Backtick found at index ${j}, escaped: ${escaped}, new inTemplate: ${inTemplate}`);
  }
}
