const SKETCH_FOLDERS = ['rick and morty', 'mother', 'The Upside Down', 'test-brushes'];

const originalFetch = window.fetch;
window.fetch = async function(...args) {
    let urlStr = args[0] instanceof Request ? args[0].url : String(args[0]);
    let decodedUrl = urlStr;
    try { decodedUrl = decodeURIComponent(urlStr); } catch(e) {}

    for (const folder of SKETCH_FOLDERS) {
        if (decodedUrl.includes(`${folder}/sketch.bin`)) {
            args[0] = `https://media.githubusercontent.com/media/kannotlogin/three-tiltloader/main/Demo/${encodeURIComponent(folder)}/sketch.bin`;
            urlStr = args[0];
        } else if (decodedUrl.includes(`${folder}/Extra-Models/`)) {
            const filename = decodedUrl.split('/').pop();
            args[0] = `https://media.githubusercontent.com/media/kannotlogin/three-tiltloader/main/Demo/${encodeURIComponent(folder)}/Extra-Models/${filename}`;
            urlStr = args[0];
        }
    }

    if (decodedUrl.includes('tmp1352bc07.bin')) {
        args[0] = 'https://media.githubusercontent.com/media/kannotlogin/three-tiltloader/main/Demo/The%20Upside%20Down/tmp1352bc07.bin';
        urlStr = args[0];
    } else if (decodedUrl.includes('milkyway.psd')) {
        args[0] = 'https://media.githubusercontent.com/media/kannotlogin/three-tiltloader/main/src/data/Cubemaps/milkyway.psd';
        urlStr = args[0];
    }

    if (urlStr.length > 500 && (urlStr.includes('void%20main') || urlStr.includes('%20a_position'))) {
        let decoded = urlStr;
        try { decoded = decodeURIComponent(urlStr); } catch(e) {}
        
        let codeStart = decoded.indexOf('#version 300 es');
        if (codeStart === -1) codeStart = decoded.indexOf('// Copyright');
        if (codeStart === -1) codeStart = decoded.indexOf('in vec4');
        if (codeStart === -1) codeStart = 0;
        
        const cleanCode = decoded.substring(codeStart);
        
        return new Response(cleanCode, { status: 200, headers: { 'Content-Type': 'text/plain' } });
    }

    return originalFetch.apply(this, args);
};

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { GLTFGoogleTiltBrushMaterialExtension } from 'three-icosa';

import {
    TiltLoader,
    fixTiltMeshLighting,
    forceDoubleSide,
    applyTBEnvironmentUserData,
    applyEnvironmentAssetData,
    loadEnvironmentDatabase,
    loadCubemapDatabase
} from 'three-tiltloader';

const globalClock = new THREE.Clock();

// --- AUDIO ANALYSER SETUP ---
const audioListener = new THREE.AudioListener();
const sound = new THREE.Audio(audioListener);
let analyser;

const urlParams = new URLSearchParams(window.location.search);
const currentFolder = urlParams.get('sketch') || 'rick and morty';

window.addEventListener('DOMContentLoaded', () => {
    const audioElement = document.getElementById('music-player');
    const audioSource = audioListener.context.createMediaElementSource(audioElement);
    sound.setNodeSource(audioSource);
    analyser = new THREE.AudioAnalyser(sound, 32);

    const selectEl = document.getElementById('sketch-select');
    if (selectEl) {
        selectEl.value = currentFolder;
        selectEl.addEventListener('change', (e) => {
            window.location.search = `?sketch=${encodeURIComponent(e.target.value)}`;
        });
    }
});

function fitCameraToModel(camera, controls, model) {
    const box = new THREE.Box3().setFromObject(model);
    if (box.isEmpty()) return;

    const size = new THREE.Vector3(); box.getSize(size);
    const center = new THREE.Vector3(); box.getCenter(center);
    const maxDim = Math.max(size.x, size.y, size.z);
    
    const fov = camera.fov * (Math.PI / 180);
    let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2));
    cameraZ *= 1.5;
    
    camera.position.set(center.x, center.y + (maxDim * 0.2), center.z + cameraZ);
    camera.near = maxDim / 100;
    camera.far = cameraZ * 100;
    camera.updateProjectionMatrix();

    controls.target.copy(center);
    controls.maxDistance = cameraZ * 10;
    controls.update();
}

