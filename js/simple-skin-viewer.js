import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const PLAYER_MODEL_SCALE = 1 / 16.0;
const MODEL_Y_OFFSET_VIEWER = 0; 
const PLAYER_HEIGHT_UNITS = 32 * PLAYER_MODEL_SCALE; 

// --- Model JSON data (Corrected Alex JSON) ---
const alexJsonString = `{
    "format_version": "1.12.0",
    "minecraft:geometry": [
        {
            "description": { "identifier": "geometry.npc.alex", "texture_width": 64, "texture_height": 64, "visible_bounds_width": 2, "visible_bounds_height": 3, "visible_bounds_offset": [0, 1.5, 0] },
            "bones": [
                {"name": "root", "pivot": [0, 0, 0]}, {"name": "waist", "parent": "root", "pivot": [0, 12, 0]},
                {"name": "body", "parent": "waist", "pivot": [0, 24, 0], "cubes": [{"origin": [-4, 12, -2], "size": [8, 12, 4], "uv": [16, 16]}]},
                {"name": "head", "parent": "body", "pivot": [0, 24, 0], "cubes": [{"origin": [-4, 24, -4], "size": [8, 8, 8], "uv": [0, 0]}]},
                {"name": "hat", "parent": "head", "pivot": [0, 24, 0], "cubes": [{"origin": [-4, 24, -4], "size": [8, 8, 8], "inflate": 0.5, "uv": [32, 0]}]},
                {"name": "leftArm", "parent": "body", "pivot": [5, 21.5, 0], "cubes": [{"origin": [4, 11.5, -2], "size": [3, 12, 4], "uv": [32, 48]}]},
                {"name": "leftSleeve", "parent": "leftArm", "pivot": [5, 21.5, 0], "cubes": [{"origin": [4, 11.5, -2], "size": [3, 12, 4], "inflate": 0.25, "uv": [48, 48]}]},
                {"name": "rightArm", "parent": "body", "pivot": [-5, 21.5, 0], "cubes": [{"origin": [-7, 11.5, -2], "size": [3, 12, 4], "uv": [40, 16]}]},
                {"name": "rightSleeve", "parent": "rightArm", "pivot": [-5, 21.5, 0], "cubes": [{"origin": [-7, 11.5, -2], "size": [3, 12, 4], "inflate": 0.25, "uv": [40, 32]}]},
                {"name": "jacket", "parent": "body", "pivot": [0, 24, 0], "cubes": [{"origin": [-4, 12, -2], "size": [8, 12, 4], "inflate": 0.25, "uv": [16, 32]}]},
                {"name": "rightLeg", "parent": "root", "pivot": [-1.9, 12, 0], "cubes": [{"origin": [-4, 0, -2], "size": [4, 12, 4], "uv": [0, 16]}]},
                {"name": "rightPants", "parent": "rightLeg", "pivot": [-1.9, 12, 0], "cubes": [{"origin": [-3.9, 0, -2], "size": [4, 12, 4], "inflate": 0.25, "uv": [0, 32]}]},
                {"name": "leftLeg", "parent": "root", "pivot": [1.9, 12, 0], "cubes": [ {"origin": [0, 0, -2], "size": [4, 12, 4], "uv": [16, 48]} ] },
                {"name": "leftPants", "parent": "leftLeg", "pivot": [1.9, 12, 0], "cubes": [ {"origin": [-0.1, 0, -2], "size": [4, 12, 4], "inflate": 0.25, "uv": [0, 48]} ] }
            ]
        }
    ]
}`;

