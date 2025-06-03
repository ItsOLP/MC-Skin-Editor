import { getDbInstance, SKINS_STORE_NAME, SKIN_PACKS_STORE_NAME, clearObjectStore } from './db.js';
// Import functions to refresh views if needed after deletion
import { loadAndDisplaySkins } from './skins-module.js';
import { loadAndDisplaySkinPacks } from './skin-packs-module.js';


const deleteAllSkinsBtn = document.getElementById('delete-all-skins-btn');
const deleteAllSkinPacksBtn = document.getElementById('delete-all-skin-packs-btn');
const deleteAllDataBtn = document.getElementById('delete-all-data-btn');
// Theme selector is handled by ui.js's setupThemeControls, no need to re-select here unless for specific settings tab logic.

async function handleDeleteAllSkins() {
    const db = getDbInstance();
    if (!db) {
        alert("Database not initialized. Cannot delete skins.");
        return;
    }
    if (confirm("Are you sure you want to delete ALL skins? This action cannot be undone.")) {
        const success = await clearObjectStore(SKINS_STORE_NAME);
        if (success) {
            alert("All skins have been deleted.");
            // Check if skins tab is currently active and refresh its view
            if (document.querySelector('#skins-content.active-content')) {
                loadAndDisplaySkins();
            }
        } else {
            alert("Failed to delete all skins. Check console for errors.");
        }
    }
}

async function handleDeleteAllSkinPacks() {
    const db = getDbInstance();
    if (!db) {
        alert("Database not initialized. Cannot delete skin packs.");
        return;
    }
    if (confirm("Are you sure you want to delete ALL skin packs? This action cannot be undone.")) {
        const success = await clearObjectStore(SKIN_PACKS_STORE_NAME);
        if (success) {
            alert("All skin packs have been deleted.");
            // Check if skin packs tab is currently active and refresh its view
            if (document.querySelector('#skin-packs-content.active-content')) {
                loadAndDisplaySkinPacks();
            }
        } else {
            alert("Failed to delete all skin packs. Check console for errors.");
        }
    }
}

async function handleDeleteAllData() {
    const db = getDbInstance();
    if (!db) {
        alert("Database not initialized. Cannot delete data.");
        return;
    }
    if (confirm("WARNING: This will delete ALL skins AND skin packs. This action cannot be undone. Are you absolutely sure?")) {
        const skinsCleared = await clearObjectStore(SKINS_STORE_NAME);
        const packsCleared = await clearObjectStore(SKIN_PACKS_STORE_NAME);

        if (skinsCleared && packsCleared) {
            alert("All data (skins and skin packs) has been deleted.");
            // Refresh views if active
            if (document.querySelector('#skins-content.active-content')) {
                loadAndDisplaySkins();
            }
            if (document.querySelector('#skin-packs-content.active-content')) {
                loadAndDisplaySkinPacks();
            }
        } else {
            alert("Failed to delete all data. Some data might remain. Check console for errors.");
        }
    }
}


export function initSettingsTab() {
    if (deleteAllSkinsBtn) deleteAllSkinsBtn.onclick = handleDeleteAllSkins;
    if (deleteAllSkinPacksBtn) deleteAllSkinPacksBtn.onclick = handleDeleteAllSkinPacks;
    if (deleteAllDataBtn) deleteAllDataBtn.onclick = handleDeleteAllData;

    // Theme selector functionality is already set up by ui.js/setupThemeControls,
    // which is called once in app.js. No need to re-initialize it here unless
    // there's settings-tab-specific logic for the theme selector.
}