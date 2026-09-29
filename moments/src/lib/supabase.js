import { createClient } from "@supabase/supabase-js";
import { config } from "../config.js";
import { normalizeName } from "./utils.js";

let client;

export function getSupabase() {
  if (!client) {
    client = createClient(config.supabaseUrl, config.supabasePublishableKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
      realtime: { params: { eventsPerSecond: 10 } },
    });
  }
  return client;
}

export async function ensureAnonymousSession(displayName) {
  const supabase = getSupabase();
  const { data: sessionData } = await supabase.auth.getSession();
  let session = sessionData.session;

  if (!session) {
    const { data, error } = await supabase.auth.signInAnonymously({
      options: { data: { display_name: normalizeName(displayName) } },
    });
    if (error) throw error;
    session = data.session;
  }

  if (!session?.user?.id) throw new Error("Não foi possível criar sua sessão.");
  await saveProfile(session.user.id, displayName);
  return session;
}

export async function saveProfile(userId, displayName) {
  const cleanName = normalizeName(displayName);
  const { error } = await getSupabase().from("profiles").upsert(
    { id: userId, display_name: cleanName, updated_at: new Date().toISOString() },
    { onConflict: "id" },
  );
  if (error) throw error;
}

export async function getOwnProfile() {
  const supabase = getSupabase();
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user?.id;
  if (!userId) return null;
  const { data, error } = await supabase.from("profiles").select("id, display_name").eq("id", userId).maybeSingle();
  if (error) throw error;
  return data;
}

export async function getAccessToken() {
  const { data, error } = await getSupabase().auth.getSession();
  if (error) throw error;
  const token = data.session?.access_token;
  if (!token) throw new Error("Sua sessão expirou. Reabra o aplicativo.");
  return token;
}

function withPreviewUrl(photo) {
  return { ...photo, preview_url: `/api/media?photo=${encodeURIComponent(photo.id)}` };
}

function applySort(query, sort) {
  switch (sort) {
    case "oldest":
      return query.order("created_at", { ascending: true }).order("id", { ascending: true });
    case "most_liked":
      return query.order("likes_count", { ascending: false }).order("created_at", { ascending: false });
    case "least_liked":
      return query.order("likes_count", { ascending: true }).order("created_at", { ascending: false });
    case "user_az":
      return query.order("display_name", { ascending: true }).order("created_at", { ascending: false });
    case "user_za":
      return query.order("display_name", { ascending: false }).order("created_at", { ascending: false });
    case "newest":
    default:
      return query.order("created_at", { ascending: false }).order("id", { ascending: false });
  }
}

export async function fetchFeed({ offset = 0, limit = config.feedPageSize, userId = null, sort = "newest" } = {}) {
  const supabase = getSupabase();
  let query = supabase
    .from("photos")
    .select("id,user_id,display_name,original_name,mime_type,size_bytes,width,height,likes_count,created_at")
    .eq("published", true);

  if (userId) query = query.eq("user_id", userId);
  query = applySort(query, sort).range(offset, offset + limit - 1);

  const { data: photos, error } = await query;
  if (error) throw error;
  if (!photos?.length) return { photos: [], liked: new Set() };

  const ids = photos.map(photo => photo.id);
  const { data: likedRows, error: likesError } = await supabase.from("likes").select("photo_id").in("photo_id", ids);
  if (likesError) throw likesError;
  return {
    photos: photos.map(withPreviewUrl),
    liked: new Set((likedRows || []).map(row => row.photo_id)),
  };
}

export async function setLike(photoId, shouldLike) {
  const supabase = getSupabase();
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  const userId = sessionData.session?.user?.id;
  if (!userId) throw new Error("Sessão indisponível.");

  if (shouldLike) {
    const { error } = await supabase.from("likes").insert({ photo_id: photoId, user_id: userId });
    if (error && error.code !== "23505") throw error;
  } else {
    const { error } = await supabase.from("likes").delete().eq("photo_id", photoId).eq("user_id", userId);
    if (error) throw error;
  }
}

export function subscribeToPhotoChanges(onChange) {
  const supabase = getSupabase();
  const channel = supabase
    .channel("party-feed")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "photos" },
      payload => {
        if (payload.new?.id) payload.new.preview_url = `/api/media?photo=${encodeURIComponent(payload.new.id)}`;
        onChange(payload);
      },
    )
    .subscribe();
  return () => supabase.removeChannel(channel);
}
