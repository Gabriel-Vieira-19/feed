import { config } from "../config.js";
import { getAccessToken } from "./supabase.js";
import { fileStem, safeFilename, wait } from "./utils.js";

const PREVIEW_TYPE = "image/jpeg";
const UPLOAD_DRAFTS_KEY = "pedro_momentos_upload_drafts_v2";
const UPLOAD_DRAFT_MAX_AGE_MS = 24 * 60 * 60 * 1000;

function fileFingerprint(file) {
  return [
    file.name || "foto",
    Number(file.size || 0),
    Number(file.lastModified || 0),
    file.type || "application/octet-stream",
  ].join("|");
}

function readUploadDrafts() {
  try {
    const parsed = JSON.parse(localStorage.getItem(UPLOAD_DRAFTS_KEY) || "{}");
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const now = Date.now();
    const fresh = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (value?.uploadGroupId && Number(value?.updatedAt || 0) > now - UPLOAD_DRAFT_MAX_AGE_MS) {
        fresh[key] = value;
      }
    }
    return fresh;
  } catch {
    return {};
  }
}

function writeUploadDrafts(drafts) {
  try {
    localStorage.setItem(UPLOAD_DRAFTS_KEY, JSON.stringify(drafts));
  } catch {
    // Se o navegador bloquear localStorage, a proteção do servidor continua funcionando.
  }
}

function getOrCreateUploadGroupId(file) {
  const key = fileFingerprint(file);
  const drafts = readUploadDrafts();
  const existing = drafts[key];
  if (existing?.uploadGroupId) {
    drafts[key] = { ...existing, updatedAt: Date.now() };
    writeUploadDrafts(drafts);
    return existing.uploadGroupId;
  }

  const uploadGroupId = crypto.randomUUID();
  drafts[key] = { uploadGroupId, updatedAt: Date.now() };
  const trimmed = Object.fromEntries(
    Object.entries(drafts)
      .sort((a, b) => Number(b[1]?.updatedAt || 0) - Number(a[1]?.updatedAt || 0))
      .slice(0, 12),
  );
  writeUploadDrafts(trimmed);
  return uploadGroupId;
}

export function clearUploadRecovery(file) {
  const key = fileFingerprint(file);
  const drafts = readUploadDrafts();
  if (!(key in drafts)) return;
  delete drafts[key];
  writeUploadDrafts(drafts);
}

