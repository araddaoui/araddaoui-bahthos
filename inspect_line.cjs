const fs = require('fs');
const lines = fs.readFileSync('server.ts', 'utf8').split('\n');
const line = lines[662];
console.log('Line 663 length:', line.length);
console.log('Char around 165:', JSON.stringify(line.substring(160, 180)));
for (let i = 160; i < 180; i++) {
  console.log(`Index ${i}: ${line[i]} (code: ${line.charCodeAt(i)})`);
}
