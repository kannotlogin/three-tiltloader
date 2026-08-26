import { readdirSync, statSync, readFileSync, writeFileSync } from 'node:fs';
import { join, extname } from 'node:path';

const inputDir = process.argv[2];
const outputFile = process.argv[3] || 'cubemap-database.json';

if (!inputDir) {
    console.error('Gebruik: node generate-cubemap-map.mjs <pad-naar-Cubemaps-map> [output.json]');
    process.exit(1);
}

const map = {};
let count = 0;

for (const entry of readdirSync(inputDir)) {
    if (extname(entry) === '.meta') {
        const fullPath = join(inputDir, entry);
        const metaText = readFileSync(fullPath, 'utf8');
        
        // Zoek de guid
        const guidMatch = metaText.match(/^guid:\s*([0-9a-fA-F]+)/m);
        if (guidMatch) {
            const fileName = entry.replace('.meta', '');
            map[guidMatch[1]] = fileName;
            count++;
        }
    }
}

writeFileSync(outputFile, JSON.stringify(map, null, 2));
console.log(`${count} cubemaps mapt to ${outputFile}.`);