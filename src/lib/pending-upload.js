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

function fileRecord(file) {
  if (!file) return null;
  return {
    blob: file,
    name: file.name || `foto-${Date.now()}.jpg`,
    type: file.type || "image/jpeg",
    lastModified: Number(file.lastModified || Date.now()),
  };
}

function restoreFile(record, fallbackName = "foto.jpg") {
  if (!record?.blob) return null;
  return new File([record.blob], record.name || fallbackName, {
    type: record.type || record.blob.type || "image/jpeg",
    lastModified: Number(record.lastModified || Date.now()),
  });
}

export async function savePendingCapture(capture) {
  const originalFile = capture instanceof File ? capture : capture?.originalFile;
  if (!originalFile) return false;
  try {
    await withStore("readwrite", store => store.put({
      version: 2,
      original: fileRecord(originalFile),
      published: fileRecord(capture?.publishedFile || null),
      effectId: String(capture?.effectId || "original"),
      effectMeta: capture?.effectMeta && typeof capture.effectMeta === "object" ? capture.effectMeta : {},
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
    if (!record?.savedAt) return null;
    if (Date.now() - Number(record.savedAt) > MAX_AGE_MS) {
      await clearPendingCapture();
      return null;
    }

    // Compatibilidade com a versão anterior, que salvava apenas um blob na raiz.
    if (record.blob) {
      const originalFile = restoreFile(record, "foto.jpg");
      return originalFile ? { originalFile, publishedFile: null, effectId: "original", effectMeta: {} } : null;
    }

    const originalFile = restoreFile(record.original, "foto.jpg");
    if (!originalFile) return null;
    return {
      originalFile,
      publishedFile: restoreFile(record.published, "foto-editada.jpg"),
      effectId: String(record.effectId || "original"),
      effectMeta: record.effectMeta && typeof record.effectMeta === "object" ? record.effectMeta : {},
    };
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