function centerAndScaleModel(model, targetSize) {
    const box = new THREE.Box3().setFromObject(model);
    if (box.isEmpty()) return model;

    const size = new THREE.Vector3(); box.getSize(size);
    const center = new THREE.Vector3(); box.getCenter(center);

    model.position.sub(center);
    const pivotGroup = new THREE.Group();
    pivotGroup.add(model);

    const maxDim = Math.max(size.x, size.y, size.z);
    if (maxDim > 0) pivotGroup.scale.setScalar(targetSize / maxDim);

    return pivotGroup;
}

// ==========================================
// SETUP TILT
// ==========================================
const containerLeft = document.getElementById('left-view');
const sceneLeft = new THREE.Scene();
sceneLeft.background = new THREE.Color(0x1a1a1a);

const cameraLeft = new THREE.PerspectiveCamera(75, window.innerWidth / 2 / window.innerHeight, 0.1, 10000);
cameraLeft.position.set(0, 15, 40);

const rendererLeft = new THREE.WebGLRenderer({ antialias: true });
rendererLeft.setSize(window.innerWidth / 2, window.innerHeight);
rendererLeft.outputColorSpace = THREE.SRGBColorSpace;
rendererLeft.toneMapping = THREE.ACESFilmicToneMapping;
rendererLeft.toneMappingExposure = 1.0;
containerLeft.appendChild(rendererLeft.domElement);

const controlsLeft = new OrbitControls(cameraLeft, rendererLeft.domElement);
controlsLeft.target.set(0, 0, 0);

let sharedTiltBrushEnvironmentUserData = null;
let leftSceneReadyForEnvironment = false;
let leftEnvironmentApplied = false;

function tryApplyEnvironmentToLeft() {
    if (leftSceneReadyForEnvironment && sharedTiltBrushEnvironmentUserData && !leftEnvironmentApplied) {
        applyTBEnvironmentUserData(
            sceneLeft, ambientLightLeft, dirLightLeft0, dirLightLeft1,
            sharedTiltBrushEnvironmentUserData, 'Links/.tilt'
        );
        leftEnvironmentApplied = true;
    }
}

const ambientLightLeft = new THREE.AmbientLight(0xffffff, 1.0);
sceneLeft.add(ambientLightLeft);
const dirLightLeft0 = new THREE.DirectionalLight(0x000000, 1.0);
sceneLeft.add(dirLightLeft0);
sceneLeft.add(dirLightLeft0.target);
const dirLightLeft1 = new THREE.DirectionalLight(0x000000, 1.0);
sceneLeft.add(dirLightLeft1);
sceneLeft.add(dirLightLeft1.target);

const tiltLoader = new TiltLoader();
tiltLoader.setBrushPath('../brushes/'); 

const tiltFilePath = `./${currentFolder}/sketch.tilt`;
const tiltDir = tiltFilePath.substring(0, tiltFilePath.lastIndexOf('/') + 1);

