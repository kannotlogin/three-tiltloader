import { 
    Loader, 
    FileLoader, 
    Group, 
    Mesh, 
    BufferGeometry, 
    BufferAttribute, 
    Clock, 
    FrontSide, 
    DoubleSide, 
    BackSide, 
    MeshBasicMaterial 
} from 'three';
import { unzipSync, strFromU8 } from 'three/examples/jsm/libs/fflate.module.js';
import { TiltShaderLoader, createTiltBrushRenderMaterial, applyTiltBrushRenderGroups } from 'three-icosa';
import { generateBrushGeometry } from './brush-geometry.ts';
import { BRUSH_DATABASE } from './data/brush-database.generated.js';

export { createBufferGeometry } from './geometry-api.mjs';
export {
	createBrushGeometryArrays,
	generateBrushGeometry,
	generateBrushGeometryInto,
	getGeneratedIndexCount,
	getGeneratedVertexCount
} from './brush-geometry.ts';

// Export lighting and environment logic seamlessly.
export * from './SceneEnvironment.js';

const brushFamilyMap = {
    "LightWire": "tube", "Disco": "tube", "TubeToonInverted": "tube",
    "FacetedTube": "tube", "WaveformTube": "tube", "MylarTube": "tube",
    "KeijiroTube": "tube", "TaperedWire": "tube", "Wireframe": "tube",
    "Muscle": "tube", "Guts": "tube", "TubeAdditive": "tube",
    "Wire (Lit)": "tube", "Fire2": "tube", "BubbleWand": "tube",
    "Lofted (Hue Shift)": "tube", "Lofted": "tube", "Comet": "tube",
    "DiamondHull": "hull", "MatteHull": "hull", "UnlitHull": "hull",
    "ShinyHull": "hull", "SmoothHull": "hull", "PassthroughHull": "hull",
    "ConcaveHull": "concave-hull",
    "Stars": "particle", "Bubbles": "particle", "Rising Bubbles": "particle",
    "Snow": "particle", "Embers": "particle", "Smoke": "particle",
    "WaveformParticles": "particle", "Fairy": "particle", "Rain": "particle",
    "Wind": "particle", "Space": "particle", "Sparks": "particle", "Splatter": "particle",
    "ThickPaint": "thick-strip", "ThickGeometry": "thick-strip",
    "3D Printing Brush": "print3d"
};

const brushGeometryOverrides = {
    "Petal": {
        geometryParams: {
            tubeShapeModifier: 5,               
            tubeSideCount: 5,                   
            tubeHardEdges: true,                
            tubeEndCaps: false,                 
            tubeBreakAngleMultiplier: 1000,     
            tubePetalDisplacementAmount: 2.0,   
            tubePetalDisplacementExponent: 3.0  
        }
    },
    "Spikes": {
        geometryParams: {
            tubeShapeModifier: 4,    
            tubeSideCount: 3,        
            tubeHardEdges: true      
        }
    },
    "Lofted": {
        geometryParams: {
            tubeShapeModifier: 1,    
            tubeSideCount: 4,        
            tubeHardEdges: true      
        }
    },
    "Lofted (Hue Shift)": {
        geometryParams: {
            tubeShapeModifier: 1,
            tubeSideCount: 4,
            tubeHardEdges: true
        }
    },
    "Comet": {
        geometryParams: {
            tubeUvStyle: "stretch",  
            tubeShapeModifier: 3     
        }
    },
    "LightWire": {
        geometryParams: {
            tubeStoreRadiusInTexcoord0Z: true
        }
    },
    "HyperGrid": {
        geometryParams: {
            sprayRateMultiplier: 1   
        }
    }
};

const brushGeneratorMap = {
    // none
};

const renderBackfacesMap = {
    "OilPaint": true, "Ink": true, "ThickPaint": true, "WetPaint": true
};

