import { initDB } from './db.js';
import { 
    setupThemeControls, 
    setupNavigation, 
    showContent, 
    setupCommonModals,
    largeSkinPreviewModal, 
    closeLargeSkinPreview  
} from './ui.js';
import { 
    initSkinsTab
} from './skins-module.js';
import { 
    initSkinPacksTab, 
    editSkinInPackModal, 
    closeEditSkinInPackModal
} from './skin-packs-module.js';
import { initSettingsTab } from './settings-module.js';
// Import the close function for the new modal from editor-module
import { closeSaveNewSkinModal } from './editor-module.js'; 

document.addEventListener('DOMContentLoaded', async () => {
    try {
        await initDB(); 

        setupThemeControls(); 
        
        const initialHash = setupNavigation(); 
        
        setupCommonModals(); 

        initSkinsTab();
        initSkinPacksTab();
        initSettingsTab();
        
        showContent(initialHash);

        // Global modal background click handlers
        // Get the new modal element by ID
        const saveNewSkinModalElement = document.getElementById('save-new-skin-modal');

        window.addEventListener('click', (event) => {
            if (largeSkinPreviewModal && event.target == largeSkinPreviewModal) {
                closeLargeSkinPreview();
            }
            if (editSkinInPackModal && event.target == editSkinInPackModal) {
                closeEditSkinInPackModal();
            }
            // Add handler for the new save-new-skin-modal
            if (saveNewSkinModalElement && event.target == saveNewSkinModalElement) {
                if (typeof closeSaveNewSkinModal === 'function') { // Ensure the function is imported
                    closeSaveNewSkinModal();
                } else {
                    console.warn("closeSaveNewSkinModal function not available to app.js");
                }
            }
        });

        console.log("Application initialized successfully.");

    } catch (error) {
        console.error("Failed to initialize application:", error);
        const mainElement = document.querySelector('main');
        if (mainElement) {
            mainElement.innerHTML = `<p style="color:red; text-align:center; padding:20px;">Error initializing application. Please check the console for details and try refreshing the page.</p>`;
        }
    }
});