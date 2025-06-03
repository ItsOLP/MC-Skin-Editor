import { getDbInstance, SKINS_STORE_NAME } from './db.js';
import { openLargeSkinPreview, registerHideSkinEditorFullView, registerSkinsTabActivated } from './ui.js';
import { generateSkinPreviews } from './skin-preview-renderer.js';
import { initSimpleViewer } from './simple-skin-viewer.js'; 

// DOM Elements
const skinsTabMainContent = document.getElementById('skins-tab-main-content');
const importSkinsBtn = document.getElementById('import-skins-btn');
const skinFileInput = document.getElementById('skin-file-input');
export const skinsDisplayArea = document.getElementById('skins-display-area');
const skinsSearchInput = document.getElementById('skins-search-input');
const downloadAllSkinsBtn = document.getElementById('download-all-skins-btn');

const skinEditorFullView = document.getElementById('skin-editor-full-view');
const simpleSkinViewerCanvas = document.getElementById('simple-skin-viewer-canvas'); 
const skinEditorNameInput = document.getElementById('skin-editor-name-input');
const skinEditorTypeSelect = document.getElementById('skin-editor-type-select');
const skinEditorSaveBtn = document.getElementById('skin-editor-save-btn');
const skinEditorCancelBtn = document.getElementById('skin-editor-cancel-btn');
const skinEditorDownloadBtn = document.getElementById('skin-editor-download-btn'); 
const skinEditorDeleteBtn = document.getElementById('skin-editor-delete-btn');   
const skinEditorEditInFullEditorBtn = document.getElementById('skin-editor-edit-in-full-editor-btn'); 
const skinEditor2DFrontPreviewImg = document.getElementById('skin-editor-2d-front-preview'); 
const skinEditor2DBackPreviewImg = document.getElementById('skin-editor-2d-back-preview');   
const skinEditorRawTexturePreviewImg = document.getElementById('skin-editor-raw-texture-preview'); 

const skinImportView = document.getElementById('skin-import-view');
const skinImportViewTitle = document.getElementById('skin-import-view-title');
const skinImportPreviewFrontImg = document.getElementById('skin-import-preview-front-img');
const skinImportPreviewBackImg = document.getElementById('skin-import-preview-back-img');
const skinImportMultiCounter = document.getElementById('skin-import-multi-counter');
const skinImportCurrentNum = document.getElementById('skin-import-current-num');
const skinImportTotalNum = document.getElementById('skin-import-total-num');
const skinImportAutoModeToggle = document.getElementById('skin-import-auto-mode-toggle');
const skinImportSelfModeControls = document.getElementById('skin-import-self-mode-controls');
const skinImportNameInput = document.getElementById('skin-import-name-input');
const skinImportTypeSelect = document.getElementById('skin-import-type-select');
const skinImportActionsDiv = document.getElementById('skin-import-actions');
const skinImportCancelBtn = document.getElementById('skin-import-cancel-btn');
const skinImportBackBtn = document.getElementById('skin-import-back-btn');
const skinImportActionBtn = document.getElementById('skin-import-action-btn');

// --- Module State for UI Persistence ---
let currentSkinsTabView = 'main'; 
let skinToEditOnTabReturnId = null; 

let currentEditingSkinId = null; 
let originalLoadedSkinDataForComparison = null; 
let currentEditingSkinData = null; 

let simpleViewerControls = null;   

let importContext = { 
    files: [],
    processedData: [],
    currentIndex: 0,
    isAutoMode: true // Default to true (Auto Mode ON / Self Mode OFF)
};

const PLACEHOLDER_PREVIEW = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

// --- Persistent State Handling ---
const SKINS_TAB_STATE_KEY = 'skinsTabPersistentState';
let persistentStateJustLoaded = false;

function saveSkinsTabState() {
    if (!skinsSearchInput) return; // Ensure critical DOM element is available

    // If in simple editor, capture current input values into currentEditingSkinData
    if (currentSkinsTabView === 'editor' && currentEditingSkinData && skinEditorNameInput && skinEditorTypeSelect) {
        currentEditingSkinData.name = skinEditorNameInput.value;
        currentEditingSkinData.type = skinEditorTypeSelect.value;
    }

    const stateToSave = {
        currentSkinsTabView,
        skinToEditOnTabReturnId, // This is essentially currentEditingSkinId for the simple editor view
        currentEditingSkinData: currentEditingSkinData ? JSON.parse(JSON.stringify(currentEditingSkinData)) : null,
        originalLoadedSkinDataForComparison: originalLoadedSkinDataForComparison ? JSON.parse(JSON.stringify(originalLoadedSkinDataForComparison)) : null,
        importContext: JSON.parse(JSON.stringify(importContext)),
        skinsSearchTerm: skinsSearchInput.value,
    };
    try {
        localStorage.setItem(SKINS_TAB_STATE_KEY, JSON.stringify(stateToSave));
        console.log("SkinsTab: State saved to localStorage.", stateToSave);
    } catch (e) {
        console.error("SkinsTab: Error saving state to localStorage.", e);
    }
}

async function loadAndApplySkinsTabState() {
    const stateJSON = localStorage.getItem(SKINS_TAB_STATE_KEY);
    if (stateJSON) {
        try {
            const state = JSON.parse(stateJSON);
            currentSkinsTabView = state.currentSkinsTabView || 'main';
            skinToEditOnTabReturnId = state.skinToEditOnTabReturnId || null;
            currentEditingSkinData = state.currentEditingSkinData || null;
            originalLoadedSkinDataForComparison = state.originalLoadedSkinDataForComparison || null;
            importContext = state.importContext || { files: [], processedData: [], currentIndex: 0, isAutoMode: true };
            
            if (skinsSearchInput && state.skinsSearchTerm) {
                skinsSearchInput.value = state.skinsSearchTerm;
            }
            if(skinImportAutoModeToggle && importContext){ // Restore toggle state for import view
                skinImportAutoModeToggle.checked = !importContext.isAutoMode;
            }
            
            localStorage.removeItem(SKINS_TAB_STATE_KEY); // Clear after loading
            persistentStateJustLoaded = true;
            console.log("SkinsTab: Persistent state loaded and cleared.", state);
            return true;
        } catch (e) {
            console.error("SkinsTab: Error parsing persistent state.", e);
            localStorage.removeItem(SKINS_TAB_STATE_KEY);
            return false;
        }
    }
    return false;
}
// --- End Persistent State Handling ---


