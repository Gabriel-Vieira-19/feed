import { fetchDriveMedia, getDriveAccessToken } from "./_lib/google-drive.js";
import { json, methodNotAllowed } from "./_lib/http.js";
import { getAdminSupabase } from "./_lib/supabase-admin.js";

export default async function handler(req, res) {
  if (req.method !== "GET") return methodNotAllowed(res, ["GET"]);
  try {
    const photoId = String(req.query?.photo || "");
    if (!photoId) return json(res, 400, { error: "Foto não informada." });

    const supabase = getAdminSupabase();
    const { data: photo, error } = await supabase
      .from("photos")
      .select("preview_drive_id,preview_size_bytes,published")
      .eq("id", photoId)
      .eq("published", true)
      .maybeSingle();
    if (error) throw error;
    if (!photo) return json(res, 404, { error: "Foto não encontrada." });
    if (Number(photo.preview_size_bytes || 0) > 2 * 1024 * 1024) return json(res, 413, { error: "Prévia inválida." });

    const accessToken = await getDriveAccessToken();
    const driveResponse = await fetchDriveMedia(accessToken, photo.preview_drive_id);
    const buffer = Buffer.from(await driveResponse.arrayBuffer());
    if (buffer.length > 2.2 * 1024 * 1024) return json(res, 413, { error: "Prévia acima do limite seguro." });

    res.statusCode = 200;
    res.setHeader("Content-Type", driveResponse.headers.get("Content-Type") || "image/jpeg");
    res.setHeader("Content-Length", String(buffer.length));
    res.setHeader("Cache-Control", "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400");
    res.end(buffer);
  } catch (error) {
    console.error(error);
    return json(res, 502, { error: error.message || "Não foi possível carregar a prévia." });
  }
}
