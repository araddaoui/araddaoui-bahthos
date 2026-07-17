const fs = require('fs');
const code = fs.readFileSync('server.ts', 'utf8');
const lines = code.split('\n');

for (let i = 765; i <= 773; i++) {
  const line = lines[i];
  console.log(`\nLine ${i + 1}:`);
  for (let j = 0; j < line.length; j++) {
    if (line[j] === '`' || line[j] === '"' || line[j] === "'") {
      const isEscaped = (j > 0 && line[j - 1] === '\\');
      console.log(`  Char at ${j}: "${line[j]}" | escaped: ${isEscaped}`);
    }
  }
}
