import { config } from "../config.js";
import { getAccessToken } from "./supabase.js";
import { calculateParts, hashFileParts } from "./md5.js";
import { readImageDimensions, safeFilename, sleep } from "./utils.js";

async function fetchWithTimeout(url, options = {}, timeoutMs = 120_000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (error) {
    if (error?.name === "AbortError") throw new Error("A conexão demorou demais. Verifique a internet e tente novamente.");
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

async function apiFetch(path, options = {}, { auth = true, retries = 1 } = {}) {
  const headers = new Headers(options.headers || {});
  if (auth) headers.set("Authorization", `Bearer ${await getAccessToken()}`);

  let lastError;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await fetchWithTimeout(`${config.workerUrl}${path}`, { ...options, headers });
      const contentType = response.headers.get("content-type") || "";
      const payload = contentType.includes("application/json") ? await response.json() : await response.text();
      if (!response.ok) {
        const message = typeof payload === "object" ? payload?.error || payload?.message : payload;
        const error = new Error(message || `Erro HTTP ${response.status}.`);
        error.code = payload?.code;
        error.status = response.status;
        throw error;
      }
      return payload;
    } catch (error) {
      lastError = error;
      if (attempt >= retries || (error.status && error.status < 500)) break;
      await sleep(600 * (attempt + 1));
    }
  }
  throw lastError;
}

export async function uploadPhoto(file, displayName, onProgress = () => {}) {
  if (!(file instanceof File || file instanceof Blob)) throw new Error("Foto inválida.");
  if (!file.type.startsWith("image/")) throw new Error("Selecione uma imagem.");
  if (file.size > config.maxPhotoBytes) throw new Error("A foto ultrapassa o limite de 30 MB.");

  const parts = calculateParts(file.size);
  onProgress({ stage: "hash", value: 0.03, label: "Preparando a foto…" });
  const blockList = await hashFileParts(file, parts, value => {
    onProgress({ stage: "hash", value: 0.03 + value * 0.12, label: "Preparando a foto…" });
  });

  const dimensions = await readImageDimensions(file);
  const originalName = safeFilename(file.name || "foto.jpg");

  const start = await apiFetch("/api/uploads/start", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      originalName,
      mimeType: file.type || "image/jpeg",
      size: file.size,
      blocks: blockList,
      width: dimensions.width,
      height: dimensions.height,
      displayName,
      partSizes: parts.map(part => part.size),
    }),
  });

  if (start.alreadyExists && start.photo) {
    onProgress({ stage: "done", value: 1, label: "Publicada!" });
    return start.photo;
  }

  const uploadParts = Array.isArray(start.partsToUpload) && start.partsToUpload.length
    ? start.partsToUpload
    : parts.map(part => part.index);

  let completedBytes = 0;
  const uploadBytes = uploadParts.reduce((sum, index) => sum + (parts[index]?.size || 0), 0) || file.size;

  for (const partIndex of uploadParts) {
    const part = parts[partIndex];
    if (!part) throw new Error("O TeraBox solicitou um fragmento inválido.");
    const blob = file.slice(part.start, part.end, file.type || "application/octet-stream");
    onProgress({
      stage: "upload",
      value: 0.15 + (completedBytes / uploadBytes) * 0.72,
      label: `Enviando foto… ${Math.round((completedBytes / uploadBytes) * 100)}%`,
    });

    await apiFetch(`/api/uploads/chunk?part=${partIndex}`, {
      method: "POST",
      headers: {
        "Authorization": `Upload ${start.session}`,
        "Content-Type": "application/octet-stream",
      },
      body: blob,
    }, { auth: false, retries: 2 });

    completedBytes += part.size;
  }

  onProgress({ stage: "finish", value: 0.9, label: "Finalizando publicação…" });
  const result = await apiFetch("/api/uploads/finish", {
    method: "POST",
    headers: {
      "Authorization": `Upload ${start.session}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({}),
  }, { auth: false, retries: 1 });

  onProgress({ stage: "done", value: 1, label: "Publicada!" });
  return result.photo;
}

export async function refreshThumbnail(photoId) {
  return await apiFetch(`/api/photos/${encodeURIComponent(photoId)}/thumbnail`, { method: "POST" }, { retries: 1 });
}

export async function fetchOriginalBlob(photoId) {
  const headers = new Headers();
  headers.set("Authorization", `Bearer ${await getAccessToken()}`);
  const response = await fetchWithTimeout(`${config.workerUrl}/api/photos/${encodeURIComponent(photoId)}/original`, { headers }, 90_000);
  if (!response.ok) {
    let message = "Não foi possível abrir a foto original.";
    try {
      const body = await response.json();
      message = body.error || message;
    } catch {}
    throw new Error(message);
  }
  return await response.blob();
}

export async function getWorkerHealth() {
  return await apiFetch("/api/health", { method: "GET" }, { auth: false, retries: 0 });
}
