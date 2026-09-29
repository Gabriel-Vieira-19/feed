import { createResumableSession, ensureDriveFolders, getDriveAccessToken } from "./_lib/google-drive.js";
import { handleError, json, methodNotAllowed, readJson } from "./_lib/http.js";
import { requireUser } from "./_lib/supabase-admin.js";

const MAX_ORIGINAL_BYTES = 30 * 1024 * 1024;
const MAX_PREVIEW_BYTES = 2 * 1024 * 1024;

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
    if (!["original", "preview"].includes(kind)) {
      const error = new Error("Tipo de upload inválido."); error.statusCode = 400; throw error;
    }
    if (kind === "preview" && mimeType !== "image/jpeg") {
      const error = new Error("A prévia precisa estar em JPEG."); error.statusCode = 400; throw error;
    }
    if (kind === "original" && !(mimeType.startsWith("image/") || mimeType === "application/octet-stream")) {
      const error = new Error("O arquivo precisa ser uma imagem."); error.statusCode = 400; throw error;
    }

    const accessToken = await getDriveAccessToken();
    const folders = await ensureDriveFolders(accessToken);
    const folderId = kind === "original" ? folders.originalsId : folders.previewsId;
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

    return json(res, 200, { sessionUrl });
  } catch (error) {
    return handleError(res, error);
  }
}
