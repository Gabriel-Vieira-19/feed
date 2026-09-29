import { createClient } from "@supabase/supabase-js";
import { getBearerToken } from "./http.js";

let adminClient;

function getSupabaseUrl() {
  return String(process.env.VITE_SUPABASE_URL || "").trim().replace(/\/$/, "");
}

export function getAdminSupabase() {
  if (!adminClient) {
    const url = getSupabaseUrl();
    const key = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
    if (!url || !key) throw new Error("Supabase do servidor não está configurado.");
    adminClient = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
  }
  return adminClient;
}

export async function requireUser(req) {
  const token = getBearerToken(req);
  if (!token) {
    const error = new Error("Sessão ausente.");
    error.statusCode = 401;
    throw error;
  }

  const supabase = getAdminSupabase();
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user?.id) {
    const authError = new Error("Sessão inválida ou expirada.");
    authError.statusCode = 401;
    throw authError;
  }
  return data.user;
}

export async function getSetting(key) {
  const supabase = getAdminSupabase();
  const { data, error } = await supabase.from("app_settings").select("value").eq("key", key).maybeSingle();
  if (error) throw error;
  return data?.value ?? null;
}

export async function setSetting(key, value) {
  const supabase = getAdminSupabase();
  const { error } = await supabase.from("app_settings").upsert(
    { key, value: String(value ?? ""), updated_at: new Date().toISOString() },
    { onConflict: "key" },
  );
  if (error) throw error;
}

export async function setSettings(entries) {
  const supabase = getAdminSupabase();
  const now = new Date().toISOString();
  const rows = Object.entries(entries).map(([key, value]) => ({ key, value: String(value ?? ""), updated_at: now }));
  const { error } = await supabase.from("app_settings").upsert(rows, { onConflict: "key" });
  if (error) throw error;
}