const steveJsonString = `{
    "format_version": "1.12.0",
    "minecraft:geometry": [
        {
            "description": { "identifier": "geometry.npc.steve", "texture_width": 64, "texture_height": 64, "visible_bounds_width": 3, "visible_bounds_height": 3, "visible_bounds_offset": [0, 1.5, 0] },
            "bones": [
                {"name": "root", "pivot": [0, 0, 0]}, {"name": "waist", "parent": "root", "pivot": [0, 12, 0]},
                {"name": "body", "parent": "waist", "pivot": [0, 24, 0], "cubes": [{"origin": [-4, 12, -2], "size": [8, 12, 4], "uv": [16, 16]}]},
                {"name": "head", "parent": "body", "pivot": [0, 24, 0], "cubes": [{"origin": [-4, 24, -4], "size": [8, 8, 8], "uv": [0, 0]}]},
                {"name": "hat", "parent": "head", "pivot": [0, 24, 0], "cubes": [{"origin": [-4, 24, -4], "size": [8, 8, 8], "inflate": 0.5, "uv": [32, 0]}]},
                {"name": "leftArm", "parent": "body", "pivot": [5, 22, 0], "cubes": [{"origin": [4, 12, -2], "size": [4, 12, 4], "uv": [32, 48]}]},
                {"name": "leftSleeve", "parent": "leftArm", "pivot": [5, 22, 0], "cubes": [{"origin": [4, 12, -2], "size": [4, 12, 4], "inflate": 0.25, "uv": [48, 48]}]},
                {"name": "rightArm", "parent": "body", "pivot": [-5, 22, 0], "cubes": [{"origin": [-8, 12, -2], "size": [4, 12, 4], "uv": [40, 16]}]},
                {"name": "rightSleeve", "parent": "rightArm", "pivot": [-5, 22, 0], "cubes": [{"origin": [-8, 12, -2], "size": [4, 12, 4], "inflate": 0.25, "uv": [40, 32]}]},
                {"name": "jacket", "parent": "body", "pivot": [0, 24, 0], "cubes": [{"origin": [-4, 12, -2], "size": [8, 12, 4], "inflate": 0.25, "uv": [16, 32]}]},
                {"name": "leftLeg", "parent": "root", "pivot": [1.9, 12, 0], "cubes": [{"origin": [0, 0, -2], "size": [4, 12, 4], "uv": [16, 48]}]}, 
                {"name": "leftPants", "parent": "leftLeg", "pivot": [1.9, 12, 0], "cubes": [{"origin": [-0.1, 0, -2], "size": [4, 12, 4], "inflate": 0.25, "uv": [0, 48]}]}, 
                {"name": "rightLeg", "parent": "root", "pivot": [-1.9, 12, 0], "cubes": [{"origin": [-4, 0, -2], "size": [4, 12, 4], "uv": [0, 16]}]},
                {"name": "rightPants", "parent": "rightLeg", "pivot": [-1.9, 12, 0], "cubes": [{"origin": [-3.9, 0, -2], "size": [4, 12, 4], "inflate": 0.25, "uv": [0, 32]}]}
            ]
        }
    ]
}`;
const steveJsonData = JSON.parse(steveJsonString);
const alexJsonData = JSON.parse(alexJsonString);

