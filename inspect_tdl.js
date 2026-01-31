const tdl = require('tdl');
console.log('Exports type:', typeof tdl);
console.log('Keys:', Object.keys(tdl));
if (tdl.Client) console.log('Client found');
else console.log('Client NOT found');
