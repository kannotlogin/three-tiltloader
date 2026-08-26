#!/usr/bin/env node
// generate-script-guid-map.mjs

import { readdirSync, statSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, extname } from 'node:path';

function walk(dir, out) {
    for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        const stat = statSync(full);
        if (stat.isDirectory()) {
            walk(full, out);
        } else if (extname(entry) === '.cs') {
            out.push(full);
        }
    }
}

function extractGuid(metaText) {
    const m = metaText.match(/^guid:\s*([0-9a-fA-F]+)/m);
    return m ? m[1] : undefined;
}

function extractClassNames(csText) {
    const names = [];
    const re = /\bclass\s+([A-Za-z_][A-Za-z0-9_]*)/g;
    let m;
    while ((m = re.exec(csText)) !== null) names.push(m[1]);
    return names;
}

const inputDir = process.argv[2];
const outputFile = process.argv[3] || 'script-guid-map.json';

if (!inputDir) {
    console.error('Use: node generate-script-guid-map.mjs <path-to-Scripts-map> [output.json]');
    process.exit(1);
}

const csFiles = [];
walk(inputDir, csFiles);
console.log(`Found .cs files: ${csFiles.length}`);

const map = {};
let mapped = 0, noMeta = 0;

for (const csFile of csFiles) {
    const metaFile = csFile + '.meta';
    if (!existsSync(metaFile)) { noMeta++; continue; }
    const guid = extractGuid(readFileSync(metaFile, 'utf8'));
    if (!guid) continue;

    const csText = readFileSync(csFile, 'utf8');
    const classNames = extractClassNames(csText);
    if (classNames.length === 0) continue;

    const fileBaseName = csFile.split('/').pop().replace(/\.cs$/, '');
    const chosen = classNames.includes(fileBaseName) ? fileBaseName : classNames[0];

    map[guid] = chosen;
    mapped++;
}

writeFileSync(outputFile, JSON.stringify(map, null, 2));
console.log(`${mapped} script-guids mapped to ${outputFile} (${noMeta} .cs files without .meta skipped).`);