function parseSketchBinary(arrayBuffer) {
    const data = new DataView(arrayBuffer);
    const num_strokes = data.getInt32(16, true);
    let offset = 20;
    const strokes = [];

    for (let i = 0; i < num_strokes; i++) {
        const brush_index = data.getInt32(offset, true);
            
        const brush_color = [
            data.getFloat32(offset + 4, true),
            data.getFloat32(offset + 8, true),
            data.getFloat32(offset + 12, true),
            data.getFloat32(offset + 16, true),
        ];
        const brush_size = data.getFloat32(offset + 20, true);
        const stroke_mask = data.getUint32(offset + 24, true);
        const controlpoint_mask = data.getUint32(offset + 28, true);
        
        let offset_stroke_mask = 0;
        let temp_stroke_mask = stroke_mask;
        let strokeBitIndex = 0;
        let brushScale = 1.0;
        let strokeSeed = i;
        let ext_offset = offset + 32;

        while (temp_stroke_mask > 0) {
            if ((temp_stroke_mask & 1) !== 0) {
                let extSize = 4;
                if (strokeBitIndex === 1) brushScale = data.getFloat32(ext_offset, true);
                else if (strokeBitIndex === 3) strokeSeed = data.getUint32(ext_offset, true);
                
                ext_offset += extSize;
                offset_stroke_mask += extSize;
            }
            temp_stroke_mask >>>= 1;
            strokeBitIndex++;
        }

        let offset_controlpoint_mask = 0;
        let temp_cp_mask = controlpoint_mask;
        while (temp_cp_mask > 0) {
            offset_controlpoint_mask += (temp_cp_mask & 1) * 4;
            temp_cp_mask >>>= 1;
        }

        offset += 32 + offset_stroke_mask;

        const num_control_points = data.getInt32(offset, true);
        offset += 4;

        const cp_stride = 28 + offset_controlpoint_mask;
        const controlPoints = [];

        for (let p = 0; p < num_control_points; p++) {
            const base = offset + p * cp_stride;
            
            // CONVERSION: Unity (Left-handed) to Three.js (Right-handed)
            const position = [
                data.getFloat32(base + 0, true),
                data.getFloat32(base + 4, true),
                -data.getFloat32(base + 8, true) 
            ];
            const orientation = [
                -data.getFloat32(base + 12, true), 
                -data.getFloat32(base + 16, true), 
                data.getFloat32(base + 20, true),
                data.getFloat32(base + 24, true)
            ];
            
            let pressure = 1.0;
            let timestampMs = 0;
            
            let extOffset = base + 28;
            let temp_mask = controlpoint_mask;
            let bitIndex = 0;
            
            while (temp_mask > 0) {
                if ((temp_mask & 1) !== 0) {
                    if (bitIndex === 0) pressure = data.getFloat32(extOffset, true);
                    else if (bitIndex === 1) timestampMs = data.getUint32(extOffset, true);
                    extOffset += 4;
                }
                temp_mask >>>= 1;
                bitIndex++;
            }

            controlPoints.push({ position, orientation, pressure, timestampMs });
        }

        strokes.push({
            brush_index, color: brush_color, brushSize: brush_size,
            brushScale, controlPoints, seed: strokeSeed
        });

        offset += num_control_points * cp_stride;
    }
    return strokes;
}

function createGeometryFromArrays(arraysList) {
    if (arraysList.length === 0) return new BufferGeometry();

    let totalVertices = 0;
    let totalIndices = 0;
    for (const arr of arraysList) {
        totalVertices += arr.positions.length / 3;
        totalIndices += arr.indices.length;
    }

    const positions = new Float32Array(totalVertices * 3);
    const normals = new Float32Array(totalVertices * 3);
    const tangents = new Float32Array(totalVertices * 4);
    const colors = new Float32Array(totalVertices * 4);
    const uvs = new Float32Array(totalVertices * 2);
    const indices = new Uint32Array(totalIndices);
    
    const uv0Size = arraysList[0]?.uv0Size || 2;
    const uv1Size = arraysList[0]?.uv1Size || 0;
    
    let packedUvs = null;
    let uv1s = null;
    
    if (uv0Size > 2) packedUvs = new Float32Array(totalVertices * uv0Size);
    if (uv1Size > 0) uv1s = new Float32Array(totalVertices * uv1Size);

    let vOffset = 0;
    let iOffset = 0;

    for (const arr of arraysList) {
        const vCount = arr.positions.length / 3;
        const iCount = arr.indices.length;

        positions.set(arr.positions, vOffset * 3);
        normals.set(arr.normals, vOffset * 3);
        if (arr.tangents) tangents.set(arr.tangents, vOffset * 4);
        colors.set(arr.colors, vOffset * 4);
        uvs.set(arr.uvs, vOffset * 2);

        if (packedUvs && arr.packedUvs) packedUvs.set(arr.packedUvs, vOffset * uv0Size);
        if (uv1s && arr.uv1) uv1s.set(arr.uv1, vOffset * uv1Size);
        
        for (let i = 0; i < iCount; i++) {
            indices[iOffset + i] = arr.indices[i] + vOffset;
        }

        vOffset += vCount;
        iOffset += iCount;
    }

    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(positions, 3));
    geometry.setAttribute('normal', new BufferAttribute(normals, 3));
    geometry.setAttribute('tangent', new BufferAttribute(tangents, 4));
    geometry.setAttribute('color', new BufferAttribute(colors, 4));
    
    if (uv0Size === 2) geometry.setAttribute('uv', new BufferAttribute(uvs, 2));
    else if (uv0Size > 2) geometry.setAttribute('uv', new BufferAttribute(packedUvs, uv0Size));
    
    if (uv1Size > 0) geometry.setAttribute('uv1', new BufferAttribute(uv1s, uv1Size));

    geometry.setIndex(new BufferAttribute(indices, 1));

    geometry.setAttribute('a_position', geometry.getAttribute('position'));
    geometry.setAttribute('a_normal', geometry.getAttribute('normal'));
    geometry.setAttribute('a_color', geometry.getAttribute('color'));
    geometry.setAttribute('a_texcoord0', geometry.getAttribute('uv'));
    if (geometry.getAttribute('uv1')) geometry.setAttribute('a_texcoord1', geometry.getAttribute('uv1'));
    if (geometry.getAttribute('tangent')) geometry.setAttribute('a_tangent', geometry.getAttribute('tangent'));

    return geometry;
}

