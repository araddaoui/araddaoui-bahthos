const fs = require('fs');
const code = fs.readFileSync('server.ts', 'utf8');
const lines = code.split('\n');

for (let i = 794; i <= 814; i++) {
  console.log(`Line ${i + 1}: ${JSON.stringify(lines[i])}`);
}
