
const fs = require('fs');
const path = require('path');

const possiblePaths = [
    path.join(__dirname, 'assets', 'icon-only.png')
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
    const content = `export const LOGO_BASE64 = "data:image/png;base64,${base64}";`;

    const outputPath = path.join(__dirname, 'utils', 'logoData.ts');
    fs.writeFileSync(outputPath, content);
    console.log(`Generated ${outputPath}`);
} else {
    console.error('No icon found');
}
