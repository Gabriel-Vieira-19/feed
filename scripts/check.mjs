import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { calculateParts } from "../src/lib/md5.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const mustExist = [
  "index.html",
  "src/main.js",
  "src/styles.css",
  "src/lib/terabox.js",
  "supabase/schema.sql",
  "cloudflare-worker/src/index.js",
  "cloudflare-worker/src/terabox-vault.js",
];
for (const file of mustExist) {
  if (!fs.existsSync(path.join(root, file))) throw new Error(`Arquivo ausente: ${file}`);
}

for (const mib of [1, 8, 8.0001, 9, 15, 30]) {
  const bytes = Math.round(mib * 1024 * 1024);
  const parts = calculateParts(bytes);
  const total = parts.reduce((sum, p) => sum + p.size, 0);
  if (total !== bytes) throw new Error(`Particionamento incorreto para ${mib} MiB`);
  if (parts.length > 1 && parts.some(p => p.size <= 4 * 1024 * 1024)) {
    throw new Error(`Fragmento <= 4 MiB para ${mib} MiB`);
  }
}

const index = fs.readFileSync(path.join(root, "index.html"), "utf8");
const ids = [...index.matchAll(/\sid="([^"]+)"/g)].map(match => match[1]);
const duplicates = ids.filter((id, i) => ids.indexOf(id) !== i);
if (duplicates.length) throw new Error(`IDs duplicados no HTML: ${[...new Set(duplicates)].join(", ")}`);

console.log("Checks estruturais concluídos com sucesso.");
