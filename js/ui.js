import { initEditor, refreshEditorLayout, saveEditorDraftState } from './editor-module.js'; 

// Callbacks to be registered by other modules
let hideSkinPackCreatorCallback = (isSwitchingTabs) => {}; // Added parameter
let hideSkinEditorFullViewCallback = (isSwitchingTabs) => {}; // Added parameter
let skinsTabActivatedCallback = (isDirectNavigation) => {};
let skinPacksTabActivatedCallback = (isDirectNavigation) => {};

export function registerHideSkinPackCreator(fn) { hideSkinPackCreatorCallback = fn; }
export function registerHideSkinEditorFullView(fn) { hideSkinEditorFullViewCallback = fn; }
export function registerSkinsTabActivated(fn) { skinsTabActivatedCallback = fn; }
export function registerSkinPacksTabActivated(fn) { skinPacksTabActivatedCallback = fn; }

// DOM Elements for UI module
const navLinks = document.querySelectorAll('.nav-link');
const contentSections = document.querySelectorAll('.content-section');
const themeSelector = document.getElementById('theme-selector');
const body = document.body;

export const largeSkinPreviewModal = document.getElementById('large-skin-preview-modal');
const largeSkinPreviewImg = document.getElementById('large-skin-preview-img');
const closeLargeSkinPreviewBtn = document.getElementById('close-large-skin-preview-btn');


export function applyTheme(themeValue) {
    body.removeAttribute('data-theme');
    if (themeValue !== 'white') { 
        body.setAttribute('data-theme', themeValue);
    }
    localStorage.setItem('selectedTheme', themeValue);
    updateSelectArrowColor();
}

export function updateSelectArrowColor() {
    if (!themeSelector) return;
    setTimeout(() => {
        const currentColor = getComputedStyle(document.body).getPropertyValue('--text-color').trim();
        const svg = `<svg fill="${encodeURIComponent(currentColor)}" height="24" viewBox="0 0 24 24" width="24" xmlns="http://www.w3.org/2000/svg"><path d="M7 10l5 5 5-5z"/><path d="M0 0h24v24H0z" fill="none"/></svg>`;
        themeSelector.style.backgroundImage = `url('data:image/svg+xml;utf8,${svg}')`;
    }, 0);
}

export function setupThemeControls() {
    const savedTheme = localStorage.getItem('selectedTheme');
    if (savedTheme && themeSelector) {
        themeSelector.value = savedTheme;
        applyTheme(savedTheme);
    } else if (themeSelector) {
        applyTheme(themeSelector.value); 
    } else {
        applyTheme('white'); 
    }

    if (themeSelector) {
        themeSelector.addEventListener('change', (event) => applyTheme(event.target.value));
    }
}

let previousHash = null;
const pendingFullEditorSkinDataKey = 'pendingFullEditorSkinData'; 

