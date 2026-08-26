#!/usr/bin/env node
// generate-brush-family.mjs

import { readdirSync, statSync, readFileSync, writeFileSync } from 'node:fs';
import { join, extname } from 'node:path';

const KNOWN_BRUSH_CLASSES = {
    "FlatGeometryBrush": { family: "ribbon", generatorClass: "FlatGeometryBrush" },
    "QuadStripUnitizedUVBrush": { family: "ribbon", generatorClass: "QuadStripUnitizedUVBrush" },
    "QuadStripBrushDistanceUV": { family: "ribbon", generatorClass: "QuadStripBrushDistanceUV" },
    "QuadStripBrushStretchUV": { family: "ribbon", generatorClass: "QuadStripBrushStretchUV" },
    "SquareBrush": { family: "ribbon", generatorClass: "SquareBrush" },
    "GeniusParticlesBrush": { family: "particle", generatorClass: "GeniusParticlesBrush" },
    "SprayBrush": { family: "particle", generatorClass: "SprayBrush" },
    "MidpointPlusLifetimeSprayBrush": { family: "particle", generatorClass: "MidpointPlusLifetimeSprayBrush" },
    "HullBrush": { family: "hull", generatorClass: "HullBrush" },
    "ConcaveHullBrush": { family: "concave-hull", generatorClass: "ConcaveHullBrush" },
    "TubeBrush": { family: "tube", generatorClass: "TubeBrush" },
    "ThickStripBrush": { family: "thick-strip", generatorClass: "ThickStripBrush" },
    "ParentBrush": { family: "unsupported" }        
};

const IGNORE_CLASSES = new Set([
    "BaseBrushScript", "BrushDescriptor", "AudioReactive", "AudioReactiveResizableIcon"
]);

function walkFiles(dir, ext, out) {
    for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        const stat = statSync(full);
        if (stat.isDirectory()) walkFiles(full, ext, out);
        else if (extname(entry) === ext) out.push(full);
    }
}

function getPrefabOwnGuid(prefabPath) {
    const metaPath = prefabPath + '.meta';
    try {
        const metaText = readFileSync(metaPath, 'utf8');
        const m = metaText.match(/^guid:\s*([0-9a-fA-F]+)/m);
        return m ? m[1] : undefined;
    } catch {
        return undefined;
    }
}

function getScriptGuidsInPrefab(prefabText) {
    const guids = new Set();
    const re = /m_Script:\s*\{fileID:\s*\d+,\s*guid:\s*([0-9a-fA-F]+)/g;
    let m;
    while ((m = re.exec(prefabText)) !== null) guids.add(m[1]);
    return guids;
}

// -----------------------------------------------------------------------
// Main
// -----------------------------------------------------------------------
const [dbPath, prefabsDir, scriptMapPath, outPath] = process.argv.slice(2);

if (!dbPath || !prefabsDir || !scriptMapPath) {
    console.error('Uses: node generate-brush-family.mjs <brush-database.json> <BrushPrefabs-map> <script-guid-map.json> [output.json]');
    process.exit(1);
}

const database = JSON.parse(readFileSync(dbPath, 'utf8'));
const scriptGuidMap = JSON.parse(readFileSync(scriptMapPath, 'utf8'));

const prefabFiles = [];
walkFiles(prefabsDir, '.prefab', prefabFiles);
console.log(`Found ${prefabFiles.length} .prefab files`);
console.log(`.prefab files: ${prefabFiles.length}`);

const prefabByGuid = {};
for (const p of prefabFiles) {
    const guid = getPrefabOwnGuid(p);
    if (guid) prefabByGuid[guid] = p;
}

let matched = 0, unmatchedPrefab = 0, unknownClass = 0;
const unknownClassesSeen = new Set();

for (const brushGuid of Object.keys(database)) {
    const brush = database[brushGuid];
    const prefabGuid = brush._brushPrefabGuid;
    if (!prefabGuid || !prefabByGuid[prefabGuid]) {
        unmatchedPrefab++;
        console.warn(`[${brush.name}] no .prefab found for guid ${prefabGuid} - skipped.`);
        continue;
    }

    const prefabText = readFileSync(prefabByGuid[prefabGuid], 'utf8');
    const scriptGuids = getScriptGuidsInPrefab(prefabText);

    const classNames = [...scriptGuids]
        .map(g => scriptGuidMap[g])
        .filter(Boolean);

    let resolved = null;
    for (const cls of classNames) {
        if (KNOWN_BRUSH_CLASSES[cls]) { resolved = { class: cls, ...KNOWN_BRUSH_CLASSES[cls] }; break; }
    }

    if (resolved) {
        brush.family = resolved.family;
        if (resolved.generatorClass) brush.generatorClass = resolved.generatorClass;
        brush._unityBrushClass = resolved.class;
        matched++;
    } else {
        const unknown = classNames.filter(c => !IGNORE_CLASSES.has(c));
        unknown.forEach(c => unknownClassesSeen.add(c));
        brush._unknownScriptClasses = unknown;
        unknownClass++;
    }
}

writeFileSync(outPath || dbPath, JSON.stringify(database, null, 2));
console.log(`\nDone!`);
console.log(`  ${matched} brushes: family/generatorClass automatically determined.`);
console.log(`  ${unmatchedPrefab} brushes: no .prefab file found.`);
console.log(`  ${unknownClass} brushes: prefab found but with an UNKNOWN script class.`);
if (unknownClassesSeen.size > 0) {
    console.log(`\nUnknown classes that still need to be added to KNOWN_BRUSH_CLASSES:`);
    console.log('  ' + [...unknownClassesSeen].join(', '));
}