tiltLoader.load(tiltFilePath, async (promiseData) => {
    try {
        const rawModel = await promiseData;

        rawModel.traverse(child => {
            if (child.isMesh && child.material) {
                fixTiltMeshLighting(child);

                const mats = Array.isArray(child.material) ? child.material : [child.material];
                mats.forEach(mat => {
                    if (mat.name.includes("Smoke") && mat.uniforms && mat.uniforms.u_TintColor) {
                        mat.uniforms.u_TintColor.value.set(0.05, 0.05, 0.05, 1.0);
                    }
                });
            }
        });

        const tiltMeta = rawModel.userData.tiltMetadata;
        rawModel.scale.setScalar(0.1);
        rawModel.updateMatrixWorld(true);

        const boxLeft = new THREE.Box3().setFromObject(rawModel);
        const centerLeft = new THREE.Vector3();
        boxLeft.getCenter(centerLeft);
        rawModel.position.sub(centerLeft);

        sceneLeft.add(rawModel);
        leftSceneReadyForEnvironment = true;

        // 3D loading
        if (tiltMeta && tiltMeta.ModelIndex) {
            tiltMeta.ModelIndex.forEach(item => {
                if (item.AssetId) {
                    const modelPath = `${tiltDir}extra-models/${item.AssetId}.glb`;

                    const extGltfLoader = new GLTFLoader();
                    extGltfLoader.load(modelPath, function (gltfExt) {
                        const baseModel = gltfExt.scene;

                        if (item.RawTransforms && item.RawTransforms.length > 0) {
                            item.RawTransforms.forEach(transform => {
                                const pos = transform[0];
                                const rot = transform[1];
                                const scl = transform[2];

                                const instance = baseModel.clone();

                                instance.position.set(pos[0], pos[1], -pos[2]);
                                instance.quaternion.set(-rot[0], -rot[1], rot[2], rot[3]);
                                instance.scale.setScalar(scl);

                                rawModel.add(instance);
                            });
                            console.log(`Extra model loaded: ${item.AssetId}`);
                        }
                    }, undefined, (err) => {
                        console.warn(`Missing 3D model for AssetId: "${item.AssetId}". Place the file in the extra-models folder.`);
                    });
                }
            });
        }

        const envDb = await loadEnvironmentDatabase();
        const cubemapDb = await loadCubemapDatabase(); 
        const envEntry = envDb && tiltMeta?.EnvironmentPreset ? envDb[tiltMeta.EnvironmentPreset] : null;
        
        if (envEntry) {
            try {
                applyEnvironmentAssetData(sceneLeft, ambientLightLeft, dirLightLeft0, dirLightLeft1, envEntry, cubemapDb, 'Links/.tilt', tiltMeta, '../src/data/Cubemaps/');
                leftEnvironmentApplied = true;
            } catch (e) {
                tryApplyEnvironmentToLeft();
            }
        } else {
            tryApplyEnvironmentToLeft();
        }

        fitCameraToModel(cameraLeft, controlsLeft, rawModel);
        setupPlayback(rawModel);
        console.log("Tilt model loaded!");
    } catch (e) {
        console.error('[Left/.tilt] Error processing tilt model:', e);
    }
}, undefined, (err) => console.error("Error in TiltLoader:", err));


// ==========================================
// SETUP GLTF
// ==========================================
const containerRight = document.getElementById('right-view');
const sceneRight = new THREE.Scene();
sceneRight.background = new THREE.Color(0x222222);

const cameraRight = new THREE.PerspectiveCamera(75, window.innerWidth / 2 / window.innerHeight, 0.1, 10000);
cameraRight.position.set(0, 15, 40);

const rendererRight = new THREE.WebGLRenderer({ antialias: true });
rendererRight.setSize(window.innerWidth / 2, window.innerHeight);
rendererRight.outputColorSpace = THREE.SRGBColorSpace;
rendererRight.toneMapping = THREE.ACESFilmicToneMapping;
rendererRight.toneMappingExposure = 1.0;
containerRight.appendChild(rendererRight.domElement);

const controlsRight = new OrbitControls(cameraRight, rendererRight.domElement);
controlsRight.target.set(0, 0, 0);

const ambientLightRight = new THREE.AmbientLight(0xffffff, 1.0);
sceneRight.add(ambientLightRight);

const dirLightRight0 = new THREE.DirectionalLight(0x000000, 1.0);
sceneRight.add(dirLightRight0);
sceneRight.add(dirLightRight0.target); 

const dirLightRight1 = new THREE.DirectionalLight(0x000000, 1.0);
sceneRight.add(dirLightRight1);
sceneRight.add(dirLightRight1.target);

const gltfLoader = new GLTFLoader();
gltfLoader.register(parser => new GLTFGoogleTiltBrushMaterialExtension(parser, '../brushes/', true));

