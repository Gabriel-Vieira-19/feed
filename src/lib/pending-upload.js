const DB_NAME = "pedro-momentos-local";
const STORE_NAME = "pending-capture";
const RECORD_KEY = "current";
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

function openDb() {
  return new Promise((resolve, reject) => {
    if (!("indexedDB" in window)) {
      reject(new Error("IndexedDB indisponível."));
      return;
    }
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Falha ao abrir armazenamento local."));
  });
}

async function withStore(mode, callback) {
  const db = await openDb();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, mode);
      const store = tx.objectStore(STORE_NAME);
      let result;
      try {
        result = callback(store, resolve, reject);
      } catch (error) {
        reject(error);
        return;
      }
      tx.onerror = () => reject(tx.error || new Error("Falha no armazenamento local."));
      if (result instanceof IDBRequest) {
        result.onsuccess = () => resolve(result.result);
        result.onerror = () => reject(result.error || new Error("Falha no armazenamento local."));
      }
    });
  } finally {
    db.close();
  }
}

export async function savePendingCapture(file) {
  if (!file) return false;
  try {
    await withStore("readwrite", store => store.put({
      blob: file,
      name: file.name || `foto-${Date.now()}.jpg`,
      type: file.type || "image/jpeg",
      lastModified: Number(file.lastModified || Date.now()),
      savedAt: Date.now(),
    }, RECORD_KEY));
    return true;
  } catch {
    return false;
  }
}

export async function loadPendingCapture() {
  try {
    const record = await withStore("readonly", store => store.get(RECORD_KEY));
    if (!record?.blob || !record?.savedAt) return null;
    if (Date.now() - Number(record.savedAt) > MAX_AGE_MS) {
      await clearPendingCapture();
      return null;
    }
    return new File([record.blob], record.name || "foto.jpg", {
      type: record.type || record.blob.type || "image/jpeg",
      lastModified: Number(record.lastModified || record.savedAt),
    });
  } catch {
    return null;
  }
}

export async function clearPendingCapture() {
  try {
    await withStore("readwrite", store => store.delete(RECORD_KEY));
  } catch {
    // O IndexedDB é apenas uma camada extra de recuperação.
  }
}

export async function requestPersistentStorage() {
  try {
    if (navigator.storage?.persist) await navigator.storage.persist();
  } catch {
    // Não bloqueia o aplicativo caso o navegador negue persistência.
  }
}
