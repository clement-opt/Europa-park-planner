/**
 * Détoure le wagon et ses passagers pour l'écran de lancement.
 *
 *   1. déposez votre image dans public/wagon-source.png (ou .jpg)
 *   2. node scripts/cut-wagon.mjs
 *
 * Produit `public/wagon.png` : fond rendu transparent, image recadrée au plus juste.
 * L'écran de lancement le détecte au chargement et remplace le wagon dessiné, sans
 * autre modification à faire.
 *
 * Options de détourage :
 *   --tol=60      tolérance, en distance de couleur (défaut 60)
 *   --rails       retire aussi les rails clairs restés derrière le wagon
 *   --coin=x,y    pixel servant d'échantillon de fond (défaut : le coin haut-gauche)
 *
 * Options d'orientation — le wagon de l'écran de lancement roule de la gauche vers
 * la droite et s'incline tout seul en suivant la voie. L'image doit donc arriver
 * **à plat et tournée vers la droite**, sinon l'inclinaison se cumule avec celle
 * déjà présente dans la photo :
 *   --miroir        retourne l'image horizontalement
 *   --rotation=-18  redresse une photo prise en pente (degrés, sens horaire)
 */
import sharp from "sharp";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const arg = (n, d) => {
  const a = process.argv.find((v) => v.startsWith(`--${n}=`));
  return a ? a.split("=")[1] : d;
};

const src = ["public/wagon-source.png", "public/wagon-source.jpg", "public/wagon-source.jpeg"]
  .map((f) => join(root, f)).find(existsSync);

if (!src) {
  console.error("Aucune source trouvée. Déposez l'image dans public/wagon-source.png");
  process.exit(1);
}

const tol = Number(arg("tol", 60));
const rails = process.argv.includes("--rails");
const [cx, cy] = arg("coin", "2,2").split(",").map(Number);
const miroir = process.argv.includes("--miroir");
const rotation = Number(arg("rotation", 0));

const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const { width: W, height: H, channels: C } = info;

const at = (x, y) => (y * W + x) * C;
const fond = [data[at(cx, cy)], data[at(cx, cy) + 1], data[at(cx, cy) + 2]];
const dist = (i, c) => Math.hypot(data[i] - c[0], data[i + 1] - c[1], data[i + 2] - c[2]);

// Rails : gris très clair et peu saturé. On ne les retire que sur demande, car
// selon le cadrage ils peuvent faire partie du décor qu'on veut garder.
const estRail = (i) => {
  const r = data[i], g = data[i + 1], b = data[i + 2];
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  return max > 165 && max - min < 26;
};

let effaces = 0;
for (let i = 0; i < data.length; i += C) {
  if (dist(i, fond) < tol || (rails && estRail(i))) { data[i + 3] = 0; effaces++; }
}

// Recadrage au contenu restant.
let x0 = W, y0 = H, x1 = -1, y1 = -1;
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    if (data[at(x, y) + 3] > 24) {
      if (x < x0) x0 = x; if (x > x1) x1 = x;
      if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
  }
}

if (x1 < 0) {
  console.error(`Tout a été effacé : la tolérance de ${tol} est trop élevée. Réessayez avec --tol=35.`);
  process.exit(1);
}

const marge = 4;
const left = Math.max(0, x0 - marge), top = Math.max(0, y0 - marge);
const w = Math.min(W - left, x1 - x0 + 2 * marge), h = Math.min(H - top, y1 - y0 + 2 * marge);

let img = sharp(data, { raw: { width: W, height: H, channels: C } })
  .extract({ left, top, width: w, height: h });

// Redressement d'abord, miroir ensuite : l'inverse retournerait aussi l'angle.
if (rotation) img = img.rotate(rotation, { background: { r: 0, g: 0, b: 0, alpha: 0 } });
if (miroir) img = img.flop();

// La rotation rajoute des marges transparentes : on recadre une seconde fois.
if (rotation) {
  const r = await img.png().toBuffer();
  img = sharp(r).trim({ threshold: 1 });
}

await img.png().toFile(join(root, "public/wagon.png"));

const pct = Math.round((effaces / (W * H)) * 100);
const fin = await sharp(join(root, "public/wagon.png")).metadata();
console.log(`public/wagon.png  ${fin.width}×${fin.height}px` +
  (miroir ? " · retourné" : "") + (rotation ? ` · redressé de ${rotation}°` : ""));
console.log(`fond échantillonné rgb(${fond.join(",")}) · ${pct} % de l'image rendue transparente`);
console.log(pct < 8 || pct > 92
  ? "\nCe taux est suspect : ajustez --tol, ou --coin=x,y si le coin haut-gauche n'est pas du fond."
  : "\nRelancez le build : le wagon apparaît sur l'écran de lancement.");