gltfLoader.load(`./${currentFolder}/sketch.gltf`, async (gltf) => {

    const userData = gltf.scene.userData || gltf.userData || {};

    sharedTiltBrushEnvironmentUserData = userData;
    tryApplyEnvironmentToLeft();

    const envDb = await loadEnvironmentDatabase();
    const cubemapDb = await loadCubemapDatabase();
    const envEntry = envDb && userData.TB_EnvironmentGuid ? envDb[userData.TB_EnvironmentGuid] : null;

    if (envEntry) {
        try {
            applyEnvironmentAssetData(sceneRight, ambientLightRight, dirLightRight0, dirLightRight1, envEntry, cubemapDb, 'Rechts/.gltf', userData, '../src/data/Cubemaps/');
        } catch (e) {
            applyTBEnvironmentUserData(sceneRight, ambientLightRight, dirLightRight0, dirLightRight1, userData, 'Rechts/.gltf');
        }
    } else {
        applyTBEnvironmentUserData(sceneRight, ambientLightRight, dirLightRight0, dirLightRight1, userData, 'Rechts/.gltf');
    }

    gltf.scene.traverse(child => {
        if (child.isMesh && child.material) {
            const mats = Array.isArray(child.material) ? child.material : [child.material];
            mats.forEach(m => {
                forceDoubleSide(m);

                if (m.name.includes("Smoke") && m.uniforms && m.uniforms.u_TintColor) {
                    m.uniforms.u_TintColor.value.set(1.0, 1.0, 1.0, 1.0);
                }
            });
        }
    });

    const boxRight = new THREE.Box3().setFromObject(gltf.scene);
    const centerRight = new THREE.Vector3();
    boxRight.getCenter(centerRight);
    gltf.scene.position.sub(centerRight);

    sceneRight.add(gltf.scene);
    
    fitCameraToModel(cameraRight, controlsRight, gltf.scene);
    console.log("GLTF model loaded with original lighting!");
}, undefined, () => {});


// ==========================================
// DRAW-IN ANIMATIE (PLAYBACK)
// ==========================================
const playbackState = {
    active: false,
    playing: false,
    minMs: 0,
    maxMs: 0,
    currentMs: 0,
    speedMultiplier: 4, 
    meshes: []
};

function setupPlayback(rawModel) {
    const range = rawModel.userData.playbackRangeMs;
    if (!range) return;
    
    playbackState.meshes = [];
    rawModel.traverse(child => {
        if (child.isMesh && child.userData.strokeTimeline && child.userData.strokeTimeline.length > 0) {
            child.userData.basePositions = new Float32Array(child.geometry.attributes.position.array);
            child.userData.wasSquashed = false; 
            playbackState.meshes.push(child);
        }
    });
    if (playbackState.meshes.length === 0) return;

    playbackState.active = true;
    playbackState.minMs = range.min;
    playbackState.maxMs = range.max;
    playbackState.currentMs = range.max;

    playbackUI.style.display = 'flex';
    playbackSlider.value = 1000;
    applyPlaybackTime(playbackState.maxMs);
}

function applyPlaybackTime(ms) {
    for (const mesh of playbackState.meshes) {
        const timeline = mesh.userData.strokeTimeline;
        if (ms >= playbackState.maxMs) {
            mesh.geometry.setDrawRange(0, Infinity);
            continue;
        }
        if (ms <= playbackState.minMs) {
            mesh.geometry.setDrawRange(0, 0);
            continue;
        }
        let indexCount = 0;
        for (let i = 0; i < timeline.length; i++) {
            if (timeline[i].t <= ms) indexCount = timeline[i].indexEnd;
            else break;
        }
        mesh.geometry.setDrawRange(0, indexCount);
    }
}

// --- UI ---
const playbackUI = document.createElement('div');
playbackUI.style.cssText = 'display:none; position:absolute; bottom:20px; left:20px; right:20px; z-index:10; align-items:center; gap:10px; background:rgba(0,0,0,0.8); padding:10px 16px; border-radius:8px; pointer-events:auto;';
const playbackButton = document.createElement('button');
playbackButton.textContent = '▶';
playbackButton.style.cssText = 'background:#FF5B5B; color:white; border:none; border-radius:4px; width:36px; height:36px; font-size:16px; cursor:pointer; flex-shrink:0;';
const playbackSlider = document.createElement('input');
playbackSlider.type = 'range';
playbackSlider.min = '0';
playbackSlider.max = '1000';
playbackSlider.value = '0';
playbackSlider.style.cssText = 'flex:1;';
playbackUI.appendChild(playbackButton);
playbackUI.appendChild(playbackSlider);
containerLeft.appendChild(playbackUI);