async function apiFetch(path, options = {}) {
  const token = await getAccessToken();
  const response = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Erro ${response.status}.`);
  return data;
}

async function decodeImage(file) {
  if ("createImageBitmap" in window) {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
      return {
        width: bitmap.width,
        height: bitmap.height,
        draw(ctx, width, height) { ctx.drawImage(bitmap, 0, 0, width, height); },
        close() { bitmap.close?.(); },
      };
    } catch {
      // Safari/formatos específicos podem cair no fallback abaixo.
    }
  }

  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.decoding = "async";
    image.src = url;
    await image.decode();
    return {
      width: image.naturalWidth,
      height: image.naturalHeight,
      draw(ctx, width, height) { ctx.drawImage(image, 0, 0, width, height); },
      close() {},
    };
  } finally {
    URL.revokeObjectURL(url);
  }
}

function canvasToBlob(canvas, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => {
      if (!blob) reject(new Error("Não foi possível gerar a prévia da foto."));
      else resolve(blob);
    }, PREVIEW_TYPE, quality);
  });
}

export async function createFeedPreview(file) {
  const source = await decodeImage(file);
  try {
    if (!source.width || !source.height) throw new Error("Não foi possível ler as dimensões da foto.");

    let maxDimension = 1600;
    let quality = 0.86;
    let blob = null;
    let width = 0;
    let height = 0;

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const scale = Math.min(1, maxDimension / Math.max(source.width, source.height));
      width = Math.max(1, Math.round(source.width * scale));
      height = Math.max(1, Math.round(source.height * scale));

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d", { alpha: false });
      if (!ctx) throw new Error("Seu navegador não conseguiu preparar a prévia da foto.");
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.fillStyle = "#071a33";
      ctx.fillRect(0, 0, width, height);
      source.draw(ctx, width, height);
      blob = await canvasToBlob(canvas, quality);
      canvas.width = 1;
      canvas.height = 1;

      if (blob.size <= config.previewMaxBytes) break;
      quality = Math.max(0.66, quality - 0.08);
      maxDimension = Math.max(1000, Math.round(maxDimension * 0.86));
    }

    if (!blob || blob.size > config.previewMaxBytes) {
      throw new Error("A foto é muito complexa para gerar uma prévia leve. Tente outra foto.");
    }

    return {
      blob,
      width: source.width,
      height: source.height,
      previewWidth: width,
      previewHeight: height,
    };
  } finally {
    source.close();
  }
}

async function createUploadSession({ kind, file, uploadGroupId, displayName }) {
  const filename = kind === "preview"
    ? `${fileStem(file.name || "foto")}-preview.jpg`
    : safeFilename(file.name || `foto-${Date.now()}.jpg`);

  return apiFetch("/api/drive-upload-session", {
    method: "POST",
    body: JSON.stringify({
      kind,
      uploadGroupId,
      filename,
      mimeType: kind === "preview" ? PREVIEW_TYPE : (file.type || "application/octet-stream"),
      size: file.size,
      displayName,
    }),
  });
}

async function proxyUploadRequest(sessionUrl, { body = null, contentType = "application/octet-stream", contentRange }) {
  const token = await getAccessToken();
  const headers = {
    Authorization: `Bearer ${token}`,
    "X-Drive-Session-Url": sessionUrl,
    "Content-Range": contentRange,
  };
  if (body) headers["Content-Type"] = contentType || "application/octet-stream";

  let response;
  try {
    response = await fetch("/api/drive-upload-proxy", {
      method: "PUT",
      headers,
      body,
    });
  } catch {
    throw new Error("Não foi possível alcançar o servidor de upload. Verifique sua conexão e tente novamente.");
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Falha no envio (${response.status}).`);
  return data;
}

async function queryUploadOffset(sessionUrl, total) {
  const result = await proxyUploadRequest(sessionUrl, { contentRange: `bytes */${total}` });
  if (result.complete) return { complete: true, metadata: result.metadata };
  return { complete: false, next: Number.isInteger(result.next) ? result.next : 0 };
}

export async function uploadFileResumable(sessionUrl, file, onProgress) {
  let offset = 0;
  let retryCount = 0;
  const total = file.size;

  while (offset < total) {
    if (!navigator.onLine) throw new Error("Você está sem conexão. Quando a internet voltar, toque em publicar novamente.");
    const end = Math.min(total, offset + config.uploadChunkBytes);
    const chunk = file.slice(offset, end);

    try {
      const result = await proxyUploadRequest(sessionUrl, {
        body: chunk,
        contentType: file.type || "application/octet-stream",
        contentRange: `bytes ${offset}-${end - 1}/${total}`,
      });

      if (result.complete) {
        onProgress?.(1);
        return result.metadata;
      }

      offset = Number.isInteger(result.next) ? result.next : end;
      retryCount = 0;
      onProgress?.(Math.min(0.99, offset / total));
    } catch (error) {
      retryCount += 1;
      if (retryCount > 4 || !navigator.onLine) throw error;
      await wait(500 * 2 ** (retryCount - 1));
      const status = await queryUploadOffset(sessionUrl, total);
      if (status.complete) return status.metadata;
      offset = status.next;
    }
  }

  const status = await queryUploadOffset(sessionUrl, total);
  if (status.complete) return status.metadata;
  throw new Error("O Google Drive não confirmou o término do upload.");
}

async function uploadOrReuse(session, file, onProgress) {
  if (session?.alreadyUploaded && session?.file?.id) {
    onProgress?.(1);
    return session.file;
  }
  if (!session?.sessionUrl) throw new Error("O servidor não devolveu uma sessão de upload válida.");
  return uploadFileResumable(session.sessionUrl, file, onProgress);
}

