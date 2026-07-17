const fs = require('fs');
const code = fs.readFileSync('server.ts', 'utf8');
const lines = code.split('\n');

const line = lines[697]; // Line 698 (index 697)
console.log('Line 698 length:', line.length);
console.log('Line 698 raw:', JSON.stringify(line));

for (let i = line.length - 15; i < line.length; i++) {
  console.log(`Char ${i}: "${line[i]}" (code: ${line.charCodeAt(i)})`);
}