export class TiltLoader extends Loader {
    constructor(manager) {
        super(manager);
        this.tiltShaderLoader = new TiltShaderLoader(manager);
    }

    setBrushPath(path) {
        if (path.slice(path.length - 1) !== '/') path += '/';
        this.tiltShaderLoader.setPath(path);
        return this;
    }

    load(url, onLoad, onProgress, onError) {
        const scope = this;
        const loader = new FileLoader(this.manager);
        loader.setPath(this.path);
        loader.setResponseType('arraybuffer');
        loader.setWithCredentials(this.withCredentials);
        loader.load(url, function (buffer) {
            scope.parse(buffer).then(group => {
                onLoad(group);
            }).catch(err => {
                if (onError) onError(err);
                else console.error(err);
                scope.manager.itemError(url);
            });
        }, onProgress, onError);
    }

    async parse(buffer) {
        const group = new Group();
        const zip = unzipSync(new Uint8Array(buffer.slice(16)));
        const metadata = JSON.parse(strFromU8(zip['metadata.json']));
        const strokes = parseSketchBinary(zip['data.sketch'].buffer);
        const brushDatabase = BRUSH_DATABASE;

        group.userData.tiltMetadata = metadata;

        const byBrush = {};
        const globalPlaybackRange = { min: Infinity, max: -Infinity };
        
        for (const s of strokes) {
            if (!byBrush[s.brush_index]) byBrush[s.brush_index] = [];
            byBrush[s.brush_index].push(s);
        }

        const clock = new Clock();
        
        for (const brushIndexStr in byBrush) {
            const guidOrName = metadata.BrushIndex[brushIndexStr];
            const materialName = this.tiltShaderLoader.lookupMaterialName(guidOrName);
            if (!materialName) continue;

            const dbEntry = brushDatabase[guidOrName];

            let family = dbEntry?.family || brushFamilyMap[materialName] || "ribbon";
            let generatorClass = dbEntry?.generatorClass || brushGeneratorMap[materialName];

            if (!generatorClass) {
                if (family === "ribbon" || family === "emissive") generatorClass = "FlatGeometryBrush";
                else if (family === "tube") generatorClass = "TubeBrush";
            }

            if (materialName === "Petal" || materialName === "Spikes") {
                family = "tube";
                generatorClass = "TubeBrush";
            }
            
            const needsRealBackfaces = dbEntry?.geometryParams?.renderBackfaces !== undefined
                ? dbEntry.geometryParams.renderBackfaces
                : renderBackfacesMap[materialName] === true;

            const defaultOpacityOverrides = {
                "Electricity": {
                    geometryParams: { ribbonOffsetInTexcoord1: true }
                },
                "Petal": {
                    geometryParams: { tubeShapeModifier: 5 }
                }
            };

            const baseOverride = defaultOpacityOverrides[materialName] || {};
            const legacyOverride = {
                ...baseOverride,
                ...(brushGeometryOverrides[materialName] || {}),
                geometryParams: {
                    ...baseOverride.geometryParams,
                    ...(brushGeometryOverrides[materialName]?.geometryParams || {})
                }
            };
            
            const options = {
                generatorClass: legacyOverride.generatorClass || generatorClass,
                pressureSizeRange: legacyOverride.pressureSizeRange || dbEntry?.pressureSizeRange,
                pressureOpacityRange: legacyOverride.pressureOpacityRange || dbEntry?.pressureOpacityRange,
                deterministicBirthTime: true,
                geometryParams: {
                    renderBackfaces: needsRealBackfaces,
                    ...(dbEntry?.geometryParams || {}),
                    ...(legacyOverride.geometryParams || {}) 
                }
            };

            const arraysList = [];
            const strokeTimeline = [];
            let cumulativeIndexCount = 0;
            
            for (const stroke of byBrush[brushIndexStr]) {
                if (stroke.controlPoints.length < 2) continue;
                const arrays = generateBrushGeometry(stroke, family, options);

                if (materialName === "Comet") {
                    let maxU = 0;
                    for (let i = 0; i < arrays.uvs.length; i += 2) if (arrays.uvs[i] > maxU) maxU = arrays.uvs[i];
                    for (let i = 0; i < arrays.uvs.length; i += 2) arrays.uvs[i] = maxU - arrays.uvs[i];
                }

                arraysList.push(arrays);
                cumulativeIndexCount += arrays.indices.length;
                const lastCp = stroke.controlPoints[stroke.controlPoints.length - 1];
                strokeTimeline.push({ indexEnd: cumulativeIndexCount, t: lastCp.timestampMs });
                if (lastCp.timestampMs < globalPlaybackRange.min) globalPlaybackRange.min = lastCp.timestampMs;
                if (lastCp.timestampMs > globalPlaybackRange.max) globalPlaybackRange.max = lastCp.timestampMs;
            }

            const geometry = createGeometryFromArrays(arraysList);

            let material;
            try {
                material = await this.tiltShaderLoader.loadAsync(materialName);
            } catch (err) {
                continue;
            }

            if (material) {
                const isAdditive = material.blending === 2 || material.blending === 5 || material.name.includes("Waveform") || material.name.includes("Chromatic");
                
                if (needsRealBackfaces && !isAdditive && materialName !== "Petal") {
                    material.side = FrontSide; 
                } else {
                    material.side = DoubleSide; 
                }

                if (isAdditive) material.depthWrite = false;

                if (material.uniforms && material.uniforms.u_A2CEnabled) {
                    material.uniforms.u_A2CEnabled.value = 0.0;
                    material.needsUpdate = true;
                }

                if (materialName === "Electricity" || guidOrName === "f6e85de3-6dcc-4e7f-87fd-cee8c3d25d51") {
                    if (material.uniforms) {
                        material.uniforms.u_isNewTiltExporter = { value: false };
                        material.uniforms.u_ElectricityHasBakedDisplacement = { value: false };
                    }
                    material = createTiltBrushRenderMaterial(guidOrName, material, {}, { electricityMultipass: true });
                }

                if (materialName === "HyperGrid" && material.uniforms) {
                    material.uniforms.u_isNewTiltExporter = { value: true };
                    material.needsUpdate = true;
                }
            }

            const mesh = new Mesh(geometry, material);

            if (Array.isArray(material)) {
                applyTiltBrushRenderGroups(geometry, geometry.getIndex().count, material);
            }

            mesh.userData.strokeTimeline = strokeTimeline;
            mesh.onBeforeRender = (renderer, scene, camera, geo, mat) => {
                if (mat.uniforms && mat.uniforms['u_time']) {
                    const t = clock.getElapsedTime();
                    mat.uniforms['u_time'].value.set(t / 20, t, t * 2, t * 3);
                }
                if (mat.uniforms && mat.uniforms['cameraPosition']) {
                    mat.uniforms['cameraPosition'].value = camera.position;
                }
            };
            group.add(mesh);

            if (materialName === "Toon") {
                const outlineMaterial = material.clone();
                outlineMaterial.side = BackSide;
                outlineMaterial.uniforms = { ...material.uniforms };
                
                if (material.uniforms.u_isOutline === undefined) {
                    material.uniforms.u_isOutline = { value: 0.0 };
                }
                outlineMaterial.uniforms.u_isOutline = { value: 1.0 };
                
                const outlineMesh = new Mesh(geometry, outlineMaterial);
                outlineMesh.userData.strokeTimeline = strokeTimeline;
                outlineMesh.onBeforeRender = mesh.onBeforeRender; 
                group.add(outlineMesh);
            }
        }
        
        if (globalPlaybackRange.max > globalPlaybackRange.min) {
            group.userData.playbackRangeMs = globalPlaybackRange;
        }

        return group;
    }
}