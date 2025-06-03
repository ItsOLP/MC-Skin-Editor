import { getDbInstance, SKINS_STORE_NAME, SKIN_PACKS_STORE_NAME, getSkinPackById, getSkinPackByUUID, getSkinPackByName } from './db.js';
import { openLargeSkinPreview, registerHideSkinPackCreator, registerSkinPacksTabActivated } from './ui.js';
import { generateUUID, dataURLToBlob } from './utils.js';
import { generateSkinPreviews } from './skin-preview-renderer.js'; 

// --- Constants ---
const PLACEHOLDER_PREVIEW_PACK = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";


// --- Skin Type Detection ---
async function detectSkinTypeFromImageDataLocal(imageDataUrl) {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            let analysisCanvas = document.createElement('canvas');
            let analysisCtx = analysisCanvas.getContext('2d');
            if (!analysisCtx) { resolve('steve'); return; }
            analysisCtx.imageSmoothingEnabled = false;
            analysisCanvas.width = img.width;
            analysisCanvas.height = img.height;
            analysisCtx.drawImage(img, 0, 0);
            if (img.width === 64 && img.height === 32) { resolve('steve'); return; }
            if (img.width !== 64 || img.height !== 64) { resolve('steve'); return; }
            const checkX = 50, checkY = 19;
            try {
                const pixelData = analysisCtx.getImageData(checkX, checkY, 1, 1).data;
                resolve(pixelData[3] === 0 ? 'alex' : 'steve');
            } catch (e) { resolve('steve'); }
        };
        img.onerror = () => resolve('steve');
        img.src = imageDataUrl;
    });
}

// DOM Elements
const skinPacksMainView = document.getElementById('skin-packs-main-view');
export const createSkinPackView = document.getElementById('create-skin-pack-view');
const newSkinPackBtn = document.getElementById('new-skin-pack-btn');
const importSkinPacksBtn = document.getElementById('import-skin-packs-btn');
const skinPackFileInput = document.getElementById('skin-pack-file-input');
const downloadAllSkinPacksBtn = document.getElementById('download-all-skin-packs-btn');
export const skinPacksDisplayArea = document.getElementById('skin-packs-display-area');
const skinPacksSearchInput = document.getElementById('skin-packs-search-input');
const skinPackCreatorHeader = document.getElementById('skin-pack-creator-header');
const packNameInput = document.getElementById('pack-name-input');
const packDescriptionInput = document.getElementById('pack-description-input');
const packSkinSourceToggle = document.getElementById('pack-skin-source-toggle'); 
const packFromDeviceOptionsDiv = document.getElementById('pack-from-device-options');
const packDeviceSkinFilesInput = document.getElementById('pack-device-skin-files');
const packFromMySkinsOptionsDiv = document.getElementById('pack-from-my-skins-options');
const packAvailableSkinsSearchInput = document.getElementById('pack-available-skins-search');
const packAvailableSkinsListDiv = document.getElementById('pack-available-skins-list');
const packMySkinsManagementToggleContainer = document.getElementById('pack-my-skins-management-toggle-container');
const packMySkinsUseExistingToggle = document.getElementById('pack-my-skins-use-existing-toggle'); 
const packSkinAutoModeToggle = document.getElementById('pack-skin-auto-mode-toggle'); 
const packSelfModeSkinProcessorDiv = document.getElementById('pack-self-mode-skin-processor');
const packSelfModeProcessorTitle = document.getElementById('pack-self-mode-processor-title'); 
const packSelfModeCurrentNumSpan = document.getElementById('pack-self-mode-current-num');
const packSelfModeTotalNumSpan = document.getElementById('pack-self-mode-total-num');
const packSelfModePreviewFrontImg = document.getElementById('pack-self-mode-preview-front-img');
const packSelfModePreviewBackImg = document.getElementById('pack-self-mode-preview-back-img');
const packSelfModeSkinNameInput = document.getElementById('pack-self-mode-skin-name');
const packSelfModeSkinTypeSelect = document.getElementById('pack-self-mode-skin-type');
const packSelfModeCancelAllBtn = document.getElementById('pack-self-mode-cancel-all-btn');
const packSelfModeBackBtn = document.getElementById('pack-self-mode-back-btn');
const packSelfModeNextBtn = document.getElementById('pack-self-mode-next-btn');
const packAddClearActionsDiv = document.getElementById('pack-add-clear-actions');
const packClearSelectedSkinsBtn = document.getElementById('pack-clear-selected-skins-btn');
const packAddProcessedSkinsBtn = document.getElementById('pack-add-processed-skins-btn');
const currentPackSkinsSearchInput = document.getElementById('current-pack-skins-search');
const currentPackSkinsPreviewDiv = document.getElementById('current-pack-skins-preview');
const currentPackSkinCountSpan = document.getElementById('current-pack-skin-count');
const cancelPackCreationBtn = document.getElementById('cancel-pack-creation-btn');
const savePackBtn = document.getElementById('save-pack-btn');
const saveDownloadPackBtn = document.getElementById('save-download-pack-btn');
export const editSkinInPackModal = document.getElementById('edit-skin-in-pack-modal');
const closeEditSkinInPackModalBtn = document.getElementById('close-edit-skin-in-pack-modal-btn');
const editSkinInPackPreviewFrontImg = document.getElementById('edit-skin-in-pack-preview-front-img'); 
const editSkinInPackPreviewBackImg = document.getElementById('edit-skin-in-pack-preview-back-img');   
const editSkinInPackNameInput = document.getElementById('edit-skin-in-pack-name');
const editSkinInPackTypeSelect = document.getElementById('edit-skin-in-pack-type');
const cancelEditSkinInPackBtn = document.getElementById('cancel-edit-skin-in-pack-btn');
const saveEditSkinInPackBtn = document.getElementById('save-edit-skin-in-pack-btn');

// --- Module State for UI Persistence ---
let currentSkinPacksTabView = 'main'; 
let packCreatorContext = {
    editingPackId: null,
    originalPackDataForEdit: null, 
    packName: '',
    packDescription: '',
    currentPackSkins: [], 
    sourceToggleState: false, 
    skinProcessingModeToggleState: false, 
    mySkinsInfoManagementToggleState: true, 
    selectedDeviceFilesStore: [], 
    selfModeQueueStore: [], 
    selfModeCurrentIndexStore: 0,
    isSelfModeProcessingActive: false, 
    availableSkinsSearchTerm: '',
    currentPackSkinsSearchTerm: '',
};

let selectedDeviceFiles = []; 
let allSkinsFromDBForPackCreator = []; 
let currentEditingSkinInPackIndex = -1; 

// --- Persistent State Handling ---
const SKIN_PACKS_TAB_STATE_KEY = 'skinPacksTabPersistentState';
let persistentStateJustLoadedSkinPacks = false;

function saveSkinPacksTabState() {
    if (!skinPacksSearchInput || !packNameInput || !packDescriptionInput || 
        !packSkinSourceToggle || !packSkinAutoModeToggle || !packMySkinsUseExistingToggle ||
        !packAvailableSkinsSearchInput || !currentPackSkinsSearchInput) {
        console.warn("SkinPacksTab: Critical DOM elements for state saving not found.");
        return;
    }

    if (currentSkinPacksTabView === 'creator') {
        packCreatorContext.packName = packNameInput.value;
        packCreatorContext.packDescription = packDescriptionInput.value;
        packCreatorContext.sourceToggleState = packSkinSourceToggle.checked;
        packCreatorContext.skinProcessingModeToggleState = packSkinAutoModeToggle.checked;
        packCreatorContext.mySkinsInfoManagementToggleState = packMySkinsUseExistingToggle.checked;
        packCreatorContext.availableSkinsSearchTerm = packAvailableSkinsSearchInput.value;
        packCreatorContext.currentPackSkinsSearchTerm = currentPackSkinsSearchInput.value;
    }
    
    const serializableSelectedDeviceFilesStore = packCreatorContext.selectedDeviceFilesStore.map(fileData => {
        if (fileData.fileRef instanceof File) {
            return { name: fileData.fileRef.name, type: fileData.fileRef.type, size: fileData.fileRef.size, lastModified: fileData.fileRef.lastModified };
        }
        return fileData; 
    });

    const serializableSelfModeQueueStore = packCreatorContext.selfModeQueueStore.map(skinData => {
        const { fileRef, ...restOfSkinData } = skinData;
        if (fileRef instanceof File) {
            return { ...restOfSkinData, originalFilename: fileRef.name }; 
        }
        return skinData; 
    });


    const stateToSave = {
        currentSkinPacksTabView,
        packCreatorContext: {
            ...packCreatorContext,
            selectedDeviceFilesStore: serializableSelectedDeviceFilesStore,
            selfModeQueueStore: serializableSelfModeQueueStore,
            originalPackDataForEdit: packCreatorContext.originalPackDataForEdit ? JSON.parse(JSON.stringify(packCreatorContext.originalPackDataForEdit)) : null,
            currentPackSkins: packCreatorContext.currentPackSkins.map(skin => { 
                 const { fileRef, ...rest } = skin; 
                 return rest;
            })
        },
        skinPacksSearchTerm: skinPacksSearchInput.value,
    };

    try {
        localStorage.setItem(SKIN_PACKS_TAB_STATE_KEY, JSON.stringify(stateToSave));
        console.log("SkinPacksTab: State saved to localStorage.", stateToSave);
    } catch (e) {
        console.error("SkinPacksTab: Error saving state to localStorage.", e);
    }
}


