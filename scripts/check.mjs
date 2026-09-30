import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const errors = [];

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name);
    if (entry.name === "node_modules" || entry.name === "dist") return [];
    return entry.isDirectory() ? walk(full) : [full];
  });
}

const files = walk(root);
const jsFiles = files.filter(file => file.endsWith(".js") || file.endsWith(".mjs"));

for (const file of jsFiles) {
  const result = spawnSync(process.execPath, ["--check", file], { encoding: "utf8" });
  if (result.status !== 0) errors.push(`Sintaxe inválida: ${path.relative(root, file)}\n${result.stderr}`);

  const source = fs.readFileSync(file, "utf8");
  const names = [...source.matchAll(/\b(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/g)].map(match => match[1]);
  const duplicates = names.filter((name, index) => names.indexOf(name) !== index);
  if (duplicates.length) errors.push(`Funções duplicadas em ${path.relative(root, file)}: ${[...new Set(duplicates)].join(", ")}`);

  for (const match of source.matchAll(/from\s+["'](\.\.?\/[^"']+)["']/g)) {
    let target = path.resolve(path.dirname(file), match[1]);
    if (!path.extname(target)) target += ".js";
    if (!fs.existsSync(target)) errors.push(`Import inexistente em ${path.relative(root, file)}: ${match[1]}`);
  }
}

const forbidden = ["terabox", "cloudflare-worker", "TERABOX_", "VITE_WORKER_URL"];
for (const file of files.filter(file => /\.(js|mjs|json|html|css|md|sql|example)$/.test(file) && !file.endsWith("scripts/check.mjs"))) {
  const source = fs.readFileSync(file, "utf8");
  for (const word of forbidden) {
    if (source.toLowerCase().includes(word.toLowerCase())) errors.push(`Referência antiga encontrada (${word}): ${path.relative(root, file)}`);
  }
}

const frontendFiles = files.filter(file => file.includes(`${path.sep}src${path.sep}`));
for (const file of frontendFiles) {
  const source = fs.readFileSync(file, "utf8");
  for (const secretName of ["SUPABASE_SERVICE_ROLE_KEY", "GOOGLE_CLIENT_SECRET"]) {
    if (source.includes(secretName)) errors.push(`Segredo referenciado no frontend: ${secretName} em ${path.relative(root, file)}`);
  }
}

const required = [
  "api/admin-drive-auth.js",
  "api/admin-drive-callback.js",
  "api/admin-drive-status.js",
  "api/drive-upload-session.js",
  "api/photo-publish.js",
  "api/media.js",
  "api/original-chunk.js",
  "api/admin-dashboard.js",
  "api/admin-photo-action.js",
  "api/admin-private-originals.js",
  "api/cleanup-abandoned.js",
  "supabase/schema.sql",
  "src/lib/drive.js",
  "src/lib/effects.js",
  "src/lib/pending-upload.js",
  "supabase/upgrade_v2_2_to_final.sql",
  "supabase/upgrade_final_to_filters_v1.sql",
];
for (const item of required) if (!fs.existsSync(path.join(root, item))) errors.push(`Arquivo obrigatório ausente: ${item}`);

const apiFunctionCount = files.filter(file => file.startsWith(path.join(root, "api") + path.sep) && file.endsWith(".js")).length;
if (apiFunctionCount > 12) errors.push(`Vercel Hobby: ${apiFunctionCount} funções em api/; o projeto deve manter no máximo 12.`);

const css = fs.readFileSync(path.join(root, "src/styles.css"), "utf8");
let depth = 0;
for (const char of css) {
  if (char === "{") depth += 1;
  if (char === "}") depth -= 1;
  if (depth < 0) break;
}
if (depth !== 0) errors.push("Chaves CSS desbalanceadas em src/styles.css.");

if (errors.length) {
  console.error(errors.join("\n\n"));
  process.exit(1);
}

console.log(`OK — ${jsFiles.length} arquivos JS verificados; sem referências antigas e sem segredos no frontend.`);
