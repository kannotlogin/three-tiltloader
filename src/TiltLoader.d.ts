import {
	Group,
	Loader,
	LoadingManager,
	Scene,
	Light,
	DirectionalLight
} from 'three';

export {
    createBufferGeometry,
    type ControlPoint,
    type GeometryAttribute,
    type GeometryAttributeArray,
    type GeometryBounds,
    type GeometryGroup,
    type GeometryResult,
    type Quat,
    type Rgba,
    type StrokeInput,
    type Vec3,
} from './geometry-api.mjs';

export {
    createBrushGeometryArrays,
    generateBrushGeometry,
    generateBrushGeometryInto,
    getGeneratedIndexCount,
    getGeneratedVertexCount,
    type BrushGeometryArrays,
    type BrushGeometryBounds,
    type BrushGeometryOptions,
    type GeneratedBrushGeometry,
} from './brush-geometry.js';

export type {
    BrushGeometryFamily,
    BrushGeometryParams,
    BrushPressureOpacityRange,
    BrushPressureSizeRange,
} from './brush-types.js';

export type { StrokeData } from './stroke-types.js';

export class TiltLoader extends Loader {
    constructor(manager?: LoadingManager);

    load(
        url: string,
        onLoad: (group: Group) => void,
        onProgress?: (event: ProgressEvent) => void,
        onError?: (error: unknown) => void,
    ): void;
    parse(buffer: ArrayBuffer): Promise<Group>;
    setBrushPath(brushPath: string): this;
}

// -- src/SceneEnvironment.js -------------------------------------------------
// Helpers to light/background a loaded .tilt or .gltf scene using the same
// Tilt Brush / Open Brush environment data on both sides.

export function forceDoubleSide(material: any): void;
export function feedTiltBrushLighting(material: any): void;
export function fixTiltMeshLighting(mesh: any): void;
export function parseTBColor(str: string | undefined, fallbackHex: number): any;
export function parseTBRotation(str: string | undefined): any;

export function applyTBEnvironmentUserData(
    scene: Scene,
    ambientLight: Light,
    dirLight0: DirectionalLight,
    dirLight1: DirectionalLight,
    userData: Record<string, unknown>,
    label: string,
): void;

export function loadEnvironmentDatabase(): Promise<Record<string, unknown> | null>;
export function loadCubemapDatabase(): Promise<Record<string, string> | null>;

export function applyEnvironmentAssetData(
    scene: Scene,
    ambientLight: Light,
    dirLight0: DirectionalLight,
    dirLight1: DirectionalLight,
    env: Record<string, unknown>,
    cubemapDb: Record<string, string> | null,
    label: string,
    customData?: Record<string, unknown> | null,
    cubemapBasePath?: string,
): void;