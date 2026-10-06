import { deleteDriveFile, getDriveAccessToken, listAppFilesCreatedBefore } from "./_lib/google-drive.js";
import { handleError, json, methodNotAllowed, requireCronOrAdmin } from "./_lib/http.js";
import { getAdminSupabase } from "./_lib/supabase-admin.js";

const ABANDONED_AFTER_HOURS = 8;

export default async function handler(req, res) {
  if (!["GET", "POST"].includes(req.method)) return methodNotAllowed(res, ["GET", "POST"]);
  try {
    requireCronOrAdmin(req);
    const cutoff = new Date(Date.now() - ABANDONED_AFTER_HOURS * 60 * 60 * 1000).toISOString();
    const supabase = getAdminSupabase();
    const { data: rows, error } = await supabase.from("photos").select("upload_group_id");
    if (error) throw error;
    const publishedGroups = new Set((rows || []).map(row => String(row.upload_group_id)));

    const accessToken = await getDriveAccessToken();
    const files = await listAppFilesCreatedBefore(accessToken, cutoff);
    let deleted = 0;
    let skipped = 0;
    for (const file of files) {
      const group = String(file.appProperties?.upload_group || "");
      if (!group || publishedGroups.has(group)) {
        skipped += 1;
        continue;
      }
      try {
        if (await deleteDriveFile(accessToken, file.id)) deleted += 1;
      } catch (error) {
        console.error("Falha ao excluir upload abandonado", file.id, error);
      }
    }

    return json(res, 200, { ok: true, deleted, skipped, scanned: files.length, cutoff });
  } catch (error) {
    return handleError(res, error);
  }
}