async function loadAndApplySkinPacksTabState() {
    const stateJSON = localStorage.getItem(SKIN_PACKS_TAB_STATE_KEY);
    if (stateJSON) {
        try {
            const state = JSON.parse(stateJSON);
            currentSkinPacksTabView = state.currentSkinPacksTabView || 'main';
            
            const restoredContext = state.packCreatorContext || {};
            packCreatorContext = {
                ...packCreatorContext, 
                ...restoredContext,
                selectedDeviceFilesStore: restoredContext.selectedDeviceFilesStore || [], 
                selfModeQueueStore: restoredContext.selfModeQueueStore || [] 
            };
            selectedDeviceFiles = []; 
            if (packDeviceSkinFilesInput) packDeviceSkinFilesInput.value = '';

            if (skinPacksSearchInput && state.skinPacksSearchTerm) {
                skinPacksSearchInput.value = state.skinPacksSearchTerm;
            }
            
            localStorage.removeItem(SKIN_PACKS_TAB_STATE_KEY);
            persistentStateJustLoadedSkinPacks = true;
            console.log("SkinPacksTab: Persistent state loaded and cleared.", state);
            return true;
        } catch (e) {
            console.error("SkinPacksTab: Error parsing persistent state.", e);
            localStorage.removeItem(SKIN_PACKS_TAB_STATE_KEY);
            return false;
        }
    }
    return false;
}
// --- End Persistent State Handling ---