function mapUvForSimpleViewer(geometry, texWidth, texHeight, u, v, sizeX, sizeY, sizeZ, isMirrored = false) {
    if (!geometry.attributes.uv) { console.error("mapUvForSimpleViewer Error: Geometry missing UV attribute."); return; }
    const uvAttribute = geometry.attributes.uv;
    const uvs = uvAttribute.array;

    const u_ = (px) => px / texWidth;
    const v_ = (py) => py / texHeight;

    const cubeWidth = sizeX;
    const cubeHeight = sizeY;
    const cubeDepth = sizeZ;

    const atlas = {
        right:  { u: u,                                 v: v + cubeDepth, w: cubeDepth,  h: cubeHeight },
        left:   { u: u + cubeDepth + cubeWidth,         v: v + cubeDepth, w: cubeDepth,  h: cubeHeight },
        top:    { u: u + cubeDepth,                     v: v,             w: cubeWidth,  h: cubeDepth  },
        bottom: { u: u + cubeDepth + cubeWidth,         v: v,             w: cubeWidth,  h: cubeDepth  },
        front:  { u: u + cubeDepth,                     v: v + cubeDepth, w: cubeWidth,  h: cubeHeight },
        back:   { u: u + cubeDepth + cubeWidth + cubeDepth, v: v + cubeDepth, w: cubeWidth,  h: cubeHeight }
    };
    
    const facesOrder = ['left', 'right', 'top', 'bottom', 'front', 'back'];

    for (let faceIndex = 0; faceIndex < 6; faceIndex++) {
        const faceName = facesOrder[faceIndex];
        const region = atlas[faceName];
        const baseVertexUvIndex = faceIndex * 4 * 2;

        let u0_tex = region.u;
        let v0_tex = region.v;
        let u1_tex = region.u + region.w;
        let v1_tex = region.v + region.h;

        let u0_gl = u_(u0_tex);
        let u1_gl = u_(u1_tex);
        let gl_v_tex_top    = v_(v0_tex);
        let gl_v_tex_bottom = v_(v1_tex);

        if (isMirrored) {
            [u0_gl, u1_gl] = [u1_gl, u0_gl];
        }

        uvs[baseVertexUvIndex + 0] = u0_gl;      uvs[baseVertexUvIndex + 1] = gl_v_tex_top;
        uvs[baseVertexUvIndex + 2] = u1_gl;      uvs[baseVertexUvIndex + 3] = gl_v_tex_top;
        uvs[baseVertexUvIndex + 4] = u0_gl;      uvs[baseVertexUvIndex + 5] = gl_v_tex_bottom;
        uvs[baseVertexUvIndex + 6] = u1_gl;      uvs[baseVertexUvIndex + 7] = gl_v_tex_bottom;
    }
    uvAttribute.needsUpdate = true;
}


