import { fetchDriveMediaRange, getDriveAccessToken } from "../server/google-drive.js";
import { handleError, json, methodNotAllowed } from "../server/http.js";
import { getAdminSupabase, requireUser } from "../server/supabase-admin.js";

const MAX_CHUNK_BYTES = 3 * 1024 * 1024;
const MAX_ORIGINAL_BYTES = 30 * 1024 * 1024;

export default async function handler(req, res) {
  if (req.method !== "GET") return methodNotAllowed(res, ["GET"]);
  try {
    const user = await requireUser(req);
    const photoId = String(req.query?.photo || "");
    const start = Number(req.query?.start);
    const end = Number(req.query?.end);
    const variant = String(req.query?.variant || "original") === "published" ? "published" : "original";
    if (!photoId || !Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end < start) {
      const error = new Error("Faixa de download inválida."); error.statusCode = 400; throw error;
    }
    if (end - start + 1 > MAX_CHUNK_BYTES) {
      const error = new Error("Bloco de download acima do limite."); error.statusCode = 413; throw error;
    }

    const supabase = getAdminSupabase();
    const { data: photo, error } = await supabase
      .from("photos")
      .select("user_id,original_drive_id,mime_type,size_bytes,published_drive_id,published_mime_type,published_size_bytes,published")
      .eq("id", photoId)
      .eq("user_id", user.id)
      .eq("published", true)
      .maybeSingle();
    if (error) throw error;
    if (!photo) {
      const notFound = new Error("Foto não encontrada em Meus cliques."); notFound.statusCode = 404; throw notFound;
    }

    const usePublished = variant === "published" && photo.published_drive_id && Number(photo.published_size_bytes || 0) > 0;
    const total = usePublished ? Number(photo.published_size_bytes || 0) : Number(photo.size_bytes || 0);
    const driveId = usePublished ? photo.published_drive_id : photo.original_drive_id;
    const mimeType = usePublished ? (photo.published_mime_type || "image/jpeg") : photo.mime_type;
    if (!Number.isFinite(total) || total <= 0 || total > MAX_ORIGINAL_BYTES || start >= total) {
      const invalid = new Error("Tamanho da foto inválido."); invalid.statusCode = 400; throw invalid;
    }
    const safeEnd = Math.min(end, total - 1);

    const accessToken = await getDriveAccessToken();
    const driveResponse = await fetchDriveMediaRange(accessToken, driveId, start, safeEnd);
    const buffer = Buffer.from(await driveResponse.arrayBuffer());
    if (buffer.length > MAX_CHUNK_BYTES) {
      const tooLarge = new Error("O Google Drive devolveu um bloco acima do limite."); tooLarge.statusCode = 502; throw tooLarge;
    }

    res.statusCode = 206;
    res.setHeader("Content-Type", driveResponse.headers.get("Content-Type") || mimeType || "application/octet-stream");
    res.setHeader("Content-Length", String(buffer.length));
    res.setHeader("Content-Range", `bytes ${start}-${start + buffer.length - 1}/${total}`);
    res.setHeader("Accept-Ranges", "bytes");
    res.setHeader("Cache-Control", "private, no-store");
    res.end(buffer);
  } catch (error) {
    if (res.headersSent) return res.end();
    return handleError(res, error);
  }
}
