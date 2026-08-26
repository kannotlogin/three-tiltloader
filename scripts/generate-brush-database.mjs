#!/usr/bin/env node
// generate-brush-database.mjs

import { readdirSync, statSync, readFileSync, writeFileSync } from 'node:fs';
import { join, extname } from 'node:path';

const BRUSH_DESCRIPTOR_SCRIPT_GUID = 'c71b2ac88638c5c41a0a0681f70d2512';

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

function extractBool(text, key) {
    const n = extractNumber(text, key);
    if (n === undefined) return undefined;
    return n !== 0;
}

function extractVec2(text, key) {
    const m = text.match(new RegExp(`^\\s*${key}:\\s*\\{x:\\s*([\\-\\d.eE]+),\\s*y:\\s*([\\-\\d.eE]+)\\}`, 'm'));
    if (!m) return undefined;
    return [parseFloat(m[1]), parseFloat(m[2])];
}

function extractGuidStorage(text) {
    const m = text.match(/m_Guid:\s*\n\s*m_storage:\s*([0-9a-fA-F-]+)/);
    return m ? m[1] : undefined;
}

function parseBrushAsset(filePath) {
    const text = readFileSync(filePath, 'utf8');

    const scriptGuidMatch = text.match(/m_Script:\s*\{fileID:\s*\d+,\s*guid:\s*([0-9a-fA-F]+)/);
    const scriptGuid = scriptGuidMatch ? scriptGuidMatch[1] : undefined;
    if (scriptGuid !== BRUSH_DESCRIPTOR_SCRIPT_GUID) {
        return null;
    }

    const guid = extractGuidStorage(text);
    const durableName = extractScalar(text, 'm_DurableName');
    if (!guid || !durableName) return null;

    const pressureSizeRange = extractVec2(text, 'm_PressureSizeRange');
    const pressureOpacityRange = extractVec2(text, 'm_PressureOpacityRange');

    const geometryParams = {};
    const brushSizeRange = extractVec2(text, 'm_BrushSizeRange');
    if (brushSizeRange) geometryParams.brushSizeRange = brushSizeRange;

    const tileRate = extractNumber(text, 'm_TileRate');
    if (tileRate !== undefined) geometryParams.tileRate = tileRate;

    const textureAtlasV = extractNumber(text, 'm_TextureAtlasV');
    if (textureAtlasV !== undefined) geometryParams.textureAtlasV = textureAtlasV;

    const renderBackfaces = extractBool(text, 'm_RenderBackfaces');
    if (renderBackfaces !== undefined) geometryParams.renderBackfaces = renderBackfaces;

    const backfaceHueShift = extractNumber(text, 'm_BackfaceHueShift');
    if (backfaceHueShift !== undefined) geometryParams.backfaceHueShift = backfaceHueShift;

    const tubeStoreRadiusInTexcoord0Z = extractBool(text, 'm_TubeStoreRadiusInTexcoord0Z');
    if (tubeStoreRadiusInTexcoord0Z !== undefined) geometryParams.tubeStoreRadiusInTexcoord0Z = tubeStoreRadiusInTexcoord0Z;

    const m11Compatibility = extractBool(text, 'm_M11Compatibility');
    if (m11Compatibility !== undefined) geometryParams.m11Compatibility = m11Compatibility;

    const opacity = extractNumber(text, 'm_Opacity');
    if (opacity !== undefined) geometryParams.opacity = opacity;

    const solidMinLengthMeters = extractNumber(text, 'm_SolidMinLengthMeters_PS');
    if (solidMinLengthMeters !== undefined) geometryParams.solidMinLengthMeters = solidMinLengthMeters;

    const audioReactive = extractBool(text, 'm_AudioReactive');
    if (audioReactive !== undefined) geometryParams.audioReactive = audioReactive;

    const colorLuminanceMin = extractNumber(text, 'm_ColorLuminanceMin');
    if (colorLuminanceMin !== undefined) geometryParams.colorLuminanceMin = colorLuminanceMin;

    const colorSaturationMax = extractNumber(text, 'm_ColorSaturationMax');
    if (colorSaturationMax !== undefined) geometryParams.colorSaturationMax = colorSaturationMax;

    const particleRate = extractNumber(text, 'm_ParticleRate');
    if (particleRate !== undefined) geometryParams.particleRate = particleRate;

    const sprayRateMultiplier = extractNumber(text, 'm_SprayRateMultiplier');
    if (sprayRateMultiplier !== undefined) geometryParams.sprayRateMultiplier = sprayRateMultiplier;

    const particleSpeed = extractNumber(text, 'm_ParticleSpeed');
    if (particleSpeed !== undefined) geometryParams.particleSpeed = particleSpeed;

    const particleInitialRotationRange = extractNumber(text, 'm_ParticleInitialRotationRange');
    if (particleInitialRotationRange !== undefined) geometryParams.particleInitialRotationRange = particleInitialRotationRange;

    const particleRandomizeAlpha = extractBool(text, 'm_RandomizeAlpha');
    if (particleRandomizeAlpha !== undefined) geometryParams.particleRandomizeAlpha = particleRandomizeAlpha;

    const sizeVariance = extractNumber(text, 'm_SizeVariance');
    if (sizeVariance !== undefined) geometryParams.particleSizeVariance = sizeVariance;

    const positionVariance = extractNumber(text, 'm_PositionVariance');
    if (positionVariance !== undefined) geometryParams.particlePositionVariance = positionVariance;

    const rotationVariance = extractNumber(text, 'm_RotationVariance');
    if (rotationVariance !== undefined) geometryParams.particleRotationVariance = rotationVariance;

    const sizeRatio = extractVec2(text, 'm_SizeRatio');
    if (sizeRatio) geometryParams.particleSizeRatio = sizeRatio;

    return {
        guid,
        name: durableName,
        pressureSizeRange,
        pressureOpacityRange,
        geometryParams,
        _brushPrefabGuid: (text.match(/m_BrushPrefab:\s*\{fileID:\s*\d+,\s*guid:\s*([0-9a-fA-F]+)/) || [])[1],
        _sourceFile: filePath
    };
}

function walk(dir, out) {
    for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        const stat = statSync(full);
        if (stat.isDirectory()) {
            walk(full, out);
        } else if (extname(entry) === '.asset') {
            out.push(full);
        }
    }
}

// -----------------------------------------------------------------------
// Main
// -----------------------------------------------------------------------
const inputDir = process.argv[2];
const outputFile = process.argv[3] || 'brush-database.json';

if (!inputDir) {
    console.error('Uses: node generate-brush-database.mjs <path-to-Brushes-map> [output.json]');
    process.exit(1);
}

const assetFiles = [];
walk(inputDir, assetFiles);
console.log(`Found .asset files: ${assetFiles.length}`);

const database = {};
let parsedCount = 0;
let skippedCount = 0;

for (const file of assetFiles) {
    try {
        const brush = parseBrushAsset(file);
        if (brush) {
            database[brush.guid] = brush;
            parsedCount++;
        } else {
            skippedCount++;
        }
    } catch (e) {
        console.warn(`Could not parse ${file}:`, e.message);
        skippedCount++;
    }
}

writeFileSync(outputFile, JSON.stringify(database, null, 2));
console.log(`${parsedCount} brushes written to ${outputFile} (${skippedCount} files skipped, no BrushDescriptor).`);
console.log('Voorbeeld entries:', Object.values(database).slice(0, 3).map(b => b.name));
