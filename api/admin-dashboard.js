import { handleError, json, methodNotAllowed, requireAdmin } from "../server/http.js";
import { getAdminSupabase } from "../server/supabase-admin.js";

async function exactCount(table, filter = null) {
  let query = getAdminSupabase().from(table).select("*", { count: "exact", head: true });
  if (filter) query = filter(query);
  const { count, error } = await query;
  if (error) throw error;
  return Number(count || 0);
}

async function calculateStorageBytes() {
  const supabase = getAdminSupabase();
  let offset = 0;
  let total = 0;
  const pageSize = 1000;

  while (true) {
    const { data, error } = await supabase
      .from("photos")
      .select("size_bytes,preview_size_bytes,published_size_bytes")
      .range(offset, offset + pageSize - 1);
    if (error) throw error;
    const rows = data || [];
    for (const row of rows) {
      total += Number(row.size_bytes || 0) + Number(row.preview_size_bytes || 0) + Number(row.published_size_bytes || 0);
    }
    if (rows.length < pageSize) break;
    offset += pageSize;
  }
  return total;
}

export default async function handler(req, res) {
  if (req.method !== "GET") return methodNotAllowed(res, ["GET"]);
  try {
    requireAdmin(req);
    const supabase = getAdminSupabase();

    const [photos, users, likes, hidden, storageBytes, recentResult] = await Promise.all([
      exactCount("photos"),
      exactCount("profiles"),
      exactCount("likes"),
      exactCount("photos", query => query.eq("published", false)),
      calculateStorageBytes(),
      supabase
        .from("photos")
        .select("id,user_id,display_name,mime_type,size_bytes,preview_size_bytes,published_size_bytes,effect_id,likes_count,published,created_at")
        .order("created_at", { ascending: false })
        .limit(60),
    ]);

    if (recentResult.error) throw recentResult.error;

    return json(res, 200, {
      stats: { photos, users, likes, hidden, storageBytes },
      recentPhotos: recentResult.data || [],
    });
  } catch (error) {
    return handleError(res, error);
  }
}
