import { config } from "../config.js";
import { getAccessToken } from "./supabase.js";
import { fileStem, safeFilename, wait } from "./utils.js";

const PREVIEW_TYPE = "image/jpeg";

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

function parseReceivedEnd(response) {
  const range = response.headers.get("Range") || response.headers.get("range");
  if (!range) return null;
  const match = /bytes=0-(\d+)/i.exec(range);
  return match ? Number(match[1]) : null;
}

async function queryUploadOffset(sessionUrl, total) {
  const response = await fetch(sessionUrl, {
    method: "PUT",
    headers: { "Content-Range": `bytes */${total}` },
  });
  if (response.status === 200 || response.status === 201) {
    return { complete: true, metadata: await response.json() };
  }
  if (response.status === 308) {
    const end = parseReceivedEnd(response);
    return { complete: false, next: end == null ? 0 : end + 1 };
  }
  if (response.status === 404) throw new Error("A sessão de upload expirou. Tente publicar novamente.");
  throw new Error(`Não foi possível consultar o upload (${response.status}).`);
}

export async function uploadFileResumable(sessionUrl, file, onProgress) {
  let offset = 0;
  let retryCount = 0;
  const total = file.size;

  while (offset < total) {
    const end = Math.min(total, offset + config.uploadChunkBytes);
    const chunk = file.slice(offset, end);

    try {
      const response = await fetch(sessionUrl, {
        method: "PUT",
        headers: {
          "Content-Type": file.type || "application/octet-stream",
          "Content-Range": `bytes ${offset}-${end - 1}/${total}`,
        },
        body: chunk,
      });

      if (response.status === 200 || response.status === 201) {
        onProgress?.(1);
        return response.json();
      }

      if (response.status === 308) {
        const receivedEnd = parseReceivedEnd(response);
        offset = receivedEnd == null ? end : receivedEnd + 1;
        retryCount = 0;
        onProgress?.(Math.min(0.99, offset / total));
        continue;
      }

      if (response.status >= 500) throw new Error(`Falha temporária ${response.status}`);
      if (response.status === 404) throw new Error("A sessão de upload expirou. Tente publicar novamente.");
      const text = await response.text().catch(() => "");
      throw new Error(text || `Falha no upload (${response.status}).`);
    } catch (error) {
      retryCount += 1;
      if (retryCount > 4) throw error;
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

export async function uploadPhotoToDrive(file, displayName, onProgress) {
  const uploadGroupId = crypto.randomUUID();

  onProgress?.({ label: "Preparando a prévia…", value: 0.03 });
  const previewData = await createFeedPreview(file);
  const previewFile = new File(
    [previewData.blob],
    `${fileStem(file.name || "foto")}-preview.jpg`,
    { type: PREVIEW_TYPE, lastModified: Date.now() },
  );

  onProgress?.({ label: "Preparando envio…", value: 0.08 });
  const [originalSession, previewSession] = await Promise.all([
    createUploadSession({ kind: "original", file, uploadGroupId, displayName }),
    createUploadSession({ kind: "preview", file: previewFile, uploadGroupId, displayName }),
  ]);

  onProgress?.({ label: "Enviando foto original…", value: 0.12 });
  const original = await uploadFileResumable(originalSession.sessionUrl, file, ratio => {
    onProgress?.({ label: "Enviando foto original…", value: 0.12 + ratio * 0.62 });
  });

  onProgress?.({ label: "Enviando prévia…", value: 0.76 });
  const preview = await uploadFileResumable(previewSession.sessionUrl, previewFile, ratio => {
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

export async function getOriginalViewUrl(photoId) {
  const data = await apiFetch(`/api/original-link?photo=${encodeURIComponent(photoId)}`, { method: "GET" });
  return data.url;
}
