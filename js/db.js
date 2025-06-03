export const DB_NAME = 'minecraftSkinAppDB';
export const SKINS_STORE_NAME = 'skins';
export const SKIN_PACKS_STORE_NAME = 'skinPacks';

let dbInstance = null;

export function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 3); // Version from original script

        request.onerror = event => {
            console.error("Error opening DB:", event.target.errorCode);
            reject("Error opening DB: " + event.target.errorCode);
        };

        request.onsuccess = event => {
            dbInstance = event.target.result;
            console.log("Database opened successfully.");
            resolve(dbInstance);
        };

        request.onupgradeneeded = event => {
            dbInstance = event.target.result;
            if (!dbInstance.objectStoreNames.contains(SKINS_STORE_NAME)) {
                const skinsStore = dbInstance.createObjectStore(SKINS_STORE_NAME, { keyPath: 'id', autoIncrement: true });
                skinsStore.createIndex('name', 'name', { unique: false });
            }
            if (!dbInstance.objectStoreNames.contains(SKIN_PACKS_STORE_NAME)) {
                const skinPacksStore = dbInstance.createObjectStore(SKIN_PACKS_STORE_NAME, { keyPath: 'id', autoIncrement: true });
                skinPacksStore.createIndex('name', 'name', { unique: false });
                skinPacksStore.createIndex('uuidHeader', 'uuidHeader', { unique: false }); // Added from original
            }
            console.log("Database upgrade complete.");
        };
    });
}

export function getDbInstance() {
    if (!dbInstance) {
        console.error("DB not initialized. Call initDB() first.");
    }
    return dbInstance;
}

export async function clearObjectStore(storeName) {
    const db = getDbInstance();
    if (!db) {
        console.error("DB not initialized for clearObjectStore.");
        return false;
    }
    try {
        const transaction = db.transaction(storeName, 'readwrite');
        const store = transaction.objectStore(storeName);
        const clearRequest = store.clear();
        return new Promise((resolve, reject) => {
            clearRequest.onsuccess = () => {
                console.log(`Store "${storeName}" cleared.`);
                resolve(true);
            };
            clearRequest.onerror = (event) => {
                console.error(`Error clearing store "${storeName}":`, event.target.error);
                reject(false);
            };
        });
    } catch (error) {
        console.error(`Exception clearing store "${storeName}":`, error);
        return false;
    }
}

// Generic helper to get a skin pack by ID
export async function getSkinPackById(packId) {
    const db = getDbInstance();
    if (!db) return null;
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(SKIN_PACKS_STORE_NAME, 'readonly');
        const store = transaction.objectStore(SKIN_PACKS_STORE_NAME);
        const request = store.get(packId);
        request.onsuccess = () => resolve(request.result);
        request.onerror = (e) => {
            console.error("Error fetching pack by ID:", e.target.error);
            reject(null);
        };
    });
}

// Generic helper to get a skin pack by UUID
export async function getSkinPackByUUID(uuid) {
    const db = getDbInstance();
    if (!db) return null;
    return new Promise((resolve) => {
        const transaction = db.transaction(SKIN_PACKS_STORE_NAME, 'readonly');
        const store = transaction.objectStore(SKIN_PACKS_STORE_NAME);
        // Assuming uuidHeader is indexed. If not, iterate with cursor.
        const index = store.index('uuidHeader'); 
        const request = index.get(uuid);
        
        request.onsuccess = event => {
             // Check if result is found, could be multiple if not unique but get() returns first
            if (request.result) {
                resolve(request.result);
            } else {
                // Fallback to cursor scan if index not reliable or multiple entries possible
                // For simplicity, this example assumes index('uuidHeader').get(uuid) works for unique or first match.
                // A full cursor scan would be more robust if uuids are not strictly unique in the index or multiple entries are possible.
                let foundPack = null;
                const cursorRequest = store.openCursor();
                cursorRequest.onsuccess = e => {
                    const cursor = e.target.result;
                    if (cursor) {
                        if (cursor.value.uuidHeader === uuid) {
                            foundPack = cursor.value;
                           // cursor.continue(); // Stop after first match for this simple get
                           resolve(foundPack); // Resolve once found
                           return;
                        }
                        cursor.continue();
                    } else {
                        resolve(foundPack); // Resolve with null if not found
                    }
                };
                cursorRequest.onerror = () => resolve(null);
            }
        };
        request.onerror = () => resolve(null); // Error on index.get()
    });
}

// Generic helper to get a skin pack by Name
export async function getSkinPackByName(name) {
    const db = getDbInstance();
    if (!db) return null;
    return new Promise((resolve) => {
        const transaction = db.transaction(SKIN_PACKS_STORE_NAME, 'readonly');
        const index = transaction.objectStore(SKIN_PACKS_STORE_NAME).index('name');
        const request = index.get(name);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => resolve(null);
    });
}