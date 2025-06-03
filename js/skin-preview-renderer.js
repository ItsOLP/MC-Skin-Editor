import * as THREE from 'three';

// Constants
const PREVIEW_CANVAS_WIDTH = 128; 
const PREVIEW_CANVAS_HEIGHT = 256; 

const PLAYER_MODEL_SCALE = 1 / 16.0;
const PLAYER_HEIGHT_UNITS = 32 * PLAYER_MODEL_SCALE; 
const MODEL_Y_OFFSET_PREVIEW = 0; 

const AMBIENT_LIGHT_INTENSITY = 0.9;
const DIRECTIONAL_LIGHT_INTENSITY = 0.8;

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

// --- UV Mapping function ---
function mapUvForPreview(geometry, texWidth, texHeight, u, v, sizeX, sizeY, sizeZ, isMirrored = false) { // Added isMirrored
    if (!geometry.attributes.uv) { console.error("mapUvForPreview Error: Geometry missing UV attribute."); return; } 
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
        back:   { u: u + cubeDepth + cubeWidth + cubeDepth, v: v + cubeDepth, w: cubeWidth,  h: cubeHeight }, 
    };
    
    const facesOrder = ['left', 'right', 'top', 'bottom', 'front', 'back']; 
    for (let faceIndex = 0; faceIndex < 6; faceIndex++) {
        const faceName = facesOrder[faceIndex]; 
        const region = atlas[faceName];         
        const baseUvIndex = faceIndex * 4 * 2; 
        
        let u0_tex = region.u;
        let v0_tex = region.v; 
        let u1_tex = region.u + region.w;
        let v1_tex = region.v + region.h; 

        let u0_gl = u_(u0_tex);            
        let u1_gl = u_(u1_tex); 
        let gl_v_tex_top = v_(v0_tex); 
        let gl_v_tex_bottom = v_(v1_tex); 

        if (isMirrored) { // Apply U-mirroring if the bone flag is set
            [u0_gl, u1_gl] = [u1_gl, u0_gl];
        }
        
        uvs[baseUvIndex + 0] = u0_gl; uvs[baseUvIndex + 1] = gl_v_tex_top; 
        uvs[baseUvIndex + 2] = u1_gl; uvs[baseUvIndex + 3] = gl_v_tex_top;
        uvs[baseUvIndex + 4] = u0_gl; uvs[baseUvIndex + 5] = gl_v_tex_bottom;
        uvs[baseUvIndex + 6] = u1_gl; uvs[baseUvIndex + 7] = gl_v_tex_bottom;
    }
    uvAttribute.needsUpdate = true;
}
// --- End UV Mapping function ---

