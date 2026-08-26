#!/usr/bin/env node
// generate-environment-database.mjs

import { readdirSync, statSync, readFileSync, writeFileSync } from 'node:fs';
import { join, extname } from 'node:path';

function walk(dir, out) {
    for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        const stat = statSync(full);
        if (stat.isDirectory()) walk(full, out);
        else if (extname(entry) === '.asset') out.push(full);
    }
}

function extractScalar(text, key) {
    const m = text.match(new RegExp(`^\\s*${key}:\\s*(.+?)\\s*$`, 'm'));
    return m ? m[1] : undefined;
}

function extractNumber(text, key) {
    const raw = extractScalar(text, key);
    if (raw === undefined) return undefined;
    const n = parseFloat(raw);
    return Number.isNaN(n) ? undefined : n;
}

function extractRgba(text, key) {
    const m = text.match(new RegExp(`^\\s*${key}:\\s*\\{r:\\s*([\\-\\d.eE]+),\\s*g:\\s*([\\-\\d.eE]+),\\s*b:\\s*([\\-\\d.eE]+),\\s*a:\\s*([\\-\\d.eE]+)\\}`, 'm'));
    if (!m) return undefined;
    return [parseFloat(m[1]), parseFloat(m[2]), parseFloat(m[3]), parseFloat(m[4])];
}

function extractQuat(text, key) {
    const m = text.match(new RegExp(`^\\s*${key}:\\s*\\{x:\\s*([\\-\\d.eE]+),\\s*y:\\s*([\\-\\d.eE]+),\\s*z:\\s*([\\-\\d.eE]+),\\s*w:\\s*([\\-\\d.eE]+)\\}`, 'm'));
    if (!m) return undefined;
    return [parseFloat(m[1]), parseFloat(m[2]), parseFloat(m[3]), parseFloat(m[4])];
}

function extractRefGuid(text, key) {
    const re = new RegExp(`^\\s*${key}:\\s*\\{.*guid:\\s*([0-9a-fA-F]+)`, 'm');
    const m = text.match(re);
    return m ? m[1] : undefined;
}

function extractGuidStorage(text) {
    const m = text.match(/m_Guid:\s*\n\s*m_storage:\s*([0-9a-fA-F-]+)/);
    return m ? m[1] : undefined;
}

function extractLights(text) {
    const listMatch = text.match(/m_Lights:\n([\s\S]*?)\n  m_TeleportBoundsHalfWidth:/);
    if (!listMatch) return [];
    const blockText = listMatch[1];
    const entries = blockText.split(/\n  - m_Color:/).map((chunk, i) => i === 0 ? chunk.replace(/^\s*-\s*/, '') : 'm_Color:' + chunk);
    return entries
        .filter(e => e.includes('m_Color'))
        .map(e => ({
            color: extractRgba(e, 'm_Color'),
            intensity: extractNumber(e, 'm_Intensity'),
            rotation: extractQuat(e, 'm_Rotation'),
            type: extractNumber(e, 'm_Type')
        }));
}

function parseEnvironmentAsset(filePath) {
    const text = readFileSync(filePath, 'utf8');
    const guid = extractGuidStorage(text);
    const name = extractScalar(text, 'm_Name');
    if (!guid || !name) return null;

    if (!text.includes('m_RenderSettings:')) return null;

    return {
        guid,
        name,
        fogEnabled: extractNumber(text, 'm_FogEnabled') === 1,
        fogColor: extractRgba(text, 'm_FogColor'),
        fogDensity: extractNumber(text, 'm_FogDensity'),
        fogStartDistance: extractNumber(text, 'm_FogStartDistance'),
        fogEndDistance: extractNumber(text, 'm_FogEndDistance'),
        ambientColor: extractRgba(text, 'm_AmbientColor'),
        skyboxColorA: extractRgba(text, 'm_SkyboxColorA'),
        skyboxColorB: extractRgba(text, 'm_SkyboxColorB'),
        skyboxTint: extractRgba(text, 'm_SkyboxTint'),
        skyboxExposure: extractNumber(text, 'm_SkyboxExposure'),
        lights: extractLights(text),
        skyboxCubemap: extractRefGuid(text, 'm_SkyboxCubemap'),
        reflectionCubemap: extractRefGuid(text, 'm_ReflectionCubemap'),
        environmentPrefab: extractScalar(text, 'm_EnvironmentPrefab'),
        _sourceFile: filePath
    };
}

const inputDir = process.argv[2];
const outputFile = process.argv[3] || 'environment-database.json';

if (!inputDir) {
    console.error('Uses: node generate-environment-database.mjs <path-to-Environments-map> [output.json]');
    process.exit(1);
}

const assetFiles = [];
walk(inputDir, assetFiles);
console.log(`Found ${assetFiles.length} .asset files`);

const database = {};
let parsed = 0, skipped = 0;
for (const file of assetFiles) {
    try {
        const env = parseEnvironmentAsset(file);
        if (env) { database[env.guid] = env; parsed++; }
        else skipped++;
    } catch (e) {
        console.warn(`Could not parse ${file}:`, e.message);
        skipped++;
    }
}

writeFileSync(outputFile, JSON.stringify(database, null, 2));
console.log(`${parsed} environments written to ${outputFile} (${skipped} skipped).`);
console.log('Found environments:', Object.values(database).map(e => e.name).join(', '));
