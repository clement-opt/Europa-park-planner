/**
 * Découpe les têtes de la photo de groupe pour les installer dans le wagon.
 *
 *   node scripts/cut-heads.mjs
 *
 * Attend `public/equipe.jpg` et produit `public/tetes/1.png` … `5.png`, ronds et
 * détourés. L'écran de lancement les détecte tout seul et remplace les passagers
 * dessinés — aucune autre modification à faire.
 *
 * Les positions par défaut supposent un groupe cadré en largeur, de gauche à droite.
 * Si un visage est mal centré, ajustez la ligne correspondante de HEADS : les valeurs
 * sont des fractions de la largeur et de la hauteur, donc indépendantes de la taille
 * du fichier.
 */
import sharp from "sharp";
import { existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = join(root, "public/equipe.jpg");

if (!existsSync(src)) {
  console.error("public/equipe.jpg est absent. Déposez la photo du groupe à cet emplacement.");
  process.exit(1);
}

// cx, cy : centre du visage ; r : rayon, en fraction de la plus petite dimension.
const HEADS = [
  { cx: 0.10, cy: 0.30, r: 0.20 },
  { cx: 0.38, cy: 0.26, r: 0.16 },
  { cx: 0.53, cy: 0.26, r: 0.16 },
  { cx: 0.64, cy: 0.27, r: 0.15 },
  { cx: 0.84, cy: 0.28, r: 0.24 }
];

const OUT = 256;
const dir = join(root, "public/tetes");
mkdirSync(dir, { recursive: true });

const meta = await sharp(src).metadata();
const W = meta.width ?? 0;
const H = meta.height ?? 0;
const base = Math.min(W, H);

const mask = Buffer.from(
  `<svg width="${OUT}" height="${OUT}"><circle cx="${OUT / 2}" cy="${OUT / 2}" r="${OUT / 2}" fill="#fff"/></svg>`
);

let n = 0;
for (const [i, h] of HEADS.entries()) {
  const r = Math.round(h.r * base);
  // Le recadrage est borné à l'image : un visage près du bord ne doit pas
  // faire échouer l'extraction, seulement se décentrer un peu.
  const left = Math.max(0, Math.min(W - 2 * r, Math.round(h.cx * W - r)));
  const top = Math.max(0, Math.min(H - 2 * r, Math.round(h.cy * H - r)));
  const size = Math.min(2 * r, W - left, H - top);
  if (size < 24) { console.warn(`tête ${i + 1} ignorée : cadre trop petit`); continue; }

  await sharp(src)
    .extract({ left, top, width: size, height: size })
    .resize(OUT, OUT)
    .composite([{ input: mask, blend: "dest-in" }])
    .png()
    .toFile(join(dir, `${i + 1}.png`));
  n++;
  console.log(`public/tetes/${i + 1}.png`);
}

console.log(`\n${n} têtes découpées. Relancez le build : elles apparaissent dans le wagon.`);
console.log("Si un visage est décalé, ajustez HEADS dans ce fichier puis relancez.");