async function detectSkinTypeFromImageData(imageDataUrl) {
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

function showSkinsTabMainContent(resetSearch = true) {
    if (skinsTabMainContent) skinsTabMainContent.style.display = 'block';
    
    if (skinEditorFullView && skinEditorFullView.style.display !== 'none') {
        hideSkinEditorFullView(true); 
    }
    if (skinImportView && skinImportView.style.display !== 'none') { 
        hideSkinImportView(true); 
    }
    
    currentSkinsTabView = 'main';
    
    if (resetSearch) { 
        importContext = { files: [], processedData: [], currentIndex: 0, isAutoMode: true };
        if (skinImportAutoModeToggle) skinImportAutoModeToggle.checked = false; 
    }

    if(resetSearch && skinsSearchInput) skinsSearchInput.value = '';
    loadAndDisplaySkins(skinsSearchInput ? skinsSearchInput.value : "");
}

async function showSkinEditorFullView(skinOrId) { 
    let skinDataForEditor;

    if (typeof skinOrId === 'object' && skinOrId !== null && skinOrId.id !== undefined) {
        skinDataForEditor = JSON.parse(JSON.stringify(skinOrId)); 
    } else if (typeof skinOrId === 'number' || typeof skinOrId === 'string') {
        const db = getDbInstance();
        if (!db) { console.error("DB not available to fetch skin for editor"); showSkinsTabMainContent(); return; }
        skinDataForEditor = await new Promise((resolve) => {
            const tx = db.transaction(SKINS_STORE_NAME, 'readonly');
            const store = tx.objectStore(SKINS_STORE_NAME);
            const req = store.get(Number(skinOrId)); 
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => { console.error("Error fetching skin by ID", skinOrId); resolve(null); };
        });
        if (!skinDataForEditor) { console.warn("Skin not found for editor, returning to main."); showSkinsTabMainContent(); return; }
        skinDataForEditor = JSON.parse(JSON.stringify(skinDataForEditor)); 
    } else {
        console.error("Invalid argument to showSkinEditorFullView", skinOrId); showSkinsTabMainContent(); return;
    }

    currentEditingSkinId = skinDataForEditor.id; 
    currentEditingSkinData = skinDataForEditor; 
    // If originalLoadedSkinDataForComparison is not set OR it's for a different skin,
    // then set it to the current skin being loaded. This happens on first load or switch.
    // If it *is* set and for the *same* skin, we keep it to allow comparison with user's potential in-memory changes.
    if (!originalLoadedSkinDataForComparison || originalLoadedSkinDataForComparison.id !== currentEditingSkinId) {
      originalLoadedSkinDataForComparison = JSON.parse(JSON.stringify(skinDataForEditor)); 
    }

    const hasOriginalComparison = !!originalLoadedSkinDataForComparison;
    // Image/type might have changed if coming back from main editor with pending changes
    const imageChangedInMemory = currentEditingSkinData.imageDataUrl !== (originalLoadedSkinDataForComparison ? originalLoadedSkinDataForComparison.imageDataUrl : null);
    const typeChangedInMemory = currentEditingSkinData.type !== (originalLoadedSkinDataForComparison ? originalLoadedSkinDataForComparison.type : null);


    if (!currentEditingSkinData.previewFrontUrl || !currentEditingSkinData.previewBackUrl || 
        imageChangedInMemory || typeChangedInMemory ) {
        
        console.log(`Regenerating previews for skin ID ${currentEditingSkinData.id} in Skins tab editor (showSkinEditorFullView).`);
        const previews = await generateSkinPreviews(currentEditingSkinData.imageDataUrl, currentEditingSkinData.type);
        currentEditingSkinData.previewFrontUrl = previews.front;
        currentEditingSkinData.previewBackUrl = previews.back;

        // If the original comparison data was for the same image/type that just got previews, update its previews too.
        if(hasOriginalComparison && 
           originalLoadedSkinDataForComparison.imageDataUrl === currentEditingSkinData.imageDataUrl &&
           originalLoadedSkinDataForComparison.type === currentEditingSkinData.type) {
            originalLoadedSkinDataForComparison.previewFrontUrl = previews.front;
            originalLoadedSkinDataForComparison.previewBackUrl = previews.back;
        }
    }

    if (skinsTabMainContent) skinsTabMainContent.style.display = 'none';
    if (skinImportView && skinImportView.style.display !== 'none') hideSkinImportView(true);

    if (skinEditorFullView) {
        skinEditorFullView.style.display = 'flex'; 
        if(skinEditorNameInput) skinEditorNameInput.value = currentEditingSkinData.name;
        if(skinEditorTypeSelect) skinEditorTypeSelect.value = currentEditingSkinData.type;

        if (simpleSkinViewerCanvas) {
            const skinForViewer = { imageDataUrl: currentEditingSkinData.imageDataUrl, type: currentEditingSkinData.type };
            if (!simpleViewerControls) { 
                simpleViewerControls = initSimpleViewer(simpleSkinViewerCanvas, skinForViewer);
            } else { 
                simpleViewerControls.updateSkin(skinForViewer.imageDataUrl, skinForViewer.type);
            }
            if (simpleViewerControls && typeof simpleViewerControls.refreshLayout === 'function') {
                setTimeout(() => simpleViewerControls.refreshLayout(), 50);
            }
            simpleSkinViewerCanvas.style.display = 'block'; 
        }

        if (skinEditor2DFrontPreviewImg) skinEditor2DFrontPreviewImg.src = currentEditingSkinData.previewFrontUrl || PLACEHOLDER_PREVIEW;
        if (skinEditor2DBackPreviewImg) skinEditor2DBackPreviewImg.src = currentEditingSkinData.previewBackUrl || PLACEHOLDER_PREVIEW;
        if (skinEditorRawTexturePreviewImg) skinEditorRawTexturePreviewImg.src = currentEditingSkinData.imageDataUrl; 
    }
    currentSkinsTabView = 'editor'; 
    skinToEditOnTabReturnId = currentEditingSkinData.id; 
}

export function hideSkinEditorFullView(resetStateAndClearData = true) {
    if (skinEditorFullView) skinEditorFullView.style.display = 'none';
    
    // Only fully reset state if explicitly told (e.g., navigating away or completing action)
    // For 'beforeunload', we want to keep the state for saveSkinsTabState
    if (resetStateAndClearData) { 
        if (simpleViewerControls) {
            simpleViewerControls.dispose();
            simpleViewerControls = null;
        }
        skinToEditOnTabReturnId = null; 
        currentEditingSkinId = null; 
        currentEditingSkinData = null; 
        originalLoadedSkinDataForComparison = null;
    } 
    if(skinEditor2DFrontPreviewImg) skinEditor2DFrontPreviewImg.src = '#';
    if(skinEditor2DBackPreviewImg) skinEditor2DBackPreviewImg.src = '#';
    if(skinEditorRawTexturePreviewImg) skinEditorRawTexturePreviewImg.src = '#';
}

function showSkinImportView(restoreContext = false) { 
    if (skinsTabMainContent) skinsTabMainContent.style.display = 'none';
    if (skinEditorFullView && skinEditorFullView.style.display !== 'none') {
        hideSkinEditorFullView(true); 
    }
    if (skinImportView) skinImportView.style.display = 'flex'; 
    currentSkinsTabView = 'import';

    if (restoreContext && importContext.files.length > 0) { 
        if(skinImportAutoModeToggle) skinImportAutoModeToggle.checked = !importContext.isAutoMode; 
        loadSkinForImportView(importContext.currentIndex); 
    } else { 
        if(skinImportAutoModeToggle) skinImportAutoModeToggle.checked = false; 
        importContext.isAutoMode = !skinImportAutoModeToggle.checked; 
        importContext.currentIndex = 0; 
        importContext.files = []; 
        importContext.processedData = [];
        if(skinImportPreviewFrontImg) skinImportPreviewFrontImg.src = PLACEHOLDER_PREVIEW;
        if(skinImportPreviewBackImg) skinImportPreviewBackImg.src = PLACEHOLDER_PREVIEW;
        if(skinImportNameInput) skinImportNameInput.value = "";
        if(skinImportTypeSelect) skinImportTypeSelect.value = "steve"; 
        updateImportViewUI(); 
    }
}

function hideSkinImportView(isCancellationOrCompletion = true) { 
    if (skinImportView) skinImportView.style.display = 'none';
    
    if (isCancellationOrCompletion) { 
        importContext = { files: [], processedData: [], currentIndex: 0, isAutoMode: true };
        if (skinImportAutoModeToggle) skinImportAutoModeToggle.checked = false; 
        if (skinFileInput) skinFileInput.value = ''; 
    }
}

async function processSingleSkinData(index, fileToProcess) { 
    const file = fileToProcess || importContext.files[index]; 
    if (!file) return false;

    if (importContext.processedData[index] && importContext.processedData[index].imageDataUrl && importContext.processedData[index].file === file) {
        const currentData = importContext.processedData[index];
        if (currentData.userModified && (currentData.type !== currentData.previewsForType)) {
            console.log(`Regenerating previews for user-modified type: ${currentData.type}`);
            const previews = await generateSkinPreviews(currentData.imageDataUrl, currentData.type);
            currentData.previewFrontUrl = previews.front;
            currentData.previewBackUrl = previews.back;
            currentData.previewsForType = currentData.type;
        }
        return true; 
    }

    const imageDataUrl = await new Promise((resolve) => { 
        const reader = new FileReader();
        reader.onload = e => resolve(e.target.result);
        reader.onerror = (e) => { console.error(`File reading error for import: ${file.name}`, e); resolve(null); };
        reader.readAsDataURL(file);
    });

    if (!imageDataUrl) {
        importContext.processedData[index] = { file, imageDataUrl: null, name: `INVALID-${file.name}`, type: 'steve', userModified: false, autoDetectedType: 'steve', previewFrontUrl: PLACEHOLDER_PREVIEW, previewBackUrl: PLACEHOLDER_PREVIEW, previewsForType: 'steve' };
        return false; 
    }

    const autoDetectedType = await detectSkinTypeFromImageData(imageDataUrl);
    const previews = await generateSkinPreviews(imageDataUrl, autoDetectedType);

    importContext.processedData[index] = { 
        file: file, 
        imageDataUrl: imageDataUrl, 
        name: file.name.replace(/\.(png|jpg|jpeg)$/i, '').substring(0, 50), 
        type: autoDetectedType, 
        userModified: false, 
        autoDetectedType: autoDetectedType,
        previewFrontUrl: previews.front,
        previewBackUrl: previews.back,
        previewsForType: autoDetectedType 
    };
    return true;
}

async function startSkinImportProcess(filesFromInput) { 
    if (filesFromInput.length === 0) {
        updateImportViewUI(); 
        return;
    }
    
    importContext.files = Array.from(filesFromInput);
    importContext.processedData = new Array(filesFromInput.length).fill(null);
    importContext.currentIndex = 0;
    if(skinImportAutoModeToggle) {
        importContext.isAutoMode = !skinImportAutoModeToggle.checked; 
    } else {
        importContext.isAutoMode = true; 
    }
    
    await loadSkinForImportView(importContext.currentIndex); 
}

async function loadSkinForImportView(index) { 
    if (index < 0 || index >= importContext.files.length) {
        if (importContext.files.length === 0 && skinImportView.style.display === 'flex') { 
            if(skinImportPreviewFrontImg) skinImportPreviewFrontImg.src = PLACEHOLDER_PREVIEW;
            if(skinImportPreviewBackImg) skinImportPreviewBackImg.src = PLACEHOLDER_PREVIEW;
            if(skinImportNameInput) skinImportNameInput.value = "";
            if(skinImportTypeSelect) skinImportTypeSelect.value = "steve";
            updateImportViewUI(); 
        }
        return;
    }
    
    let skinData = importContext.processedData[index];
    if (!skinData || !skinData.imageDataUrl || skinData.file !== importContext.files[index]) { 
        const success = await processSingleSkinData(index, importContext.files[index]);
        if (!success) { 
            alert(`Could not process file: ${importContext.files[index].name}. It might be corrupted or unreadable.`); 
            if(skinImportPreviewFrontImg) skinImportPreviewFrontImg.src = PLACEHOLDER_PREVIEW;
            if(skinImportPreviewBackImg) skinImportPreviewBackImg.src = PLACEHOLDER_PREVIEW;
            updateImportViewUI(); 
            if(skinImportActionBtn && importContext.files.length === 1) skinImportActionBtn.disabled = true; 
            return; 
        }
        skinData = importContext.processedData[index]; 
    }
    
    if (skinImportPreviewFrontImg) skinImportPreviewFrontImg.src = skinData.previewFrontUrl || PLACEHOLDER_PREVIEW;
    if (skinImportPreviewBackImg) skinImportPreviewBackImg.src = skinData.previewBackUrl || PLACEHOLDER_PREVIEW;

    if (!importContext.isAutoMode) { 
        if(skinImportNameInput) skinImportNameInput.value = skinData.name; 
        if(skinImportTypeSelect) skinImportTypeSelect.value = skinData.type; 
    } else {
        if(skinImportNameInput) skinImportNameInput.value = ""; 
        if(skinImportTypeSelect) skinImportTypeSelect.value = skinData.autoDetectedType; 
    }
    updateImportViewUI();
}

function updateImportViewUI() { 
    const isMulti = importContext.files.length > 1;
    
    if (skinImportViewTitle) skinImportViewTitle.textContent = isMulti ? 'Import Skins' : 'Import Skin';
    if (skinImportMultiCounter) skinImportMultiCounter.style.display = isMulti ? 'block' : 'none';
    if (isMulti && skinImportCurrentNum && skinImportTotalNum) { 
        skinImportCurrentNum.textContent = importContext.files.length > 0 ? importContext.currentIndex + 1 : 0; 
        skinImportTotalNum.textContent = importContext.files.length; 
    }
    
    if (skinImportSelfModeControls) skinImportSelfModeControls.style.display = !importContext.isAutoMode ? 'flex' : 'none'; 
    
    if (skinImportBackBtn) {
        skinImportBackBtn.style.display = (isMulti && !importContext.isAutoMode && importContext.currentIndex > 0) ? 'inline-block' : 'none';
    }
    if (skinImportActionBtn) { 
        skinImportActionBtn.disabled = (importContext.files.length === 0);
        if (importContext.files.length === 0) { 
            skinImportActionBtn.textContent = 'Import Skin'; 
        } else if (isMulti) { 
            if (importContext.isAutoMode) { 
                skinImportActionBtn.textContent = 'Import All Skins'; 
            } else {  
                skinImportActionBtn.textContent = (importContext.currentIndex === importContext.files.length - 1) ? 'Import All Skins' : 'Next Skin'; 
            } 
        } else { 
            skinImportActionBtn.textContent = 'Import Skin'; 
        }
    }
}

async function handleImportViewAction() { 
    const currentIdx = importContext.currentIndex;

    if (currentIdx < 0 || currentIdx >= importContext.files.length) {
        if (importContext.files.length === 0) {
             alert("Please select files to import by clicking the main 'Import Skins' button again.");
        } else {
            console.warn("handleImportViewAction called with invalid index or no files.");
        }
        return;
    }
    
    if (!importContext.processedData[currentIdx] || !importContext.processedData[currentIdx].imageDataUrl || importContext.processedData[currentIdx].file !== importContext.files[currentIdx] ) {
        const success = await processSingleSkinData(currentIdx, importContext.files[currentIdx]);
        if (!success) {
            alert(`Cannot process current skin: ${importContext.files[currentIdx].name}. It may be skipped or an error occurred.`);
            if (importContext.isAutoMode || currentIdx === importContext.files.length - 1) {
                await finalizeAndImportSkins();
            } else { 
                importContext.currentIndex++;
                await loadSkinForImportView(importContext.currentIndex);
            }
            return;
        }
    }
    
    const currentData = importContext.processedData[currentIdx];
    if (!importContext.isAutoMode) { 
        const name = skinImportNameInput ? skinImportNameInput.value.trim() : currentData.name;
        if (!name && skinImportNameInput) { alert("Skin name cannot be empty in Self Mode."); return; }
        
        const oldType = currentData.type;
        currentData.name = name;
        currentData.type = skinImportTypeSelect ? skinImportTypeSelect.value : currentData.type;
        currentData.userModified = true; 
        
        if (currentData.type !== oldType || currentData.type !== currentData.previewsForType) {
            console.log(`Regenerating previews in self-mode due to type change for ${currentData.name}`);
            const previews = await generateSkinPreviews(currentData.imageDataUrl, currentData.type);
            currentData.previewFrontUrl = previews.front;
            currentData.previewBackUrl = previews.back;
            currentData.previewsForType = currentData.type; 
            if (skinImportPreviewFrontImg) skinImportPreviewFrontImg.src = currentData.previewFrontUrl;
            if (skinImportPreviewBackImg) skinImportPreviewBackImg.src = currentData.previewBackUrl;
        }
    }

    if (importContext.isAutoMode && importContext.files.length >= 1) { 
        if(skinImportActionBtn) { skinImportActionBtn.disabled = true; skinImportActionBtn.textContent = 'Processing...'; }
        for (let i = 0; i < importContext.files.length; i++) { 
            if (!importContext.processedData[i] || !importContext.processedData[i].imageDataUrl || importContext.processedData[i].file !== importContext.files[i]) { 
                await processSingleSkinData(i, importContext.files[i]); 
            }
        }
        if(skinImportActionBtn) skinImportActionBtn.disabled = false; 
        await finalizeAndImportSkins(); 
        return; 
    }
    
    if (!importContext.isAutoMode) {
        if (importContext.currentIndex < importContext.files.length - 1) { 
            importContext.currentIndex++;
            await loadSkinForImportView(importContext.currentIndex);
        } else { 
            await finalizeAndImportSkins();
        }
    }
}

async function handleImportViewBack() { 
    if (importContext.currentIndex > 0 && !importContext.isAutoMode) { 
        const currentData = importContext.processedData[importContext.currentIndex];
        if (currentData) { 
            const name = skinImportNameInput ? skinImportNameInput.value.trim() : currentData.name;
            const oldType = currentData.type;

            currentData.name = name || currentData.name; 
            currentData.type = skinImportTypeSelect ? skinImportTypeSelect.value : currentData.type;
            currentData.userModified = true;

            if (currentData.type !== oldType || currentData.type !== currentData.previewsForType) {
                 console.log(`Regenerating previews (back button) for ${currentData.name}`);
                const previews = await generateSkinPreviews(currentData.imageDataUrl, currentData.type);
                currentData.previewFrontUrl = previews.front;
                currentData.previewBackUrl = previews.back;
                currentData.previewsForType = currentData.type;
            }
        }
        importContext.currentIndex--; 
        await loadSkinForImportView(importContext.currentIndex); 
    }
}

async function getNextAvailableSkinName(db, baseName = "Skin ", existingNamesInBatch = new Set()) {
    const transaction = db.transaction(SKINS_STORE_NAME, 'readonly');
    const store = transaction.objectStore(SKINS_STORE_NAME);
    const getAllSkinsRequest = store.getAll();

    return new Promise((resolve) => {
        getAllSkinsRequest.onsuccess = () => {
            const existingSkinsFromDB = getAllSkinsRequest.result;
            const existingDBNames = new Set(existingSkinsFromDB.map(s => s.name));
            
            let counter = 1;
            let nextName = `${baseName}${counter}`;
            while (existingDBNames.has(nextName) || existingNamesInBatch.has(nextName)) {
                counter++;
                nextName = `${baseName}${counter}`;
            }
            resolve(nextName);
        };
        getAllSkinsRequest.onerror = (event) => {
            console.error("Error fetching existing skin names for auto-naming:", event.target.error);
            let counter = 1;
            let nextName = `${baseName}${counter}`;
            while(existingNamesInBatch.has(nextName)){ 
                counter++;
                nextName = `${baseName}${counter}`;
            }
            resolve(nextName); 
        };
    });
}

async function finalizeAndImportSkins() { 
    const db = getDbInstance(); if (!db) { alert("Database error."); showSkinsTabMainContent(); return; }
    
    const skinsToSave = [];
    const namesAssignedInThisBatch = new Set(); 

    for (let i = 0; i < importContext.processedData.length; i++) { 
        const data = importContext.processedData[i];
        if (!data || !data.imageDataUrl) {
            console.warn(`Skipping data for skin at index ${i} due to missing imageDataUrl.`);
            continue;
        }

        let nameToSave = data.name;
        let typeToSave = data.type; 

        if (importContext.isAutoMode) {
            nameToSave = await getNextAvailableSkinName(db, "Skin ", namesAssignedInThisBatch);
            namesAssignedInThisBatch.add(nameToSave); 
            typeToSave = data.autoDetectedType || 'steve'; 
        } else { 
            if (!nameToSave) { 
                nameToSave = data.file ? data.file.name.replace(/\.(png|jpg|jpeg)$/i, '').substring(0,50) : `Imported Skin ${i + 1}`;
            }
        }
        
        let previewFront = data.previewFrontUrl;
        let previewBack = data.previewBackUrl;
        if (!previewFront || !previewBack || typeToSave !== data.previewsForType ) {
            console.log(`Finalizing: Regenerating previews for ${nameToSave} with type ${typeToSave}`);
            const previews = await generateSkinPreviews(data.imageDataUrl, typeToSave);
            previewFront = previews.front;
            previewBack = previews.back;
        }

        skinsToSave.push({ 
            name: nameToSave, 
            type: typeToSave, 
            imageDataUrl: data.imageDataUrl,
            previewFrontUrl: previewFront,
            previewBackUrl: previewBack,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        }); 
    }

    if (skinsToSave.length === 0) { 
        alert("No valid skins to import.");
        showSkinsTabMainContent(); 
        return; 
    }
    
    try {
        const transaction = db.transaction(SKINS_STORE_NAME, 'readwrite'); 
        const store = transaction.objectStore(SKINS_STORE_NAME); 
        let importCount = 0; let errorCount = 0;
        
        const promises = skinsToSave.map(skin => {
            return new Promise((resolve) => { 
                const addReq = store.add(skin); 
                addReq.onsuccess = () => { importCount++; resolve({status: 'fulfilled'}); }; 
                addReq.onerror = (e) => { errorCount++; console.error("Error adding skin to DB:", skin.name, e.target.error); resolve({status: 'rejected', reason: e.target.error}); };
            });
        });

        await Promise.allSettled(promises); 

        let message = `${importCount} skin(s) imported successfully!`; 
        if (errorCount > 0) { message += ` ${errorCount} skin(s) failed to import due to database errors.`; } 
        alert(message); 
        
        showSkinsTabMainContent(false); 

    } catch (error) { 
        alert("An exception occurred during import. Check console."); 
        console.error("Exception during finalizeAndImportSkins:", error); 
        showSkinsTabMainContent(false); 
    }
}

async function saveEditedSkinInFullViewEditor() {
    const db = getDbInstance();
    if (!currentEditingSkinId || !db || !skinEditorNameInput || !skinEditorTypeSelect || !currentEditingSkinData ) {
        console.warn("Save condition not met in saveEditedSkinInFullViewEditor", {currentEditingSkinId, dbExists: !!db, inputsExist: !!skinEditorNameInput, dataExists: !!currentEditingSkinData});
        return false; 
    }
    
    const newName = skinEditorNameInput.value.trim();
    const newType = skinEditorTypeSelect.value;
    if (!newName) { alert("Skin name cannot be empty."); return false; }

    currentEditingSkinData.name = newName;
    const typeChanged = currentEditingSkinData.type !== newType;
    currentEditingSkinData.type = newType;
    
    const imageDataChanged = originalLoadedSkinDataForComparison ? currentEditingSkinData.imageDataUrl !== originalLoadedSkinDataForComparison.imageDataUrl : true;

    if (typeChanged || imageDataChanged || !currentEditingSkinData.previewFrontUrl || !currentEditingSkinData.previewBackUrl) { 
        console.log("Regenerating previews for Skins tab save (saveEditedSkinInFullViewEditor).");
        const previews = await generateSkinPreviews(currentEditingSkinData.imageDataUrl, currentEditingSkinData.type);
        currentEditingSkinData.previewFrontUrl = previews.front;
        currentEditingSkinData.previewBackUrl = previews.back;
    }
    currentEditingSkinData.updatedAt = new Date().toISOString(); 

    try {
        const transaction = db.transaction(SKINS_STORE_NAME, 'readwrite');
        const store = transaction.objectStore(SKINS_STORE_NAME);
        const skinToPutInDB = { ...currentEditingSkinData, id: currentEditingSkinId };
        const request = store.put(skinToPutInDB); 
        
        return new Promise((resolve) => {
            request.onsuccess = () => {
                console.log("Skin updated in DB from Skins Tab Editor:", currentEditingSkinId);
                originalLoadedSkinDataForComparison = JSON.parse(JSON.stringify(currentEditingSkinData)); 
                resolve(true); 
            };
            request.onerror = (e) => {
                console.error("Error updating skin from Skins Tab Editor:", e.target.error);
                alert("Error saving skin: " + e.target.error.message);
                resolve(false); 
            };
        });
    } catch (error) { 
        console.error("Exception during full editor save:", error); 
        alert("Exception saving skin: " + error.message);
        return false; 
    }
}

function downloadSkin(skinData) { 
    if (!skinData || !skinData.imageDataUrl || !skinData.name) { console.error("Invalid skin data for download."); return; }
    const link = document.createElement('a'); link.href = skinData.imageDataUrl;
    const safeName = skinData.name.replace(/[^a-z0-9_.-]/gi, '_') || 'skin';
    link.download = `${safeName}.png`; document.body.appendChild(link); link.click(); document.body.removeChild(link);
}

async function deleteSkinInEditor() {
    if (!currentEditingSkinId) return;
    const skinIdToDelete = currentEditingSkinId; 

    const db = getDbInstance();
    if (!db) { alert("Database error."); return; }
    if (!confirm("Are you sure you want to delete this skin? This action cannot be undone.")) return;
    
    try {
        const transaction = db.transaction(SKINS_STORE_NAME, 'readwrite');
        const store = transaction.objectStore(SKINS_STORE_NAME);
        const request = store.delete(skinIdToDelete);
        request.onsuccess = () => {
            console.log("Skin deleted:", skinIdToDelete);
            showSkinsTabMainContent(false); 
        };
        request.onerror = (event) => console.error("Error deleting skin:", event.target.error);
    } catch (error) { console.error("Error during delete transaction:", error); }
}

export async function loadAndDisplaySkins(searchTerm = "") { 
    const db = getDbInstance();
    if (!db) { if (skinsDisplayArea) skinsDisplayArea.innerHTML = '<p>Database not ready.</p>'; return; }
    if (!skinsDisplayArea) return;

    skinsDisplayArea.innerHTML = ''; 
    const loadingMessage = document.createElement('p');
    loadingMessage.textContent = searchTerm ? 'Searching skins...' : 'Loading skin previews...';
    skinsDisplayArea.appendChild(loadingMessage);
    
    const transaction = db.transaction(SKINS_STORE_NAME, 'readonly');
    const store = transaction.objectStore(SKINS_STORE_NAME);
    const getAllRequest = store.getAll();

    getAllRequest.onsuccess = async () => { 
        let skins = getAllRequest.result.sort((a,b) => {
            const dateA = a.updatedAt || a.createdAt || 0;
            const dateB = b.updatedAt || b.createdAt || 0;
            return new Date(dateB) - new Date(dateA);
        });
        if (searchTerm) { skins = skins.filter(skin => skin.name.toLowerCase().includes(searchTerm.toLowerCase())); }

        skinsDisplayArea.innerHTML = '';

        if (skins.length === 0) { 
            skinsDisplayArea.innerHTML = searchTerm ? '<p>No skins match your search.</p>' : '<p>No skins imported yet.</p>';
            return;
        }
        
        const fragment = document.createDocumentFragment();

        for (const skin of skins) { 
            const skinItem = document.createElement('div'); 
            skinItem.className = 'skin-item';
            const safeAltName = skin.name.replace(/"/g, '"');

            let frontSrc = skin.previewFrontUrl || PLACEHOLDER_PREVIEW;
            let backSrc = skin.previewBackUrl || PLACEHOLDER_PREVIEW;

            skinItem.innerHTML = `
                <div class="skin-image-container">
                    <img src="${PLACEHOLDER_PREVIEW}" data-src-front="${frontSrc}" alt="${safeAltName} - Front View" class="skin-preview-front">
                    <img src="${PLACEHOLDER_PREVIEW}" data-src-back="${backSrc}" alt="${safeAltName} - Back View" class="skin-preview-back">
                </div>
                <p class="skin-name">${skin.name}</p>
                <div class="skin-item-actions">
                    <button class="action-button download-btn">Download</button>
                    <button class="action-button edit-btn">Edit</button>
                    <button class="action-button delete-btn">Delete</button>
                </div>`;
            
            const frontPreviewImgElem = skinItem.querySelector('.skin-preview-front');
            const backPreviewImgElem = skinItem.querySelector('.skin-preview-back');

            if (skin.previewFrontUrl && skin.previewBackUrl) {
                frontPreviewImgElem.src = skin.previewFrontUrl;
                backPreviewImgElem.src = skin.previewBackUrl;
            } else {
                generateSkinPreviews(skin.imageDataUrl, skin.type).then(previews => {
                    frontPreviewImgElem.src = previews.front;
                    backPreviewImgElem.src = previews.back;
                    
                    const updateTx = db.transaction(SKINS_STORE_NAME, 'readwrite');
                    const updateStore = updateTx.objectStore(SKINS_STORE_NAME);
                    const skinToUpdate = { ...skin, previewFrontUrl: previews.front, previewBackUrl: previews.back };
                    updateStore.put(skinToUpdate).onerror = (e) => console.error("Failed to cache previews for skin:", skin.id, e);
                }).catch(err => {
                    console.error("Error generating previews for skin:", skin.id, err);
                    frontPreviewImgElem.src = PLACEHOLDER_PREVIEW; 
                    backPreviewImgElem.src = PLACEHOLDER_PREVIEW;
                });
            }
            
            fragment.appendChild(skinItem);

            if (frontPreviewImgElem) {
                frontPreviewImgElem.addEventListener('click', (e) => {
                    e.stopPropagation(); 
                    if (frontPreviewImgElem.src && frontPreviewImgElem.src !== '#' && frontPreviewImgElem.src !== PLACEHOLDER_PREVIEW) {
                        openLargeSkinPreview(frontPreviewImgElem.src);
                    }
                });
            }
            if (backPreviewImgElem) {
                backPreviewImgElem.addEventListener('click', (e) => {
                    e.stopPropagation(); 
                    if (backPreviewImgElem.src && backPreviewImgElem.src !== '#' && backPreviewImgElem.src !== PLACEHOLDER_PREVIEW) {
                        openLargeSkinPreview(backPreviewImgElem.src);
                    }
                });
            }
            const editBtn = skinItem.querySelector('.edit-btn');
            if (editBtn) editBtn.addEventListener('click', () => showSkinEditorFullView(skin.id)); 
            const deleteBtn = skinItem.querySelector('.delete-btn');
            if (deleteBtn) deleteBtn.addEventListener('click', async () => {
                 if (!confirm("Are you sure you want to delete this skin from the list?")) return;
                 const db = getDbInstance(); if (!db) return;
                 const tx = db.transaction(SKINS_STORE_NAME, 'readwrite');
                 const req = tx.objectStore(SKINS_STORE_NAME).delete(skin.id);
                 req.onsuccess = () => loadAndDisplaySkins(skinsSearchInput ? skinsSearchInput.value : ""); 
                 req.onerror = (e) => console.error("Error deleting skin from list:", e.target.error);
            });
            const downloadBtn = skinItem.querySelector('.download-btn');
            if (downloadBtn) downloadBtn.addEventListener('click', () => downloadSkin(skin));
        }
        skinsDisplayArea.appendChild(fragment); 
    };
    getAllRequest.onerror = (event) => { 
        console.error("Error fetching skins:", event.target.error); 
        skinsDisplayArea.innerHTML = '<p>Error loading skins.</p>'; 
    };
}

async function onSkinsTabActivated(isDirectNavigationOrSameTabClick = false) {
    const skinIdToOpenFromEditorStr = localStorage.getItem('skinToOpenInSkinsTabAfterEditorSave');
    const pendingChangesKeyBase = 'pendingEditorChanges_';

    if (skinIdToOpenFromEditorStr) { // Highest priority: returning from main editor
        const skinIdToReopen = parseInt(skinIdToOpenFromEditorStr);
        const pendingChangesJSON = localStorage.getItem(pendingChangesKeyBase + skinIdToReopen);
        
        localStorage.removeItem('skinToOpenInSkinsTabAfterEditorSave');
        localStorage.removeItem(pendingChangesKeyBase + skinIdToReopen);
        localStorage.removeItem('skinToEditInFullEditorId'); 

        if (!pendingChangesJSON) {
            console.error("Error: Pending changes from editor not found for skin ID:", skinIdToReopen);
            showSkinsTabMainContent(isDirectNavigationOrSameTabClick);
            return;
        }
        const pendingEditorChanges = JSON.parse(pendingChangesJSON);
        let proceedToOpenTargetSkin = true;

        // Check for unsaved changes in the *current* simple editor view if it was active for a *different* skin
        if (currentSkinsTabView === 'editor' && currentEditingSkinId && originalLoadedSkinDataForComparison && currentEditingSkinId !== skinIdToReopen) {
            const nameChangedInSkinsEditor = skinEditorNameInput && (skinEditorNameInput.value.trim() !== originalLoadedSkinDataForComparison.name);
            const typeChangedInSkinsEditor = skinEditorTypeSelect && (skinEditorTypeSelect.value !== originalLoadedSkinDataForComparison.type);

            if (nameChangedInSkinsEditor || typeChangedInSkinsEditor) {
                if (confirm(`You have unsaved name/type changes for '${originalLoadedSkinDataForComparison.name}'. Save them before opening the skin edited in the main editor?`)) {
                    const savedSuccessfully = await saveEditedSkinInFullViewEditor();
                    if (!savedSuccessfully) {
                        alert("Failed to save changes to the currently open skin. The action to open the edited skin from the main editor will be cancelled.");
                        proceedToOpenTargetSkin = false; 
                    }
                }
            }
             // Always hide, regardless of save, if proceeding to open target or cancelling that action
            if (proceedToOpenTargetSkin) hideSkinEditorFullView(true);
        } else if (currentSkinsTabView === 'editor' && currentEditingSkinId === skinIdToReopen) {
             hideSkinEditorFullView(true); // Hide if it was already showing the same skin
        } else if (skinEditorFullView && skinEditorFullView.style.display === 'flex' && currentSkinsTabView !== 'editor') { 
            hideSkinEditorFullView(true); // Hide if it was open but tab view was something else
        }


        if (proceedToOpenTargetSkin) {
            const db = getDbInstance();
            if (!db) { showSkinsTabMainContent(isDirectNavigationOrSameTabClick); return; }

            const tx = db.transaction(SKINS_STORE_NAME, 'readonly');
            const store = tx.objectStore(SKINS_STORE_NAME);
            const getReq = store.get(skinIdToReopen);

            getReq.onsuccess = async () => {
                let skinDataFromDb = getReq.result;
                if (skinDataFromDb) {
                    // Apply pending changes from main editor to the data before showing
                    skinDataFromDb.imageDataUrl = pendingEditorChanges.imageDataUrl;
                    skinDataFromDb.type = pendingEditorChanges.type; // Main editor might have changed type
                    // Name is not directly edited in main editor, so keep DB name or let simple editor handle it
                    
                    console.log("Skins Module (onSkinsTabActivated): Regenerating previews after returning from main editor.");
                    const previews = await generateSkinPreviews(skinDataFromDb.imageDataUrl, skinDataFromDb.type);
                    skinDataFromDb.previewFrontUrl = previews.front;
                    skinDataFromDb.previewBackUrl = previews.back;
                    
                    // currentEditingSkinData will be set by showSkinEditorFullView
                    // originalLoadedSkinDataForComparison should also be reset by showSkinEditorFullView
                    // for this new context.
                    await showSkinEditorFullView(skinDataFromDb); 
                } else {
                    alert("Error: Could not find the skin (ID: " + skinIdToReopen + ") to reopen. Displaying main skins list.");
                    showSkinsTabMainContent(isDirectNavigationOrSameTabClick);
                }
            };
            getReq.onerror = (e) => {
                console.error("Error fetching skin to reopen:", e);
                showSkinsTabMainContent(isDirectNavigationOrSameTabClick);
            };
        } else {
             // If we didn't proceed to open target skin, ensure we're in a sensible state.
             // If not already in main or editor view (e.g. import), switch to main.
            if(currentSkinsTabView !== 'main' && currentSkinsTabView !== 'editor') {
                 showSkinsTabMainContent(isDirectNavigationOrSameTabClick);
            } else if (currentSkinsTabView === 'editor' && !skinToEditOnTabReturnId) { // If was editor but now no target
                showSkinsTabMainContent(isDirectNavigationOrSameTabClick);
            }
            // If it was editor and still has a target, it will remain on that editor view.
        }

    } else if (persistentStateJustLoaded) { // Second priority: restoring from browser close
        console.log("SkinsTab: Activating based on persistentStateJustLoaded.");
        persistentStateJustLoaded = false; // Consume the flag

        if (currentSkinsTabView === 'editor' && (currentEditingSkinData || skinToEditOnTabReturnId)) {
            // originalLoadedSkinDataForComparison should have been restored by loadAndApplySkinsTabState
            await showSkinEditorFullView(currentEditingSkinData || skinToEditOnTabReturnId);
        } else if (currentSkinsTabView === 'import') {
            showSkinImportView(true); // true to restore from the restored importContext
        } else { // 'main' or default
            showSkinsTabMainContent(false); // false to keep search term if any was restored
        }
    } else { // Default behavior for subsequent tab clicks or no special state
        if (currentSkinsTabView === 'editor' && (currentEditingSkinData || skinToEditOnTabReturnId)) {
            await showSkinEditorFullView(currentEditingSkinData || skinToEditOnTabReturnId); 
        } else if (currentSkinsTabView === 'import' && (importContext.files.length > 0 || (importContext.processedData && importContext.processedData.some(d => d !==null)))) { 
            showSkinImportView(true); 
        } else { 
            // This path handles normal tab clicks after initial load/restore
            // or if isDirectNavigationOrSameTabClick is true (e.g. clicking same tab again)
            currentSkinsTabView = 'main'; 
            skinToEditOnTabReturnId = null; 
            // currentEditingSkinData/originalLoaded are reset by hideSkinEditorFullView if called
            // importContext is reset by hideSkinImportView if called
            showSkinsTabMainContent(isDirectNavigationOrSameTabClick); // Reset search if direct nav
        }
    }
}


let searchDebounceTimer;
export function initSkinsTab() {
    loadAndApplySkinsTabState(); // Load persistent state early

    registerHideSkinEditorFullView((isBeingFullyHiddenDueToTabSwitch) => { 
        // This callback might be less critical now with `beforeunload` saving state
    }); 
    registerSkinsTabActivated(onSkinsTabActivated);

    if (importSkinsBtn) {
        importSkinsBtn.onclick = () => {
            if (currentSkinsTabView === 'editor' && currentEditingSkinId && originalLoadedSkinDataForComparison && skinEditorNameInput && skinEditorTypeSelect) {
                 const nameChanged = skinEditorNameInput.value.trim() !== originalLoadedSkinDataForComparison.name;
                 const typeChanged = skinEditorTypeSelect.value !== originalLoadedSkinDataForComparison.type;
                 const imageChanged = currentEditingSkinData && currentEditingSkinData.imageDataUrl !== originalLoadedSkinDataForComparison.imageDataUrl;
                 if(nameChanged || typeChanged || imageChanged) {
                     if(!confirm("You have unsaved changes in the skin editor. Discard and proceed with import?")) {
                         return;
                     }
                 }
            }
            showSkinImportView(false); 
            skinFileInput.click();     
        };
    }

    if (skinFileInput) { skinFileInput.onchange = (event) => { startSkinImportProcess(event.target.files); skinFileInput.value = ''; }; }
    
    if (skinsSearchInput) {
        skinsSearchInput.addEventListener('input', (e) => {
            clearTimeout(searchDebounceTimer);
            searchDebounceTimer = setTimeout(() => {
                if (currentSkinsTabView === 'main') { 
                    loadAndDisplaySkins(e.target.value);
                }
            }, 300); 
        });
    }

    if (downloadAllSkinsBtn) { 
        downloadAllSkinsBtn.onclick = async () => {
            const db = getDbInstance(); if (!db) { alert("DB not ready."); return; }
            const transaction = db.transaction(SKINS_STORE_NAME, 'readonly'); const store = transaction.objectStore(SKINS_STORE_NAME);
            const getAllReq = store.getAll(); 
            getAllReq.onsuccess = () => { const skins = getAllReq.result; if (skins.length === 0) { alert("No skins to download."); return; } skins.forEach(skin => downloadSkin(skin)); };
            getAllReq.onerror = () => alert("Error fetching skins for download.");
        };
    }
    
    if (skinEditorSaveBtn) skinEditorSaveBtn.onclick = async () => {
        const saved = await saveEditedSkinInFullViewEditor();
        if (saved) {
            showSkinsTabMainContent(false); 
            localStorage.removeItem('editorTabDraftState'); // Clear main editor draft on save here
            localStorage.removeItem('skinToEditInFullEditorId');
            localStorage.removeItem('pendingFullEditorSkinData');
        }
    };
    if (skinEditorCancelBtn) skinEditorCancelBtn.onclick = () => {
        localStorage.removeItem('skinToOpenInSkinsTabAfterEditorSave'); 
        if(currentEditingSkinId) localStorage.removeItem(`pendingEditorChanges_${currentEditingSkinId}`); 
        showSkinsTabMainContent(false); 
        localStorage.removeItem('editorTabDraftState');
        localStorage.removeItem('skinToEditInFullEditorId');
        localStorage.removeItem('pendingFullEditorSkinData');
    };
    
    if (skinEditorDownloadBtn) {
        skinEditorDownloadBtn.onclick = () => {
            if (currentEditingSkinData) { 
                downloadSkin(currentEditingSkinData);
            }
        };
    }
    if (skinEditorDeleteBtn) skinEditorDeleteBtn.onclick = async () => {
        await deleteSkinInEditor(); 
        localStorage.removeItem('editorTabDraftState');
        localStorage.removeItem('skinToEditInFullEditorId');
        localStorage.removeItem('pendingFullEditorSkinData');
    };

    if (skinEditorEditInFullEditorBtn) {
        skinEditorEditInFullEditorBtn.onclick = () => {
            if (currentEditingSkinData && currentEditingSkinData.id && skinEditorNameInput && skinEditorTypeSelect) { 
                let sendCurrentInMemoryDataToMainEditor = false;
                const currentNameInSimpleEditor = skinEditorNameInput.value.trim();
                const currentTypeInSimpleEditor = skinEditorTypeSelect.value;
                
                let hasUnsavedChangesInSimpleEditor = false;
                if (originalLoadedSkinDataForComparison) {
                    if (currentNameInSimpleEditor !== originalLoadedSkinDataForComparison.name ||
                        currentTypeInSimpleEditor !== originalLoadedSkinDataForComparison.type ||
                        (currentEditingSkinData && currentEditingSkinData.imageDataUrl !== originalLoadedSkinDataForComparison.imageDataUrl) ) { // Check image data too
                        hasUnsavedChangesInSimpleEditor = true;
                    }
                } else { 
                    hasUnsavedChangesInSimpleEditor = true; 
                }

                if (hasUnsavedChangesInSimpleEditor) {
                    if (confirm("You have changes in this editor view (name, type, or texture from a previous main editor session). Send these current changes to the main editor? \n\n- Click 'OK' to send current changes. \n- Click 'Cancel' to load the last *database saved* version into the main editor.")) {
                        sendCurrentInMemoryDataToMainEditor = true;
                    } else {
                        sendCurrentInMemoryDataToMainEditor = false;
                    }
                } else {
                    sendCurrentInMemoryDataToMainEditor = true; 
                }

                if (sendCurrentInMemoryDataToMainEditor) {
                    // Ensure currentEditingSkinData reflects the latest from inputs before saving
                    const dataToSend = {
                        ...currentEditingSkinData, 
                        name: currentNameInSimpleEditor, // Use current input value
                        type: currentTypeInSimpleEditor, // Use current select value
                        imageDataUrl: currentEditingSkinData.imageDataUrl // This should be up-to-date if returned from main editor
                    };
                    localStorage.setItem('pendingFullEditorSkinData', JSON.stringify(dataToSend));
                } else {
                    localStorage.removeItem('pendingFullEditorSkinData'); // Load from DB in main editor
                }
                
                localStorage.setItem('skinToEditInFullEditorId', currentEditingSkinData.id.toString());
                
                const editorNavLink = document.querySelector('header .nav-link[href="#editor"]');
                if (editorNavLink) {
                    editorNavLink.click(); 
                } else {
                    window.location.hash = '#editor'; 
                }
            } else {
                alert("Cannot edit in main editor: No skin loaded or skin has no ID.");
            }
        };
    }
    
    if(skinEditor2DFrontPreviewImg) skinEditor2DFrontPreviewImg.onclick = () => { if(currentEditingSkinData && skinEditor2DFrontPreviewImg.src !== '#' && skinEditor2DFrontPreviewImg.src !== PLACEHOLDER_PREVIEW) openLargeSkinPreview(skinEditor2DFrontPreviewImg.src);};
    if(skinEditor2DBackPreviewImg) skinEditor2DBackPreviewImg.onclick = () => { if(currentEditingSkinData && skinEditor2DBackPreviewImg.src !== '#' && skinEditor2DBackPreviewImg.src !== PLACEHOLDER_PREVIEW) openLargeSkinPreview(skinEditor2DBackPreviewImg.src);};
    if(skinEditorRawTexturePreviewImg) skinEditorRawTexturePreviewImg.onclick = () => { if(currentEditingSkinData) openLargeSkinPreview(currentEditingSkinData.imageDataUrl);};

    if (skinImportAutoModeToggle) { 
        skinImportAutoModeToggle.onchange = async () => { 
            importContext.isAutoMode = !skinImportAutoModeToggle.checked; 
            if (importContext.files[importContext.currentIndex] && importContext.processedData[importContext.currentIndex]) { 
                const currentSkinData = importContext.processedData[importContext.currentIndex];
                if (importContext.isAutoMode) { 
                    if(skinImportNameInput) skinImportNameInput.value = ""; 
                    if(skinImportTypeSelect) skinImportTypeSelect.value = currentSkinData.autoDetectedType || 'steve';
                } else { 
                    if(skinImportNameInput) skinImportNameInput.value = currentSkinData.name;
                    if(skinImportTypeSelect) skinImportTypeSelect.value = currentSkinData.type;
                }
            } else if (importContext.files[importContext.currentIndex]) { 
                await loadSkinForImportView(importContext.currentIndex); 
            }
            updateImportViewUI(); 
        };
    }
    if (skinImportCancelBtn) skinImportCancelBtn.onclick = () => {
        showSkinsTabMainContent(); 
    }; 
    if (skinImportActionBtn) skinImportActionBtn.onclick = handleImportViewAction; 
    if (skinImportBackBtn) skinImportBackBtn.onclick = handleImportViewBack;
    
    if (skinImportPreviewFrontImg) skinImportPreviewFrontImg.addEventListener('click', () => { 
        const skinData = importContext.processedData[importContext.currentIndex];
        if (skinData && skinData.previewFrontUrl && skinData.previewFrontUrl !== PLACEHOLDER_PREVIEW) { 
            openLargeSkinPreview(skinData.previewFrontUrl); 
        } else if (skinData && skinData.imageDataUrl){ 
             openLargeSkinPreview(skinData.imageDataUrl);
        }
    });
    if (skinImportPreviewBackImg) skinImportPreviewBackImg.addEventListener('click', () => { 
        const skinData = importContext.processedData[importContext.currentIndex];
        if (skinData && skinData.previewBackUrl && skinData.previewBackUrl !== PLACEHOLDER_PREVIEW) { 
            openLargeSkinPreview(skinData.previewBackUrl); 
        } else if (skinData && skinData.imageDataUrl){ 
            openLargeSkinPreview(skinData.imageDataUrl);
        }
    });

    window.addEventListener('beforeunload', saveSkinsTabState);
}