function updateCurrentPackSkinsPreview(searchTerm = "") {
    if (!currentPackSkinCountSpan || !currentPackSkinsPreviewDiv) return;
    packCreatorContext.currentPackSkinsSearchTerm = searchTerm; 
    
    let skinsToDisplay = packCreatorContext.currentPackSkins; 
    if (searchTerm) {
        skinsToDisplay = packCreatorContext.currentPackSkins.filter(skin => 
            skin.name.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }
    currentPackSkinCountSpan.textContent = skinsToDisplay.length + (searchTerm && skinsToDisplay.length !== packCreatorContext.currentPackSkins.length ? ` of ${packCreatorContext.currentPackSkins.length}` : '');


    if (skinsToDisplay.length === 0) {
        currentPackSkinsPreviewDiv.innerHTML = searchTerm ? '<p>No skins in pack match your search.</p>' : '<p>No skins added yet.</p>';
    } else {
        currentPackSkinsPreviewDiv.innerHTML = ''; 
        skinsToDisplay.forEach((skin) => { 
            const skinItemRow = document.createElement('div');
            skinItemRow.className = 'current-pack-skin-item-row';
            const frontPreview = skin.previewFrontUrl || PLACEHOLDER_PREVIEW_PACK;
            const backPreview = skin.previewBackUrl || PLACEHOLDER_PREVIEW_PACK;
            skinItemRow.innerHTML = `
                <div class="skin-list-item-previews" style="display: flex; gap: 5px;">
                    <img src="${frontPreview}" alt="${skin.name.replace(/"/g, '"')} Front" class="current-pack-skin-front-preview">
                    <img src="${backPreview}" alt="${skin.name.replace(/"/g, '"')} Back" class="current-pack-skin-back-preview">
                </div>
                <div class="info">
                    <p>${skin.name}</p>
                    <small>Type: ${skin.type === 'alex' ? 'Alex/Slim' : 'Steve/Normal'}</small>
                </div>
                <div class="actions">
                    <button class="action-button edit-btn edit-skin-in-pack-btn" data-internalid="${skin.internalId}">Edit</button>
                    <button class="action-button delete-btn delete-skin-from-pack-btn" data-internalid="${skin.internalId}">Delete</button>
                </div>`;
            
            const frontImg = skinItemRow.querySelector('.current-pack-skin-front-preview');
            const backImg = skinItemRow.querySelector('.current-pack-skin-back-preview');
            if(frontImg) frontImg.onclick = () => { if(frontPreview !== PLACEHOLDER_PREVIEW_PACK) openLargeSkinPreview(frontPreview); };
            if(backImg) backImg.onclick = () => { if(backPreview !== PLACEHOLDER_PREVIEW_PACK) openLargeSkinPreview(backPreview); };

            skinItemRow.querySelector('.edit-skin-in-pack-btn').onclick = () => {
                 const skinToEditIndex = packCreatorContext.currentPackSkins.findIndex(s => s.internalId === skin.internalId);
                 if (skinToEditIndex !== -1) openEditSkinInPackModal(skinToEditIndex);
            };
            skinItemRow.querySelector('.delete-skin-from-pack-btn').onclick = () => deleteSkinFromCurrentPack(skin.internalId);
            currentPackSkinsPreviewDiv.appendChild(skinItemRow);
        });
    }
}

function updatePackCreatorSkinSourceUI() {
    if (!packSkinSourceToggle || !packFromDeviceOptionsDiv || !packFromMySkinsOptionsDiv) return;
    const fromMySkinsIsChecked = packSkinSourceToggle.checked; 
    packCreatorContext.sourceToggleState = fromMySkinsIsChecked; 

    packFromDeviceOptionsDiv.style.display = fromMySkinsIsChecked ? 'none' : 'block';
    packFromMySkinsOptionsDiv.style.display = fromMySkinsIsChecked ? 'block' : 'none';
    
    clearSelectedPackSkins(); 
    if (fromMySkinsIsChecked) {
        loadAvailableSkinsForPackSelection(packCreatorContext.availableSkinsSearchTerm); 
    }
    updatePackCreatorModeAndActionUI();
}

function updatePackCreatorModeAndActionUI() {
    if (!packSkinSourceToggle || !packSkinAutoModeToggle || !packMySkinsUseExistingToggle ||
        !packSelfModeSkinProcessorDiv || !packAddClearActionsDiv || !packMySkinsManagementToggleContainer ||
        !packAddProcessedSkinsBtn || !packClearSelectedSkinsBtn) return;

    const fromMySkinsIsChecked = packSkinSourceToggle.checked; 
    const isSelfModeActive = packSkinAutoModeToggle.checked;  
    packCreatorContext.skinProcessingModeToggleState = isSelfModeActive; 
    packCreatorContext.mySkinsInfoManagementToggleState = packMySkinsUseExistingToggle.checked; 

    const hasDeviceFiles = selectedDeviceFiles.length > 0; 
    const selectedMySkinsCheckboxes = getSelectedMySkinsCheckboxData();
    const hasMySkinsSelected = selectedMySkinsCheckboxes.length > 0;

    packSelfModeSkinProcessorDiv.style.display = packCreatorContext.isSelfModeProcessingActive ? 'block' : 'none';
    packAddClearActionsDiv.style.display = !packCreatorContext.isSelfModeProcessingActive ? 'flex' : 'none';

    packMySkinsManagementToggleContainer.style.display = (fromMySkinsIsChecked && !isSelfModeActive) ? 'flex' : 'none';

    if (!isSelfModeActive) { 
        if (fromMySkinsIsChecked) {
            packAddProcessedSkinsBtn.textContent = 'Add Selected to Pack';
            packAddProcessedSkinsBtn.disabled = !hasMySkinsSelected;
        } else { 
            packAddProcessedSkinsBtn.textContent = 'Add Skins to Pack';
            packAddProcessedSkinsBtn.disabled = !hasDeviceFiles;
        }
    } else { 
        packAddProcessedSkinsBtn.textContent = 'Process Selected Manually'; 
        if (fromMySkinsIsChecked) {
            packAddProcessedSkinsBtn.disabled = !hasMySkinsSelected;
        } else { 
            packAddProcessedSkinsBtn.disabled = !hasDeviceFiles;
        }
    }
    packClearSelectedSkinsBtn.disabled = fromMySkinsIsChecked ? !hasMySkinsSelected : !hasDeviceFiles;
}

async function fetchAllSkinsForPackCreator() {
    const db = getDbInstance();
    if (!db) {
        allSkinsFromDBForPackCreator = [];
        return;
    }
    const transaction = db.transaction(SKINS_STORE_NAME, 'readonly');
    const store = transaction.objectStore(SKINS_STORE_NAME);
    const getAllSkinsRequest = store.getAll();
    return new Promise(resolve => {
        getAllSkinsRequest.onsuccess = async () => {
            const skins = getAllSkinsRequest.result;
            for (const skin of skins) {
                if (!skin.previewFrontUrl || !skin.previewBackUrl) {
                    console.warn(`Generating previews for skin ID ${skin.id} for pack creator list.`);
                    const previews = await generateSkinPreviews(skin.imageDataUrl, skin.type);
                    skin.previewFrontUrl = previews.front;
                    skin.previewBackUrl = previews.back;
                }
            }
            allSkinsFromDBForPackCreator = skins;
            resolve();
        };
        getAllSkinsRequest.onerror = (e) => {
            console.error("Error fetching all skins for pack creator:", e);
            allSkinsFromDBForPackCreator = [];
            resolve();
        };
    });
}


async function loadAvailableSkinsForPackSelection(searchTerm = "") {
    if (!packAvailableSkinsListDiv) return;
    
    if (allSkinsFromDBForPackCreator.length === 0 && packSkinSourceToggle && packSkinSourceToggle.checked) { 
         packAvailableSkinsListDiv.innerHTML = 'Loading...';
         await fetchAllSkinsForPackCreator();
    }
    
    let skinsToDisplay = allSkinsFromDBForPackCreator;
    if (searchTerm) {
        packCreatorContext.availableSkinsSearchTerm = searchTerm; 
        skinsToDisplay = allSkinsFromDBForPackCreator.filter(skin => 
            skin.name.toLowerCase().includes(searchTerm.toLowerCase())
        );
    } else if (packCreatorContext.availableSkinsSearchTerm) { 
         skinsToDisplay = allSkinsFromDBForPackCreator.filter(skin => 
            skin.name.toLowerCase().includes(packCreatorContext.availableSkinsSearchTerm.toLowerCase())
        );
    }


    if (skinsToDisplay.length === 0) {
        packAvailableSkinsListDiv.innerHTML = searchTerm ? '<p>No skins match your search.</p>' : '<p>No skins in your library.</p>';
        updatePackCreatorModeAndActionUI();
        return;
    }

    let html = '';
    skinsToDisplay.forEach(skin => {
        const safeName = skin.name.replace(/"/g, '"');
        const frontPreview = skin.previewFrontUrl || PLACEHOLDER_PREVIEW_PACK;
        const backPreview = skin.previewBackUrl || PLACEHOLDER_PREVIEW_PACK;

        html += `
            <label>
                <input type="checkbox" name="pack-select-existing-skin" 
                       value="${skin.id}" 
                       data-name="${safeName}" 
                       data-type="${skin.type}" 
                       data-img="${skin.imageDataUrl}"
                       data-preview-front="${frontPreview}"
                       data-preview-back="${backPreview}">
                <div class="skin-list-item-previews" style="display: flex; gap: 5px; margin-right: 10px;">
                    <img src="${frontPreview}" alt="${safeName} Front" class="skin-list-item-img-small skin-list-item-front">
                    <img src="${backPreview}" alt="${safeName} Back" class="skin-list-item-img-small skin-list-item-back">
                </div>
                <div class="skin-list-item-info">
                    <span class="name">${skin.name}</span>
                    <span class="type">Type: ${skin.type === "alex" ? "Alex/Slim" : "Steve/Normal"}</span>
                </div>
            </label>`;
    });
    packAvailableSkinsListDiv.innerHTML = html;

    packAvailableSkinsListDiv.querySelectorAll('.skin-list-item-front').forEach(img => {
        img.onclick = (e) => { e.stopPropagation(); e.preventDefault(); if (img.src !== PLACEHOLDER_PREVIEW_PACK) openLargeSkinPreview(img.src); };
    });
    packAvailableSkinsListDiv.querySelectorAll('.skin-list-item-back').forEach(img => {
        img.onclick = (e) => { e.stopPropagation(); e.preventDefault(); if (img.src !== PLACEHOLDER_PREVIEW_PACK) openLargeSkinPreview(img.src); };
    });

    packAvailableSkinsListDiv.querySelectorAll('input[type="checkbox"]').forEach(cb => {
        cb.onchange = updatePackCreatorModeAndActionUI;
    });
    updatePackCreatorModeAndActionUI();
}


function getSelectedMySkinsCheckboxData() {
    if (!packAvailableSkinsListDiv) return [];
    const checked = [];
    packAvailableSkinsListDiv.querySelectorAll('input[type="checkbox"]:checked').forEach(cb => {
        checked.push({
            id: cb.value, 
            name: cb.dataset.name, 
            type: cb.dataset.type,
            imageDataUrl: cb.dataset.img,
            previewFrontUrl: cb.dataset.previewFront, 
            previewBackUrl: cb.dataset.previewBack,
            originalFilename: cb.dataset.name.replace(/[^a-z0-9_.-]/gi, '_') + ".png" 
        });
    });
    return checked;
}

function clearSelectedPackSkins() {
    selectedDeviceFiles = []; 
    packCreatorContext.selectedDeviceFilesStore = []; 

    if (packDeviceSkinFilesInput) packDeviceSkinFilesInput.value = '';
    if (packAvailableSkinsListDiv) {
        packAvailableSkinsListDiv.querySelectorAll('input[type="checkbox"]:checked').forEach(cb => cb.checked = false);
    }
    
    packCreatorContext.selfModeQueueStore = [];
    packCreatorContext.selfModeCurrentIndexStore = 0;
    packCreatorContext.isSelfModeProcessingActive = false;

    if(packSelfModeSkinProcessorDiv) packSelfModeSkinProcessorDiv.style.display = 'none';
    if(packAddClearActionsDiv) packAddClearActionsDiv.style.display = 'flex';
    updatePackCreatorModeAndActionUI();
}

async function handleAddOrProcessSkinsForPack() {
    const fromMySkinsIsChecked = packCreatorContext.sourceToggleState; 
    const isSelfModeActive = packCreatorContext.skinProcessingModeToggleState; 
    let skinsToProcessIntermediate = []; 

    if (fromMySkinsIsChecked) {
        const currentSelectedMySkins = getSelectedMySkinsCheckboxData(); 
        if (currentSelectedMySkins.length === 0) { alert("Please select skins from your library."); return; }
        skinsToProcessIntermediate = currentSelectedMySkins.map(s => ({...s})); 
    } else { 
        if (selectedDeviceFiles.length === 0) { alert("Please select skin files from your device."); return; }
        packCreatorContext.selectedDeviceFilesStore = selectedDeviceFiles.map(file => ({
            name: file.name,
            type: file.type,
            size: file.size,
            lastModified: file.lastModified,
            fileRef: file 
        }));


        for (let i = 0; i < selectedDeviceFiles.length; i++) {
            const file = selectedDeviceFiles[i];
            const imageDataUrl = await new Promise(resolve => {
                const reader = new FileReader();
                reader.onload = e => resolve(e.target.result);
                reader.onerror = () => resolve(null);
                reader.readAsDataURL(file);
            });
            if (imageDataUrl) {
                const initialType = await detectSkinTypeFromImageDataLocal(imageDataUrl);
                const previews = await generateSkinPreviews(imageDataUrl, initialType); 
                skinsToProcessIntermediate.push({
                    imageDataUrl, 
                    name: file.name.replace(/\.(png|jpg|jpeg)$/i, '').substring(0,50), 
                    type: initialType, 
                    originalFilename: file.name, 
                    previewFrontUrl: previews.front, 
                    previewBackUrl: previews.back
                });
            } else { console.warn(`Could not read file: ${file.name}`); }
        }
    }

    if (skinsToProcessIntermediate.length === 0) { alert("No valid skins were prepared."); return; }

    if (!isSelfModeActive) { 
        let preparedForAutoAdd = [];
        const useExistingInfoForMySkins = fromMySkinsIsChecked && packCreatorContext.mySkinsInfoManagementToggleState;

        for (let i = 0; i < skinsToProcessIntermediate.length; i++) {
            const skin = skinsToProcessIntermediate[i];
            let nameToAdd, typeToAdd;
            let previewFrontToAdd = skin.previewFrontUrl;
            let previewBackToAdd = skin.previewBackUrl;

            if (fromMySkinsIsChecked && useExistingInfoForMySkins) { 
                nameToAdd = skin.name;
                typeToAdd = skin.type; 
            } else { 
                nameToAdd = `Skin ${packCreatorContext.currentPackSkins.length + preparedForAutoAdd.length + 1}`; 
                typeToAdd = await detectSkinTypeFromImageDataLocal(skin.imageDataUrl); 
                if (skin.type !== typeToAdd || !previewFrontToAdd || !previewBackToAdd) {
                    const previews = await generateSkinPreviews(skin.imageDataUrl, typeToAdd);
                    previewFrontToAdd = previews.front;
                    previewBackToAdd = previews.back;
                }
            }
            preparedForAutoAdd.push({ ...skin, name: nameToAdd, type: typeToAdd, internalId: generateUUID(), previewFrontUrl: previewFrontToAdd, previewBackUrl: previewBackToAdd });
        }
        packCreatorContext.currentPackSkins.push(...preparedForAutoAdd);
        updateCurrentPackSkinsPreview(packCreatorContext.currentPackSkinsSearchTerm);
        clearSelectedPackSkins(); 
    } else { 
        packCreatorContext.selfModeQueueStore = [];
        for (const skin of skinsToProcessIntermediate) {
            packCreatorContext.selfModeQueueStore.push({ 
                ...skin, 
                editedName: skin.name, 
                editedType: skin.type 
            });
        }
        
        if (packCreatorContext.selfModeQueueStore.length > 0) {
            packCreatorContext.selfModeCurrentIndexStore = 0;
            packCreatorContext.isSelfModeProcessingActive = true; 
            if(packAddClearActionsDiv) packAddClearActionsDiv.style.display = 'none';
            if(packSelfModeSkinProcessorDiv) packSelfModeSkinProcessorDiv.style.display = 'block';
            await loadCurrentSelfModeSkinToProcess();
        } else {
            alert("No skins to process in Self Mode.");
            packCreatorContext.isSelfModeProcessingActive = false; 
        }
    }
}

async function loadCurrentSelfModeSkinToProcess() {
    if (!packSelfModeSkinProcessorDiv || !packSelfModePreviewFrontImg || !packSelfModePreviewBackImg ||
        !packSelfModeSkinNameInput || !packSelfModeSkinTypeSelect || !packSelfModeCurrentNumSpan ||
        !packSelfModeTotalNumSpan || !packSelfModeBackBtn || !packSelfModeNextBtn) return;

    const queue = packCreatorContext.selfModeQueueStore;
    const index = packCreatorContext.selfModeCurrentIndexStore;

    if (index < 0 || index >= queue.length) return;
    const skinData = queue[index];
    
    if (!skinData.imageDataUrl && skinData.fileRef instanceof File) { 
         skinData.imageDataUrl = await new Promise(resolve => {
            const reader = new FileReader();
            reader.onload = e => resolve(e.target.result);
            reader.onerror = () => resolve(null);
            reader.readAsDataURL(skinData.fileRef);
        });
        if(!skinData.imageDataUrl){ 
            alert(`Error loading image for: ${skinData.name || skinData.fileRef.name}.`); 
            packSelfModePreviewFrontImg.src = PLACEHOLDER_PREVIEW_PACK; 
            packSelfModePreviewBackImg.src = PLACEHOLDER_PREVIEW_PACK; 
            return;
        }
        if (!skinData.userModifiedType) { 
             skinData.editedType = await detectSkinTypeFromImageDataLocal(skinData.imageDataUrl);
        }
        if (!skinData.previewFrontUrl || !skinData.previewBackUrl) {
            const previews = await generateSkinPreviews(skinData.imageDataUrl, skinData.editedType);
            skinData.previewFrontUrl = previews.front;
            skinData.previewBackUrl = previews.back;
        }
    } else if (!skinData.imageDataUrl) {
        console.warn(`Self-mode: Skin data for "${skinData.originalFilename || skinData.editedName}" is missing imageDataUrl.`);
        packSelfModePreviewFrontImg.src = PLACEHOLDER_PREVIEW_PACK; 
        packSelfModePreviewBackImg.src = PLACEHOLDER_PREVIEW_PACK; 
        packSelfModeSkinNameInput.disabled = true;
        packSelfModeSkinTypeSelect.disabled = true;
    } else {
        packSelfModeSkinNameInput.disabled = false;
        packSelfModeSkinTypeSelect.disabled = false;
    }

    packSelfModePreviewFrontImg.src = skinData.previewFrontUrl || PLACEHOLDER_PREVIEW_PACK;
    packSelfModePreviewBackImg.src = skinData.previewBackUrl || PLACEHOLDER_PREVIEW_PACK;
    packSelfModeSkinNameInput.value = skinData.editedName || '';
    packSelfModeSkinTypeSelect.value = skinData.editedType || 'steve'; 
    packSelfModeCurrentNumSpan.textContent = index + 1;
    packSelfModeTotalNumSpan.textContent = queue.length;
    packSelfModeBackBtn.disabled = index === 0;
    packSelfModeNextBtn.textContent = (index === queue.length - 1) ? "Add All to Pack" : "Next";
}

async function saveCurrentSelfModeSkinEdits() { 
    if (!packSelfModeSkinNameInput || !packSelfModeSkinTypeSelect) return false;
    const queue = packCreatorContext.selfModeQueueStore;
    const index = packCreatorContext.selfModeCurrentIndexStore;
    if (index < 0 || index >= queue.length) return false;
    
    const skinToEdit = queue[index];
    if (!skinToEdit.imageDataUrl) { 
        console.warn("Cannot save self-mode skin edits: imageDataUrl is missing.");
        return true; 
    }

    const newName = packSelfModeSkinNameInput.value.trim();
    if (!newName) { alert("Skin name cannot be empty."); return false; }
    
    const oldType = skinToEdit.editedType;
    skinToEdit.editedName = newName;
    skinToEdit.editedType = packSelfModeSkinTypeSelect.value;
    skinToEdit.userModifiedType = true; 

    if (oldType !== skinToEdit.editedType || !skinToEdit.previewFrontUrl || !skinToEdit.previewBackUrl) {
        const previews = await generateSkinPreviews(skinToEdit.imageDataUrl, skinToEdit.editedType);
        skinToEdit.previewFrontUrl = previews.front;
        skinToEdit.previewBackUrl = previews.back;
        if(packSelfModePreviewFrontImg) packSelfModePreviewFrontImg.src = skinToEdit.previewFrontUrl;
        if(packSelfModePreviewBackImg) packSelfModePreviewBackImg.src = skinToEdit.previewBackUrl;
    }
    return true;
}

async function handleSelfModeNext() {
    if (!await saveCurrentSelfModeSkinEdits()) return; 
    const queue = packCreatorContext.selfModeQueueStore;
    let index = packCreatorContext.selfModeCurrentIndexStore;

    if (index < queue.length - 1) {
        packCreatorContext.selfModeCurrentIndexStore++;
        await loadCurrentSelfModeSkinToProcess();
    } else {
        const validSkinsToAdd = queue.filter(skin => !!skin.imageDataUrl);
        validSkinsToAdd.forEach(processedSkin => {
            packCreatorContext.currentPackSkins.push({
                internalId: generateUUID(), name: processedSkin.editedName, type: processedSkin.editedType,
                imageDataUrl: processedSkin.imageDataUrl,
                originalFilename: processedSkin.originalFilename || processedSkin.editedName + ".png",
                previewFrontUrl: processedSkin.previewFrontUrl, 
                previewBackUrl: processedSkin.previewBackUrl
            });
        });

        updateCurrentPackSkinsPreview(packCreatorContext.currentPackSkinsSearchTerm);
        packCreatorContext.isSelfModeProcessingActive = false; 
        if(packSelfModeSkinProcessorDiv) packSelfModeSkinProcessorDiv.style.display = 'none';
        if(packAddClearActionsDiv) packAddClearActionsDiv.style.display = 'flex';
        clearSelectedPackSkins(); 
    }
}

async function handleSelfModeBack() {
    if (packCreatorContext.selfModeCurrentIndexStore > 0) {
        if (!await saveCurrentSelfModeSkinEdits()) return; 
        packCreatorContext.selfModeCurrentIndexStore--;
        await loadCurrentSelfModeSkinToProcess();
    }
}

function cancelSelfModeProcessing() {
    packCreatorContext.selfModeQueueStore = [];
    packCreatorContext.selfModeCurrentIndexStore = 0;
    packCreatorContext.isSelfModeProcessingActive = false;
    if(packSelfModeSkinProcessorDiv) packSelfModeSkinProcessorDiv.style.display = 'none';
    if(packAddClearActionsDiv) packAddClearActionsDiv.style.display = 'flex';
    clearSelectedPackSkins(); 
}

async function showSkinPackCreator(packToEdit = null, restoreFromContext = false) { 
    currentSkinPacksTabView = 'creator';
    if (skinPacksMainView) skinPacksMainView.style.display = 'none';
    if (createSkinPackView) createSkinPackView.style.display = 'flex';

    if (restoreFromContext) {
        if(packNameInput) packNameInput.value = packCreatorContext.packName;
        if(packDescriptionInput) packDescriptionInput.value = packCreatorContext.packDescription;
        if(packSkinSourceToggle) packSkinSourceToggle.checked = packCreatorContext.sourceToggleState;
        if(packSkinAutoModeToggle) packSkinAutoModeToggle.checked = packCreatorContext.skinProcessingModeToggleState;
        if(packMySkinsUseExistingToggle) packMySkinsUseExistingToggle.checked = packCreatorContext.mySkinsInfoManagementToggleState;
        if(currentPackSkinsSearchInput) currentPackSkinsSearchInput.value = packCreatorContext.currentPackSkinsSearchTerm;
        if(packAvailableSkinsSearchInput) packAvailableSkinsSearchInput.value = packCreatorContext.availableSkinsSearchTerm;
        selectedDeviceFiles = []; 
        if (packDeviceSkinFilesInput) packDeviceSkinFilesInput.value = ''; 
    } else if (packToEdit) {
        packCreatorContext.editingPackId = packToEdit.id;
        packCreatorContext.originalPackDataForEdit = JSON.parse(JSON.stringify(packToEdit));
        if(skinPackCreatorHeader) skinPackCreatorHeader.textContent = "Edit Skin Pack";
        packCreatorContext.packName = packToEdit.name;
        packCreatorContext.packDescription = packToEdit.description || '';
        packCreatorContext.currentPackSkins = packToEdit.skins ? JSON.parse(JSON.stringify(packToEdit.skins)) : [];
        
        for (const skin of packCreatorContext.currentPackSkins) {
            if (!skin.internalId) skin.internalId = `packskin-${Date.now()}-${Math.random().toString(16).slice(2)}`;
            if (!skin.previewFrontUrl || !skin.previewBackUrl) {
                const previews = await generateSkinPreviews(skin.imageDataUrl, skin.type);
                skin.previewFrontUrl = previews.front;
                skin.previewBackUrl = previews.back;
            }
        }
        packCreatorContext.sourceToggleState = false;
        packCreatorContext.skinProcessingModeToggleState = false; 
        packCreatorContext.mySkinsInfoManagementToggleState = true;
        packCreatorContext.availableSkinsSearchTerm = '';
        packCreatorContext.currentPackSkinsSearchTerm = '';
        packCreatorContext.selectedDeviceFilesStore = [];
        packCreatorContext.selfModeQueueStore = [];
        packCreatorContext.selfModeCurrentIndexStore = 0;
        packCreatorContext.isSelfModeProcessingActive = false;
    } else { 
        packCreatorContext.editingPackId = null;
        packCreatorContext.originalPackDataForEdit = null;
        if(skinPackCreatorHeader) skinPackCreatorHeader.textContent = "Create New Skin Pack";
        packCreatorContext.packName = '';
        packCreatorContext.packDescription = '';
        packCreatorContext.currentPackSkins = [];
        packCreatorContext.sourceToggleState = false;
        packCreatorContext.skinProcessingModeToggleState = false; 
        packCreatorContext.mySkinsInfoManagementToggleState = true;
        packCreatorContext.availableSkinsSearchTerm = '';
        packCreatorContext.currentPackSkinsSearchTerm = '';
        packCreatorContext.selectedDeviceFilesStore = [];
        packCreatorContext.selfModeQueueStore = [];
        packCreatorContext.selfModeCurrentIndexStore = 0;
        packCreatorContext.isSelfModeProcessingActive = false;
    }
    
    if(packNameInput) packNameInput.value = packCreatorContext.packName;
    if(packDescriptionInput) packDescriptionInput.value = packCreatorContext.packDescription;
    if(packSkinSourceToggle) packSkinSourceToggle.checked = packCreatorContext.sourceToggleState;
    if(packSkinAutoModeToggle) packSkinAutoModeToggle.checked = packCreatorContext.skinProcessingModeToggleState;
    if(packMySkinsUseExistingToggle) packMySkinsUseExistingToggle.checked = packCreatorContext.mySkinsInfoManagementToggleState;
    if(currentPackSkinsSearchInput) currentPackSkinsSearchInput.value = packCreatorContext.currentPackSkinsSearchTerm;
    if(packAvailableSkinsSearchInput) packAvailableSkinsSearchInput.value = packCreatorContext.availableSkinsSearchTerm;

    updateCurrentPackSkinsPreview(packCreatorContext.currentPackSkinsSearchTerm);
    await fetchAllSkinsForPackCreator(); 
    updatePackCreatorSkinSourceUI(); 
    
    if (packCreatorContext.isSelfModeProcessingActive && packCreatorContext.selfModeQueueStore.length > 0) {
        if(packAddClearActionsDiv) packAddClearActionsDiv.style.display = 'none';
        if(packSelfModeSkinProcessorDiv) packSelfModeSkinProcessorDiv.style.display = 'block';
        await loadCurrentSelfModeSkinToProcess(); 
    } else {
        packCreatorContext.isSelfModeProcessingActive = false; 
        if(packSelfModeSkinProcessorDiv) packSelfModeSkinProcessorDiv.style.display = 'none';
        if(packAddClearActionsDiv) packAddClearActionsDiv.style.display = 'flex';
    }

    if (!restoreFromContext && !packToEdit) { 
       clearSelectedPackSkins(); 
    }
 }

export function hideSkinPackCreator(isCancellationOrCompletion = true) {
    if (createSkinPackView) createSkinPackView.style.display = 'none';
    if (skinPacksMainView) skinPacksMainView.style.display = 'block';
    
    if (isCancellationOrCompletion) {
        currentSkinPacksTabView = 'main'; 
        packCreatorContext = {
            editingPackId: null, originalPackDataForEdit: null, packName: '', packDescription: '',
            currentPackSkins: [], sourceToggleState: false, skinProcessingModeToggleState: false,
            mySkinsInfoManagementToggleState: true, selectedDeviceFilesStore: [],
            selfModeQueueStore: [], selfModeCurrentIndexStore: 0, isSelfModeProcessingActive: false,
            availableSkinsSearchTerm: '', currentPackSkinsSearchTerm: ''
        };
        selectedDeviceFiles = []; 
        if(packDeviceSkinFilesInput) packDeviceSkinFilesInput.value = '';
        if(packAvailableSkinsSearchInput) packAvailableSkinsSearchInput.value = '';
        if(currentPackSkinsSearchInput) currentPackSkinsSearchInput.value = '';
    } else {
        // Update context from DOM for in-memory persistence if not cancelling/completing
        if (packNameInput) packCreatorContext.packName = packNameInput.value;
        if (packDescriptionInput) packCreatorContext.packDescription = packDescriptionInput.value;
        if (packSkinSourceToggle) packCreatorContext.sourceToggleState = packSkinSourceToggle.checked;
        if (packSkinAutoModeToggle) packCreatorContext.skinProcessingModeToggleState = packSkinAutoModeToggle.checked;
        if (packMySkinsUseExistingToggle) packCreatorContext.mySkinsInfoManagementToggleState = packMySkinsUseExistingToggle.checked;
        if (packAvailableSkinsSearchInput) packCreatorContext.availableSkinsSearchTerm = packAvailableSkinsSearchInput.value;
        if (currentPackSkinsSearchInput) packCreatorContext.currentPackSkinsSearchTerm = currentPackSkinsSearchInput.value;
    }
}


async function openEditSkinInPackModal(indexInPackContext) { 
    currentEditingSkinInPackIndex = indexInPackContext; 
    const skin = packCreatorContext.currentPackSkins[indexInPackContext]; 
    if (!skin || !editSkinInPackModal) return;
    
    if (!skin.previewFrontUrl || !skin.previewBackUrl) {
        const previews = await generateSkinPreviews(skin.imageDataUrl, skin.type);
        skin.previewFrontUrl = previews.front; 
        skin.previewBackUrl = previews.back;
    }
    
    if (editSkinInPackPreviewFrontImg) editSkinInPackPreviewFrontImg.src = skin.previewFrontUrl || PLACEHOLDER_PREVIEW_PACK;
    if (editSkinInPackPreviewBackImg) editSkinInPackPreviewBackImg.src = skin.previewBackUrl || PLACEHOLDER_PREVIEW_PACK;
    
    if (editSkinInPackNameInput) editSkinInPackNameInput.value = skin.name;
    if (editSkinInPackTypeSelect) editSkinInPackTypeSelect.value = skin.type;
    editSkinInPackModal.style.display = 'flex';
}
export function closeEditSkinInPackModal() {
    if (editSkinInPackModal) editSkinInPackModal.style.display = 'none';
    currentEditingSkinInPackIndex = -1;
}
async function saveEditedSkinInPack() { 
    if (currentEditingSkinInPackIndex === -1 || !packCreatorContext.currentPackSkins[currentEditingSkinInPackIndex] || !editSkinInPackNameInput || !editSkinInPackTypeSelect) return;
    const skinToUpdate = packCreatorContext.currentPackSkins[currentEditingSkinInPackIndex];
    const newName = editSkinInPackNameInput.value.trim();
    if (!newName) {
        alert("Skin name in pack cannot be empty.");
        return;
    }
    const oldType = skinToUpdate.type;
    skinToUpdate.name = newName;
    skinToUpdate.type = editSkinInPackTypeSelect.value;

    if (oldType !== skinToUpdate.type || !skinToUpdate.previewFrontUrl || !skinToUpdate.previewBackUrl) { 
        const previews = await generateSkinPreviews(skinToUpdate.imageDataUrl, skinToUpdate.type);
        skinToUpdate.previewFrontUrl = previews.front;
        skinToUpdate.previewBackUrl = previews.back;
    }

    updateCurrentPackSkinsPreview(packCreatorContext.currentPackSkinsSearchTerm);
    closeEditSkinInPackModal();
}
async function savePack(andDownload = false) {
    const db = getDbInstance();
    if (!db || !packNameInput || !packDescriptionInput) { alert("Database not initialized or critical elements missing. Cannot save pack."); return; }
    
    packCreatorContext.packName = packNameInput.value.trim(); 
    packCreatorContext.packDescription = packDescriptionInput.value.trim();

    if (!packCreatorContext.packName) { alert("Pack Name is required."); return; }
    if (packCreatorContext.currentPackSkins.length === 0) { alert("A skin pack must contain at least one skin."); return; }
    
    let hasChanges = false;
    let manifestVersionToSave;
    const editingPackId = packCreatorContext.editingPackId;
    const originalData = packCreatorContext.originalPackDataForEdit;

    if (editingPackId && originalData) {
        const originalSkinsSimple = originalData.skins.map(s => ({ name: s.name, type: s.type, imageDataUrl: s.imageDataUrl.substring(0,100) }));
        const currentSkinsSimple = packCreatorContext.currentPackSkins.map(s => ({ name: s.name, type: s.type, imageDataUrl: s.imageDataUrl.substring(0,100) }));
        if (originalData.name !== packCreatorContext.packName || 
            originalData.description !== packCreatorContext.packDescription ||
            packCreatorContext.currentPackSkins.length !== originalData.skins.length ||
            JSON.stringify(originalSkinsSimple) !== JSON.stringify(currentSkinsSimple)
           ) { hasChanges = true; }
        let currentVersion = Array.isArray(originalData.manifestVersion) ? [...originalData.manifestVersion] : [0,0,0];
        if (hasChanges) { 
            currentVersion[2]++; 
            if (currentVersion[2] > 99) { currentVersion[2] = 0; currentVersion[1]++; } 
            if (currentVersion[1] > 99) { currentVersion[1] = 0; currentVersion[0]++; }
        }
        manifestVersionToSave = [...currentVersion];
    } else { hasChanges = true; manifestVersionToSave = [0,0,1]; }
    
    const packDataToSave = {
        name: packCreatorContext.packName, 
        description: packCreatorContext.packDescription, 
        skins: JSON.parse(JSON.stringify(packCreatorContext.currentPackSkins)), 
        updatedAt: new Date().toISOString(), 
        manifestVersion: manifestVersionToSave
    };

    if (editingPackId) { 
        const existingPack = await getSkinPackById(editingPackId); 
        packDataToSave.id = editingPackId;
        packDataToSave.uuidHeader = existingPack.uuidHeader || generateUUID(); 
        packDataToSave.uuidModule = existingPack.uuidModule || generateUUID();
        packDataToSave.createdAt = existingPack.createdAt || new Date().toISOString();
    } else { 
        packDataToSave.uuidHeader = generateUUID(); 
        packDataToSave.uuidModule = generateUUID(); 
        packDataToSave.createdAt = new Date().toISOString(); 
    }

    try {
        const transaction = db.transaction(SKIN_PACKS_STORE_NAME, 'readwrite');
        const store = transaction.objectStore(SKIN_PACKS_STORE_NAME);
        const request = editingPackId ? store.put(packDataToSave) : store.add(packDataToSave);
        request.onsuccess = () => {
            alert(`Skin pack "${packDataToSave.name}" ${editingPackId ? (hasChanges ? 'updated' : 'saved (no changes detected)') : 'saved'}!`);
            if (andDownload) { generateMcpack(packDataToSave); } 
            hideSkinPackCreator(true); 
            loadAndDisplaySkinPacks();
        };
        request.onerror = (e) => { alert("Error saving pack: " + e.target.error.message); };
    } catch (error) { alert("Exception saving pack: " + error.message); }
}
async function generateMcpack(packData) { 
    if (!window.JSZip) { alert("JSZip library not loaded."); return; }
    const zip = new JSZip();
    const packSafeName = (packData.name.replace(/[^a-z0-9_.-]/gi, '_').toLowerCase() || 'new_skin_pack').substring(0, 30);
    const manifestVersion = Array.isArray(packData.manifestVersion) ? packData.manifestVersion : [1,0,0];
    const downloadFileName = `${packSafeName}_v${manifestVersion.join('.')}.mcpack`;
    const manifest = {
        format_version: 2, header: { name: packData.name, description: packData.description || "", uuid: packData.uuidHeader || generateUUID(), version: manifestVersion, min_engine_version: [1, 16, 0] },
        modules: [ { type: "skin_pack", uuid: packData.uuidModule || generateUUID(), version: manifestVersion } ]
    };
    zip.file("manifest.json", JSON.stringify(manifest, null, 2));
    const skinsJson = { serialize_name: packSafeName, localization_name: packSafeName, skins: [] };
    const textsLang = {};
    textsLang[`skinpack.${packSafeName}`] = packData.name;
    for (let i = 0; i < packData.skins.length; i++) {
        const skin = packData.skins[i];
        const safeSkinNamePart = (skin.name.replace(/[^a-z0-9]/gi, '_') || 'skin').substring(0,20);
        const textureFilename = `skin_${i}_${safeSkinNamePart}.png`;
        skinsJson.skins.push({ localization_name: `skin${i}`, geometry: skin.type === 'alex' ? "geometry.humanoid.customSlim" : "geometry.humanoid.custom", texture: textureFilename, type: "free" });
        textsLang[`skin.${packSafeName}.skin${i}`] = skin.name;
        try {
            const blob = await dataURLToBlob(skin.imageDataUrl);
            zip.file(textureFilename, blob);
        } catch (e) { alert(`Could not process image for skin: ${skin.name}.`); }
    }
    zip.file("skins.json", JSON.stringify(skinsJson, null, 2));
    let langFileContent = "";
    for (const key in textsLang) { langFileContent += `${key}=${textsLang[key]}\n`; }
    const textsFolder = zip.folder("texts");
    if (textsFolder) { textsFolder.file("en_US.lang", langFileContent); }
    else { zip.file("texts/en_US.lang", langFileContent); } 
    zip.generateAsync({ type: "blob" })
        .then(function(content) {
            const link = document.createElement('a');
            link.href = URL.createObjectURL(content); link.download = downloadFileName;
            document.body.appendChild(link); link.click(); document.body.removeChild(link);
            URL.revokeObjectURL(link.href); 
        }).catch(err => { alert("Error generating .mcpack: " + err.message); });
}
export async function loadAndDisplaySkinPacks(searchTerm = "") {
    const db = getDbInstance();
    if (!db || !skinPacksDisplayArea) { if(skinPacksDisplayArea) skinPacksDisplayArea.innerHTML = '<p>DB not ready.</p>'; return; }
    skinPacksDisplayArea.innerHTML = ''; 
    const transaction = db.transaction(SKIN_PACKS_STORE_NAME, 'readonly');
    const store = transaction.objectStore(SKIN_PACKS_STORE_NAME);
    const getAllPacksRequest = store.getAll();
    getAllPacksRequest.onsuccess = () => {
        let packs = getAllPacksRequest.result;
        if (searchTerm) { packs = packs.filter(pack => pack.name.toLowerCase().includes(searchTerm.toLowerCase())); }
        if (packs.length === 0) { 
            skinPacksDisplayArea.innerHTML = searchTerm ? '<p>No skin packs match your search.</p>' : '<p>No skin packs created yet.</p>'; 
        } else { 
            packs.forEach(pack => {
                const packItem = document.createElement('div');
                packItem.className = 'skin-pack-list-item';
                const versionStr = Array.isArray(pack.manifestVersion) ? `v${pack.manifestVersion.join('.')}` : 'v0.0.0';
                const skinCount = pack.skins ? pack.skins.length : 0;
                packItem.innerHTML = `
                    <div class="info">
                        <p class="pack-name">${pack.name} (${versionStr})</p>
                        <p class="pack-details">Skins: ${skinCount}</p>
                    </div>
                    <div class="actions">
                        <button class="action-button download-btn download-pack-btn" data-id="${pack.id}">Download</button>
                        <button class="action-button edit-btn edit-pack-btn" data-id="${pack.id}">Edit</button>
                        <button class="action-button delete-btn delete-pack-btn" data-id="${pack.id}">Delete</button>
                    </div>`;
                skinPacksDisplayArea.appendChild(packItem);
                packItem.querySelector('.delete-pack-btn').onclick = () => deleteSkinPack(pack.id);
                packItem.querySelector('.download-pack-btn').onclick = async () => {
                    const packToDownload = await getSkinPackById(pack.id);
                    if (packToDownload) generateMcpack(packToDownload);
                };
                packItem.querySelector('.edit-pack-btn').onclick = async () => {
                    const packToEdit = await getSkinPackById(pack.id);
                    if (packToEdit) showSkinPackCreator(packToEdit, false); 
                };
            });
        }
    };
    getAllPacksRequest.onerror = (e) => { skinPacksDisplayArea.innerHTML = '<p>Error loading packs.</p>';};
}
async function importMcpackFiles(event) {
    const db = getDbInstance();
    const files = event.target.files;
    if (!files.length || !db || !window.JSZip) { if (!window.JSZip) alert("JSZip library not loaded."); return; }
    let importedCount = 0, skippedCount = 0; let errorMessages = [];
    for (const file of files) {
        if (file.name.endsWith(".mcpack")) {
            try {
                const zip = await JSZip.loadAsync(file);
                const manifestFile = zip.file("manifest.json");
                if (!manifestFile) { errorMessages.push(`${file.name}: manifest.json missing.`); skippedCount++; continue; }
                const manifestContent = await manifestFile.async("string");
                const manifestData = JSON.parse(manifestContent);
                if (!manifestData.header || !manifestData.header.name || !manifestData.header.uuid || !manifestData.modules || !manifestData.modules[0] || !manifestData.modules[0].uuid) {
                    errorMessages.push(`${file.name}: manifest.json malformed.`); skippedCount++; continue;
                }
                const packName = manifestData.header.name, packDesc = manifestData.header.description || "", packVersionArray = Array.isArray(manifestData.header.version) ? manifestData.header.version : [0,0,1];
                const packHeaderUUID = manifestData.header.uuid, packModuleUUID = manifestData.modules[0].uuid;
                let packSafeNameFromSkinsJson = packName.replace(/[^a-z0-9_.-]/gi, '_').toLowerCase()||'imported_pack';
                const skinsJsonTempFile = zip.file("skins.json");
                if(skinsJsonTempFile){ try { const skinsJsonContentTemp = await skinsJsonTempFile.async("string"); const skinsDataTemp = JSON.parse(skinsJsonContentTemp); if(skinsDataTemp.serialize_name) packSafeNameFromSkinsJson = skinsDataTemp.serialize_name;} catch (e) { console.warn(`Could not parse skins.json for packSafeName in ${file.name}, using default. Error: ${e}`);}}
                let action = 'add', packToOverwriteId = null;
                const existingPackByUUID = await getSkinPackByUUID(packHeaderUUID);
                if (existingPackByUUID) {
                    packToOverwriteId = existingPackByUUID.id;
                    if (confirm(`Pack ID for "${packName}" (v${packVersionArray.join('.')}) exists as "${existingPackByUUID.name}" (v${(Array.isArray(existingPackByUUID.manifestVersion) ? existingPackByUUID.manifestVersion : [0,0,0]).join('.')}). Overwrite?`)) { action = 'overwrite'; } else { action = 'skip'; }
                } else { const existingPackByName = await getSkinPackByName(packName); if (existingPackByName) { packToOverwriteId = existingPackByName.id; if (confirm(`Pack name "${packName}" (v${packVersionArray.join('.')}) exists (different ID) as "${existingPackByName.name}" (v${(Array.isArray(existingPackByName.manifestVersion) ? existingPackByName.manifestVersion : [0,0,0]).join('.')}). Overwrite?`)) { action = 'overwrite'; } else { action = 'skip'; }}}
                if (action === 'skip') { skippedCount++; continue; }
                let importedSkinsArray = []; const skinsJsonFile = zip.file("skins.json");
                const langFileNames = ["texts/en_US.lang", "texts/en_GB.lang"]; let textsLangFile = null;
                for (const langName of langFileNames) { if (zip.file(langName)) { textsLangFile = zip.file(langName); break; } }
                if (!textsLangFile) { const anyLangFileKey = Object.keys(zip.files).find(fn => fn.startsWith("texts/") && fn.endsWith(".lang")); if (anyLangFileKey) textsLangFile = zip.file(anyLangFileKey); }
                let skinLocalizationMap = {};
                if (textsLangFile) { const langContent = await textsLangFile.async("string"); langContent.split(/\r?\n/).forEach(line => { const parts = line.split('='); if (parts.length === 2) skinLocalizationMap[parts[0].trim()] = parts[1].trim(); }); }
                if (skinsJsonFile) {
                    const skinsJsonContent = await skinsJsonFile.async("string"); const skinsDataFromJson = JSON.parse(skinsJsonContent); const packSerializeName = skinsDataFromJson.serialize_name || packSafeNameFromSkinsJson;
                    if (skinsDataFromJson.skins && Array.isArray(skinsDataFromJson.skins)) {
                        for (const skinEntry of skinsDataFromJson.skins) {
                            if (!skinEntry.texture) continue; const textureFile = zip.file(skinEntry.texture);
                            if (!textureFile) { errorMessages.push(`${packName} - Texture '${skinEntry.texture}' missing.`); continue; }
                            try {
                                const imageBlob = await textureFile.async("blob");
                                const imageDataUrl = await new Promise((resolveBlob, rejectBlob) => { const reader = new FileReader(); reader.onloadend = () => resolveBlob(reader.result); reader.onerror = rejectBlob; reader.readAsDataURL(imageBlob); });
                                let skinDisplayName = skinEntry.localization_name || 'Unnamed Skin'; const langKey = `skin.${packSerializeName}.${skinEntry.localization_name}`; if (skinLocalizationMap[langKey]) skinDisplayName = skinLocalizationMap[langKey];
                                const skinType = (skinEntry.geometry && skinEntry.geometry.toLowerCase().includes("slim")) ? "alex" : "steve";
                                const previews = await generateSkinPreviews(imageDataUrl, skinType); 
                                importedSkinsArray.push({ internalId: generateUUID(), name: skinDisplayName, type: skinType, imageDataUrl: imageDataUrl, originalFilename: skinEntry.texture, previewFrontUrl: previews.front, previewBackUrl: previews.back });
                            } catch (imgError) { errorMessages.push(`${packName} - Error processing texture '${skinEntry.texture}'.`);}}
                    } else { errorMessages.push(`${packName}: skins.json has no valid skins array.`); }} else { errorMessages.push(`${packName}: skins.json missing.`); }
                const importedPackData = { name: packName, description: packDesc, skins: importedSkinsArray, uuidHeader: packHeaderUUID, uuidModule: packModuleUUID, manifestVersion: packVersionArray, createdAt: (action === 'overwrite' && packToOverwriteId) ? (await getSkinPackById(packToOverwriteId)).createdAt : new Date().toISOString(), updatedAt: new Date().toISOString() };
                if (action === 'overwrite' && packToOverwriteId) importedPackData.id = packToOverwriteId;
                const transaction = db.transaction(SKIN_PACKS_STORE_NAME, 'readwrite'); const store = transaction.objectStore(SKIN_PACKS_STORE_NAME);
                const request = (action === 'overwrite' && packToOverwriteId) ? store.put(importedPackData) : store.add(importedPackData);
                await new Promise((resolveTx, rejectTx) => { request.onsuccess = () => { importedCount++; resolveTx(); }; request.onerror = (e) => { errorMessages.push(`Failed to save "${packName}" to DB: ${e.target.error.message}`); skippedCount++; rejectTx(e.target.error); }; });
            } catch (err) { errorMessages.push(`Error processing ${file.name}.`); skippedCount++; }} else { errorMessages.push(`${file.name}: Not a .mcpack.`); skippedCount++; }}
    if (skinPackFileInput) skinPackFileInput.value = ''; loadAndDisplaySkinPacks();
    let summaryMessage = `${importedCount} pack(s) processed.`; if (skippedCount > 0) summaryMessage += ` ${skippedCount} pack(s) skipped.`;
    if (errorMessages.length > 0) { summaryMessage += "\n\nDetails:\n" + errorMessages.join("\n"); } alert(summaryMessage);
}
async function deleteSkinPack(packId) {
    const db = getDbInstance(); if (!db) { console.error("DB not initialized."); return; }
    if (!confirm("Delete this skin pack?")) return;
    try {
        const transaction = db.transaction(SKIN_PACKS_STORE_NAME, 'readwrite'); const store = transaction.objectStore(SKIN_PACKS_STORE_NAME);
        const request = store.delete(packId);
        request.onsuccess = () => { console.log("Skin pack deleted:", packId); loadAndDisplaySkinPacks(); };
        request.onerror = (event) => console.error("Error deleting pack:", event.target.error);
    } catch (error) { console.error("Error during pack delete transaction:", error); }
}

function deleteSkinFromCurrentPack(internalIdToDelete) {
    packCreatorContext.currentPackSkins = packCreatorContext.currentPackSkins.filter(skin => skin.internalId !== internalIdToDelete);
    updateCurrentPackSkinsPreview(packCreatorContext.currentPackSkinsSearchTerm);
}

async function onSkinPacksTabActivated(isDirectNavigationOrSameTabClick = false) {
    if (persistentStateJustLoadedSkinPacks) {
        persistentStateJustLoadedSkinPacks = false; 
        console.log("SkinPacksTab: Activating based on persistentStateJustLoadedSkinPacks.");
        if (currentSkinPacksTabView === 'creator') {
            await showSkinPackCreator(null, true); 
        } else { 
            if (skinPacksMainView) skinPacksMainView.style.display = 'block';
            if (createSkinPackView) createSkinPackView.style.display = 'none';
            loadAndDisplaySkinPacks(skinPacksSearchInput ? skinPacksSearchInput.value : "");
        }
    } else { 
        console.log("SkinPacksTab: Activating (normal in-app). currentSkinPacksTabView:", currentSkinPacksTabView, "isDirectNavigation:", isDirectNavigationOrSameTabClick);
        if (currentSkinPacksTabView === 'creator') {
            // If module state indicates creator view, restore it (handles in-app nav back to tab)
            await showSkinPackCreator(null, true); 
        } else { 
            // Default to main view
            if (skinPacksMainView) skinPacksMainView.style.display = 'block';
            if (createSkinPackView) createSkinPackView.style.display = 'none';
            currentSkinPacksTabView = 'main'; // Ensure state consistency

            loadAndDisplaySkinPacks(isDirectNavigationOrSameTabClick ? '' : (skinPacksSearchInput ? skinPacksSearchInput.value : ""));
            if (isDirectNavigationOrSameTabClick && skinPacksSearchInput) { 
                skinPacksSearchInput.value = ''; 
            }
        }
    }
}

export function initSkinPacksTab() {
    loadAndApplySkinPacksTabState(); 

    registerHideSkinPackCreator((isSwitchingTabs) => {
        if (currentSkinPacksTabView === 'creator' && !isSwitchingTabs) { // false means switching tabs, not full cancel
             hideSkinPackCreator(false); 
        }
    }); 
    registerSkinPacksTabActivated(onSkinPacksTabActivated);

    if (newSkinPackBtn) newSkinPackBtn.onclick = () => showSkinPackCreator(null, false); 
    if (importSkinPacksBtn) importSkinPacksBtn.onclick = () => { if(skinPackFileInput) skinPackFileInput.click()};
    if (skinPackFileInput) skinPackFileInput.onchange = importMcpackFiles;
    if (downloadAllSkinPacksBtn) { 
        downloadAllSkinPacksBtn.onclick = async () => {
            const db = getDbInstance(); if (!db) { alert("DB not ready."); return; }
            const transaction = db.transaction(SKIN_PACKS_STORE_NAME, 'readonly'); 
            const store = transaction.objectStore(SKIN_PACKS_STORE_NAME); 
            const getAllPacksRequest = store.getAll(); 
            getAllPacksRequest.onsuccess = () => {
                 const packs = getAllPacksRequest.result;
                 if (packs.length === 0) { alert("No packs to download."); return; }
                 packs.forEach(pack => generateMcpack(pack));
            };
            getAllPacksRequest.onerror = (e) => { alert("Error fetching packs for download."); console.error(e);};
        }; 
    }
    if (skinPacksSearchInput) skinPacksSearchInput.addEventListener('input', (event) => loadAndDisplaySkinPacks(event.target.value));
    if (packAvailableSkinsSearchInput) packAvailableSkinsSearchInput.addEventListener('input', (e) => {
        packCreatorContext.availableSkinsSearchTerm = e.target.value;
        loadAvailableSkinsForPackSelection(e.target.value);
    });
    if (currentPackSkinsSearchInput) currentPackSkinsSearchInput.addEventListener('input', (e) => {
        packCreatorContext.currentPackSkinsSearchTerm = e.target.value;
        updateCurrentPackSkinsPreview(e.target.value);
    });


    if (cancelPackCreationBtn) cancelPackCreationBtn.onclick = () => hideSkinPackCreator(true); 
    if (savePackBtn) savePackBtn.onclick = () => savePack(false);
    if (saveDownloadPackBtn) saveDownloadPackBtn.onclick = () => savePack(true);

    if (packSkinSourceToggle) packSkinSourceToggle.onchange = updatePackCreatorSkinSourceUI;
    if (packSkinAutoModeToggle) packSkinAutoModeToggle.onchange = updatePackCreatorModeAndActionUI; 
    if (packMySkinsUseExistingToggle) packMySkinsUseExistingToggle.onchange = updatePackCreatorModeAndActionUI; 

    if (packDeviceSkinFilesInput) packDeviceSkinFilesInput.onchange = (event) => {
        selectedDeviceFiles = Array.from(event.target.files).filter(f => f.type === 'image/png');
        packCreatorContext.selectedDeviceFilesStore = selectedDeviceFiles.map(file => ({
            name: file.name, type: file.type, size: file.size, lastModified: file.lastModified
        }));
        updatePackCreatorModeAndActionUI();
    };
    
    if (packAddProcessedSkinsBtn) packAddProcessedSkinsBtn.onclick = handleAddOrProcessSkinsForPack;
    if (packClearSelectedSkinsBtn) packClearSelectedSkinsBtn.onclick = clearSelectedPackSkins;

    if (packSelfModeCancelAllBtn) packSelfModeCancelAllBtn.onclick = cancelSelfModeProcessing;
    if (packSelfModeBackBtn) packSelfModeBackBtn.onclick = handleSelfModeBack;
    if (packSelfModeNextBtn) packSelfModeNextBtn.onclick = handleSelfModeNext;
    
    if (packSelfModePreviewFrontImg) packSelfModePreviewFrontImg.onclick = () => {
        if (!packCreatorContext.selfModeQueueStore || packCreatorContext.selfModeCurrentIndexStore < 0 || packCreatorContext.selfModeCurrentIndexStore >= packCreatorContext.selfModeQueueStore.length) return;
        const skinData = packCreatorContext.selfModeQueueStore[packCreatorContext.selfModeCurrentIndexStore];
        if(skinData && skinData.previewFrontUrl && skinData.previewFrontUrl !== PLACEHOLDER_PREVIEW_PACK) openLargeSkinPreview(skinData.previewFrontUrl);
        else if (skinData && skinData.imageDataUrl) openLargeSkinPreview(skinData.imageDataUrl); 
    };
    if (packSelfModePreviewBackImg) packSelfModePreviewBackImg.onclick = () => {
        if (!packCreatorContext.selfModeQueueStore || packCreatorContext.selfModeCurrentIndexStore < 0 || packCreatorContext.selfModeCurrentIndexStore >= packCreatorContext.selfModeQueueStore.length) return;
        const skinData = packCreatorContext.selfModeQueueStore[packCreatorContext.selfModeCurrentIndexStore];
        if(skinData && skinData.previewBackUrl && skinData.previewBackUrl !== PLACEHOLDER_PREVIEW_PACK) openLargeSkinPreview(skinData.previewBackUrl);
        else if (skinData && skinData.imageDataUrl) openLargeSkinPreview(skinData.imageDataUrl); 
    };

    if (closeEditSkinInPackModalBtn) closeEditSkinInPackModalBtn.onclick = closeEditSkinInPackModal;
    if (cancelEditSkinInPackBtn) cancelEditSkinInPackBtn.onclick = closeEditSkinInPackModal;
    if (saveEditSkinInPackBtn) saveEditSkinInPackBtn.onclick = saveEditedSkinInPack;
    
    if (editSkinInPackPreviewFrontImg) {
        editSkinInPackPreviewFrontImg.onclick = () => {
            if(currentEditingSkinInPackIndex === -1 || !packCreatorContext.currentPackSkins[currentEditingSkinInPackIndex]) return;
            const skin = packCreatorContext.currentPackSkins[currentEditingSkinInPackIndex];
            if (skin && skin.previewFrontUrl && skin.previewFrontUrl !== PLACEHOLDER_PREVIEW_PACK) {
                openLargeSkinPreview(skin.previewFrontUrl);
            } else if (skin && skin.imageDataUrl) { 
                openLargeSkinPreview(skin.imageDataUrl);
            }
        };
    }
    if (editSkinInPackPreviewBackImg) {
        editSkinInPackPreviewBackImg.onclick = () => {
             if(currentEditingSkinInPackIndex === -1 || !packCreatorContext.currentPackSkins[currentEditingSkinInPackIndex]) return;
            const skin = packCreatorContext.currentPackSkins[currentEditingSkinInPackIndex];
            if (skin && skin.previewBackUrl && skin.previewBackUrl !== PLACEHOLDER_PREVIEW_PACK) {
                openLargeSkinPreview(skin.previewBackUrl);
            } else if (skin && skin.imageDataUrl) { 
                 openLargeSkinPreview(skin.imageDataUrl);
            }
        };
    }
    window.addEventListener('beforeunload', saveSkinPacksTabState);
}