function createSimplePlayerModel(modelJsonData, skinTexture) {
    const modelGroup = new THREE.Group();
    const geoArray = modelJsonData["minecraft:geometry"] ?? modelJsonData["bedrock:geometry"];
    if (!Array.isArray(geoArray) || geoArray.length === 0) { return null; }
    const geoData = geoArray[0]; if (!geoData) { return null; }
    const description = geoData.description; if (!description?.texture_width || !description?.texture_height) { return null; }
    const modelTexWidth = description.texture_width; const modelTexHeight = description.texture_height;

    const material = new THREE.MeshStandardMaterial({ map: skinTexture, transparent: true, alphaTest: 0.1, side: THREE.FrontSide, metalness: 0.0, roughness: 0.9 });
    const layerMaterial = new THREE.MeshStandardMaterial({ map: skinTexture, transparent: true, alphaTest: 0.1, side: THREE.DoubleSide, metalness: 0.0, roughness: 0.9, depthWrite: true, polygonOffset: true, polygonOffsetFactor: 1.0, polygonOffsetUnits: 1.0 });
    
    const boneGroups = {}; const bonePivots = {};
    geoData.bones.forEach(boneData => {
        if (!boneData.name) return;
        const boneGroup = new THREE.Group(); boneGroup.name = boneData.name;
        const currentBonePivot = boneData.pivot || [0, 0, 0]; bonePivots[boneData.name] = currentBonePivot;
        if (boneData.parent && boneGroups[boneData.parent]) {
            const parentGroup = boneGroups[boneData.parent]; const parentPivot = bonePivots[boneData.parent] || [0, 0, 0];
            boneGroup.position.set((currentBonePivot[0] - parentPivot[0]) * PLAYER_MODEL_SCALE, (currentBonePivot[1] - parentPivot[1]) * PLAYER_MODEL_SCALE, -(currentBonePivot[2] - parentPivot[2]) * PLAYER_MODEL_SCALE);
            parentGroup.add(boneGroup);
        } else {
            boneGroup.position.set(currentBonePivot[0] * PLAYER_MODEL_SCALE, currentBonePivot[1] * PLAYER_MODEL_SCALE, -currentBonePivot[2] * PLAYER_MODEL_SCALE);
            modelGroup.add(boneGroup);
        }
        if (boneData.rotation) { boneGroup.rotation.set(THREE.MathUtils.degToRad(-boneData.rotation[0]), THREE.MathUtils.degToRad(-boneData.rotation[1]), THREE.MathUtils.degToRad(boneData.rotation[2]), 'YXZ');}
        
        const isBoneExplicitlyMirrored = boneData.mirror === true; 

        if (boneData.cubes && Array.isArray(boneData.cubes)) {
            boneData.cubes.forEach((cubeData) => {
                if (!cubeData.size || !cubeData.origin || !cubeData.uv) return;
                const { size, origin, uv, inflate = 0 } = cubeData;
                const scaledSizeX = (size[0] + inflate * 2) * PLAYER_MODEL_SCALE; const scaledSizeY = (size[1] + inflate * 2) * PLAYER_MODEL_SCALE; const scaledSizeZ = (size[2] + inflate * 2) * PLAYER_MODEL_SCALE;
                if (scaledSizeX <= 1e-6 || scaledSizeY <= 1e-6 || scaledSizeZ <= 1e-6) return;
                const cubeGeo = new THREE.BoxGeometry(scaledSizeX, scaledSizeY, scaledSizeZ, 1, 1, 1);
                mapUvForSimpleViewer(cubeGeo, modelTexWidth, modelTexHeight, uv[0], uv[1], size[0], size[1], size[2], isBoneExplicitlyMirrored);
                const isLayerPart = ["hat", "jacket", "leftSleeve", "rightSleeve", "leftPants", "rightPants"].includes(boneData.name);
                const meshMaterial = isLayerPart ? layerMaterial : material;
                const cubeMesh = new THREE.Mesh(cubeGeo, meshMaterial); cubeMesh.name = boneData.name;
                const centerInflatedMcX = origin[0] - inflate + (size[0] / 2.0 + inflate); const centerInflatedMcY = origin[1] - inflate + (size[1] / 2.0 + inflate); const centerInflatedMcZ = origin[2] - inflate + (size[2] / 2.0 + inflate);
                cubeMesh.position.set((centerInflatedMcX - currentBonePivot[0]) * PLAYER_MODEL_SCALE, (centerInflatedMcY - currentBonePivot[1]) * PLAYER_MODEL_SCALE, -(centerInflatedMcZ - currentBonePivot[2]) * PLAYER_MODEL_SCALE);
                boneGroup.add(cubeMesh);
            });
        }
        boneGroups[boneData.name] = boneGroup;
    });
    modelGroup.position.y = MODEL_Y_OFFSET_VIEWER;
    return modelGroup;
}

let scene, camera, renderer, controls;
let currentModel, currentTexture;
let animationFrameId;
let currentCanvasElement; 

const textureLoader = new THREE.TextureLoader();

function doResize() { 
    if (!renderer || !camera || !currentCanvasElement) return;
    const width = currentCanvasElement.clientWidth;
    const height = currentCanvasElement.clientHeight;

    if (width === 0 || height === 0) { 
        return;
    }

    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
}


