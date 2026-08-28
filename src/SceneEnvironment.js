import { Color, Euler, MathUtils, Quaternion, Vector3, Vector4, FogExp2, CanvasTexture, TextureLoader, EquirectangularReflectionMapping, SRGBColorSpace, DoubleSide } from 'three';
import { EXRLoader } from 'three/examples/jsm/loaders/EXRLoader.js';

export function forceDoubleSide(mat) {
    if (!mat) return;
    mat.side = DoubleSide;
}

export function feedTiltBrushLighting(material) {
    if (material?.uniforms?.directionalLights?.value) {
        const d0 = material.uniforms.directionalLights.value[0];
        if (d0 && material.uniforms.u_SceneLight_0_color) {
            material.uniforms.u_SceneLight_0_color.value = new Vector4(d0.color.r, d0.color.g, d0.color.b, 1);
        }
        const d1 = material.uniforms.directionalLights.value[1];
        if (d1 && material.uniforms.u_SceneLight_1_color) {
            material.uniforms.u_SceneLight_1_color.value = new Vector4(d1.color.r, d1.color.g, d1.color.b, 1);
        }
    }
    if (material?.uniforms?.ambientLightColor?.value && material.uniforms.u_ambient_light_color) {
        const c = material.uniforms.ambientLightColor.value;
        material.uniforms.u_ambient_light_color.value = new Vector4(c[0], c[1], c[2], 1);
    }
    if (material?.uniforms?.fogColor?.value && material.uniforms.u_fogColor) {
        material.uniforms.u_fogColor.value = material.uniforms.fogColor.value;
    }
    if (material?.uniforms?.fogDensity?.value !== undefined && material.uniforms.u_fogDensity) {
        material.uniforms.u_fogDensity.value = material.uniforms.fogDensity.value;
    }
}

export function fixTiltMeshLighting(mesh) {
    if (!mesh.isMesh || !mesh.material) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];

    if (!mesh.geometry.getAttribute('normal')) {
        mesh.geometry.computeVertexNormals();
    }
    mesh.geometry.setAttribute('a_normal', mesh.geometry.getAttribute('normal'));

    mats.forEach(mat => {
        mat.lights = true;
        mat.fog = true;
        mat.needsUpdate = true;
    });

    const previousOnBeforeRender = mesh.onBeforeRender;
    mesh.onBeforeRender = function (renderer, scene, camera, geometry, material, group) {
        previousOnBeforeRender.call(this, renderer, scene, camera, geometry, material, group);
        feedTiltBrushLighting(material);
    };
}

export function parseTBColor(str, fallbackHex) {
    if (!str) return new Color(fallbackHex);
    const [r, g, b] = str.split(',').map(parseFloat);
    return new Color(r, g, b);
}

export function parseTBRotation(str) {
    if (!str) return new Vector3(0, 0, -1);
    const [x, y, z] = str.split(',').map(parseFloat);
    const euler = new Euler(
        MathUtils.degToRad(-x),
        MathUtils.degToRad(-y),
        MathUtils.degToRad(z),
        'YXZ'
    );
    return new Vector3(0, 0, -1).applyEuler(euler);
}

export function applyTBEnvironmentUserData(scene, ambientLight, dirLight0, dirLight1, userData, label) {
    if (!userData) return;
    try {
        if (userData.TB_SkyColorB || userData.TB_FogColor) {
            scene.background = parseTBColor(userData.TB_SkyColorB || userData.TB_FogColor, 0x222222);
        }
        if (userData.TB_AmbientLightColor) {
            ambientLight.color = parseTBColor(userData.TB_AmbientLightColor, 0x000000);
        }
        if (userData.TB_SceneLight0Color) {
            dirLight0.color = parseTBColor(userData.TB_SceneLight0Color, 0x000000);
        }
        if (userData.TB_SceneLight0Rotation) {
            dirLight0.position.copy(parseTBRotation(userData.TB_SceneLight0Rotation)).multiplyScalar(10);
        }
        if (userData.TB_SceneLight1Color) {
            dirLight1.color = parseTBColor(userData.TB_SceneLight1Color, 0x000000);
        }
        if (userData.TB_SceneLight1Rotation) {
            dirLight1.position.copy(parseTBRotation(userData.TB_SceneLight1Rotation)).multiplyScalar(10);
        }
        if (userData.TB_FogColor && userData.TB_FogDensity !== undefined) {
            const fogColor = parseTBColor(userData.TB_FogColor, 0x222222);
            const fogDensity = parseFloat(userData.TB_FogDensity) || 0;
            scene.fog = new FogExp2(fogColor, fogDensity * 0.001);
        }
        console.error(err);
    } catch (e) {
        console.error(err);
    }
}

let environmentDatabasePromise = null;
export function loadEnvironmentDatabase() {
    if (!environmentDatabasePromise) {
        environmentDatabasePromise = fetch('./data/environment-database.json')
            .then(res => { if (!res.ok) throw new Error(`HTTP ${res.status}`); return res.json(); })
            .then(db => {
                return db;
            })
            .catch(err => {
                return null;
            });
    }
    return environmentDatabasePromise;
}

