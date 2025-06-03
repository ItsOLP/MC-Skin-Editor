import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import * as TWEEN from 'tween';
import { getDbInstance, SKINS_STORE_NAME } from './db.js';
import { generateSkinPreviews } from './skin-preview-renderer.js'; 

// --- Global Color Utility Functions ---
function clamp(value,min,max){return Math.min(Math.max(value,min),max);}
function hsvToRgb(h,s,v){let r,g,b;let i=Math.floor(h*6);let f=h*6-i;let p=v*(1-s);let q=v*(1-f*s);let t=v*(1-(1-f)*s);switch(i%6){case 0:r=v;g=t;b=p;break;case 1:r=q;g=v;b=p;break;case 2:r=p;g=v;b=t;break;case 3:r=p;g=q;b=v;break;case 4:r=t;g=p;b=v;break;case 5:r=v;g=p;b=q;break;}return{r:Math.round(r*255),g:Math.round(g*255),b:Math.round(b*255)};}
function rgbToHsv(r,g,b){r/=255;g/=255;b/=255;let max=Math.max(r,g,b),min=Math.min(r,g,b);let h,s,v=max;let d=max-min;s=max===0?0:d/max;if(max===min){h=0;}else{switch(max){case r:h=(g-b)/d+(g<b?6:0);break;case g:h=(b-r)/d+2;break;case b:h=(r-g)/d+4;break;}h/=6;}return{h:h,s:s,v:v};}
function componentToHex(c){const hex=c.toString(16);return hex.length==1?"0"+hex:hex;}
function rgbToHex(r,g,b){return"#"+componentToHex(r)+componentToHex(g)+componentToHex(b);}
function hexToRgb(hex){const result=/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);return result?{r:parseInt(result[1],16),g:parseInt(result[2],16),b:parseInt(result[3],16)}:null;}

// --- Module-Scoped Variables ---
let currentPaintTool = 'hand';
let isPainting = false;
let offscreenCanvas = null;
let offscreenCtx = null;
let playerTexture = null;
let paintHistory = [];
let historyIndex = -1;
const MAX_HISTORY_STATES = 500; 
const AUTO_TONE_VARIATION = 20;
let currentStrokePaintedPixels = new Set();
const PLAYER_MODEL_SCALE = 1 / 16.0;
const MODEL_Y_OFFSET = 0;
const VIEW_GIZMO_DISTANCE = 3.0;
const VIEW_ANIMATION_DURATION = 400;
const GRID_Y_OFFSET = 0.001;
const LAYER_PARTS = ["hat", "jacket", "leftSleeve", "rightSleeve", "leftPants", "rightPants"];
const BASE_PARTS = ["head", "body", "leftArm", "rightArm", "leftLeg", "rightLeg"];
const DEFAULT_TEXTURE_WIDTH = 64;
const DEFAULT_TEXTURE_HEIGHT = 64;
const gizmoCamSize = 1.5;
const sphereRadius = 0.25;
const lineLength = 0.8;
const labelScale = 0.45;
const RENDER_ORDER_BASE_PART = 0;
const RENDER_ORDER_LAYER_PART_DEFAULT = 1;
const RENDER_ORDER_LAYER_PART_FOCUSED = 2;
const CAMERA_STOP_DELAY = 100;
const FOCUSED_LAYER_INFLATION_INCREMENT = 0.05;
const DYNAMICALLY_INFLATABLE_LAYERS = ["leftSleeve", "rightSleeve", "leftPants", "rightPants", "jacket"];
let currentlyInflatedLayerKey = null;
let isInflationEnabled = true;
const partToLayerMap = { head: "hat", body: "jacket", leftArm: "leftSleeve", rightArm: "rightSleeve", leftLeg: "leftPants", rightLeg: "rightPants" };
let scene, camera, renderer, controls, ambLight, dirLight, dirLight2, axesHelper, gridGroup;
let playerModelGroup = null;
let baseMaterial = null;
let accessoryLayerMaterial = null;
let jacketLayerMaterial = null;
let steveJsonData = null;
let alexJsonData = null;
let currentJsonData = null;
let currentModelType = 'steve'; 
let currentLoadedSkinIdForEditor = null; 
const currentEditorDraftStateKey = 'editorTabDraftState';
const pendingFullEditorSkinDataKey = 'pendingFullEditorSkinData';
let layerPartMeshes = {};
let cameraStopTimeoutId = null;
let isBaseGridVisible = true;
let isLayerGridVisible = true;
let lastHoveredPixelKey = null;
const highlightedPixelUniformValue = new THREE.Vector2(-1, -1);
const textureLoader = new THREE.TextureLoader();
let canvas, infoElement, coordsInfoElement, importSkinButton, exportSkinButton, skinInput,
    modelSwitchContainer, modelTypeSwitch, visibilityControlsContainer, visibilityCheckboxesContainer,
    gridControlsContainer, viewOptionsContainer, uiContainerElement, modeViewRadio, modePaintRadio,
    colorPickerGuiContainer, colorPreview, previousColor, hexInput, rInput, gInput, bInput,
    pickerArea, hueSlider, pickerHandle, hueHandle, paintTargetToggle, 
    pencilToolBtn, autoToneToolBtn, eraserToolBtn, bucketToolBtn, colorPickerToolBtn,
    handToolBtn, undoBtn, redoBtn,
    toggleBaseGridBtn, toggleLayerGridBtn, toggleAllGridBtn, toggleInflationBtn,
    gizmoContainer, gizmoCanvas, editorSaveOrApplyButton, editorClearSkinButton; 

let saveNewSkinModal, saveNewSkinPreviewFrontImg, saveNewSkinPreviewBackImg,
    saveNewSkinNameInput, saveNewSkinTypeSelect,
    closeSaveNewSkinModalBtn, cancelSaveNewSkinBtn, confirmSaveNewSkinBtn;

const PLACEHOLDER_PREVIEW = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

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

let currentSkinPaintColor = {h:0,s:0,v:1}; 
let userGridLineColor = new THREE.Color(0.75, 0.75, 0.75); 
let userGridLineColorHSV = rgbToHsv(userGridLineColor.r * 255, userGridLineColor.g * 255, userGridLineColor.b * 255); 
let isGridColorUserModified = false; 

let gizmoScene, gizmoCamera, gizmoAspect = 1;
const gizmoClickables = [];
const matRed = new THREE.MeshBasicMaterial({ color: 0xff0000, depthTest: false, depthWrite: false, transparent: true, opacity: 0.9 });
const matGreen = new THREE.MeshBasicMaterial({ color: 0x00dd00, depthTest: false, depthWrite: false, transparent: true, opacity: 0.9 });
const matBlue = new THREE.MeshBasicMaterial({ color: 0x0088ff, depthTest: false, depthWrite: false, transparent: true, opacity: 0.9 });
const lineMatRed = new THREE.LineBasicMaterial({ color: 0xff0000, linewidth: 2, depthTest: false, depthWrite: false, transparent: true, opacity: 0.9 });
const lineMatGreen = new THREE.LineBasicMaterial({ color: 0x00dd00, linewidth: 2, depthTest: false, depthWrite: false, transparent: true, opacity: 0.9 });
const lineMatBlue = new THREE.LineBasicMaterial({ color: 0x0088ff, linewidth: 2, depthTest: false, depthWrite: false, transparent: true, opacity: 0.9 });
const sphereGeo = new THREE.SphereGeometry(sphereRadius, 16, 8);
const origin = new THREE.Vector3(0, 0, 0);
const gizmoRaycaster = new THREE.Raycaster();
const gizmoMouse = new THREE.Vector2();
const clock = new THREE.Clock();
const gizmoCamOffset = 5;
const mainCamDirection = new THREE.Vector3();
let isEditorInitialized = false;

async function detectSkinTypeFromImageDataLocal(imageDataUrl) {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            let analysisCanvas = document.createElement('canvas');
            let analysisCtx = analysisCanvas.getContext('2d');
            if (!analysisCtx) { resolve('steve'); return; }
            analysisCtx.imageSmoothingEnabled = false;
            analysisCanvas.width = img.width; analysisCanvas.height = img.height;
            analysisCtx.drawImage(img, 0, 0);
            if (img.width !== 64 || img.height !== 64) { resolve(img.width === 64 && img.height === 32 ? 'steve' : 'steve'); return; }
            const checkX = 50, checkY = 19;
            try {
                if (checkX >= analysisCanvas.width || checkY >= analysisCanvas.height) { resolve('steve'); return; }
                const pixelData = analysisCtx.getImageData(checkX, checkY, 1, 1).data;
                resolve(pixelData[3] === 0 ? 'alex' : 'steve');
            } catch (e) { resolve('steve'); }
        };
        img.onerror = () => resolve('steve');
        img.src = imageDataUrl;
    });
}

function initializeDOMReferences() {
    canvas = document.getElementById('viewerCanvas');
    infoElement = document.getElementById('info');
    coordsInfoElement = document.getElementById('coordsInfo'); 
    importSkinButton = document.getElementById('importSkinButton'); 
    exportSkinButton = document.getElementById('exportSkinButton'); 
    skinInput = document.getElementById('skinInput'); 
    modelSwitchContainer = document.getElementById('modelSwitchContainer'); 
    modelTypeSwitch = document.getElementById('modelTypeSwitch'); 
    visibilityControlsContainer = document.getElementById('visibilityControls'); 
    visibilityCheckboxesContainer = document.getElementById('visibilityCheckboxes'); 
    gridControlsContainer = document.getElementById('gridControlsContainer'); 
    viewOptionsContainer = document.getElementById('viewOptionsContainer'); 
    uiContainerElement = document.getElementById('uiContainer'); 
    modeViewRadio = document.getElementById('modeView'); 
    modePaintRadio = document.getElementById('modePaint'); 
    colorPickerGuiContainer = document.getElementById('colorPickerContainer'); 
    colorPreview = document.getElementById('colorPreview'); 
    previousColor = document.getElementById('previousColor'); 
    hexInput = document.getElementById('hexInput'); 
    rInput = document.getElementById('rInput'); 
    gInput = document.getElementById('gInput'); 
    bInput = document.getElementById('bInput'); 
    pickerArea = document.getElementById('colorPickerArea'); 
    hueSlider = document.getElementById('hueSlider'); 
    pickerHandle = document.getElementById('pickerHandle'); 
    hueHandle = document.getElementById('hueHandle'); 
    paintTargetToggle = document.getElementById('paintTargetToggle'); 
    pencilToolBtn = document.getElementById('pencilToolBtn'); 
    autoToneToolBtn = document.getElementById('autoToneToolBtn'); 
    eraserToolBtn = document.getElementById('eraserToolBtn'); 
    bucketToolBtn = document.getElementById('bucketToolBtn'); 
    colorPickerToolBtn = document.getElementById('colorPickerToolBtn'); 
    handToolBtn = document.getElementById('handToolBtn'); 
    undoBtn = document.getElementById('undoBtn'); 
    redoBtn = document.getElementById('redoBtn'); 
    toggleBaseGridBtn = document.getElementById('toggleBaseGridBtn'); 
    toggleLayerGridBtn = document.getElementById('toggleLayerGridBtn'); 
    toggleAllGridBtn = document.getElementById('toggleAllGridBtn'); 
    toggleInflationBtn = document.getElementById('toggleInflationBtn'); 
    gizmoContainer = document.getElementById('gizmoContainer'); 
    gizmoCanvas = document.getElementById('gizmoCanvas');
    editorSaveOrApplyButton = document.getElementById('editorSaveOrApplyButton'); 
    editorClearSkinButton = document.getElementById('editorClearSkinButton');

    saveNewSkinModal = document.getElementById('save-new-skin-modal');
    saveNewSkinPreviewFrontImg = document.getElementById('save-new-skin-preview-front-img');
    saveNewSkinPreviewBackImg = document.getElementById('save-new-skin-preview-back-img');
    saveNewSkinNameInput = document.getElementById('save-new-skin-name-input');
    saveNewSkinTypeSelect = document.getElementById('save-new-skin-type-select');
    closeSaveNewSkinModalBtn = document.getElementById('close-save-new-skin-modal-btn');
    cancelSaveNewSkinBtn = document.getElementById('cancel-save-new-skin-btn');
    confirmSaveNewSkinBtn = document.getElementById('confirm-save-new-skin-btn');

    if (!canvas || !uiContainerElement || !colorPickerGuiContainer || !gizmoCanvas || 
        !editorSaveOrApplyButton || !editorClearSkinButton || !paintTargetToggle ||
        !saveNewSkinModal) { 
        console.error("Essential DOM elements for the editor or save modal are missing."); 
    }
}

function initializeCoreTextureData() {
    if (!offscreenCanvas) { 
        offscreenCanvas = document.createElement('canvas');
        console.log("Offscreen canvas created for the first time.");
    }
    offscreenCanvas.width = DEFAULT_TEXTURE_WIDTH; 
    offscreenCanvas.height = DEFAULT_TEXTURE_HEIGHT; 
    
    offscreenCtx = offscreenCanvas.getContext('2d', { willReadFrequently: true }); 
    if (!offscreenCtx) {
        console.error("Failed to get 2D context for offscreen canvas.");
        return;
    }
    offscreenCtx.clearRect(0, 0, offscreenCanvas.width, offscreenCanvas.height); 

    if (playerTexture) playerTexture.dispose(); 
    playerTexture = new THREE.CanvasTexture(offscreenCanvas); 
    playerTexture.magFilter = THREE.NearestFilter; 
    playerTexture.minFilter = THREE.NearestFilter; 
    playerTexture.generateMipmaps = false; 
    playerTexture.colorSpace = THREE.SRGBColorSpace;
    playerTexture.flipY = false;
    playerTexture.premultiplyAlpha = false;
    console.log("Core texture data initialized/re-initialized. Canvas texture updated.");
}