playbackButton.addEventListener('click', () => {
    if (!playbackState.active) return;
    if (!playbackState.playing && playbackState.currentMs >= playbackState.maxMs) {
        playbackState.currentMs = playbackState.minMs;
    }
    playbackState.playing = !playbackState.playing;
    playbackButton.textContent = playbackState.playing ? '⏸' : '▶';
});

playbackSlider.addEventListener('input', () => {
    playbackState.playing = false;
    playbackButton.textContent = '▶';
    const frac = playbackSlider.value / 1000;
    playbackState.currentMs = playbackState.minMs + frac * (playbackState.maxMs - playbackState.minMs);
    applyPlaybackTime(playbackState.currentMs);
});

// ==========================================
// ANIMATIE & RESIZE LOOP
// ==========================================
let lastFrameTimeMs = performance.now();
function animate() {
    requestAnimationFrame(animate);

    const nowMs = performance.now();
    const deltaMs = nowMs - lastFrameTimeMs;
    lastFrameTimeMs = nowMs;

    if (playbackState.active && playbackState.playing) {
        playbackState.currentMs += deltaMs * playbackState.speedMultiplier;
        if (playbackState.currentMs >= playbackState.maxMs) {
            playbackState.currentMs = playbackState.maxMs;
            playbackState.playing = false;
            playbackButton.textContent = '▶';
        }
        applyPlaybackTime(playbackState.currentMs);
        const frac = (playbackState.currentMs - playbackState.minMs) / (playbackState.maxMs - playbackState.minMs);
        playbackSlider.value = Math.round(frac * 1000);
    }

    const elapsedTime = globalClock.getElapsedTime();

    let volume = 0;
    let bass = 0, lowMid = 0, highMid = 0, treble = 0;

    if (analyser) {
        const freqData = analyser.getFrequencyData();
        volume = analyser.getAverageFrequency() / 256.0; 

        bass = (freqData[0] + freqData[1]) / (2 * 256);
        lowMid = (freqData[2] + freqData[3] + freqData[4]) / (3 * 256);
        highMid = (freqData[5] + freqData[6] + freqData[7]) / (3 * 256);
        treble = (freqData[8] + freqData[9] + freqData[10]) / (3 * 256);
    }
    const beatFFT = new THREE.Vector4(bass, lowMid, highMid, treble);

    const updateShaders = (scene) => {
        scene.traverse(child => {
            if (!child.isMesh || !child.material) return;
            const mats = Array.isArray(child.material) ? child.material : [child.material];
            mats.forEach(mat => {
                if (!mat || !mat.uniforms) return;
                try {
                    if (mat.uniforms.u_time) {
                        mat.uniforms.u_time.value.set(
                            elapsedTime / 20,
                            elapsedTime,
                            elapsedTime * 2,
                            elapsedTime * 3
                        );
                    }

                    if (mat.uniforms.u_AudioVolume === undefined) mat.uniforms.u_AudioVolume = { value: 0 };
                    if (mat.uniforms.u_BeatFFT === undefined) mat.uniforms.u_BeatFFT = { value: new THREE.Vector4() };

                    mat.uniforms.u_AudioVolume.value = volume;
                    mat.uniforms.u_BeatFFT.value.copy(beatFFT);

                } catch (e) {
                    if (!mat.__u_time_warned) {
                        console.warn('[animate] failed to update u_time for material', mat.name || mat, e);
                        mat.__u_time_warned = true;
                    }
                }
            });
        });
    };

    updateShaders(sceneLeft);
    updateShaders(sceneRight);

    controlsLeft.update();
    controlsRight.update();

    rendererLeft.render(sceneLeft, cameraLeft);
    rendererRight.render(sceneRight, cameraRight);
}
animate();

window.addEventListener('resize', () => {
    const halfWidth = window.innerWidth / 2;
    const height = window.innerHeight;

    cameraLeft.aspect = halfWidth / height;
    cameraLeft.updateProjectionMatrix();
    rendererLeft.setSize(halfWidth, height);

    cameraRight.aspect = halfWidth / height;
    cameraRight.updateProjectionMatrix();
    rendererRight.setSize(halfWidth, height);
});