export function initSimpleViewer(canvasElement, skinData) {
    if (!canvasElement) {
        console.error("SimpleViewer: Canvas element not provided.");
        return null;
    }
    currentCanvasElement = canvasElement; 

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x666666); 

    const aspect = canvasElement.clientWidth / canvasElement.clientHeight || 1; 
    camera = new THREE.PerspectiveCamera(50, aspect, 0.1, 100);
    camera.position.set(0, PLAYER_HEIGHT_UNITS * 0.7, 2.7); 

    renderer = new THREE.WebGLRenderer({ canvas: canvasElement, antialias: true, alpha: true });
    renderer.setSize(canvasElement.clientWidth || 300, canvasElement.clientHeight || 400); 
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.1;
    
    const targetY = (PLAYER_HEIGHT_UNITS / 2) + MODEL_Y_OFFSET_VIEWER + 0.1; 
    controls.target.set(0, targetY, 0); 
    controls.update();

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
    directionalLight.position.set(1, 2, 1.5).normalize();
    scene.add(directionalLight);
    const directionalLight2 = new THREE.DirectionalLight(0xffffff, 0.5);
    directionalLight2.position.set(-1, -0.5, -1).normalize();
    scene.add(directionalLight2);
    
    if (skinData) {
        updateSimpleViewerSkin(skinData.imageDataUrl, skinData.type);
    }

    if (canvasElement._resizeObserver) {
        canvasElement._resizeObserver.unobserve(canvasElement);
    }
    const resizeObserver = new ResizeObserver(entries => {
       doResize(); 
    });
    resizeObserver.observe(canvasElement);
    canvasElement._resizeObserver = resizeObserver; 

    function animate() {
        animationFrameId = requestAnimationFrame(animate);
        if(controls) controls.update(); 
        if(renderer && scene && camera && renderer.domElement.width > 0 && renderer.domElement.height > 0) {
             renderer.render(scene, camera); 
        }
    }
    if (animationFrameId) cancelAnimationFrame(animationFrameId);
    animate();
    doResize(); 

    return {
        updateSkin: updateSimpleViewerSkin,
        refreshLayout: doResize, 
        dispose: () => {
            if (animationFrameId) cancelAnimationFrame(animationFrameId);
            animationFrameId = null;
            if (currentCanvasElement && currentCanvasElement._resizeObserver) {
                 currentCanvasElement._resizeObserver.unobserve(currentCanvasElement);
                 delete currentCanvasElement._resizeObserver;
            }
            if(currentModel && scene) scene.remove(currentModel);
            if(currentTexture) currentTexture.dispose();
            if(controls) controls.dispose();
            if(renderer) renderer.dispose();
            
            currentModel = null; currentTexture = null; currentCanvasElement = null;
            // Setting scene, camera, renderer to null here would affect all instances if not careful.
            // Better to manage instance-specific cleanup or ensure they are re-created.
        }
    };
}

export function updateSimpleViewerSkin(imageDataUrl, skinType) {
    if (!scene || !textureLoader || !renderer) { 
        console.warn("SimpleViewer not fully initialized or already disposed. Cannot update skin.");
        return; 
    }

    textureLoader.load(
        imageDataUrl,
        (newTexture) => {
            if (!scene) return; 

            if (currentTexture) {
                currentTexture.dispose();
            }
            currentTexture = newTexture;
            currentTexture.magFilter = THREE.NearestFilter;
            currentTexture.minFilter = THREE.NearestFilter;
            currentTexture.generateMipmaps = false;
            currentTexture.colorSpace = THREE.SRGBColorSpace;
            currentTexture.flipY = false; 
            currentTexture.premultiplyAlpha = false;

            const modelJsonData = skinType === 'alex' ? alexJsonData : steveJsonData;
            
            if (currentModel) {
                scene.remove(currentModel);
                currentModel.traverse(child => {
                    if (child.isMesh && child.geometry) {
                        child.geometry.dispose();
                    }
                     if (child.isMesh && child.material) { 
                        if (Array.isArray(child.material)) {
                            child.material.forEach(mat => mat.dispose());
                        } else {
                            child.material.dispose();
                        }
                    }
                });
            }

            currentModel = createSimplePlayerModel(modelJsonData, currentTexture);
            if (currentModel) {
                currentModel.rotation.y = 0; 
                scene.add(currentModel);
                if (controls) { 
                     const targetY = (PLAYER_HEIGHT_UNITS / 2) + MODEL_Y_OFFSET_VIEWER + 0.1;
                     controls.target.set(0, targetY, 0);
                     controls.update(); 
                }
                if (renderer && scene && camera) {
                    renderer.render(scene, camera);
                }
            } else {
                console.error("Failed to create model for simple viewer.");
            }
        },
        undefined,
        (error) => {
            console.error('Error loading skin texture for simple viewer:', error);
        }
    );
}