// --- Model Creation function ---
function createPreviewPlayerModel(modelJsonData, skinTexture) {
    const modelGroup = new THREE.Group();
    const geoArray = modelJsonData["minecraft:geometry"] ?? modelJsonData["bedrock:geometry"];
    if (!Array.isArray(geoArray) || geoArray.length === 0) { return null; }
    const geoData = geoArray[0];
    if (!geoData) { return null; }
    const description = geoData.description;
    if (!description?.texture_width || !description?.texture_height) { return null; }

    const modelTexWidth = description.texture_width;
    const modelTexHeight = description.texture_height;

    const material = new THREE.MeshStandardMaterial({
        map: skinTexture, transparent: true, alphaTest: 0.1, side: THREE.FrontSide,
        metalness: 0.0, roughness: 0.9
    });
    const layerMaterial = new THREE.MeshStandardMaterial({
        map: skinTexture, transparent: true, alphaTest: 0.1, side: THREE.DoubleSide,
        metalness: 0.0, roughness: 0.9, depthWrite: true, polygonOffset: true,
        polygonOffsetFactor: 1.0, polygonOffsetUnits: 1.0
    });

    const boneGroups = {}; const bonePivots = {};
    geoData.bones.forEach(boneData => {
        if (!boneData.name) return;
        const boneGroup = new THREE.Group(); boneGroup.name = boneData.name;
        const currentBonePivot = boneData.pivot || [0, 0, 0]; bonePivots[boneData.name] = currentBonePivot;
        if (boneData.parent && boneGroups[boneData.parent]) {
            const parentGroup = boneGroups[boneData.parent]; const parentPivot = bonePivots[boneData.parent] || [0, 0, 0];
            boneGroup.position.set(
                (currentBonePivot[0] - parentPivot[0]) * PLAYER_MODEL_SCALE,
                (currentBonePivot[1] - parentPivot[1]) * PLAYER_MODEL_SCALE,
                -(currentBonePivot[2] - parentPivot[2]) * PLAYER_MODEL_SCALE);
            parentGroup.add(boneGroup);
        } else {
            boneGroup.position.set(
                currentBonePivot[0] * PLAYER_MODEL_SCALE,
                currentBonePivot[1] * PLAYER_MODEL_SCALE,
                -currentBonePivot[2] * PLAYER_MODEL_SCALE);
            modelGroup.add(boneGroup);
        }
        if (boneData.rotation) {
            boneGroup.rotation.set(
                THREE.MathUtils.degToRad(-boneData.rotation[0]), 
                THREE.MathUtils.degToRad(-boneData.rotation[1]), 
                THREE.MathUtils.degToRad(boneData.rotation[2]), 'YXZ');
        }

        const isBoneExplicitlyMirrored = boneData.mirror === true; // Get mirror flag

        if (boneData.cubes && Array.isArray(boneData.cubes)) {
            boneData.cubes.forEach((cubeData) => {
                if (!cubeData.size || !cubeData.origin || !cubeData.uv) return;
                const { size, origin, uv, inflate = 0 } = cubeData;
                const scaledSizeX = (size[0] + inflate * 2) * PLAYER_MODEL_SCALE;
                const scaledSizeY = (size[1] + inflate * 2) * PLAYER_MODEL_SCALE;
                const scaledSizeZ = (size[2] + inflate * 2) * PLAYER_MODEL_SCALE;
                if (scaledSizeX <= 1e-6 || scaledSizeY <= 1e-6 || scaledSizeZ <= 1e-6) return;
                const cubeGeo = new THREE.BoxGeometry(scaledSizeX, scaledSizeY, scaledSizeZ, 1, 1, 1);
                mapUvForPreview(cubeGeo, modelTexWidth, modelTexHeight, uv[0], uv[1], size[0], size[1], size[2], isBoneExplicitlyMirrored);
                const isLayerPart = ["hat", "jacket", "leftSleeve", "rightSleeve", "leftPants", "rightPants"].includes(boneData.name);
                const meshMaterial = isLayerPart ? layerMaterial : material;
                const cubeMesh = new THREE.Mesh(cubeGeo, meshMaterial); cubeMesh.name = boneData.name;
                const centerInflatedMcX = origin[0] - inflate + (size[0] / 2.0 + inflate);
                const centerInflatedMcY = origin[1] - inflate + (size[1] / 2.0 + inflate);
                const centerInflatedMcZ = origin[2] - inflate + (size[2] / 2.0 + inflate);
                cubeMesh.position.set(
                    (centerInflatedMcX - currentBonePivot[0]) * PLAYER_MODEL_SCALE,
                    (centerInflatedMcY - currentBonePivot[1]) * PLAYER_MODEL_SCALE,
                    -(centerInflatedMcZ - currentBonePivot[2]) * PLAYER_MODEL_SCALE);
                boneGroup.add(cubeMesh);
            });
        }
        boneGroups[boneData.name] = boneGroup;
    });
    modelGroup.position.y = MODEL_Y_OFFSET_PREVIEW; 
    return modelGroup;
}
// --- End Model Creation function ---

// Scene, camera, renderer for preview generation (initialized once)
let previewScene, previewCamera, previewRenderer;
let offscreenPreviewCanvas;

