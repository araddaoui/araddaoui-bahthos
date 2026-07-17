const fs = require('fs');
const code = fs.readFileSync('server.ts', 'utf8');
const lines = code.split('\n');

let inTemplate = false;
let openLine = -1;
let openCol = -1;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  let chars = line.split('');
  for (let j = 0; j < chars.length; j++) {
    if (chars[j] === '`') {
      const isEscaped = (j > 0 && chars[j - 1] === '\\');
      if (!isEscaped) {
        inTemplate = !inTemplate;
        if (inTemplate) {
          openLine = i + 1;
          openCol = j + 1;
        } else {
          openLine = -1;
          openCol = -1;
        }
      }
    }
  }
}

if (inTemplate) {
  console.log(`Error: Template literal opened at Line ${openLine}, Column ${openCol} is never closed!`);
} else {
  console.log('All template literals are perfectly closed!');
}
