
import fs from 'fs';
import path from 'path';

const iconPath = path.join(__dirname, 'assets', 'icon-only.png');
// Check if exists, else try others
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
    // Print first 50 chars to verify and total length
    console.log(`FOUND: ${foundPath}`);
    console.log(`LENGTH: ${base64.length}`);
    console.log('BASE64_START');
    console.log(base64);
    console.log('BASE64_END');
} else {
    console.error('No icon found');
}