function initPreviewRenderer() {
    if (previewRenderer) return; 

    offscreenPreviewCanvas = document.createElement('canvas');
    offscreenPreviewCanvas.width = PREVIEW_CANVAS_WIDTH;
    offscreenPreviewCanvas.height = PREVIEW_CANVAS_HEIGHT;

    previewScene = new THREE.Scene();
    previewRenderer = new THREE.WebGLRenderer({
        canvas: offscreenPreviewCanvas, alpha: true, antialias: true 
    });
    previewRenderer.setPixelRatio(1); 
    previewRenderer.setSize(PREVIEW_CANVAS_WIDTH, PREVIEW_CANVAS_HEIGHT);
    previewRenderer.setClearColor(0x000000, 0); 
    previewRenderer.outputColorSpace = THREE.SRGBColorSpace;

    const aspect = PREVIEW_CANVAS_WIDTH / PREVIEW_CANVAS_HEIGHT;
    const frustumSize = PLAYER_HEIGHT_UNITS + 0.4; 

    previewCamera = new THREE.OrthographicCamera(
        frustumSize * aspect / -2, frustumSize * aspect / 2, 
        frustumSize / 2, frustumSize / -2, 
        0.1, 100
    );
    previewCamera.position.z = 5; 

    const ambientLight = new THREE.AmbientLight(0xffffff, AMBIENT_LIGHT_INTENSITY);
    previewScene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, DIRECTIONAL_LIGHT_INTENSITY);
    directionalLight.position.set(0.5, 1, 1); 
    previewScene.add(directionalLight);
    const directionalLight2 = new THREE.DirectionalLight(0xffffff, DIRECTIONAL_LIGHT_INTENSITY * 0.5);
    directionalLight2.position.set(-0.5, -0.5, -1); 
    previewScene.add(directionalLight2);
}


export async function renderSkinToDataURL(imageDataUrl, skinType, viewAngleY = Math.PI) {
    return new Promise((resolve, reject) => {
        initPreviewRenderer(); 

        const textureLoader = new THREE.TextureLoader();
        textureLoader.load(
            imageDataUrl,
            (skinTexture) => {
                skinTexture.magFilter = THREE.NearestFilter;
                skinTexture.minFilter = THREE.NearestFilter;
                skinTexture.generateMipmaps = false;
                skinTexture.colorSpace = THREE.SRGBColorSpace;
                skinTexture.flipY = false; 
                skinTexture.premultiplyAlpha = false; 

                const modelJsonData = skinType === 'alex' ? alexJsonData : steveJsonData;
                const playerModel = createPreviewPlayerModel(modelJsonData, skinTexture);

                if (!playerModel) {
                    console.error("Failed to create player model for preview.");
                    if (skinTexture) skinTexture.dispose();
                    reject("Model creation failed");
                    return;
                }

                if (previewScene.getObjectByName("playerPreviewModel")) {
                    const oldModel = previewScene.getObjectByName("playerPreviewModel");
                    oldModel.traverse(child => {
                        if (child.isMesh) { 
                            if (child.geometry) child.geometry.dispose(); 
                            if (child.material) {
                                if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
                                else child.material.dispose();
                            }
                        }
                    });
                    previewScene.remove(oldModel);
                }
                
                playerModel.name = "playerPreviewModel";
                playerModel.rotation.y = viewAngleY; 
                previewScene.add(playerModel);
                
                const targetYFocus = MODEL_Y_OFFSET_PREVIEW + (PLAYER_HEIGHT_UNITS / 2); 

                previewCamera.position.set(0, targetYFocus, 5); 
                previewCamera.lookAt(0, targetYFocus , 0);      
                previewCamera.updateProjectionMatrix(); 

                previewRenderer.render(previewScene, previewCamera);
                const dataUrl = previewRenderer.domElement.toDataURL('image/png');
                
                skinTexture.dispose(); 
                resolve(dataUrl);
            },
            undefined, 
            (error) => {
                console.error('Error loading skin texture for preview:', error);
                reject('Texture load error');
            }
        );
    });
}

export async function generateSkinPreviews(imageDataUrl, skinType) {
    try {
        const frontDataUrl = await renderSkinToDataURL(imageDataUrl, skinType, Math.PI); 
        const backDataUrl = await renderSkinToDataURL(imageDataUrl, skinType, 0);       
        return { front: frontDataUrl, back: backDataUrl };
    } catch (error) {
        console.error("Error generating skin previews:", error);
        const placeholder = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="; 
        return { front: placeholder, back: placeholder };
    }
}