
const fs = require('fs');
const path = require('path');

const possiblePaths = [
    path.join(__dirname, 'assets', 'icon-only.png'),
    path.join(__dirname, 'public', 'icon.png'),
    path.join(__dirname, 'src', 'assets', 'react.svg')
];

let foundPath = '';
for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
        foundPath = p;
        break;
    }
}

if (foundPath) {
    const bitmap = fs.readFileSync(foundPath);
    const base64 = Buffer.from(bitmap).toString('base64');
    fs.writeFileSync('logo_base64.txt', base64);
    console.log(`Saved base64 of ${foundPath} to logo_base64.txt`);
    console.log(`Length: ${base64.length}`);
} else {
    console.error('No icon found');
}