let cubemapDatabasePromise = null;
export function loadCubemapDatabase() {
    if (!cubemapDatabasePromise) {
        cubemapDatabasePromise = fetch('./data/cubemap-database.json')
            .then(res => { if (!res.ok) throw new Error(`HTTP ${res.status}`); return res.json(); })
            .then(db => {
                return db;
            })
            .catch(err => {
                return null;
            });
    }
    return cubemapDatabasePromise;
}

export function applyEnvironmentAssetData(scene, ambientLight, dirLight0, dirLight1, env, cubemapDb, label, customData = null, cubemapBasePath = './Cubemaps/') {
    try {
        const toHex = rgba => new Color(rgba[0], rgba[1], rgba[2]);
        const lightDirection = (rotXYZW) => {
            const q = new Quaternion(-rotXYZW[0], -rotXYZW[1], rotXYZW[2], rotXYZW[3]);
            return new Vector3(0, 0, -1).applyQuaternion(q);
        };

        let colorTop = env.skyboxColorA ? toHex(env.skyboxColorA) : null;
        let colorBottom = env.skyboxColorB ? toHex(env.skyboxColorB) : null;

        if (customData) {
            if (customData.TB_SkyColorA) {
                const [r, g, b] = customData.TB_SkyColorA.split(',').map(parseFloat);
                colorTop = new Color(r, g, b);
            }
            if (customData.TB_SkyColorB) {
                const [r, g, b] = customData.TB_SkyColorB.split(',').map(parseFloat);
                colorBottom = new Color(r, g, b);
            }
            if (customData.Environment && customData.Environment.GradientColors) {
                const c0 = customData.Environment.GradientColors[0];
                const c1 = customData.Environment.GradientColors[1];
                colorTop = new Color(c0[0] / 255, c0[1] / 255, c0[2] / 255);
                colorBottom = new Color(c1[0] / 255, c1[1] / 255, c1[2] / 255);
            }
        }

        if (colorTop && colorBottom) {

            if (!colorTop.equals(colorBottom)) {
                const canvas = document.createElement('canvas');
                canvas.width = 512;
                canvas.height = 512;
                const context = canvas.getContext('2d');

                const gradient = context.createLinearGradient(0, 0, 0, 512);
                gradient.addColorStop(0, colorBottom.getStyle());
                gradient.addColorStop(1, colorTop.getStyle());

                context.fillStyle = gradient;
                context.fillRect(0, 0, 512, 512);

                const texture = new CanvasTexture(canvas);
                texture.colorSpace = SRGBColorSpace;
                texture.mapping = EquirectangularReflectionMapping;
                texture.needsUpdate = true;
                scene.background = texture;
            } else {
                scene.background = colorTop;
            }

        } else if (env.fogColor) {
            scene.background = toHex(env.fogColor);
        }

        if (env.ambientColor) ambientLight.color = toHex(env.ambientColor);

        if (env.lights && env.lights[0]) {
            dirLight0.color = toHex(env.lights[0].color);
            dirLight0.intensity = env.lights[0].intensity ?? 1;
            dirLight0.position.copy(lightDirection(env.lights[0].rotation)).multiplyScalar(10);
        }
        if (env.lights && env.lights[1]) {
            dirLight1.color = toHex(env.lights[1].color);
            dirLight1.intensity = env.lights[1].intensity ?? 1;
            dirLight1.position.copy(lightDirection(env.lights[1].rotation)).multiplyScalar(10);
        } else {
            dirLight1.intensity = 0;
        }

        if (env.fogEnabled && env.fogColor) {
            const density = env.fogDensity > 0 ? env.fogDensity :
                (customData?.TB_FogDensity ? parseFloat(customData.TB_FogDensity) : 0.01);
            scene.fog = new FogExp2(toHex(env.fogColor), density * 0.001);
        }

        const loadCubemap = (guid, isSkybox) => {
            if (!guid || !cubemapDb || !cubemapDb[guid]) return;
            const fileName = cubemapDb[guid];
            const filePath = cubemapBasePath + fileName;

            const isEXR = fileName.toLowerCase().endsWith('.exr');
            const loader = isEXR ? new EXRLoader() : new TextureLoader();

            loader.load(filePath, (texture) => {
                if (!isEXR) texture.colorSpace = SRGBColorSpace;
                texture.mapping = EquirectangularReflectionMapping;

                if (isSkybox) {
                    scene.background = texture;
                } else {
                    scene.environment = texture;
                }
            }, undefined, (err) => console.error(err));
        };

        if (env.skyboxCubemap) loadCubemap(env.skyboxCubemap, true);
        if (env.reflectionCubemap) loadCubemap(env.reflectionCubemap, false);

    } catch (e) {
        throw e;
    }
}