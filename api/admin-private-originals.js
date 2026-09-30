import { getDriveAccessToken, removeAnyoneReader } from "./_lib/google-drive.js";
import { handleError, json, methodNotAllowed, requireAdmin } from "./_lib/http.js";
import { getAdminSupabase } from "./_lib/supabase-admin.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);
  try {
    requireAdmin(req);
    const supabase = getAdminSupabase();
    const { data: photos, error } = await supabase.from("photos").select("original_drive_id");
    if (error) throw error;
    const accessToken = await getDriveAccessToken();
    let updated = 0;
    for (const photo of photos || []) {
      try {
        updated += await removeAnyoneReader(accessToken, photo.original_drive_id);
      } catch (error) {
        console.error("Falha ao privatizar original", photo.original_drive_id, error);
      }
    }
    return json(res, 200, { ok: true, updated });
  } catch (error) {
    return handleError(res, error);
  }
}