export function showContent(hash, isPopState = false) {
    // If navigating away from the editor tab, save its draft.
    // The editor's own 'beforeunload' will handle browser close.
    // This handles in-app tab navigation.
    if (previousHash === '#editor' && hash !== '#editor') {
        if (typeof saveEditorDraftState === 'function') {
            saveEditorDraftState();
            console.log("UI: Called saveEditorDraftState because navigating away from #editor (in-app).");
        }
        // Clear keys used for one-time navigation from Skins -> Editor
        // if not going to skins (where skins module might need them for its return flow)
        // and also if not a popstate (where user might be going "back" to editor from skins).
        // This cleanup is to prevent stale requests.
        if (hash !== '#skins' && !isPopState) {
            localStorage.removeItem('skinToEditInFullEditorId');
            localStorage.removeItem(pendingFullEditorSkinDataKey);
            console.log("UI: Cleared skinToEditInFullEditorId and pendingFullEditorSkinDataKey due to navigation away from editor and not to skins (and not popstate).");
        }
    }
    
    if (!isPopState && hash === previousHash) { // Click on already active tab
        const currentActiveContentId = document.querySelector('.content-section.active-content')?.id;
        const targetContentIdForCheck = hash.substring(1) + '-content';
        if (currentActiveContentId === targetContentIdForCheck) {
             if (hash === '#editor') {
                // Re-initialize editor to potentially pick up changes or re-render
                initEditor().then(() => { 
                    if (typeof refreshEditorLayout === 'function') {
                        setTimeout(() => refreshEditorLayout(), 50); 
                    }
                });
            } else if (hash === '#skins' && typeof skinsTabActivatedCallback === 'function') {
                skinsTabActivatedCallback(true); // true for same-tab reselect
            } else if (hash === '#skin-packs' && typeof skinPacksTabActivatedCallback === 'function') {
                skinPacksTabActivatedCallback(true); // true for same-tab reselect
            }
            return; 
        }
    }

    // If switching to a different tab, inform the modules of the previous tab
    // that they are being hidden due to a tab switch. (false means not full reset)
    if (previousHash && previousHash !== hash) {
        if (previousHash === '#skins' && typeof hideSkinEditorFullViewCallback === 'function') {
            hideSkinEditorFullViewCallback(false); 
        }
        if (previousHash === '#skin-packs' && typeof hideSkinPackCreatorCallback === 'function') {
            hideSkinPackCreatorCallback(false); 
        }
    }

    navLinks.forEach(link => link.classList.remove('active'));
    contentSections.forEach(section => section.classList.remove('active-content'));

    const activeLink = document.querySelector(`.nav-link[href="${hash}"]`);
    const targetContentId = hash.substring(1) + '-content';
    const targetContent = document.getElementById(targetContentId);

    if (activeLink) activeLink.classList.add('active');
    
    if (targetContent) {
        targetContent.classList.add('active-content');
        
        const isDirectNavigationEvent = (hash !== previousHash) || isPopState;
        previousHash = hash; 

        if (hash === '#skins' && typeof skinsTabActivatedCallback === 'function') {
            skinsTabActivatedCallback(isDirectNavigationEvent); 
        } else if (hash === '#skin-packs' && typeof skinPacksTabActivatedCallback === 'function') {
            skinPacksTabActivatedCallback(isDirectNavigationEvent); 
        } else if (hash === '#editor') {
            initEditor().then(() => { 
                if (typeof refreshEditorLayout === 'function') {
                    setTimeout(() => {
                        refreshEditorLayout();
                    }, 50); 
                }
            });
        }
    } else { 
        console.warn(`Content section for ${hash} not found. Defaulting to #home.`);
        previousHash = '#home'; 
        const homeLink = document.querySelector('.nav-link[href="#home"]');
        const homeContent = document.getElementById('home-content');
        if (homeLink) homeLink.classList.add('active');
        if (homeContent) homeContent.classList.add('active-content');
    }
}


export function setupNavigation() {
    navLinks.forEach(link => {
        link.addEventListener('click', (event) => {
            event.preventDefault();
            const newHash = link.getAttribute('href');
            if (window.location.hash !== newHash || newHash === previousHash) { 
                 if(window.location.hash !== newHash) history.pushState(null, '', newHash); 
                 showContent(newHash, false); 
            }
        });
    });

    window.addEventListener('popstate', () => {
        showContent(window.location.hash || '#home', true); 
    });
    
    previousHash = null; 
    const initialHash = window.location.hash || '#home';
    // On initial load, treat it as a direct navigation event for the activated tab.
    // The modules themselves will handle loading their own persistent state.
    return initialHash; 
}


export function openLargeSkinPreview(imageDataUrl) {
    if (!largeSkinPreviewModal || !largeSkinPreviewImg) return;
    if (!imageDataUrl || imageDataUrl === '#' || imageDataUrl.endsWith('/#')) {
        console.warn("Invalid image URL for preview:", imageDataUrl);
        return;
    }
    largeSkinPreviewImg.src = imageDataUrl;
    largeSkinPreviewModal.style.display = 'flex';
}

export function closeLargeSkinPreview() {
    if (!largeSkinPreviewModal || !largeSkinPreviewImg) return;
    largeSkinPreviewModal.style.display = 'none';
    largeSkinPreviewImg.src = '#'; 
}

export function setupCommonModals() {
    if (closeLargeSkinPreviewBtn) {
        closeLargeSkinPreviewBtn.onclick = closeLargeSkinPreview;
    }
}