function createGridTemplateMaterial() {
    const material = new THREE.MeshStandardMaterial({ map: playerTexture, roughness: 0.95, metalness: 0.0, transparent: true, alphaTest: 0.001, side: THREE.FrontSide, depthWrite: true, depthFunc: THREE.LessEqualDepth });
    material.userData.uniforms = { hasSkin: { value: true }, textureDimensionsAtlas: { value: new THREE.Vector2(playerTexture.image.width, playerTexture.image.height) }, u_gridLineColor: { value: new THREE.Color(0.75, 0.75, 0.75) }, u_showGridLines: { value: true }, u_highlightedPixelCoords: { value: highlightedPixelUniformValue }, u_isPixelHighlighted: { value: false } };
    material.onBeforeCompile = (shader) => {
        shader.uniforms.hasSkin = material.userData.uniforms.hasSkin;
        shader.uniforms.textureDimensionsAtlas = material.userData.uniforms.textureDimensionsAtlas;
        shader.uniforms.u_gridLineColor = material.userData.uniforms.u_gridLineColor;
        shader.uniforms.u_showGridLines = material.userData.uniforms.u_showGridLines;
        shader.uniforms.u_highlightedPixelCoords = material.userData.uniforms.u_highlightedPixelCoords;
        shader.uniforms.u_isPixelHighlighted = material.userData.uniforms.u_isPixelHighlighted;
        shader.vertexShader = 'varying vec2 vUv;\n' + shader.vertexShader;
        shader.vertexShader = shader.vertexShader.replace('#include <uv_vertex>', '#include <uv_vertex>\nvUv = uv;');
        
        const customLogic = `
            if (u_showGridLines) {
                vec2 scaledUV_grid = vUv * textureDimensionsAtlas;
                vec2 fracUV_grid = fract(scaledUV_grid);
                float currentLineThickness = 0.03;
                vec3 currentGridLineColor = u_gridLineColor;
                bool isCurrentPixelActuallyHighlighted = false;

                if (u_isPixelHighlighted) {
                    float currentPixelTexX_floor = floor(vUv.x * textureDimensionsAtlas.x);
                    float currentPixelTexY_floor = floor(vUv.y * textureDimensionsAtlas.y);
                    if (abs(currentPixelTexX_floor - u_highlightedPixelCoords.x) < 0.1 && abs(currentPixelTexY_floor - u_highlightedPixelCoords.y) < 0.1) {
                        isCurrentPixelActuallyHighlighted = true;
                        currentLineThickness = 0.08; 
                        currentGridLineColor = vec3(1.0) - u_gridLineColor; 
                    }
                }

                bool isPixelBorder_grid = fracUV_grid.x < currentLineThickness || fracUV_grid.x > (1.0 - currentLineThickness) || fracUV_grid.y < currentLineThickness || fracUV_grid.y > (1.0 - currentLineThickness);

                if (isPixelBorder_grid) {
                    float gridAlpha;
                    if (isCurrentPixelActuallyHighlighted) {
                        gridAlpha = 1.0;
                    } else if (!hasSkin && diffuseColor.a < 0.05) { 
                        gridAlpha = 0.75; 
                    } else if (hasSkin && diffuseColor.a < 0.1 && diffuseColor.a > 0.005) { 
                        gridAlpha = 0.5;
                    } else { 
                        gridAlpha = 1.0; 
                    }
                    if (!hasSkin && diffuseColor.a < 0.05) gridAlpha = 0.75;

                    diffuseColor = vec4(currentGridLineColor, gridAlpha);
                }
            }

            if (!hasSkin) { 
                vec2 scaledUV_template_fill = vUv * textureDimensionsAtlas;
                vec2 fracUV_template_fill = fract(scaledUV_template_fill);
                const float lineThickness_template_fill = 0.03; 
                bool isPixelBorder_template_fill = fracUV_template_fill.x < lineThickness_template_fill || fracUV_template_fill.x > (1.0 - lineThickness_template_fill) || fracUV_template_fill.y < lineThickness_template_fill || fracUV_template_fill.y > (1.0 - lineThickness_template_fill);
                
                if (!isPixelBorder_template_fill) { 
                    if (u_showGridLines) {
                        diffuseColor = vec4(u_gridLineColor, 0.02); 
                    } else {
                        diffuseColor = vec4(u_gridLineColor, 0.0); 
                    }
                }
            }
        `; 

        shader.fragmentShader = `uniform bool hasSkin;\nuniform vec2 textureDimensionsAtlas;\nuniform vec3 u_gridLineColor;\nuniform bool u_showGridLines;\nuniform vec2 u_highlightedPixelCoords;\nuniform bool u_isPixelHighlighted;\nvarying vec2 vUv;\n` + shader.fragmentShader;
        shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', '#include <map_fragment>' + customLogic );
        material.needsUpdate = true;
    };
    return material;
}

function initializeMaterials() {
    if (!offscreenCanvas || !offscreenCtx || !playerTexture) {
      console.warn("Core texture data was not ready, re-initializing before materials.");
      initializeCoreTextureData();
    }
    
    if (baseMaterial) baseMaterial.dispose(); 
    if (accessoryLayerMaterial) accessoryLayerMaterial.dispose(); 
    if (jacketLayerMaterial) jacketLayerMaterial.dispose(); 
    
    baseMaterial = createGridTemplateMaterial(); 
    const layerPolygonOffsetFactor = 0; 
    const layerPolygonOffsetUnits = -0.5; 
    accessoryLayerMaterial = createGridTemplateMaterial(); 
    accessoryLayerMaterial.polygonOffset = true; 
    accessoryLayerMaterial.polygonOffsetFactor = layerPolygonOffsetFactor; 
    accessoryLayerMaterial.polygonOffsetUnits = layerPolygonOffsetUnits; 
    accessoryLayerMaterial.side = THREE.DoubleSide; 
    jacketLayerMaterial = createGridTemplateMaterial(); 
    jacketLayerMaterial.polygonOffset = true; 
    jacketLayerMaterial.polygonOffsetFactor = layerPolygonOffsetFactor; 
    jacketLayerMaterial.polygonOffsetUnits = layerPolygonOffsetUnits; 
    jacketLayerMaterial.side = THREE.DoubleSide; 
    
    applyGridVisibilityStates(); 
    updateGridButtonTexts();
    console.log("Materials initialized/re-initialized.");
}

function updateMaterialsPixelHighlight(pixelX, pixelY, isHighlighted) {
    highlightedPixelUniformValue.set(pixelX, pixelY); const materialsToUpdate = [baseMaterial, accessoryLayerMaterial, jacketLayerMaterial]; materialsToUpdate.forEach(mat => { if (mat && mat.userData.uniforms.u_isPixelHighlighted) { mat.userData.uniforms.u_isPixelHighlighted.value = isHighlighted; } });
}

function updateMaterialsTextureProperties(texWidth, texHeight, isEffectivelyBlankCanvas) {
    const materialsToUpdate = [baseMaterial, accessoryLayerMaterial, jacketLayerMaterial];
    const defaultGridColor = new THREE.Color(0.75, 0.75, 0.75);
    const hasSkinUniformValue = true; 

    materialsToUpdate.forEach(mat => { 
        if (mat && mat.userData && mat.userData.uniforms) { 
            mat.userData.uniforms.textureDimensionsAtlas.value.set(texWidth, texHeight); 
            mat.userData.uniforms.hasSkin.value = hasSkinUniformValue; 
            mat.alphaTest = 0.001; 
            
            if (paintTargetToggle && paintTargetToggle.checked) { 
                mat.userData.uniforms.u_gridLineColor.value.copy(userGridLineColor);
            } else { 
                mat.userData.uniforms.u_gridLineColor.value.copy(defaultGridColor);
            }
            mat.needsUpdate = true; 
        } 
    }); 
    applyGridVisibilityStates();  
    
    if (lastHoveredPixelKey !== null) {  
        updateMaterialsPixelHighlight(-1, -1, false); 
        lastHoveredPixelKey = null; 
        setDefaultPaintCursor(); 
    }
}

