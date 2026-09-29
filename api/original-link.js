import { ensureAnyoneReader, getDriveAccessToken, getDriveFile } from "./_lib/google-drive.js";
import { handleError, json, methodNotAllowed } from "./_lib/http.js";
import { getAdminSupabase, requireUser } from "./_lib/supabase-admin.js";

export default async function handler(req, res) {
  if (req.method !== "GET") return methodNotAllowed(res, ["GET"]);
  try {
    await requireUser(req);
    const photoId = String(req.query?.photo || "");
    if (!photoId) {
      const error = new Error("Foto não informada."); error.statusCode = 400; throw error;
    }

    const supabase = getAdminSupabase();
    const { data: photo, error } = await supabase
      .from("photos")
      .select("original_drive_id,original_web_view_url,published")
      .eq("id", photoId)
      .eq("published", true)
      .maybeSingle();
    if (error) throw error;
    if (!photo) {
      const notFound = new Error("Foto não encontrada."); notFound.statusCode = 404; throw notFound;
    }

    if (photo.original_web_view_url) return json(res, 200, { url: photo.original_web_view_url });

    const accessToken = await getDriveAccessToken();
    await ensureAnyoneReader(accessToken, photo.original_drive_id);
    const driveFile = await getDriveFile(accessToken, photo.original_drive_id);
    if (!driveFile.webViewLink) throw new Error("O Google Drive não forneceu um link de visualização.");

    await supabase.from("photos").update({
      original_web_view_url: driveFile.webViewLink,
      original_web_content_url: driveFile.webContentLink || null,
    }).eq("id", photoId);

    return json(res, 200, { url: driveFile.webViewLink });
  } catch (error) {
    return handleError(res, error);
  }
}
