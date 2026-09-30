import { createResumableSession, ensureDriveFolders, findCompletedUploadFile, getDriveAccessToken } from "../server/google-drive.js";
import { handleError, json, methodNotAllowed, readJson } from "../server/http.js";
import { requireUser } from "../server/supabase-admin.js";

const MAX_ORIGINAL_BYTES = 30 * 1024 * 1024;
const MAX_PREVIEW_BYTES = 2 * 1024 * 1024;
const MAX_PUBLISHED_BYTES = 15 * 1024 * 1024;

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ""));
}

export default async function handler(req, res) {
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);
  try {
    const user = await requireUser(req);
    const body = await readJson(req);
    const kind = String(body.kind || "");
    const filename = String(body.filename || "foto");
    const mimeType = String(body.mimeType || "application/octet-stream");
    const size = Number(body.size);
    const uploadGroupId = String(body.uploadGroupId || "");

    if (!isUuid(uploadGroupId)) {
      const error = new Error("Identificador de upload inválido."); error.statusCode = 400; throw error;
    }
    if (!Number.isInteger(size) || size <= 0) {
      const error = new Error("Tamanho de arquivo inválido."); error.statusCode = 400; throw error;
    }
    if (kind === "original" && size > MAX_ORIGINAL_BYTES) {
      const error = new Error("A foto original ultrapassa 30 MB."); error.statusCode = 413; throw error;
    }
    if (kind === "preview" && size > MAX_PREVIEW_BYTES) {
      const error = new Error("A prévia ultrapassa 2 MB."); error.statusCode = 413; throw error;
    }
    if (kind === "published" && size > MAX_PUBLISHED_BYTES) {
      const error = new Error("A foto com efeito ultrapassa 15 MB."); error.statusCode = 413; throw error;
    }
    if (!["original", "preview", "published"].includes(kind)) {
      const error = new Error("Tipo de upload inválido."); error.statusCode = 400; throw error;
    }
    if (["preview", "published"].includes(kind) && mimeType !== "image/jpeg") {
      const error = new Error(kind === "preview" ? "A prévia precisa estar em JPEG." : "A foto com efeito precisa estar em JPEG."); error.statusCode = 400; throw error;
    }
    if (kind === "original" && !(mimeType.startsWith("image/") || mimeType === "application/octet-stream")) {
      const error = new Error("O arquivo precisa ser uma imagem."); error.statusCode = 400; throw error;
    }

    const accessToken = await getDriveAccessToken();
    const folders = await ensureDriveFolders(accessToken);
    const folderId = kind === "original" ? folders.originalsId : kind === "published" ? folders.publishedId : folders.previewsId;

    // Idempotência: se este upload já terminou numa tentativa anterior,
    // reaproveitamos o arquivo existente em vez de criar outra cópia no Drive.
    const existingFiles = await findCompletedUploadFile(accessToken, {
      folderId,
      ownerId: user.id,
      uploadGroupId,
      kind,
    });

    if (existingFiles.length) {
      const existing = existingFiles[0];
      const existingSize = Number(existing.size || 0);
      if (existingSize !== size) {
        const error = new Error("Já existe um arquivo deste envio com tamanho diferente. Escolha a foto novamente.");
        error.statusCode = 409;
        throw error;
      }
      return json(res, 200, { alreadyUploaded: true, file: existing });
    }

    const sessionUrl = await createResumableSession({
      accessToken,
      folderId,
      kind,
      filename,
      mimeType,
      size,
      uploadGroupId,
      ownerId: user.id,
    });

    return json(res, 200, { alreadyUploaded: false, sessionUrl });
  } catch (error) {
    return handleError(res, error);
  }
}
