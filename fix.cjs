const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');
const lines = code.split('\n');

const line = lines[774];
console.log('Original line 775:', line);

// Let's replace the ending of the line: "\n;" or "\\n;" with "\\n`;"
let correctedLine = line;
if (line.endsWith('\\n;')) {
  correctedLine = line.substring(0, line.length - 2) + '\\n`;';
} else if (line.endsWith('\\n";')) {
  correctedLine = line.substring(0, line.length - 3) + '\\n`;';
} else {
  // Let's force the correct line with the backtick directly
  correctedLine = "      reportText += `يظهر التوليف الشامل للمصادر أن معالجة موضوع \"${topic}\" تتطلب منظوراً متعدد الأبعاد يدمج بين الجوانب النظرية والتطبيقات العملية الميدانية. يُنصح الباحثون بالبناء على هذه المقارنات لتصميم دراسات مستقبلية تسد الفجوات المعرفية المحددة في هذه الأوراق.\\n`;";
}

console.log('Corrected line 775:', correctedLine);
lines[774] = correctedLine;

fs.writeFileSync('server.ts', lines.join('\n'), 'utf8');
console.log('Successfully wrote the fix to server.ts!');
