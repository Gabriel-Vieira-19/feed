const env = import.meta.env;

export const config = Object.freeze({
  supabaseUrl: String(env.VITE_SUPABASE_URL || "").trim().replace(/\/$/, ""),
  supabasePublishableKey: String(env.VITE_SUPABASE_PUBLISHABLE_KEY || "").trim(),
  workerUrl: String(env.VITE_WORKER_URL || "").trim().replace(/\/$/, ""),
  teraboxClientId: String(env.VITE_TERABOX_CLIENT_ID || "").trim(),
  eventTitle: String(env.VITE_EVENT_TITLE || "PEDRO 18").trim(),
  eventSubtitle: String(env.VITE_EVENT_SUBTITLE || "Momentos da festa").trim(),
  feedPageSize: 20,
  maxPhotoBytes: 30 * 1024 * 1024,
  maxDisplayNameLength: 40,
  refreshIntervalMs: 30_000,
});

export function assertPublicConfig() {
  const missing = [];
  if (!config.supabaseUrl) missing.push("VITE_SUPABASE_URL");
  if (!config.supabasePublishableKey) missing.push("VITE_SUPABASE_PUBLISHABLE_KEY");
  if (!config.workerUrl) missing.push("VITE_WORKER_URL");
  return missing;
}