export async function uploadPhotoToDrive(file, displayName, onProgress) {
  const uploadGroupId = getOrCreateUploadGroupId(file);

  onProgress?.({ label: "Preparando a prévia…", value: 0.03 });
  const previewData = await createFeedPreview(file);
  const previewFile = new File(
    [previewData.blob],
    `${fileStem(file.name || "foto")}-preview.jpg`,
    { type: PREVIEW_TYPE, lastModified: file.lastModified || Date.now() },
  );

  onProgress?.({ label: "Verificando envio anterior…", value: 0.08 });
  const [originalSession, previewSession] = await Promise.all([
    createUploadSession({ kind: "original", file, uploadGroupId, displayName }),
    createUploadSession({ kind: "preview", file: previewFile, uploadGroupId, displayName }),
  ]);

  onProgress?.({
    label: originalSession.alreadyUploaded ? "Foto original já enviada. Reaproveitando…" : "Enviando foto original…",
    value: originalSession.alreadyUploaded ? 0.74 : 0.12,
  });
  const original = await uploadOrReuse(originalSession, file, ratio => {
    onProgress?.({ label: "Enviando foto original…", value: 0.12 + ratio * 0.62 });
  });

  onProgress?.({
    label: previewSession.alreadyUploaded ? "Prévia já enviada. Reaproveitando…" : "Enviando prévia…",
    value: previewSession.alreadyUploaded ? 0.92 : 0.76,
  });
  const preview = await uploadOrReuse(previewSession, previewFile, ratio => {
    onProgress?.({ label: "Enviando prévia…", value: 0.76 + ratio * 0.16 });
  });

  onProgress?.({ label: "Publicando no feed…", value: 0.94 });
  const published = await apiFetch("/api/photo-publish", {
    method: "POST",
    body: JSON.stringify({
      uploadGroupId,
      originalFileId: original.id,
      previewFileId: preview.id,
      width: previewData.width,
      height: previewData.height,
    }),
  });

  onProgress?.({ label: "Publicado!", value: 1 });
  return {
    ...published.photo,
    preview_url: `/api/media?photo=${encodeURIComponent(published.photo.id)}`,
  };
}

function extensionFromMime(mimeType) {
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/webp") return "webp";
  if (mimeType === "image/heic" || mimeType === "image/heif") return "heic";
  return "jpg";
}

export async function downloadOriginalPhoto(photo, onProgress) {
  if (!photo?.id || !photo?.size_bytes) throw new Error("Dados da foto original indisponíveis.");
  const total = Number(photo.size_bytes);
  if (!Number.isFinite(total) || total <= 0 || total > config.maxPhotoBytes) throw new Error("Tamanho da foto inválido.");

  const token = await getAccessToken();
  const chunks = [];
  let offset = 0;

  while (offset < total) {
    const end = Math.min(total - 1, offset + config.downloadChunkBytes - 1);
    const response = await fetch(`/api/original-chunk?photo=${encodeURIComponent(photo.id)}&start=${offset}&end=${end}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || `Falha ao baixar a foto (${response.status}).`);
    }
    const blob = await response.blob();
    if (!blob.size) throw new Error("O servidor devolveu um bloco vazio da foto.");
    chunks.push(blob);
    offset += blob.size;
    onProgress?.(Math.min(1, offset / total));
  }

  const mimeType = photo.mime_type || chunks[0]?.type || "image/jpeg";
  const finalBlob = new Blob(chunks, { type: mimeType });
  const base = String(photo.original_name || `pedro-momentos-${photo.id.slice(0, 8)}`)
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-zA-Z0-9-_ ]+/g, "-")
    .trim() || `pedro-momentos-${photo.id.slice(0, 8)}`;
  const filename = `${base}.${extensionFromMime(mimeType)}`;
  return { blob: finalBlob, filename };
}
