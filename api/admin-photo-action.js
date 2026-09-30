import { deleteDriveFile, getDriveAccessToken } from "../server/google-drive.js";
import { handleError, json, methodNotAllowed, readJson, requireAdmin } from "../server/http.js";
import { getAdminSupabase } from "../server/supabase-admin.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);
  try {
    requireAdmin(req);
    const body = await readJson(req);
    const photoId = String(body.photoId || "");
    const action = String(body.action || "");
    if (!photoId || !["hide", "show", "delete"].includes(action)) {
      const error = new Error("Ação administrativa inválida."); error.statusCode = 400; throw error;
    }

    const supabase = getAdminSupabase();
    const { data: photo, error } = await supabase
      .from("photos")
      .select("id,original_drive_id,preview_drive_id,published_drive_id,published")
      .eq("id", photoId)
      .maybeSingle();
    if (error) throw error;
    if (!photo) {
      const notFound = new Error("Foto não encontrada."); notFound.statusCode = 404; throw notFound;
    }

    if (action === "hide" || action === "show") {
      const { error: updateError } = await supabase
        .from("photos")
        .update({ published: action === "show" })
        .eq("id", photoId);
      if (updateError) throw updateError;
      return json(res, 200, { ok: true, action });
    }

    const { error: deleteError } = await supabase.from("photos").delete().eq("id", photoId);
    if (deleteError) throw deleteError;

    // Apaga primeiro o registro do feed. Se o Drive falhar, os arquivos órfãos
    // serão recolhidos pela limpeza automática, sem deixar um card quebrado.
    const accessToken = await getDriveAccessToken();
    await Promise.allSettled([
      deleteDriveFile(accessToken, photo.original_drive_id),
      deleteDriveFile(accessToken, photo.preview_drive_id),
      photo.published_drive_id ? deleteDriveFile(accessToken, photo.published_drive_id) : Promise.resolve(false),
    ]);
    return json(res, 200, { ok: true, action: "delete" });
  } catch (error) {
    return handleError(res, error);
  }
}
