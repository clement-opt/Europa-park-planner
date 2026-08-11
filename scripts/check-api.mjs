/**
 * Croise le référentiel rides.ts avec la réponse réelle de queue-times.
 *
 * Le référentiel est figé à la main : rien ne garantit que les 36 `id` et les 3 `vlId`
 * correspondent toujours à ce que l'API expose. Un identifiant périmé se traduit par une
 * attraction bloquée à « fermé », sans message d'erreur, ce qui est invisible en usage
 * normal. Ce script rend l'écart explicite.
 *
 *   node scripts/check-api.mjs
 *   node scripts/check-api.mjs https://mon-worker.workers.dev/?url=
 *
 * Sort en code 1 si un identifiant du référentiel est absent de l'API.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const API = "https://queue-times.com/parks/51/queue_times.json";
const root = join(dirname(fileURLToPath(import.meta.url)), "..");

// rides.ts n'est pas importable tel quel depuis Node : on lit les champs utiles.
const src = readFileSync(join(root, "src/data/rides.ts"), "utf8");
const refs = [...src.matchAll(/\{ id: (\d+), n: "([^"]+)"[^\n]*?\}/g)].map((m) => ({
  id: Number(m[1]),
  n: m[2],
  vl: /vl: true/.test(m[0]),
  vlId: (m[0].match(/vlId: (\d+)/) ?? [])[1]
}));

const relay = process.argv[2];
const url = relay ? relay + encodeURIComponent(API) : API;

const res = await fetch(url, { headers: { "user-agent": "europa-park-planner/check" } });
if (!res.ok) {
  console.error(`Échec HTTP ${res.status} sur ${relay ? "le relais" : "l'API directe"}.`);
  console.error(relay ? "Vérifiez que l'URL du relais se termine par /?url=" : "Sans relais, l'appel direct échoue depuis un navigateur mais passe depuis Node.");
  process.exit(2);
}

const json = await res.json();
const live = new Map();
const collect = (r) => live.set(r.id, r);
(json.lands ?? []).forEach((l) => (l.rides ?? []).forEach(collect));
(json.rides ?? []).forEach(collect);

const isVirtual = (name) => /virtual\s*line/i.test(name);

const missing = refs.filter((r) => !live.has(r.id));
const vlMissing = refs.filter((r) => r.vlId && !live.has(Number(r.vlId)));
const renamed = refs
  .filter((r) => live.has(r.id))
  .map((r) => ({ ...r, api: live.get(r.id).name }))
  .filter((r) => {
    const a = r.n.toLowerCase().replace(/[^a-z0-9]/g, "");
    const b = r.api.toLowerCase().replace(/[^a-z0-9]/g, "");
    return !a.includes(b.slice(0, 6)) && !b.includes(a.slice(0, 6));
  });

const unknownVirtual = [...live.values()]
  .filter((r) => isVirtual(r.name))
  .filter((r) => !refs.some((x) => Number(x.vlId) === r.id));

const extra = [...live.values()]
  .filter((r) => !isVirtual(r.name))
  .filter((r) => !refs.some((x) => x.id === r.id));

console.log(`API : ${live.size} entrées · référentiel : ${refs.length} attractions\n`);

const section = (title, rows, fmt) => {
  console.log(`## ${title} : ${rows.length}`);
  rows.forEach((r) => console.log("   " + fmt(r)));
  console.log();
};

section("Identifiants du référentiel absents de l'API", missing, (r) => `${r.id} ${r.n}`);
section("vlId absents de l'API", vlMissing, (r) => `${r.vlId} (${r.n})`);
section("Noms qui ont divergé", renamed, (r) => `${r.id} · référentiel "${r.n}" ≠ API "${r.api}"`);
section("Files virtuelles exposées mais non rattachées", unknownVirtual, (r) => `${r.id} ${r.name}`);
section("Attractions de l'API absentes du référentiel", extra, (r) => `${r.id} ${r.name}`);

if (missing.length || vlMissing.length) {
  console.error("Référentiel à corriger : au moins un identifiant ne répond plus.");
  process.exit(1);
}
console.log("Référentiel cohérent avec l'API.");
