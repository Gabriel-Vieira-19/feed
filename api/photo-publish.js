import { ensureDriveFolders, getDriveAccessToken, getDriveFile } from "../server/google-drive.js";
import { handleError, json, methodNotAllowed, readJson } from "../server/http.js";
import { getAdminSupabase, requireUser } from "../server/supabase-admin.js";

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ""));
}

function verifyFile(file, { userId, uploadGroupId, kind, folderId }) {
  const props = file.appProperties || {};
  return (
    !file.trashed &&
    props.app_id === "pedro_momentos" &&
    props.owner_id === userId &&
    props.upload_group === uploadGroupId &&
    props.kind === kind &&
    Array.isArray(file.parents) &&
    file.parents.includes(folderId)
  );
}

const PUBLIC_FIELDS = "id,user_id,display_name,original_name,mime_type,size_bytes,published_drive_id,published_name,published_mime_type,published_size_bytes,effect_id,effect_meta,width,height,likes_count,created_at";

export default async function handler(req, res) {
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);
  try {
    const user = await requireUser(req);
    const body = await readJson(req);
    const uploadGroupId = String(body.uploadGroupId || "");
    const originalFileId = String(body.originalFileId || "");
    const previewFileId = String(body.previewFileId || "");
    const publishedFileId = String(body.publishedFileId || "");
    const effectId = String(body.effectId || "original").slice(0, 80);
    const effectMeta = body.effectMeta && typeof body.effectMeta === "object" && !Array.isArray(body.effectMeta) ? body.effectMeta : {};
    if (!isUuid(uploadGroupId) || !originalFileId || !previewFileId) {
      const error = new Error("Dados da publicação inválidos."); error.statusCode = 400; throw error;
    }

    const supabase = getAdminSupabase();
    const { data: existing, error: existingError } = await supabase
      .from("photos")
      .select(PUBLIC_FIELDS)
      .eq("upload_group_id", uploadGroupId)
      .maybeSingle();
    if (existingError) throw existingError;
    if (existing) {
      if (existing.user_id !== user.id) {
        const error = new Error("Upload já associado a outro usuário."); error.statusCode = 409; throw error;
      }
      return json(res, 200, { photo: existing, idempotent: true });
    }

    const accessToken = await getDriveAccessToken();
    const folders = await ensureDriveFolders(accessToken);
    const fileRequests = [
      getDriveFile(accessToken, originalFileId),
      getDriveFile(accessToken, previewFileId),
    ];
    if (publishedFileId) fileRequests.push(getDriveFile(accessToken, publishedFileId));
    const [original, preview, published = null] = await Promise.all(fileRequests);

    if (!verifyFile(original, { userId: user.id, uploadGroupId, kind: "original", folderId: folders.originalsId })) {
      const error = new Error("A foto original não pertence a esta publicação."); error.statusCode = 400; throw error;
    }
    if (!verifyFile(preview, { userId: user.id, uploadGroupId, kind: "preview", folderId: folders.previewsId })) {
      const error = new Error("A prévia não pertence a esta publicação."); error.statusCode = 400; throw error;
    }
    if (published && !verifyFile(published, { userId: user.id, uploadGroupId, kind: "published", folderId: folders.publishedId })) {
      const error = new Error("A foto com efeito não pertence a esta publicação."); error.statusCode = 400; throw error;
    }

    const originalSize = Number(original.size || 0);
    const previewSize = Number(preview.size || 0);
    const publishedSize = Number(published?.size || 0);
    if (!originalSize || !previewSize || previewSize > 2 * 1024 * 1024 || (published && (!publishedSize || publishedSize > 15 * 1024 * 1024))) {
      const error = new Error("Arquivos de upload inválidos."); error.statusCode = 400; throw error;
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("id", user.id)
      .single();
    if (profileError) throw profileError;

    const driveWidth = Number(body.width || original.imageMediaMetadata?.width || 0) || null;
    const driveHeight = Number(body.height || original.imageMediaMetadata?.height || 0) || null;

    const row = {
      user_id: user.id,
      display_name: profile.display_name,
      upload_group_id: uploadGroupId,
      original_drive_id: original.id,
      preview_drive_id: preview.id,
      original_name: original.name || null,
      mime_type: original.mimeType || "application/octet-stream",
      size_bytes: originalSize,
      preview_size_bytes: previewSize,
      published_drive_id: published?.id || null,
      published_name: published?.name || null,
      published_mime_type: published?.mimeType || null,
      published_size_bytes: publishedSize || null,
      effect_id: effectId || "original",
      effect_meta: effectMeta,
      width: driveWidth,
      height: driveHeight,
      published: true,
    };

    const { data: inserted, error: insertError } = await supabase
      .from("photos")
      .insert(row)
      .select(PUBLIC_FIELDS)
      .single();

    if (insertError) {
      if (insertError.code === "23505") {
        const { data: retry, error: retryError } = await supabase
          .from("photos")
          .select(PUBLIC_FIELDS)
          .eq("upload_group_id", uploadGroupId)
          .single();
        if (retryError) throw retryError;
        return json(res, 200, { photo: retry, idempotent: true });
      }
      throw insertError;
    }

    return json(res, 201, { photo: inserted });
  } catch (error) {
    return handleError(res, error);
  }
}