function mapUv(geometry, texWidth, texHeight, u, v, sizeX, sizeY, sizeZ, boneName = null, isMirrored = false) {
    if (!geometry.attributes.uv) { console.error("mapUv Error: Geometry missing UV attribute."); return; }
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

function createPlayerModel() {
    if (!currentJsonData || !baseMaterial || !accessoryLayerMaterial || !jacketLayerMaterial || !playerTexture ) { console.error("Prerequisites not ready for model creation."); if (infoElement) infoElement.innerHTML = "Cannot create model: Prerequisites not ready."; return null; } layerPartMeshes = {};  const modelGroup = new THREE.Group(); const geoArray = currentJsonData["minecraft:geometry"] ?? currentJsonData["bedrock:geometry"];  if (!Array.isArray(geoArray) || geoArray.length === 0) { console.error("Error: 'minecraft:geometry' is missing, not an array, or empty."); return null; } const geoData = geoArray[0];  if (!geoData) { console.error("No geometry object found."); return null; } const description = geoData.description; if (!description?.texture_width || !description?.texture_height) { console.error("Texture dimensions missing."); return null; } const modelExpectedTexWidth = description.texture_width; const modelExpectedTexHeight = description.texture_height; const currentTexWidth = playerTexture.image.width; const currentTexHeight = playerTexture.image.height; if (currentTexWidth !== modelExpectedTexWidth || currentTexHeight !== modelExpectedTexHeight) { if (currentTexWidth === DEFAULT_TEXTURE_WIDTH && currentTexHeight === DEFAULT_TEXTURE_HEIGHT) { const matsToUpdate = [baseMaterial, accessoryLayerMaterial, jacketLayerMaterial]; matsToUpdate.forEach(mat => { if (mat) { mat.userData.uniforms.textureDimensionsAtlas.value.set(modelExpectedTexWidth, modelExpectedTexHeight); } }); } } if (!geoData.bones || !Array.isArray(geoData.bones)) { console.error("Missing 'bones' array."); return null; } const boneGroups = {};  const bonePivots = {};  geoData.bones.forEach(boneData => { if (!boneData.name) { console.warn("Skipping unnamed bone."); return; } const boneGroup = new THREE.Group(); boneGroup.name = boneData.name; const currentBonePivot = boneData.pivot || [0, 0, 0];  bonePivots[boneData.name] = currentBonePivot; if (boneData.parent && boneGroups[boneData.parent]) { const parentGroup = boneGroups[boneData.parent]; let parentPivot = bonePivots[boneData.parent] || [0, 0, 0]; const relPivotX = (currentBonePivot[0] - parentPivot[0]) * PLAYER_MODEL_SCALE; const relPivotY = (currentBonePivot[1] - parentPivot[1]) * PLAYER_MODEL_SCALE; const relPivotZ = -(currentBonePivot[2] - parentPivot[2]) * PLAYER_MODEL_SCALE;  boneGroup.position.set(relPivotX, relPivotY, relPivotZ); parentGroup.add(boneGroup); } else {  boneGroup.position.set(currentBonePivot[0] * PLAYER_MODEL_SCALE, currentBonePivot[1] * PLAYER_MODEL_SCALE, -currentBonePivot[2] * PLAYER_MODEL_SCALE); modelGroup.add(boneGroup); } if (boneData.rotation) { boneGroup.rotation.set( THREE.MathUtils.degToRad(-boneData.rotation[0]), THREE.MathUtils.degToRad(-boneData.rotation[1]), THREE.MathUtils.degToRad(boneData.rotation[2]), 'YXZ' ); } if (boneData.cubes && Array.isArray(boneData.cubes)) { boneData.cubes.forEach((cubeData) => { if (!cubeData.size || cubeData.size.length !== 3 || !cubeData.origin || cubeData.origin.length !== 3 || !cubeData.uv || cubeData.uv.length !== 2) { console.warn(`Skipping invalid cube in bone '${boneData.name}'`, cubeData); return; } const size = cubeData.size; const origin = cubeData.origin; const uv = cubeData.uv; const inflate = cubeData.inflate || 0; const scaledSizeX = (size[0] + inflate * 2) * PLAYER_MODEL_SCALE; const scaledSizeY = (size[1] + inflate * 2) * PLAYER_MODEL_SCALE; const scaledSizeZ = (size[2] + inflate * 2) * PLAYER_MODEL_SCALE; if (scaledSizeX <= 1e-6 || scaledSizeY <= 1e-6 || scaledSizeZ <= 1e-6) { console.warn(`Skipping zero-size cube in bone '${boneData.name}'`); return; } const cubeGeo = new THREE.BoxGeometry(scaledSizeX, scaledSizeY, scaledSizeZ, 1, 1, 1);
mapUv(cubeGeo, modelExpectedTexWidth, modelExpectedTexHeight, uv[0], uv[1], size[0], size[1], size[2], boneData.name, boneData.mirror === true);
let materialToUse; let isActualLayerPart = LAYER_PARTS.includes(boneData.name); if (boneData.name === "jacket") { materialToUse = jacketLayerMaterial; } else if (isActualLayerPart) { materialToUse = accessoryLayerMaterial; } else { materialToUse = baseMaterial; } const cubeMesh = new THREE.Mesh(cubeGeo, materialToUse); cubeMesh.name = boneData.name;  cubeMesh.userData = {  boneName: boneData.name, originalCubeData: JSON.parse(JSON.stringify(cubeData)),  bonePivot: JSON.parse(JSON.stringify(currentBonePivot)),  texWidth: modelExpectedTexWidth, texHeight: modelExpectedTexHeight, currentInflate: inflate  }; if (isActualLayerPart) { cubeMesh.renderOrder = RENDER_ORDER_LAYER_PART_DEFAULT; layerPartMeshes[boneData.name] = cubeMesh;  } else { cubeMesh.renderOrder = RENDER_ORDER_BASE_PART; } const inflatedOriginX = origin[0] - inflate; const inflatedOriginY = origin[1] - inflate; const inflatedOriginZ = origin[2] - inflate; const centerInflatedMcX = inflatedOriginX + (size[0] / 2.0 + inflate); const centerInflatedMcY = inflatedOriginY + (size[1] / 2.0 + inflate); const centerInflatedMcZ = inflatedOriginZ + (size[2] / 2.0 + inflate); const relInflatedCenterX = centerInflatedMcX - currentBonePivot[0]; const relInflatedCenterY = centerInflatedMcY - currentBonePivot[1]; const relInflatedCenterZ = centerInflatedMcZ - currentBonePivot[2]; cubeMesh.position.set( relInflatedCenterX * PLAYER_MODEL_SCALE, relInflatedCenterY * PLAYER_MODEL_SCALE, -relInflatedCenterZ * PLAYER_MODEL_SCALE ); if (cubeData.rotation) { cubeMesh.rotation.set(THREE.MathUtils.degToRad(-cubeData.rotation[0]), THREE.MathUtils.degToRad(-cubeData.rotation[1]), THREE.MathUtils.degToRad(cubeData.rotation[2]), 'YXZ'); } boneGroup.add(cubeMesh); }); } boneGroups[boneData.name] = boneGroup;  }); modelGroup.position.y = MODEL_Y_OFFSET;  return modelGroup;
}
function rebuildCubeGeometryAndPositionForMesh(mesh, newInflateValue) {
    if (!mesh.userData.originalCubeData) { console.warn(`[Inflation] Missing originalCubeData for ${mesh.name}.`); return; } const { originalCubeData, bonePivot, texWidth, texHeight, boneName } = mesh.userData;
    let isBoneMirrored = false;
    if (boneName && currentJsonData) {
        const geometryArray = currentJsonData["minecraft:geometry"] || currentJsonData["bedrock:geometry"];
        if (geometryArray && geometryArray[0] && geometryArray[0].bones) {
            const boneDef = geometryArray[0].bones.find(b => b.name === boneName);
            if (boneDef) {
                isBoneMirrored = boneDef.mirror === true;
            }
        }
    }

    if (mesh.geometry) { mesh.geometry.dispose();  } const size = originalCubeData.size; const uv = originalCubeData.uv; const origin = originalCubeData.origin; const scaledSizeX = (size[0] + newInflateValue * 2) * PLAYER_MODEL_SCALE; const scaledSizeY = (size[1] + newInflateValue * 2) * PLAYER_MODEL_SCALE; const scaledSizeZ = (size[2] + newInflateValue * 2) * PLAYER_MODEL_SCALE; if (scaledSizeX <= 1e-6 || scaledSizeY <= 1e-6 || scaledSizeZ <= 1e-6) { mesh.visible = false;  console.warn(`[Inflation] Cube ${mesh.name} became zero-size.`); return; } mesh.visible = true;  const newGeo = new THREE.BoxGeometry(scaledSizeX, scaledSizeY, scaledSizeZ, 1, 1, 1);
    mapUv(newGeo, texWidth, texHeight, uv[0], uv[1], size[0], size[1], size[2], boneName, isBoneMirrored);
    mesh.geometry = newGeo; const currentBonePivotForCube = bonePivot || [0,0,0];  const inflatedOriginX = origin[0] - newInflateValue; const inflatedOriginY = origin[1] - newInflateValue; const inflatedOriginZ = origin[2] - newInflateValue; const centerInflatedMcX = inflatedOriginX + (size[0] / 2.0 + newInflateValue); const centerInflatedMcY = inflatedOriginY + (size[1] / 2.0 + newInflateValue); const centerInflatedMcZ = inflatedOriginZ + (size[2] / 2.0 + newInflateValue); const relInflatedCenterX = centerInflatedMcX - currentBonePivotForCube[0]; const relInflatedCenterY = centerInflatedMcY - currentBonePivotForCube[1]; const relInflatedCenterZ = centerInflatedMcZ - currentBonePivotForCube[2]; mesh.position.set( relInflatedCenterX * PLAYER_MODEL_SCALE, relInflatedCenterY * PLAYER_MODEL_SCALE, -relInflatedCenterZ * PLAYER_MODEL_SCALE ); mesh.userData.currentInflate = newInflateValue;
}
function buildAndDisplayModel() {
    if (!baseMaterial || !accessoryLayerMaterial || !jacketLayerMaterial) { console.warn("Materials not ready, re-initializing."); if (!playerTexture) initializeCoreTextureData(); initializeMaterials();  } if (!currentJsonData) {  console.error("Cannot build model: Missing JSON data."); if (infoElement) infoElement.innerHTML = "Cannot build: Missing model definition."; if (visibilityControlsContainer) visibilityControlsContainer.style.display = 'none'; if (gridControlsContainer) gridControlsContainer.style.display = 'none'; if (viewOptionsContainer) viewOptionsContainer.style.display = 'none'; return; } if (playerModelGroup) {  scene.remove(playerModelGroup); playerModelGroup.traverse(child => { if (child.isMesh) { if (child.geometry) child.geometry.dispose(); } }); playerModelGroup = null; } currentlyInflatedLayerKey = null;  playerModelGroup = createPlayerModel();  if (playerModelGroup) { playerModelGroup.rotation.y = Math.PI;  scene.add(playerModelGroup); applyCurrentVisibility();  resetLayerRenderOrders();  applyGridVisibilityStates();  updateGridButtonTexts(); const layersBtn = document.getElementById('toggleLayersBtn');  const baseBtn = document.getElementById('toggleBaseBtn'); if (layersBtn) layersBtn.textContent = "Toggle Layers Off";  if (baseBtn) baseBtn.textContent = "Toggle Base Off"; let isSkinActuallyLoaded = playerTexture && playerTexture.image && (playerTexture.image.width !== DEFAULT_TEXTURE_WIDTH || playerTexture.image.height !== DEFAULT_TEXTURE_HEIGHT || (offscreenCtx && !isCanvasBlank(offscreenCtx))); const modelName = currentModelType === 'steve' ? 'Steve (Normal)' : 'Alex (Slim)'; if (!isSkinActuallyLoaded && infoElement) { infoElement.innerHTML = `Displaying paintable template. Import or paint.<br>Model: ${modelName}<br>LMB Drag: Rotate, RMB Drag: Pan, Scroll: Zoom.`; } else if (infoElement) { infoElement.innerHTML = `Model: ${modelName}<br>LMB Drag: Rotate, RMB Drag: Pan, Scroll: Zoom.`; }  } else {  console.error("createPlayerModel() failed."); if (infoElement) infoElement.innerHTML += "<br>Model creation failed."; if (visibilityControlsContainer) visibilityControlsContainer.style.display = 'none'; if (gridControlsContainer) gridControlsContainer.style.display = 'none'; if (viewOptionsContainer) viewOptionsContainer.style.display = 'none';} 
    updateEditorButtonsState(); 
    if (modePaintRadio) setUIMode(modePaintRadio.checked ? 'paint' : 'view');
}

function isCanvasBlank(context) {
    if (!context || !context.canvas) return true; 
    if (context.canvas.width === 0 || context.canvas.height === 0) return true; 
    try {
        const pixelBuffer = new Uint32Array(
            context.getImageData(0, 0, context.canvas.width, context.canvas.height).data.buffer
        );
        return !pixelBuffer.some(color => color !== 0);
    } catch (e) {
        console.warn("isCanvasBlank: Error getting image data (possibly 0x0 canvas). Treating as blank.", e);
        return true; 
    }
}

function loadModelDefinitions() {
    if (infoElement) infoElement.innerHTML = "Loading model definitions..."; if (coordsInfoElement) coordsInfoElement.innerHTML = "Loading..."; try { steveJsonData = JSON.parse(steveJsonString); alexJsonData = JSON.parse(alexJsonString); if (!steveJsonData?.["minecraft:geometry"] || !alexJsonData?.["minecraft:geometry"]) { throw new Error("Failed to parse embedded JSON data or missing 'minecraft:geometry'."); } currentJsonData = steveJsonData; initializeMaterials(); buildAndDisplayModel(); if (infoElement) infoElement.innerHTML = "Model definitions loaded.<br>Displaying paintable template. Import or paint.<br>LMB Drag: Rotate, RMB Drag: Pan, Scroll: Zoom."; if (controls) controls.update(); } catch (error) { console.error("Error loading model definitions:", error); if (infoElement) infoElement.innerHTML = `Error loading model definitions: ${error.message}. Check JSON format and console for details.`; if (coordsInfoElement) coordsInfoElement.innerHTML = "Error"; if (importSkinButton) importSkinButton.disabled = true; if (exportSkinButton) exportSkinButton.disabled = true; if (modelTypeSwitch) modelTypeSwitch.disabled = true; if (visibilityControlsContainer) visibilityControlsContainer.style.display = 'none'; if (gridControlsContainer) gridControlsContainer.style.display = 'none'; if (viewOptionsContainer) viewOptionsContainer.style.display = 'none'; }
    updateEditorButtonsState(); 
}

function updateEditorButtonsState() {
    if (!editorSaveOrApplyButton || !editorClearSkinButton || !offscreenCtx || !offscreenCanvas) return;

    const hasContent = !isCanvasBlank(offscreenCtx);
    const isViewMode = modeViewRadio && modeViewRadio.checked;

    if (isViewMode) {
        const isEffectivelyTemplate = !hasContent && !currentLoadedSkinIdForEditor;
        
        editorSaveOrApplyButton.disabled = isEffectivelyTemplate;
        editorClearSkinButton.disabled = isEffectivelyTemplate;


        if (currentLoadedSkinIdForEditor) {
            editorSaveOrApplyButton.textContent = 'Save Edits';
        } else {
            editorSaveOrApplyButton.textContent = 'Save Skin';
        }
        editorSaveOrApplyButton.style.display = 'block'; 
        editorClearSkinButton.style.display = 'block';

    } else { // Paint Mode
        editorSaveOrApplyButton.style.display = 'none';
        editorClearSkinButton.style.display = 'none';
    }
    if(exportSkinButton) exportSkinButton.disabled = !hasContent;
}

function resetEditorToDefaultState(clearOldContextAndDraft = true) {
    if (clearOldContextAndDraft) {
        currentLoadedSkinIdForEditor = null; 
        localStorage.removeItem('skinToEditInFullEditorId'); 
        localStorage.removeItem(currentEditorDraftStateKey);
        localStorage.removeItem(pendingFullEditorSkinDataKey); 
        console.log("Editor: resetEditorToDefaultState - Cleared relevant localStorage keys.");
    }
    // Pass null for skinIdForContext to ensure it's treated as a template/new import
    loadTextureFromFile(null, 'steve', null, false); 
    console.log("Editor reset to default state. Clear context and draft:", clearOldContextAndDraft);
}


async function loadTextureFromFile(fileOrDataUrl, modelTypeToSet = null, skinIdForContext = null, isDraftLoad = false) {
    let idToApplyOnSuccess = skinIdForContext;

    if (!isDraftLoad) {
         console.log(`Editor: loadTextureFromFile (NOT DRAFT) - skinIdForContext: ${skinIdForContext}, currentLoadedSkinIdForEditor will be updated on success.`);
    } else {
        console.log(`Editor: loadTextureFromFile (DRAFT LOAD) - skinIdForContext: ${skinIdForContext}, currentLoadedSkinIdForEditor (pre-existing): ${currentLoadedSkinIdForEditor}`);
        // For draft loads, skinIdForContext is the ID *from the draft*. We must ensure currentLoadedSkinIdForEditor matches this.
        currentLoadedSkinIdForEditor = skinIdForContext; 
    }

    const processImageData = async (imageDataUrlInput) => {
        const img = new Image();
        img.onload = async () => {
            if (!offscreenCanvas || !offscreenCtx || !playerTexture || offscreenCanvas.width === 0) { 
                initializeCoreTextureData(); 
                initializeMaterials(); 
            }
            offscreenCanvas.width = img.width; 
            offscreenCanvas.height = img.height;
            offscreenCtx.clearRect(0,0, img.width, img.height); 
            offscreenCtx.drawImage(img, 0, 0); 
            playerTexture.needsUpdate = true;
            
            updateMaterialsTextureProperties(img.width, img.height, false); 
            
            if (!isDraftLoad) { 
                currentLoadedSkinIdForEditor = idToApplyOnSuccess; 
                console.log(`Editor: loadTextureFromFile > processImageData (image loaded, NOT DRAFT) - currentLoadedSkinIdForEditor finally set to: ${currentLoadedSkinIdForEditor}`);
                paintHistory = []; 
                historyIndex = -1;
            }
            updateUndoRedoButtons();

            if (infoElement) infoElement.innerHTML = "Texture loaded. Building model...";

            let typeToUse = modelTypeToSet;
            // For non-draft and direct file (not data URL initially), detect type from image.
            // If it's a data URL (e.g. from pendingFullEditorSkinData or draft), modelTypeToSet should be accurate.
            if (fileOrDataUrl instanceof File && !modelTypeToSet && !isDraftLoad) { 
                typeToUse = await detectSkinTypeFromImageDataLocal(imageDataUrlInput);
            } else if (modelTypeToSet) { 
                typeToUse = modelTypeToSet;
            } else { 
                typeToUse = currentModelType; 
            }

            if (typeToUse) {
                currentModelType = typeToUse;
                if (modelTypeSwitch) modelTypeSwitch.checked = (typeToUse === 'alex');
                 if (alexJsonData && steveJsonData) { 
                    currentJsonData = (typeToUse === 'alex') ? alexJsonData : steveJsonData;
                }
            }
            buildAndDisplayModel(); 
            if (playerModelGroup) playerModelGroup.visible = true;
            if (modePaintRadio) setUIMode(modePaintRadio.checked ? 'paint' : 'view'); 
            updateEditorButtonsState(); 
        };
        img.onerror = (error) => {
            console.error('Image load error:', error, 'Input was:', imageDataUrlInput ? imageDataUrlInput.substring(0,100) + "..." : "null/undefined");
            if (infoElement) infoElement.innerHTML = `Error processing image: ${error.message || 'Unknown error'}`;
            if (!isDraftLoad) { 
                currentLoadedSkinIdForEditor = null; 
                console.log(`Editor: loadTextureFromFile > processImageData (image error, NOT DRAFT) - currentLoadedSkinIdForEditor set to null.`);
                // Call resetEditorToDefaultState with true to clear localStorage specific to editor drafts if the error was during a non-draft load (like initial import)
                resetEditorToDefaultState(true); 
            } else {
                // If a draft load fails, just clear the draft key and reset, don't clear other potential contexts.
                localStorage.removeItem(currentEditorDraftStateKey);
                resetEditorToDefaultState(true);
            }
            updateEditorButtonsState();
        };
        img.src = imageDataUrlInput;
    };

    if (!fileOrDataUrl && !isDraftLoad) { 
        currentLoadedSkinIdForEditor = null; 
        console.log(`Editor: loadTextureFromFile (template, NOT DRAFT) - currentLoadedSkinIdForEditor set to null.`);
        
        if (!offscreenCanvas || !offscreenCtx || !playerTexture || offscreenCanvas.width === 0) {
            initializeCoreTextureData(); 
            initializeMaterials(); 
        } else {
            offscreenCanvas.width = DEFAULT_TEXTURE_WIDTH; 
            offscreenCanvas.height = DEFAULT_TEXTURE_HEIGHT;
            offscreenCtx.clearRect(0, 0, offscreenCanvas.width, offscreenCanvas.height); 
            playerTexture.needsUpdate = true;
        }
        
        updateMaterialsTextureProperties(DEFAULT_TEXTURE_WIDTH, DEFAULT_TEXTURE_HEIGHT, false); 
        
        paintHistory = []; 
        historyIndex = -1;
        updateUndoRedoButtons();

        if (infoElement) infoElement.innerHTML = `Displaying paintable template. Import or paint.<br>LMB Drag: Rotate, RMB Drag: Pan, Scroll: Zoom.`;
        
        let typeForTemplate = modelTypeToSet || 'steve'; 
        currentModelType = typeForTemplate;
        if(modelTypeSwitch) modelTypeSwitch.checked = (currentModelType === 'alex');
        if (alexJsonData && steveJsonData) {
            currentJsonData = (currentModelType === 'alex') ? alexJsonData : steveJsonData;
        }

        buildAndDisplayModel(); 
        if (playerModelGroup) playerModelGroup.visible = true;
        if (modePaintRadio) setUIMode(modePaintRadio.checked ? 'paint' : 'view');
        updateEditorButtonsState();
        return;
    }


    if (infoElement) infoElement.innerHTML = "Loading skin texture...";
    if (typeof fileOrDataUrl === 'string') { // Is a Data URL
        await processImageData(fileOrDataUrl);
    } else if (fileOrDataUrl instanceof File) { // Is a File object
        // Read the file to Data URL first, then pass to processImageData.
        // This is crucial to avoid issues with async FileReader and module re-initialization.
        const reader = new FileReader();
        reader.onload = async (event_reader) => {
            if (event_reader.target.result) {
                await processImageData(event_reader.target.result);
            } else {
                console.error("FileReader error: event.target.result is null for file:", fileOrDataUrl.name);
                if (infoElement) infoElement.innerHTML = `Error reading file: ${fileOrDataUrl.name}`;
                if (!isDraftLoad) {
                    currentLoadedSkinIdForEditor = null;
                    resetEditorToDefaultState(true);
                } else {
                     localStorage.removeItem(currentEditorDraftStateKey);
                     resetEditorToDefaultState(true);
                }
                updateEditorButtonsState();
            }
        };
        reader.onerror = (error) => {
            console.error("FileReader error:", error, "for file:", fileOrDataUrl.name);
            if (infoElement) infoElement.innerHTML = `Error reading file: ${error.message}`;
             if (!isDraftLoad) {
                currentLoadedSkinIdForEditor = null;
                resetEditorToDefaultState(true);
            } else {
                 localStorage.removeItem(currentEditorDraftStateKey);
                 resetEditorToDefaultState(true);
            }
            updateEditorButtonsState();
        };
        reader.readAsDataURL(fileOrDataUrl);
    } else {
        console.warn("loadTextureFromFile: Invalid argument type.", fileOrDataUrl);
        if (!isDraftLoad) {
            currentLoadedSkinIdForEditor = null;
            resetEditorToDefaultState(true);
        } else {
            resetEditorToDefaultState(true);
        }
    }
}

async function openSaveNewSkinModal() {
    if (!saveNewSkinModal || !offscreenCanvas) return;

    const imageDataUrl = offscreenCanvas.toDataURL('image/png');
    const previews = await generateSkinPreviews(imageDataUrl, currentModelType);

    if (saveNewSkinPreviewFrontImg) saveNewSkinPreviewFrontImg.src = previews.front;
    if (saveNewSkinPreviewBackImg) saveNewSkinPreviewBackImg.src = previews.back;
    if (saveNewSkinNameInput) saveNewSkinNameInput.value = ""; 
    if (saveNewSkinTypeSelect) saveNewSkinTypeSelect.value = currentModelType;

    saveNewSkinModal.style.display = 'flex';
}

function closeSaveNewSkinModal() { 
    if (!saveNewSkinModal) return;
    saveNewSkinModal.style.display = 'none';
    if (saveNewSkinPreviewFrontImg) saveNewSkinPreviewFrontImg.src = PLACEHOLDER_PREVIEW;
    if (saveNewSkinPreviewBackImg) saveNewSkinPreviewBackImg.src = PLACEHOLDER_PREVIEW;
    if (saveNewSkinNameInput) saveNewSkinNameInput.value = '';
}

async function handleConfirmSaveNewSkin() {
    if (!offscreenCanvas || !saveNewSkinNameInput || !saveNewSkinTypeSelect) return;

    const name = saveNewSkinNameInput.value.trim();
    const type = saveNewSkinTypeSelect.value;
    const imageDataUrl = offscreenCanvas.toDataURL('image/png');

    if (!name) {
        alert("Skin name cannot be empty.");
        return;
    }

    const previews = await generateSkinPreviews(imageDataUrl, type);

    const newSkin = {
        name: name,
        type: type,
        imageDataUrl: imageDataUrl,
        previewFrontUrl: previews.front,
        previewBackUrl: previews.back,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };

    const db = getDbInstance();
    if (!db) {
        alert("Database not initialized. Cannot save skin.");
        return;
    }

    try {
        const transaction = db.transaction(SKINS_STORE_NAME, 'readwrite');
        const store = transaction.objectStore(SKINS_STORE_NAME);
        const request = store.add(newSkin);

        request.onsuccess = () => {
            alert(`Skin "${name}" saved successfully to My Skins!`);
            closeSaveNewSkinModal();
            resetEditorToDefaultState(true); 
        };
        request.onerror = (e) => {
            alert("Error saving skin to database: " + e.target.error.message);
            console.error("Error saving new skin:", e.target.error);
        };
    } catch (error) {
        alert("Exception while trying to save skin: " + error.message);
        console.error("Exception saving new skin:", error);
    }
}


async function handleEditorSaveOrApply() {
    if (editorSaveOrApplyButton.disabled) return;
    if (!offscreenCanvas || (isCanvasBlank(offscreenCtx) && !currentLoadedSkinIdForEditor)) {
        alert("Error: No skin data to save/apply.");
        return;
    }

    if (currentLoadedSkinIdForEditor) { 
        const originalSkinId = currentLoadedSkinIdForEditor;
        const newImageDataUrl = offscreenCanvas.toDataURL('image/png');
        const newSkinType = currentModelType;

        const pendingChanges = {
            imageDataUrl: newImageDataUrl,
            type: newSkinType
        };
        localStorage.setItem(`pendingEditorChanges_${originalSkinId}`, JSON.stringify(pendingChanges));
        localStorage.setItem('skinToOpenInSkinsTabAfterEditorSave', originalSkinId.toString());
        
        resetEditorToDefaultState(true); 

        const skinsNavLink = document.querySelector('header .nav-link[href="#skins"]');
        if (skinsNavLink) {
            skinsNavLink.click(); 
        } else {
            window.location.hash = '#skins'; 
        }
    } else { 
        openSaveNewSkinModal();
    }
}

function handleEditorClearSkin() {
    if (editorClearSkinButton.disabled) return; 
    if (confirm("Are you sure you want to clear the current skin and start over? All unsaved changes will be lost.")) {
        resetEditorToDefaultState(true); 
    }
}

function saveEditorDraftState() {
    if (!isEditorInitialized || !offscreenCanvas || !offscreenCtx) {
        console.log("Editor draft not saved: Not initialized or no canvas.");
        return;
    }
    
    if (isCanvasBlank(offscreenCtx) && !currentLoadedSkinIdForEditor) {
        localStorage.removeItem(currentEditorDraftStateKey); 
        console.log("Editor draft not saved (canvas is blank and no specific skin ID was loaded).");
        return;
    }
    console.log("Editor saving draft state with loadedSkinId:", currentLoadedSkinIdForEditor); 
    try {
        const draft = {
            imageDataUrl: offscreenCanvas.toDataURL('image/png'), 
            modelType: currentModelType, 
            loadedSkinId: currentLoadedSkinIdForEditor, 
            paintHistory: JSON.parse(JSON.stringify(paintHistory)), 
            historyIndex: historyIndex 
        };
        localStorage.setItem(currentEditorDraftStateKey, JSON.stringify(draft));
    } catch (e) {
        console.error("Error saving editor draft state:", e); 
    }
}

async function loadEditorDraftState() {
    const draftJSON = localStorage.getItem(currentEditorDraftStateKey); 
    if (draftJSON) { 
        console.log("Editor loading draft state from localStorage..."); 
        localStorage.removeItem(currentEditorDraftStateKey); 
        try {
            const draft = JSON.parse(draftJSON); 
            
            // currentLoadedSkinIdForEditor will be set by loadTextureFromFile via skinIdForContext
            await loadTextureFromFile(draft.imageDataUrl, draft.modelType, draft.loadedSkinId, true); 
            
            paintHistory = draft.paintHistory || []; 
            historyIndex = draft.historyIndex !== undefined ? draft.historyIndex : -1; 
            updateUndoRedoButtons(); 
            
            console.log("Editor: loadEditorDraftState - Draft loaded successfully. currentLoadedSkinIdForEditor is now:", currentLoadedSkinIdForEditor);
            return true; 
        } catch (e) {
            console.error("Error loading editor draft state:", e); 
            localStorage.removeItem(currentEditorDraftStateKey); 
            currentLoadedSkinIdForEditor = null; 
            return false; 
        }
    }
    console.log("Editor: loadEditorDraftState - No draft found in localStorage.");
    return false; 
}


function togglePartVisibility(partName, isVisible) { if (!playerModelGroup) return; let partFoundAndToggled = false; playerModelGroup.traverse(child => { if (child.isMesh && child.name === partName) { child.visible = isVisible; partFoundAndToggled = true; } }); if (!partFoundAndToggled && LAYER_PARTS.includes(partName)) { const layerMesh = layerPartMeshes[partName]; if (layerMesh) { layerMesh.visible = isVisible; } } if (DYNAMICALLY_INFLATABLE_LAYERS.includes(partName)) { const mesh = layerPartMeshes[partName]; if (mesh && mesh.userData.originalCubeData) { if (!isVisible && partName === currentlyInflatedLayerKey) {  rebuildCubeGeometryAndPositionForMesh(mesh, mesh.userData.originalCubeData.inflate || 0);  currentlyInflatedLayerKey = null; } } } if (controls && !controls.active && cameraStopTimeoutId === null && !isPainting) { updateFocusedLayer(); } }
function applyCurrentVisibility() { if (!visibilityCheckboxesContainer || !playerModelGroup) return; const checkboxes = visibilityCheckboxesContainer.querySelectorAll('input[type="checkbox"]'); checkboxes.forEach(checkbox => { const partName = checkbox.dataset.part; const isVisible = checkbox.checked; if (partName) { togglePartVisibility(partName, isVisible); } }); }
function calculateModelTargetY() { let targetY=12*PLAYER_MODEL_SCALE;if(currentJsonData){const geoArray=currentJsonData["minecraft:geometry"]??currentJsonData["bedrock:geometry"];const bones=geoArray?.[0]?.bones;if(bones){const bodyBone=bones.find(b=>b.name==='body');const headBone=bones.find(b=>b.name==='head');const waistBone=bones.find(b=>b.name==='waist');let foundPivotY=null;if(headBone?.pivot?.[1]!==undefined){foundPivotY=headBone.pivot[1];}else if(bodyBone?.pivot?.[1]!==undefined){foundPivotY=bodyBone.pivot[1];}else if(waistBone?.pivot?.[1]!==undefined){foundPivotY=waistBone.pivot[1];}if(foundPivotY!==null){targetY=foundPivotY*PLAYER_MODEL_SCALE;if(headBone&&headBone.pivot[1]===foundPivotY){targetY-=4*PLAYER_MODEL_SCALE;}}}}return targetY;}
function animateCameraTo(targetPosition, targetLookAt) { if (!camera || !controls) return; const currentPos=camera.position.clone(); const currentTarget=controls.target.clone(); TWEEN.removeAll();  new TWEEN.Tween(currentPos) .to(targetPosition,VIEW_ANIMATION_DURATION) .easing(TWEEN.Easing.Quadratic.Out) .onUpdate(()=>{camera.position.copy(currentPos);}) .start(); new TWEEN.Tween(currentTarget) .to(targetLookAt,VIEW_ANIMATION_DURATION) .easing(TWEEN.Easing.Quadratic.Out) .onUpdate(()=>{controls.target.copy(currentTarget);controls.update();})  .onComplete(()=>{  controls.target.copy(targetLookAt); controls.update();  }) .start();}
function createAxisLabel(text) { const canvasEl = document.createElement('canvas'); const context = canvasEl.getContext('2d'); const fontSize = 64; const padding = 10; context.font = `Bold ${fontSize}px Arial`; const textMetrics = context.measureText(text); const canvasWidth = textMetrics.width + padding * 2; const canvasHeight = fontSize * 1.2 + padding * 2; canvasEl.width = canvasWidth; canvasEl.height = canvasHeight; context.font = `Bold ${fontSize}px Arial`; context.fillStyle = 'black'; context.textAlign = 'center'; context.textBaseline = 'middle'; context.fillText(text, canvasWidth / 2, canvasHeight / 2); const texture = new THREE.CanvasTexture(canvasEl); texture.magFilter = THREE.NearestFilter; texture.minFilter = THREE.NearestFilter; texture.needsUpdate = true; const material = new THREE.SpriteMaterial({ map: texture, depthTest: false, depthWrite: false, transparent: true, opacity: 1.0, sizeAttenuation: false }); const sprite = new THREE.Sprite(material); const aspectRatio = canvasWidth / canvasHeight; sprite.scale.set(labelScale * aspectRatio, labelScale, labelScale); return sprite; }
function createAxis(axis, direction, colorMat, lineMat, labelText = null) { const position = new THREE.Vector3(); position[axis] = direction * lineLength; const sphere = new THREE.Mesh(sphereGeo, colorMat); sphere.position.copy(position); sphere.userData = { axis: axis, direction: direction, type: 'gizmo' }; gizmoScene.add(sphere); gizmoClickables.push(sphere); if (direction > 0) { const points = [origin, position]; const lineGeo = new THREE.BufferGeometry().setFromPoints(points); const line = new THREE.Line(lineGeo, lineMat); gizmoScene.add(line); if (labelText) { const labelSprite = createAxisLabel(labelText); labelSprite.position.copy(position); gizmoScene.add(labelSprite); } } }
function initializeGizmoRender() { if (!gizmoCanvas || !gizmoScene) return;  if (gizmoCanvas.clientWidth > 0 && gizmoCanvas.clientHeight > 0) { gizmoAspect = gizmoCanvas.clientWidth / gizmoCanvas.clientHeight; } gizmoCamera = new THREE.OrthographicCamera( -gizmoCamSize * gizmoAspect, gizmoCamSize * gizmoAspect, gizmoCamSize, -gizmoCamSize, 0.1, 100 ); gizmoCamera.position.set(0, 0, 5);  gizmoCamera.lookAt(0, 0, 0); while(gizmoScene.children.length > 0){ gizmoScene.remove(gizmoScene.children[0]); } gizmoClickables.length = 0; createAxis('x', 1, matRed, lineMatRed, 'X'); createAxis('x', -1, matRed, lineMatRed);  createAxis('y', 1, matGreen, lineMatGreen, 'Y'); createAxis('y', -1, matGreen, lineMatGreen);  createAxis('z', 1, matBlue, lineMatBlue, 'Z'); createAxis('z', -1, matBlue, lineMatBlue);}
function setDefaultPaintCursor() { if (!canvas) return;  if (modePaintRadio && modePaintRadio.checked) { if (currentPaintTool === 'hand') { canvas.style.cursor = controls.enabled ? 'grab' : 'default'; } else if (['pencil', 'autoTone', 'eraser', 'bucket', 'colorPicker'].includes(currentPaintTool)) { canvas.style.cursor = 'crosshair'; } else { canvas.style.cursor = 'default'; } } else {  canvas.style.cursor = controls.enabled ? 'grab' : 'default'; }}
function setUIMode(mode) { 
    if (!uiContainerElement) return;  
    if (mode === 'paint') { 
        uiContainerElement.classList.add('paint-mode'); 
        uiContainerElement.classList.remove('view-mode'); 
        if(importSkinButton) importSkinButton.style.display = 'none'; 
        if(exportSkinButton) exportSkinButton.style.display = 'none'; 
        if(editorSaveOrApplyButton) editorSaveOrApplyButton.style.display = 'none';
        if(editorClearSkinButton) editorClearSkinButton.style.display = 'none';
        if(modelSwitchContainer) modelSwitchContainer.style.display = 'none'; 
        if(visibilityControlsContainer) visibilityControlsContainer.style.display = 'none'; 
        if(gridControlsContainer) gridControlsContainer.style.display = 'none'; 
        if(viewOptionsContainer) viewOptionsContainer.style.display = 'none'; 
        if(infoElement) infoElement.style.display = 'none'; 
        if(colorPickerGuiContainer) colorPickerGuiContainer.style.display = 'flex'; 
        if(controls) controls.enabled = (currentPaintTool === 'hand' || currentPaintTool === 'colorPicker' || currentPaintTool === 'bucket'); 
    } else {  // view mode
        uiContainerElement.classList.add('view-mode'); 
        uiContainerElement.classList.remove('paint-mode'); 
        if(importSkinButton) importSkinButton.style.display = 'block'; 
        if(exportSkinButton) exportSkinButton.style.display = 'block';
        if(modelSwitchContainer) modelSwitchContainer.style.display = 'flex'; 
        const modelExists = !!playerModelGroup; 
        if(visibilityControlsContainer) visibilityControlsContainer.style.display = modelExists ? 'flex' : 'none'; 
        if(gridControlsContainer) gridControlsContainer.style.display = modelExists ? 'flex' : 'none'; 
        if(viewOptionsContainer) viewOptionsContainer.style.display = modelExists ? 'flex' : 'none'; 
        if(infoElement) infoElement.style.display = 'block'; 
        if(colorPickerGuiContainer) colorPickerGuiContainer.style.display = 'none'; 
        if(controls) controls.enabled = true; 
        if (lastHoveredPixelKey !== null) {  updateMaterialsPixelHighlight(-1, -1, false); lastHoveredPixelKey = null; } 
    } 
    updateUndoRedoButtons(); 
    setDefaultPaintCursor(); 
    updateEditorButtonsState(); 
}
function setupToggleGroupButton(buttonId, partNames, groupName) {  const buttonElement = document.getElementById(buttonId);  if (!buttonElement || !visibilityCheckboxesContainer) { console.error(`Could not find button #${buttonId} or checkbox container.`); return; }  buttonElement.addEventListener('click', () => {  const allCheckboxes = Array.from(visibilityCheckboxesContainer.querySelectorAll('input[type="checkbox"]'));  const groupCheckboxes = allCheckboxes.filter(cb => partNames.includes(cb.dataset.part));  if (groupCheckboxes.length === 0) return;  const isAnyChecked = groupCheckboxes.some(cb => cb.checked);  const newState = !isAnyChecked;  groupCheckboxes.forEach(checkbox => {  const partName = checkbox.dataset.part;  checkbox.checked = newState;  togglePartVisibility(partName, newState);  });  buttonElement.textContent = `Toggle ${groupName} ${newState ? 'Off' : 'On'}`;  applyCurrentVisibility();  }); }
function resetLayerRenderOrders(focusedLayerKey = null) { for (const key in layerPartMeshes) { if (layerPartMeshes.hasOwnProperty(key)) { const mesh = layerPartMeshes[key]; if (mesh && mesh.material) { let newRO = RENDER_ORDER_LAYER_PART_DEFAULT; if (DYNAMICALLY_INFLATABLE_LAYERS.includes(key)) { newRO = RENDER_ORDER_LAYER_PART_DEFAULT;  } else if (key === focusedLayerKey) {  newRO = RENDER_ORDER_LAYER_PART_FOCUSED; } if (mesh.renderOrder !== newRO) mesh.renderOrder = newRO; if (mesh.material.depthFunc !== THREE.LessEqualDepth) { mesh.material.depthFunc = THREE.LessEqualDepth; mesh.material.needsUpdate = true; } } } } }
function updateFocusedLayer() { if (!camera || !playerModelGroup || Object.keys(layerPartMeshes).length === 0) { resetLayerRenderOrders(); if (currentlyInflatedLayerKey) { const mesh = layerPartMeshes[currentlyInflatedLayerKey]; if (mesh && mesh.userData.originalCubeData) { rebuildCubeGeometryAndPositionForMesh(mesh, mesh.userData.originalCubeData.inflate || 0); } currentlyInflatedLayerKey = null; } return; } if (isPainting && (currentPaintTool === 'pencil' || currentPaintTool === 'autoTone' || currentPaintTool === 'eraser' || currentPaintTool === 'bucket')) { return; } let closestBaseBoneName = null; const raycaster = new THREE.Raycaster(); const cameraPositionClone = camera.position.clone(); const cameraDirection = new THREE.Vector3(); camera.getWorldDirection(cameraDirection); const rayOriginOffset = cameraDirection.clone().multiplyScalar(-0.01); const rayOrigin = cameraPositionClone.add(rayOriginOffset); raycaster.set(rayOrigin, cameraDirection); const baseMeshesForRaycastTargeting = []; const originalVisibilities = new Map(); BASE_PARTS.forEach(basePartName => { const boneGroup = playerModelGroup.getObjectByName(basePartName); if (boneGroup) { boneGroup.traverse(childMesh => { if (childMesh.isMesh && childMesh.name === basePartName && BASE_PARTS.includes(childMesh.name)) { const baseCheckbox = visibilityCheckboxesContainer ? visibilityCheckboxesContainer.querySelector(`#visibilityCheckboxes input[data-part="${basePartName}"]`) : null; let isBasePartUserVisible = baseCheckbox ? baseCheckbox.checked : false; const layerPartName = partToLayerMap[basePartName]; let isLayerPartUserVisible = false; if (layerPartName && visibilityCheckboxesContainer) { const layerCheckbox = visibilityCheckboxesContainer.querySelector(`#visibilityCheckboxes input[data-part="${layerPartName}"]`); isLayerPartUserVisible = layerCheckbox ? layerCheckbox.checked : false; } if (isBasePartUserVisible || isLayerPartUserVisible) { if (!originalVisibilities.has(childMesh)) originalVisibilities.set(childMesh, childMesh.visible); childMesh.visible = true; baseMeshesForRaycastTargeting.push(childMesh); } else { if (originalVisibilities.has(childMesh)) childMesh.visible = originalVisibilities.get(childMesh); else childMesh.visible = false; } } }); } }); if (baseMeshesForRaycastTargeting.length > 0) { const intersects = raycaster.intersectObjects(baseMeshesForRaycastTargeting, false); if (intersects.length > 0) { const firstIntersectedMesh = intersects[0].object; if (firstIntersectedMesh && firstIntersectedMesh.name && BASE_PARTS.includes(firstIntersectedMesh.name)) { closestBaseBoneName = firstIntersectedMesh.name; } } } originalVisibilities.forEach((visibility, mesh) => { mesh.visible = visibility; }); const focusedLayerFromCamera = closestBaseBoneName ? partToLayerMap[closestBaseBoneName] : null; resetLayerRenderOrders(focusedLayerFromCamera); if (!isInflationEnabled) { if (currentlyInflatedLayerKey) { const mesh = layerPartMeshes[currentlyInflatedLayerKey]; if (mesh && mesh.userData.originalCubeData) { rebuildCubeGeometryAndPositionForMesh(mesh, mesh.userData.originalCubeData.inflate || 0); } currentlyInflatedLayerKey = null; } return; } let newLayerToInflate = null; if (focusedLayerFromCamera && DYNAMICALLY_INFLATABLE_LAYERS.includes(focusedLayerFromCamera)) { const meshToPotentiallyInflate = layerPartMeshes[focusedLayerFromCamera]; if (meshToPotentiallyInflate && meshToPotentiallyInflate.visible) { newLayerToInflate = focusedLayerFromCamera; } } if (newLayerToInflate !== currentlyInflatedLayerKey) { if (currentlyInflatedLayerKey) { const oldMesh = layerPartMeshes[currentlyInflatedLayerKey]; if (oldMesh && oldMesh.userData.originalCubeData) { rebuildCubeGeometryAndPositionForMesh(oldMesh, oldMesh.userData.originalCubeData.inflate || 0); } } if (newLayerToInflate) { const newMesh = layerPartMeshes[newLayerToInflate]; if (newMesh && newMesh.userData.originalCubeData) { const baseInflate = newMesh.userData.originalCubeData.inflate || 0; rebuildCubeGeometryAndPositionForMesh(newMesh, baseInflate + FOCUSED_LAYER_INFLATION_INCREMENT); } } currentlyInflatedLayerKey = newLayerToInflate; } else if (newLayerToInflate && currentlyInflatedLayerKey === newLayerToInflate) { const mesh = layerPartMeshes[currentlyInflatedLayerKey]; if (mesh && mesh.userData.originalCubeData) { if (!mesh.visible) { rebuildCubeGeometryAndPositionForMesh(mesh, mesh.userData.originalCubeData.inflate || 0); currentlyInflatedLayerKey = null; } else if (mesh.userData.currentInflate < ((mesh.userData.originalCubeData.inflate || 0) + FOCUSED_LAYER_INFLATION_INCREMENT - 0.001)) { const baseInflate = mesh.userData.originalCubeData.inflate || 0; rebuildCubeGeometryAndPositionForMesh(mesh, baseInflate + FOCUSED_LAYER_INFLATION_INCREMENT); } } } }
function setupDynamicLayerControls() { if (!controls) return; controls.addEventListener('start', () => { if (cameraStopTimeoutId) { clearTimeout(cameraStopTimeoutId); cameraStopTimeoutId = null; } }); controls.addEventListener('end', () => { if (cameraStopTimeoutId) clearTimeout(cameraStopTimeoutId); if (!isPainting) cameraStopTimeoutId = setTimeout(updateFocusedLayer, CAMERA_STOP_DELAY); });}
function updateGridButtonTexts() { if (toggleBaseGridBtn) toggleBaseGridBtn.textContent = `Toggle Base Grid ${isBaseGridVisible ? 'Off' : 'On'}`; if (toggleLayerGridBtn) toggleLayerGridBtn.textContent = `Toggle Layer Grid ${isLayerGridVisible ? 'Off' : 'On'}`; if (toggleAllGridBtn) { const anyGridVisible = isBaseGridVisible || isLayerGridVisible; toggleAllGridBtn.textContent = `Toggle All Grid ${anyGridVisible ? 'Off' : 'On'}`; } }
function applyGridVisibilityToMaterial(material, isVisible) { if (material && material.userData.uniforms.u_showGridLines) { material.userData.uniforms.u_showGridLines.value = isVisible; } }
function applyGridVisibilityStates() { if (!playerModelGroup) return; playerModelGroup.traverse(child => { if (child.isMesh && child.material) { const partName = child.name; if (BASE_PARTS.includes(partName)) { applyGridVisibilityToMaterial(child.material, isBaseGridVisible); } else if (LAYER_PARTS.includes(partName)) { applyGridVisibilityToMaterial(child.material, isLayerGridVisible); } } });}
function setupGridControlListeners() { if (toggleBaseGridBtn) { toggleBaseGridBtn.addEventListener('click', () => { isBaseGridVisible = !isBaseGridVisible; applyGridVisibilityStates(); updateGridButtonTexts(); }); } if (toggleLayerGridBtn) { toggleLayerGridBtn.addEventListener('click', () => { isLayerGridVisible = !isLayerGridVisible; applyGridVisibilityStates(); updateGridButtonTexts(); }); } if (toggleAllGridBtn) { toggleAllGridBtn.addEventListener('click', () => { const turnOff = isBaseGridVisible || isLayerGridVisible; isBaseGridVisible = !turnOff; isLayerGridVisible = !turnOff; applyGridVisibilityStates(); updateGridButtonTexts(); }); } if (toggleInflationBtn) { toggleInflationBtn.addEventListener('click', () => { isInflationEnabled = !isInflationEnabled; toggleInflationBtn.textContent = `Toggle Inflation ${isInflationEnabled ? 'Off' : 'On'}`; if (!isInflationEnabled && currentlyInflatedLayerKey) { const mesh = layerPartMeshes[currentlyInflatedLayerKey]; if (mesh && mesh.userData.originalCubeData) { rebuildCubeGeometryAndPositionForMesh(mesh, mesh.userData.originalCubeData.inflate || 0); } currentlyInflatedLayerKey = null; } else if (isInflationEnabled) { if(controls && !controls.active && cameraStopTimeoutId === null && !isPainting) { updateFocusedLayer(); } } if (!isPainting) updateFocusedLayer(); }); } }
function setActiveToolButton(activeButton) { const buttons = [pencilToolBtn, autoToneToolBtn, eraserToolBtn, bucketToolBtn, colorPickerToolBtn, handToolBtn, undoBtn, redoBtn]; buttons.forEach(button => { if (button) {  if (button === activeButton) button.classList.add('active-tool'); else if (button !== undoBtn && button !== redoBtn) button.classList.remove('active-tool'); } });}

function updateUndoRedoButtons() { 
    const isPaintingSkin = paintTargetToggle && !paintTargetToggle.checked; 
    const canPaintHistory = modePaintRadio && modePaintRadio.checked && offscreenCanvas && isPaintingSkin; 
    if (undoBtn) undoBtn.disabled = !canPaintHistory || historyIndex < 0; 
    if (redoBtn) redoBtn.disabled = !canPaintHistory || historyIndex >= paintHistory.length - 1;
}

function recordPixelChange(x, y, oldColorData, newColorData) { if (historyIndex < paintHistory.length - 1) paintHistory = paintHistory.slice(0, historyIndex + 1); paintHistory.push({ type: 'pixel', x, y, oldColor: Array.from(oldColorData), newColor: Array.from(newColorData) }); historyIndex++; if (paintHistory.length > MAX_HISTORY_STATES) { paintHistory.shift(); historyIndex--; } updateUndoRedoButtons();}
function recordRectFillAction(rect, oldImageData, fillColor) { if (historyIndex < paintHistory.length - 1) paintHistory = paintHistory.slice(0, historyIndex + 1); const oldImageBufferCopy = new Uint8ClampedArray(oldImageData.data); paintHistory.push({ type: 'fill_rect', rect: {...rect}, oldImageData: { data: oldImageBufferCopy, width: oldImageData.width, height: oldImageData.height }, fillColor }); historyIndex++; if (paintHistory.length > MAX_HISTORY_STATES) { paintHistory.shift(); historyIndex--; } updateUndoRedoButtons();}

function undoPaint() { 
    const isPaintingSkin = paintTargetToggle && !paintTargetToggle.checked;
    if (!offscreenCanvas || offscreenCanvas.width === 0 || offscreenCanvas.height === 0) {
        console.warn("Undo attempted on an invalid offscreenCanvas (zero dimensions).");
        updateUndoRedoButtons();
        return;
    }
    if (historyIndex < 0 || !offscreenCtx || !playerTexture || !isPaintingSkin) { 
        updateUndoRedoButtons(); return; 
    } 
    
    try {
        const action = paintHistory[historyIndex];
        if (action.type === 'pixel') {
            const oldImgData = offscreenCtx.createImageData(1, 1); 
            oldImgData.data.set(action.oldColor);
            offscreenCtx.putImageData(oldImgData, action.x, action.y);
        } else if (action.type === 'fill_rect') {
            const newImgData = offscreenCtx.createImageData(action.oldImageData.width, action.oldImageData.height);
            newImgData.data.set(new Uint8ClampedArray(action.oldImageData.data)); 
            offscreenCtx.putImageData(newImgData, action.rect.x, action.rect.y);
        }
        historyIndex--;
        playerTexture.needsUpdate = true;
    } catch (e) {
        console.error("Error during undo operation:", e);
        historyIndex = -1; 
        paintHistory = [];  
    }
    updateUndoRedoButtons();
    updateEditorButtonsState();
}

function redoPaint() { 
    const isPaintingSkin = paintTargetToggle && !paintTargetToggle.checked;
    if (!offscreenCanvas || offscreenCanvas.width === 0 || offscreenCanvas.height === 0) {
        console.warn("Redo attempted on an invalid offscreenCanvas (zero dimensions).");
        updateUndoRedoButtons();
        return;
    }
    if (historyIndex >= paintHistory.length - 1 || !offscreenCtx || !playerTexture || !isPaintingSkin) { 
        updateUndoRedoButtons(); return; 
    } 
    
    try {
        historyIndex++; 
        const action = paintHistory[historyIndex]; 
        if (action.type === 'pixel') { 
            const newImgData = offscreenCtx.createImageData(1, 1); 
            newImgData.data.set(action.newColor); 
            offscreenCtx.putImageData(newImgData, action.x, action.y); 
        } else if (action.type === 'fill_rect') { 
            offscreenCtx.fillStyle = action.fillColor; 
            offscreenCtx.fillRect(action.rect.x, action.rect.y, action.rect.width, action.rect.height); 
        } 
        playerTexture.needsUpdate = true; 
    } catch(e) {
        console.error("Error during redo operation:", e);
        historyIndex = -1; 
        paintHistory = [];
    }
    updateUndoRedoButtons(); 
    updateEditorButtonsState();
}

function applyPixelModification(uv) {
    const isPaintingSkin = paintTargetToggle && !paintTargetToggle.checked; 
    if (!offscreenCtx || !playerTexture || !playerTexture.image || !playerModelGroup || !isPaintingSkin || !rInput || !gInput || !bInput) return false;
    
    const wasEffectivelyTemplate = baseMaterial && baseMaterial.userData.uniforms.hasSkin.value === false;

    const textureWidth = playerTexture.image.width;
    const textureHeight = playerTexture.image.height;

    const x = Math.floor(uv.x * textureWidth);
    const y = Math.floor(uv.y * textureHeight); 

    const pixelKey = `${x},${y}`;
    if (x < 0 || x >= textureWidth || y < 0 || y >= textureHeight) return false;
    if (isPainting && currentStrokePaintedPixels.has(pixelKey)) return false;
    const oldPixelData = offscreenCtx.getImageData(x, y, 1, 1).data;
    let newPixelArray;
    if (currentPaintTool === 'eraser') {
        newPixelArray = [0, 0, 0, 0]; 
    } else if (currentPaintTool === 'autoTone') {
        const baseR = parseInt(rInput.value); const baseG = parseInt(gInput.value); const baseB = parseInt(bInput.value);
        newPixelArray = [ clamp(baseR + Math.floor((Math.random() * 2 - 1) * AUTO_TONE_VARIATION), 0, 255), clamp(baseG + Math.floor((Math.random() * 2 - 1) * AUTO_TONE_VARIATION), 0, 255), clamp(baseB + Math.floor((Math.random() * 2 - 1) * AUTO_TONE_VARIATION), 0, 255), 255]; 
    } else { 
        newPixelArray = [parseInt(rInput.value), parseInt(gInput.value), parseInt(bInput.value), 255]; 
    }

    if (oldPixelData[0] === newPixelArray[0] && oldPixelData[1] === newPixelArray[1] && oldPixelData[2] === newPixelArray[2] && oldPixelData[3] === newPixelArray[3]) {
        if(isPainting) currentStrokePaintedPixels.add(pixelKey);
        return false; 
    }

    if (currentPaintTool === 'eraser') {
        offscreenCtx.clearRect(x, y, 1, 1);
    } else {
        offscreenCtx.fillStyle = `rgba(${newPixelArray[0]},${newPixelArray[1]},${newPixelArray[2]},${newPixelArray[3]/255})`;
        offscreenCtx.fillRect(x, y, 1, 1);
    }
    
    recordPixelChange(x, y, oldPixelData, newPixelArray);
    if(isPainting) currentStrokePaintedPixels.add(pixelKey);
    playerTexture.needsUpdate = true;

    if (wasEffectivelyTemplate) { 
        updateMaterialsTextureProperties(textureWidth, textureHeight, false); 
    }
    updateEditorButtonsState(); 
    return true;
}

function getFaceTextureRegion(mesh, geometricFaceIndex, modelTexWidth, modelTexHeight) { if (!mesh.userData.originalCubeData) { console.error("Bucket fill: Mesh missing originalCubeData."); return null; } const { uv, size } = mesh.userData.originalCubeData; const boneName = mesh.userData.boneName; const u_atlas = uv[0]; const v_atlas = uv[1]; const sizeX = size[0]; const sizeY = size[1]; const sizeZ = size[2]; const atlasFaces = { right:  { u: u_atlas, v: v_atlas + sizeZ, w: sizeZ, h: sizeY }, left:   { u: u_atlas + sizeZ + sizeX, v: v_atlas + sizeZ, w: sizeZ, h: sizeY }, top:    { u: u_atlas + sizeZ, v: v_atlas, w: sizeX, h: sizeZ }, bottom: { u: u_atlas + sizeZ + sizeX, v: v_atlas, w: sizeX, h: sizeZ }, front:  { u: u_atlas + sizeZ, v: v_atlas + sizeZ, w: sizeX, h: sizeY }, back:   { u: u_atlas + sizeZ + sizeX + sizeZ, v: v_atlas + sizeZ, w: sizeX, h: sizeY }, }; if (boneName && (boneName.toLowerCase().includes('leg') || boneName.toLowerCase().includes('pants'))) { const tempR = atlasFaces.right; atlasFaces.right = atlasFaces.left; atlasFaces.left = tempR; } const faceOrderMap = ['right', 'left', 'top', 'bottom', 'front', 'back']; const faceName = faceOrderMap[geometricFaceIndex]; const faceRegion = atlasFaces[faceName]; if (faceRegion) return { x: Math.floor(faceRegion.u), y: Math.floor(faceRegion.v), width: Math.floor(faceRegion.w), height: Math.floor(faceRegion.h) }; return null;}

function applyBucketFill(intersection) { 
    const isPaintingSkin = paintTargetToggle && !paintTargetToggle.checked;
    if (!offscreenCtx || !playerTexture || !playerTexture.image || !isPaintingSkin || !intersection.face || !intersection.object.userData.originalCubeData || !rInput || !gInput || !bInput) return false; 
    
    const wasEffectivelyTemplate = baseMaterial && baseMaterial.userData.uniforms.hasSkin.value === false;

    const mesh = intersection.object; 
    const geometricFaceIndex = Math.floor(intersection.faceIndex / 2); 
    const modelTexWidth = mesh.userData.texWidth || playerTexture.image.width; 
    const modelTexHeight = mesh.userData.texHeight || playerTexture.image.height; 
    const region = getFaceTextureRegion(mesh, geometricFaceIndex, modelTexWidth, modelTexHeight); 
    if (!region || region.width <= 0 || region.height <= 0) { console.error("Bucket fill: Invalid region.", region); return false; } 
    region.x = Math.max(0, Math.min(region.x, modelTexWidth - 1)); region.y = Math.max(0, Math.min(region.y, modelTexHeight - 1)); region.width = Math.max(1, Math.min(region.width, modelTexWidth - region.x)); region.height = Math.max(1, Math.min(region.height, modelTexHeight - region.y)); 
    if (region.width <= 0 || region.height <= 0) { console.error("Bucket fill: Region invalid after clamping.", region); return false; } 
    
    const currentFillStyle = currentPaintTool === 'eraser' ? 'rgba(0,0,0,0)' : `rgba(${rInput.value},${gInput.value},${bInput.value},1.0)`;
    const oldImageData = offscreenCtx.getImageData(region.x, region.y, region.width, region.height); 
    
    if (currentPaintTool === 'eraser') {
        offscreenCtx.clearRect(region.x, region.y, region.width, region.height);
    } else {
        offscreenCtx.fillStyle = currentFillStyle; 
        offscreenCtx.fillRect(region.x, region.y, region.width, region.height); 
    }
    recordRectFillAction(region, oldImageData, currentFillStyle); 
    playerTexture.needsUpdate = true; 

    if (wasEffectivelyTemplate) {
        updateMaterialsTextureProperties(modelTexWidth, modelTexHeight, false); 
    }
    updateEditorButtonsState();
    return true;
}

function setupPaintingListeners() {
    if (!canvas) return; 
    const paintRaycaster = new THREE.Raycaster(); 
    const mouseForPainting = new THREE.Vector2(); 
    let didHitOnMouseDown = false; 

    function getModelIntersection(event) { 
        if (!playerModelGroup || !camera || !renderer) return null; 
        const rect = renderer.domElement.getBoundingClientRect(); 
        mouseForPainting.x = ((event.clientX - rect.left) / rect.width) * 2 - 1; 
        mouseForPainting.y = -((event.clientY - rect.top) / rect.height) * 2 + 1; 
        paintRaycaster.setFromCamera(mouseForPainting, camera); 
        const meshesToIntersect = []; 
        playerModelGroup.traverse(object => { 
            if (object.isMesh && object.visible && object.material && (BASE_PARTS.includes(object.name) || LAYER_PARTS.includes(object.name))) { 
                meshesToIntersect.push(object); 
            } 
        }); 
        if (meshesToIntersect.length === 0) return null; 
        const intersects = paintRaycaster.intersectObjects(meshesToIntersect, false); 
        return intersects.length > 0 ? intersects[0] : null; 
    } 

    canvas.addEventListener('mousedown', (event) => { 
        const isPaintingSkin = paintTargetToggle && !paintTargetToggle.checked; 
        if (!modePaintRadio || !modePaintRadio.checked || !isPaintingSkin || !offscreenCanvas) { 
            if(controls) controls.enabled = true; setDefaultPaintCursor(); return; 
        } 
        const intersection = getModelIntersection(event); 
        didHitOnMouseDown = !!intersection;  
        if (currentPaintTool === 'pencil' || currentPaintTool === 'autoTone' || currentPaintTool === 'eraser') { 
            currentStrokePaintedPixels.clear(); 
        } 
        if (!intersection) {  
            if(controls) controls.enabled = true;  setDefaultPaintCursor();  return;  
        } 
        const needsUv = currentPaintTool !== 'bucket';  
        const needsFace = currentPaintTool === 'bucket'; 
        if ((needsUv && !intersection.uv) || (needsFace && !intersection.face)) {  
            if(controls) controls.enabled = true;  setDefaultPaintCursor();  return;  
        } 
        if (currentPaintTool === 'pencil' || currentPaintTool === 'autoTone' || currentPaintTool === 'eraser') { 
            isPainting = true;  
            if(controls) controls.enabled = false;  
            canvas.style.cursor = 'crosshair';  
            applyPixelModification(intersection.uv); 
        } else if (currentPaintTool === 'bucket') { 
            applyBucketFill(intersection);  
            if(controls) controls.enabled = true;  
            setDefaultPaintCursor();  
        } else if (currentPaintTool === 'colorPicker') { 
            if (!playerTexture || !playerTexture.image || !rInput || !gInput || !bInput || !previousColor || !colorPreview) return; 
            const texW = playerTexture.image.width; 
            const texH = playerTexture.image.height;
            const x = Math.floor(intersection.uv.x * texW);
            const y = Math.floor(intersection.uv.y * texH); 
            if (x >= 0 && x < texW && y >= 0 && y < texH) { 
                const pixelData = offscreenCtx.getImageData(x, y, 1, 1).data; 
                if (pixelData[3] > 0) {  
                    if(previousColor && colorPreview) previousColor.style.backgroundColor = colorPreview.style.backgroundColor; 
                    
                    currentSkinPaintColor = rgbToHsv(pixelData[0], pixelData[1], pixelData[2]);
                    if(window.updateColorUI) window.updateColorUI('rgb_eyedropper_skin'); 

                    currentPaintTool = 'hand'; 
                    setActiveToolButton(handToolBtn); 
                    if(controls) controls.enabled = true; 
                    setDefaultPaintCursor(); 
                } 
            } 
        } else {  
            if(controls) controls.enabled = true;  
            setDefaultPaintCursor();  
        } 
    });

    canvas.addEventListener('mousemove', (event) => {
        const isPaintingSkin = paintTargetToggle && !paintTargetToggle.checked;
        if (modePaintRadio && modePaintRadio.checked && isPaintingSkin && playerModelGroup && playerTexture && playerTexture.image && offscreenCanvas) {
            const intersection = getModelIntersection(event);
            if (intersection && intersection.uv) {
                const texW = playerTexture.image.width;
                const texH = playerTexture.image.height;
                const x = Math.floor(intersection.uv.x * texW);
                const y = Math.floor(intersection.uv.y * texH); 

                if (x >= 0 && x < texW && y >= 0 && y < texH) {
                    const currentPixelKey = `${x},${y}`;
                    if (lastHoveredPixelKey !== currentPixelKey) {
                        updateMaterialsPixelHighlight(x, y, true);
                        lastHoveredPixelKey = currentPixelKey;
                    }
                    if (!isPainting) canvas.style.cursor = 'crosshair';
                } else {
                    if (lastHoveredPixelKey !== null) { updateMaterialsPixelHighlight(-1, -1, false); lastHoveredPixelKey = null; }
                    if (!isPainting) setDefaultPaintCursor();
                }
            } else {
                if (lastHoveredPixelKey !== null) { updateMaterialsPixelHighlight(-1, -1, false); lastHoveredPixelKey = null; }
                if (!isPainting) setDefaultPaintCursor();
            }
        } else {
            if (lastHoveredPixelKey !== null) { updateMaterialsPixelHighlight(-1, -1, false); lastHoveredPixelKey = null; setDefaultPaintCursor(); }
        }
        if (isPainting && didHitOnMouseDown && (currentPaintTool === 'pencil' || currentPaintTool === 'autoTone' || currentPaintTool === 'eraser')) { 
            canvas.style.cursor = 'crosshair';  
            const intersection = getModelIntersection(event);  
            if (intersection && intersection.uv) { applyPixelModification(intersection.uv); } 
        } 
    }); 

    window.addEventListener('mouseup', () => { 
        if (isPainting) { 
            isPainting = false;  
            didHitOnMouseDown = false;  
            currentStrokePaintedPixels.clear();  
            if(controls) controls.enabled = true;  
            setDefaultPaintCursor();  
            const mockEvent = { clientX: controls?.mouse?.x, clientY: controls?.mouse?.y };  
            if (mockEvent.clientX !== undefined && renderer && canvas) {  
                const rect = canvas.getBoundingClientRect(); 
                mockEvent.clientX += rect.left;  
                mockEvent.clientY += rect.top; 
                canvas.dispatchEvent(new MouseEvent('mousemove', mockEvent));  
            } 
            if (cameraStopTimeoutId) clearTimeout(cameraStopTimeoutId); 
            cameraStopTimeoutId = setTimeout(updateFocusedLayer, CAMERA_STOP_DELAY / 2);  
        } 
    }); 

    canvas.addEventListener('mouseleave', () => { 
        if (isPainting) {  
            isPainting = false;  
            didHitOnMouseDown = false;  
            currentStrokePaintedPixels.clear();  
            if(controls) controls.enabled = true;  
        } 
        if (lastHoveredPixelKey !== null) {  
            updateMaterialsPixelHighlight(-1, -1, false);  
            lastHoveredPixelKey = null;  
        } 
        canvas.style.cursor = 'default';  
    }); 
    
    if (paintTargetToggle) { 
        const paintTargetChangedHandler = () => { 
            const isPaintingLines = paintTargetToggle.checked;
            if (lastHoveredPixelKey !== null && isPaintingLines) { 
                updateMaterialsPixelHighlight(-1, -1, false); 
                lastHoveredPixelKey = null; 
            } 
            setDefaultPaintCursor(); 
            updateUndoRedoButtons(); 
            if(window.updateColorUI) window.updateColorUI('paintTargetSwitch'); 
        }; 
        paintTargetToggle.addEventListener('change', paintTargetChangedHandler); 
    }
}

function setupUIListeners() {
    if (importSkinButton && skinInput) {
        importSkinButton.addEventListener('click', (e) => {
            e.preventDefault(); 
            e.stopPropagation(); 
            skinInput.click();
        });
        skinInput.addEventListener('change', async (event) => { 
            event.preventDefault(); 
            event.stopPropagation();
    
            const file = event.target.files[0];
            if (file && file.type === 'image/png') {
                console.log("Editor: File selected via internal import button. Resetting editor state completely.");
                resetEditorToDefaultState(true); // true to ensure full reset, including clearing currentLoadedSkinIdForEditor
                
                console.log("Editor: Attempting to load texture from selected file:", file.name);
                // Read file to Data URL here to make loadTextureFromFile more robust against context changes
                const reader = new FileReader();
                reader.onload = async (e_reader) => {
                    if (e_reader.target.result) {
                        // Pass Data URL, explicitly no skinIdForContext, not a draft load
                        await loadTextureFromFile(e_reader.target.result, null, null, false); 
                    } else {
                         console.error("Editor: FileReader error - result is null for internal import.");
                         if(infoElement) infoElement.innerHTML = "Error reading imported file.";
                         resetEditorToDefaultState(true); // Reset on error
                    }
                };
                reader.onerror = (e_reader_error) => {
                     console.error("Editor: FileReader error on internal import:", e_reader_error);
                     if(infoElement) infoElement.innerHTML = "Error reading imported file.";
                     resetEditorToDefaultState(true); // Reset on error
                };
                reader.readAsDataURL(file);

            } else if (file) {
                if(infoElement) infoElement.innerHTML = "Please select a valid PNG file." + (!playerModelGroup ? "<br>LMB Drag: Rotate, RMB Drag: Pan, Scroll: Zoom." : "");
            }
            skinInput.value = null; 
        });
    } 
    if (exportSkinButton) { exportSkinButton.addEventListener('click', () => { if (offscreenCanvas && !isCanvasBlank(offscreenCtx)) { const dataURL = offscreenCanvas.toDataURL('image/png'); const a = document.createElement('a'); a.href = dataURL; a.download = 'player_skin.png'; document.body.appendChild(a); a.click(); document.body.removeChild(a); } else { alert("No skin data to export."); } }); }
    if (editorSaveOrApplyButton) { 
        editorSaveOrApplyButton.addEventListener('click', handleEditorSaveOrApply);
    }
    if (editorClearSkinButton) {
        editorClearSkinButton.addEventListener('click', handleEditorClearSkin);
    }

    if (closeSaveNewSkinModalBtn) closeSaveNewSkinModalBtn.onclick = closeSaveNewSkinModal;
    if (cancelSaveNewSkinBtn) cancelSaveNewSkinBtn.onclick = closeSaveNewSkinModal;
    if (confirmSaveNewSkinBtn) confirmSaveNewSkinBtn.onclick = handleConfirmSaveNewSkin;
    if (saveNewSkinModal) { 
        saveNewSkinModal.addEventListener('click', (event) => {
            if (event.target === saveNewSkinModal) {
                closeSaveNewSkinModal();
            }
        });
    }


    if (modelTypeSwitch) { modelTypeSwitch.addEventListener('change', () => { currentModelType = modelTypeSwitch.checked ? 'alex' : 'steve'; currentJsonData = modelTypeSwitch.checked ? alexJsonData : steveJsonData; if (baseMaterial) buildAndDisplayModel(); else if (infoElement) infoElement.innerHTML = `Model type set to ${currentModelType}. Paint or import skin.`; }); } if (visibilityCheckboxesContainer) { const checkboxes = visibilityCheckboxesContainer.querySelectorAll('input[type="checkbox"]'); checkboxes.forEach(checkbox => { checkbox.addEventListener('change', (event) => { const partName = event.target.dataset.part; if (partName) togglePartVisibility(partName, event.target.checked); }); }); } setupToggleGroupButton('toggleLayersBtn', LAYER_PARTS, 'Layers'); setupToggleGroupButton('toggleBaseBtn', BASE_PARTS, 'Base'); if (gizmoCanvas) { gizmoCanvas.addEventListener('click', onGizmoClick); gizmoCanvas.addEventListener('pointerdown', (e) => e.stopPropagation()); gizmoCanvas.addEventListener('mousedown', (e) => e.stopPropagation()); gizmoCanvas.addEventListener('touchstart', (e) => e.stopPropagation()); } if (modeViewRadio && modePaintRadio) { modeViewRadio.addEventListener('change', () => { if (modeViewRadio.checked) setUIMode('view'); }); modePaintRadio.addEventListener('change', () => { if (modePaintRadio.checked) setUIMode('paint'); }); } const toolButtonActions = { handToolBtn: 'hand', pencilToolBtn: 'pencil', autoToneToolBtn: 'autoTone', eraserToolBtn: 'eraser', bucketToolBtn: 'bucket', colorPickerToolBtn: 'colorPicker' }; for (const btnId in toolButtonActions) { const button = document.getElementById(btnId);  if (button) { button.addEventListener('click', () => { currentPaintTool = toolButtonActions[btnId]; setActiveToolButton(button); if (controls) controls.enabled = ['hand', 'bucket', 'colorPicker'].includes(currentPaintTool); setDefaultPaintCursor(); }); } } if(undoBtn) undoBtn.addEventListener('click', undoPaint); if(redoBtn) redoBtn.addEventListener('click', redoPaint); 
    
    (function setupColorPicker() {  
        if(!colorPickerGuiContainer||!colorPreview||!previousColor||!hexInput||!rInput||!gInput||!bInput||!pickerArea||!hueSlider||!pickerHandle||!hueHandle || !paintTargetToggle){  
            console.warn("One or more color picker elements not found."); return;  
        } 
        let isDraggingPicker=false;let isDraggingHue=false; 

        function updateColorUIFromPicker(source='init'){ 
            const oldHex = colorPreview.style.backgroundColor; 
            if(source !== 'picker_drag' && source !== 'hue_drag' && source !== 'rgb_eyedropper_skin' && source !== 'paintTargetSwitch' && oldHex) {
                 previousColor.style.backgroundColor = oldHex;
            }
            
            let activeColorHSV = paintTargetToggle.checked ? userGridLineColorHSV : currentSkinPaintColor;
            if (source === 'rgb_eyedropper_skin') { 
                activeColorHSV = currentSkinPaintColor; 
                 if (oldHex && !paintTargetToggle.checked) previousColor.style.backgroundColor = oldHex;
            } else if (source === 'paintTargetSwitch') {
                activeColorHSV = paintTargetToggle.checked ? userGridLineColorHSV : currentSkinPaintColor;
            }


            const rgb=hsvToRgb(activeColorHSV.h,activeColorHSV.s,activeColorHSV.v); 
            const hexVal=rgbToHex(rgb.r,rgb.g,rgb.b); 
            colorPreview.style.backgroundColor=hexVal; 

            const targetIsLines = paintTargetToggle.checked;
            if(source!=='hex_input' || (source === 'hex_input' && targetIsLines === (hexInput.dataset.target === 'lines')) ) {
                 if (source !== 'rgb_eyedropper_skin' || targetIsLines) hexInput.value = hexVal;
            }
            if(source!=='rgb_input' || (source === 'rgb_input' && targetIsLines === (rInput.dataset.target === 'lines'))) {
                if (source !== 'rgb_eyedropper_skin' || targetIsLines) {
                    rInput.value = rgb.r; gInput.value = rgb.g; bInput.value = rgb.b;
                }
            }
             if (source === 'rgb_eyedropper_skin' && !targetIsLines) {
                rInput.value=rgb.r; gInput.value=rgb.g; bInput.value=rgb.b; hexInput.value = hexVal;
            }


            const pureHueRgb=hsvToRgb(activeColorHSV.h,1,1); 
            const pureHueHex=rgbToHex(pureHueRgb.r,pureHueRgb.g,pureHueRgb.b); 
            pickerArea.style.background=`linear-gradient(to top, black, transparent), linear-gradient(to right, white, ${pureHueHex})`; 
            if(pickerArea.clientWidth>0 && pickerArea.clientHeight>0){pickerHandle.style.left=`${activeColorHSV.s*100}%`;pickerHandle.style.top=`${(1-activeColorHSV.v)*100}%`;} 
            if(hueSlider.clientWidth>0) hueHandle.style.left=`${activeColorHSV.h*100}%`; 
            
            if (targetIsLines) { 
                const newGridColorTHREE = new THREE.Color(rgb.r/255, rgb.g/255, rgb.b/255);
                userGridLineColor.copy(newGridColorTHREE); 
                isGridColorUserModified = true;
                updateMaterialsTextureProperties(offscreenCanvas.width, offscreenCanvas.height, isCanvasBlank(offscreenCtx) && !currentLoadedSkinIdForEditor);
            } else if (source === 'paintTargetSwitch' && !targetIsLines) { 
                updateMaterialsTextureProperties(offscreenCanvas.width, offscreenCanvas.height, isCanvasBlank(offscreenCtx) && !currentLoadedSkinIdForEditor);
            }
            updateUndoRedoButtons(); 
        } 
        window.updateColorUI = updateColorUIFromPicker; 

        function handlePickerDrag(event){
            if(!isDraggingPicker)return;
            const target=event.touches?event.touches[0]:event;
            const rect=pickerArea.getBoundingClientRect();
            const x=clamp(target.clientX-rect.left,0,rect.width);
            const y=clamp(target.clientY-rect.top,0,rect.height);
            const newS = x/rect.width;
            const newV = 1-(y/rect.height);
            if (paintTargetToggle.checked) { 
                userGridLineColorHSV.s = newS; userGridLineColorHSV.v = newV;
            } else { 
                currentSkinPaintColor.s = newS; currentSkinPaintColor.v = newV;
            }
            updateColorUIFromPicker('picker_drag');
        } 
        function handleHueDrag(event){
            if(!isDraggingHue)return;
            const target=event.touches?event.touches[0]:event;
            const rect=hueSlider.getBoundingClientRect();
            const x=clamp(target.clientX-rect.left,0,rect.width);
            const newH = x/rect.width;
            if (paintTargetToggle.checked) { 
                userGridLineColorHSV.h = newH;
            } else { 
                currentSkinPaintColor.h = newH;
            }
            updateColorUIFromPicker('hue_drag');
        } 

        function startDrag(type, event) { 
            if(type==='picker'){isDraggingPicker=true; handlePickerDrag(event);}
            else{isDraggingHue=true; handleHueDrag(event);} 
            const moveHandler = type==='picker'?handlePickerDrag:handleHueDrag; 
            window.addEventListener('mousemove',moveHandler); 
            window.addEventListener('mouseup',stopDragging); 
            if(event.touches){window.addEventListener('touchmove',moveHandler,{passive:false});window.addEventListener('touchend',stopDragging);window.addEventListener('touchcancel',stopDragging);}} 
        function stopDragging(){if(isDraggingPicker||isDraggingHue)updateColorUIFromPicker('drag_end'); isDraggingPicker=false;isDraggingHue=false;window.removeEventListener('mousemove',handlePickerDrag);window.removeEventListener('mousemove',handleHueDrag);window.removeEventListener('mouseup',stopDragging);window.removeEventListener('touchmove',handlePickerDrag);window.removeEventListener('touchmove',handleHueDrag);window.removeEventListener('touchend',stopDragging);window.removeEventListener('touchcancel',stopDragging);} 
        
        pickerArea.addEventListener('mousedown',(e)=>startDrag('picker',e)); 
        pickerArea.addEventListener('touchstart',(e)=>{if(e.touches.length===1){e.preventDefault();startDrag('picker',e);}},{passive:false}); 
        hueSlider.addEventListener('mousedown',(e)=>startDrag('hue',e)); 
        hueSlider.addEventListener('touchstart',(e)=>{if(e.touches.length===1){e.preventDefault();startDrag('hue',e);}},{passive:false}); 
        
        const rgbUpdateHandler=(e)=>{
            const r=clamp(parseInt(rInput.value)||0,0,255);
            const g=clamp(parseInt(gInput.value)||0,0,255);
            const b=clamp(parseInt(bInput.value)||0,0,255);
            const targetIsLines = paintTargetToggle.checked;
            rInput.dataset.target = targetIsLines ? 'lines' : 'skin';

            if (targetIsLines) {
                userGridLineColorHSV = rgbToHsv(r,g,b);
                isGridColorUserModified = true; 
            } else {
                currentSkinPaintColor = rgbToHsv(r,g,b);
            }
            updateColorUIFromPicker('rgb_input');
        }; 
        [rInput,gInput,bInput].forEach(input => input.addEventListener('input',rgbUpdateHandler)); 
        
        hexInput.addEventListener('change',()=>{
            const rgbVal=hexToRgb(hexInput.value);
            const targetIsLines = paintTargetToggle.checked;
            hexInput.dataset.target = targetIsLines ? 'lines' : 'skin';

            if(rgbVal){
                if (targetIsLines) {
                    userGridLineColorHSV = rgbToHsv(rgbVal.r,rgbVal.g,rgbVal.b);
                    isGridColorUserModified = true;
                } else {
                    currentSkinPaintColor = rgbToHsv(rgbVal.r,rgbVal.g,rgbVal.b);
                }
                updateColorUIFromPicker('hex_input');
            } else { 
                const activeColorHSV = targetIsLines ? userGridLineColorHSV : currentSkinPaintColor;
                const validRgb=hsvToRgb(activeColorHSV.h,activeColorHSV.s,activeColorHSV.v);
                hexInput.value=rgbToHex(validRgb.r,validRgb.g,validRgb.b);
            }
        }); 
        
        if (paintTargetToggle) { 
            paintTargetToggle.addEventListener('change', () => {
                updateColorUIFromPicker('paintTargetSwitch');
            });
        }
        updateColorUIFromPicker();  
    })(); 
    
    setActiveToolButton(handToolBtn);  
    updateUndoRedoButtons(); 
    setupPaintingListeners(); 
    setupDynamicLayerControls(); 
    setupGridControlListeners(); 
    setDefaultPaintCursor();
}
function onGizmoClick(event) {
    if (!gizmoCanvas || !gizmoCamera || !camera || !controls) return;  event.preventDefault();  const rect = gizmoCanvas.getBoundingClientRect();  const x = event.clientX - rect.left; const y = event.clientY - rect.top;  gizmoMouse.x = (x / rect.width) * 2 - 1; gizmoMouse.y = -(y / rect.height) * 2 + 1;  gizmoRaycaster.setFromCamera(gizmoMouse, gizmoCamera);  const intersects = gizmoRaycaster.intersectObjects(gizmoClickables);  if (intersects.length > 0) {  const clickedObject = intersects[0].object;  if (clickedObject.userData && clickedObject.userData.type === 'gizmo') {  const axis = clickedObject.userData.axis; const direction = clickedObject.userData.direction;  const modelCenterY = calculateModelTargetY();  const targetLookAt = new THREE.Vector3(0, modelCenterY + MODEL_Y_OFFSET, 0);  const offset = new THREE.Vector3(); offset[axis] = direction * VIEW_GIZMO_DISTANCE;  const targetPosition = targetLookAt.clone().add(offset);  if (axis === 'y') targetPosition.z += (direction > 0 ? 0.01 : -0.01);  animateCameraTo(targetPosition, targetLookAt);  }  }
}
function animate() {
    requestAnimationFrame(animate); if (!renderer || !scene || !camera || !controls) return;  const delta = clock.getDelta(); TWEEN.update(TWEEN.now()); if(controls.enabled) controls.update(delta); if (coordsInfoElement) { const camPos = camera.position; const targetPos = controls.target; coordsInfoElement.innerHTML = `Cam Pos: X:${camPos.x.toFixed(2)} Y:${camPos.y.toFixed(2)} Z:${camPos.z.toFixed(2)}<br>Target:  X:${targetPos.x.toFixed(2)} Y:${targetPos.y.toFixed(2)} Z:${targetPos.z.toFixed(2)}`; } const editorContentDiv = document.getElementById('editor-content'); if (!editorContentDiv) return; const mainCanvasWidth = editorContentDiv.clientWidth; const mainCanvasHeight = editorContentDiv.clientHeight; renderer.setViewport(0, 0, mainCanvasWidth, mainCanvasHeight); renderer.setScissor(0, 0, mainCanvasWidth, mainCanvasHeight); renderer.setScissorTest(false); renderer.render(scene, camera); if (gizmoContainer && gizmoCanvas && gizmoCamera && gizmoScene) {  camera.getWorldDirection(mainCamDirection);  gizmoCamera.position.copy(mainCamDirection).negate().setLength(gizmoCamOffset);  gizmoCamera.up.copy(camera.up); gizmoCamera.lookAt(0, 0, 0);  const gizmoRect = gizmoContainer.getBoundingClientRect();  const mainRect = editorContentDiv.getBoundingClientRect();  if (gizmoRect.width > 0 && gizmoRect.height > 0 && mainRect.width > 0 && mainRect.height > 0) { const vpX = gizmoRect.left - mainRect.left;  const vpY = mainRect.bottom - gizmoRect.bottom;  const vpW = gizmoRect.width;  const vpH = gizmoRect.height;  if (vpX >= 0 && vpY >= 0 && (vpX + vpW) <= mainCanvasWidth && (vpY + vpH) <= mainCanvasHeight) { renderer.setViewport(vpX, vpY, vpW, vpH);  renderer.setScissor(vpX, vpY, vpW, vpH);  renderer.setScissorTest(true);  renderer.clearDepth();  renderer.render(gizmoScene, gizmoCamera);  renderer.setScissorTest(false);  }  } }
}
function onWindowResize() {
    if (!camera || !renderer || !canvas) return; const editorContentDiv = document.getElementById('editor-content'); if (!editorContentDiv) return; const newWidth = editorContentDiv.clientWidth; const newHeight = editorContentDiv.clientHeight; camera.aspect = newWidth / newHeight; camera.updateProjectionMatrix(); renderer.setSize(newWidth, newHeight); if (gizmoCanvas && gizmoContainer && gizmoCamera) { const gizmoRect = gizmoContainer.getBoundingClientRect(); if (gizmoRect.width > 0 && gizmoRect.height > 0) { gizmoAspect = gizmoRect.width / gizmoRect.height; gizmoCamera.left = -gizmoCamSize * gizmoAspect; gizmoCamera.right = gizmoCamSize * gizmoAspect; gizmoCamera.top = gizmoCamSize; gizmoCamera.bottom = -gizmoCamSize; gizmoCamera.updateProjectionMatrix(); } }
}

function refreshEditorLayout() {
    if (isEditorInitialized) {
        onWindowResize();
    }
}

async function initEditor() {
    if (!isEditorInitialized) {
        console.log("Initializing 3D Editor module for the first time...");
        initializeDOMReferences();
        scene = new THREE.Scene();
        renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true, logarithmicDepthBuffer: true });
        renderer.setSize(canvas.clientWidth, canvas.clientHeight);
        renderer.setPixelRatio(window.devicePixelRatio); renderer.setClearColor(0x000000, 0);
        renderer.toneMapping = THREE.NoToneMapping; renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.sortObjects = true;
        camera = new THREE.PerspectiveCamera(50, canvas.clientWidth / canvas.clientHeight, 0.1, 100);
        camera.position.set(0.0, 1.25, -3.00);
        controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true; controls.dampingFactor = 0.1; controls.target.set(0.0, 1.25, 0.0);
        ambLight = new THREE.AmbientLight(0xffffff, 0.8); scene.add(ambLight);
        dirLight = new THREE.DirectionalLight(0xffffff, 1.0); dirLight.position.set(1, 2, 1.5).normalize(); scene.add(dirLight);
        dirLight2 = new THREE.DirectionalLight(0xffffff, 0.5); dirLight2.position.set(-1, -0.5, -1).normalize(); scene.add(dirLight2);
        axesHelper = new THREE.AxesHelper(0.5); axesHelper.setColors(0xff0000, 0x00ff00, 0x0000ff); axesHelper.position.set(0, GRID_Y_OFFSET, 0); scene.add(axesHelper);
        gridGroup = new THREE.Group(); scene.add(gridGroup);
        const detailGridDivisions = 16; const simpleGridDivisions = 1; const gridSize = 1; const detailColorCenter = 0xAAAAAA; const detailColorLines = 0x888888; function createDetailedGrid_internal() { const grid = new THREE.GridHelper(gridSize, detailGridDivisions, detailColorCenter, detailColorLines); grid.position.y = GRID_Y_OFFSET; return grid; } function createSimpleGrid_internal() { const grid = new THREE.GridHelper(gridSize, simpleGridDivisions, detailColorCenter, detailColorLines); grid.position.y = GRID_Y_OFFSET; return grid; } const centerGrid = createDetailedGrid_internal(); centerGrid.position.set(0, GRID_Y_OFFSET, 0); const positions = centerGrid.geometry.attributes.position.array; const epsilon = 0.0001; const halfSize = gridSize / 2.0; for (let i = 0; i < positions.length; i += 6) { const v1={x:positions[i],y:positions[i+1],z:positions[i+2]}; const v2={x:positions[i+3],y:positions[i+4],z:positions[i+5]};if(Math.abs(v1.z)<epsilon&&Math.abs(v2.z)<epsilon&&Math.abs(v1.y)<epsilon&&Math.abs(v2.y)<epsilon&&((Math.abs(v1.x-halfSize)<epsilon&&Math.abs(v2.x+halfSize)<epsilon)||(Math.abs(v1.x+halfSize)<epsilon&&Math.abs(v2.x-halfSize)<epsilon))) {if(Math.abs(v1.x-halfSize)<epsilon){positions[i]=0;}else if(Math.abs(v2.x-halfSize)<epsilon){positions[i+3]=0;}}else if(Math.abs(v1.x)<epsilon&&Math.abs(v2.x)<epsilon&&Math.abs(v1.y)<epsilon&&Math.abs(v2.y)<epsilon&&((Math.abs(v1.z-halfSize)<epsilon&&Math.abs(v2.z+halfSize)<epsilon)||(Math.abs(v1.z+halfSize)<epsilon&&Math.abs(v2.z-halfSize)<epsilon))) {if(Math.abs(v1.z-halfSize)<epsilon){positions[i+2]=0;}else if(Math.abs(v2.z-halfSize)<epsilon){positions[i+5]=0;}}} centerGrid.geometry.attributes.position.needsUpdate = true; gridGroup.add(centerGrid); const surroundingOffsets = [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]; surroundingOffsets.forEach(offset=>{const grid=createSimpleGrid_internal();grid.position.set(offset[0],GRID_Y_OFFSET,offset[1]);gridGroup.add(grid);});
        
        initializeCoreTextureData(); 
        loadModelDefinitions(); 
        setupUIListeners(); 
        setUIMode('view'); 
        if(paintTargetToggle) paintTargetToggle.checked = false; 
        if (window.updateColorUI) window.updateColorUI('init'); 
        
        gizmoScene = new THREE.Scene();
        if (gizmoCanvas) { initializeGizmoRender(); }
        window.addEventListener('resize', onWindowResize);
        window.addEventListener('beforeunload', saveEditorDraftState);

        setTimeout(onWindowResize, 0); 
        animate(); 
        isEditorInitialized = true;
        console.log("3D Editor module initialized successfully (first time).");
    } else { 
        console.log("Re-activating 3D Editor module.");
        initializeCoreTextureData(); 
        if (steveJsonData && alexJsonData) { 
             initializeMaterials(); 
        } else {
            console.warn("Model definitions not available to re-initialize materials fully on tab re-entry. Model may not display correctly until definitions are loaded.");
            loadModelDefinitions(); 
        }
    }

    let loadedFromSpecificSource = false;
    const pendingSkinDataJSON = localStorage.getItem(pendingFullEditorSkinDataKey);
    const skinIdToLoadFromSkinsTabViaPendingString = localStorage.getItem('skinToEditInFullEditorId'); 

    if (pendingSkinDataJSON) {
        console.log("Editor: initEditor - PRIORITY 1: pendingFullEditorSkinData found.");
        localStorage.removeItem(pendingFullEditorSkinDataKey); 
        localStorage.removeItem(currentEditorDraftStateKey); 
        
        try {
            const pendingSkinData = JSON.parse(pendingSkinDataJSON);
            await loadTextureFromFile(pendingSkinData.imageDataUrl, pendingSkinData.type, pendingSkinData.id, false);
            loadedFromSpecificSource = true;
        } catch (e) {
            console.error("Editor: initEditor - Error parsing pendingFullEditorSkinData:", e);
            currentLoadedSkinIdForEditor = null; 
        }
        if (skinIdToLoadFromSkinsTabViaPendingString) {
            localStorage.removeItem('skinToEditInFullEditorId');
        }

    } else if (skinIdToLoadFromSkinsTabViaPendingString) {
        console.log("Editor: initEditor - PRIORITY 2: skinToEditInFullEditorId found (no pending data).");
        localStorage.removeItem(currentEditorDraftStateKey); 
        const skinIdToLoad = parseInt(skinIdToLoadFromSkinsTabViaPendingString);
        localStorage.removeItem('skinToEditInFullEditorId'); 
        
        if (playerModelGroup) playerModelGroup.visible = false; 
        const db = getDbInstance();
        if (db && !isNaN(skinIdToLoad)) {
            const transaction = db.transaction(SKINS_STORE_NAME, 'readonly');
            const store = transaction.objectStore(SKINS_STORE_NAME);
            const request = store.get(skinIdToLoad);
            
            await new Promise(async (resolveDbOp) => {
                request.onsuccess = async () => {
                    if (request.result) {
                        await loadTextureFromFile(request.result.imageDataUrl, request.result.type, skinIdToLoad, false);
                        loadedFromSpecificSource = true;
                    } else {
                        console.warn(`Editor: initEditor - Skin with ID ${skinIdToLoad} not found in DB. Resetting editor.`);
                        resetEditorToDefaultState(true); 
                    }
                    resolveDbOp();
                };
                request.onerror = (e) => { 
                    console.error("Editor: initEditor - Error fetching skin for editor:", e); 
                    resetEditorToDefaultState(true); 
                    resolveDbOp();
                };
            });
        } else {
            console.warn("Editor: initEditor - DB not ready or invalid skinIdToLoad. Resetting.");
            resetEditorToDefaultState(true); 
        }
    } else {
        console.log("Editor: initEditor - PRIORITY 3: Attempting to load editor's own draft.");
        loadedFromSpecificSource = await loadEditorDraftState(); 
    }

    if (!loadedFromSpecificSource) {
        console.log("Editor: initEditor - PRIORITY 4: No specific source or draft, resetting to default template.");
        resetEditorToDefaultState(true); 
    }
    
    refreshEditorLayout(); 
    
    if (playerModelGroup) {
        const hasActualContent = offscreenCtx && !isCanvasBlank(offscreenCtx);
        playerModelGroup.visible = hasActualContent || currentLoadedSkinIdForEditor || (playerTexture && playerTexture.image && (playerTexture.image.width !==0));
    }
    
    console.log(`Editor: initEditor - Final currentLoadedSkinIdForEditor after all loading logic: ${currentLoadedSkinIdForEditor}`);
    updateEditorButtonsState(); 
}

export { 
    initEditor, 
    refreshEditorLayout, 
    saveEditorDraftState, 
    closeSaveNewSkinModal 
};
