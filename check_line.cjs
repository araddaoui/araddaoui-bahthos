const fs = require('fs');
const code = fs.readFileSync('server.ts', 'utf8');
const lines = code.split('\n');
const line = lines[717]; // index 717 is line 718
console.log('Line 718 raw:', JSON.stringify(line));
const lastChars = line.substring(line.length - 15);
for (let i = 0; i < lastChars.length; i++) {
  console.log(`Char ${i}: "${lastChars[i]}" (code: ${lastChars.charCodeAt(i)})`);
}
