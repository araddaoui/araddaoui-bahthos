const fs = require('fs');

const content = fs.readFileSync('server.ts', 'utf8');

const targetStart = '// Truncating duplicate block part 1';
const targetEnd = '// Endpoint for automatic single-document analysis';

const startIndex = content.indexOf(targetStart);
const endIndex = content.indexOf(targetEnd);

if (startIndex === -1 || endIndex === -1) {
  console.error('Error: Could not find target markers in server.ts');
  console.log('startIndex:', startIndex, 'endIndex:', endIndex);
  process.exit(1);
}

const before = content.substring(0, startIndex);
const after = content.substring(endIndex);

const replacement = `res.status(statusCode).json({ 
      error: errorMessage, 
      text: responseText, 
      isFallback: true 
    });
  }
});

`;

const newContent = before + replacement + after;
fs.writeFileSync('server.ts', newContent, 'utf8');
console.log('Successfully repaired server.ts!');
