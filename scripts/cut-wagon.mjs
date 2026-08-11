/**
 * Détoure le wagon et ses passagers pour l'écran de lancement.
 *
 *   1. déposez votre image dans design/wagon-source.png (ou .jpg)
 *   2. node scripts/cut-wagon.mjs
 *
 * La source vit dans design/ et non dans public/, qui est recopié tel quel dans
 * dist/ puis préchargé en entier par le service worker : un original de 1,5 Mo y
 * serait téléchargé sur chaque téléphone sans jamais être affiché.
 *
 * Produit `public/wagon.png` : fond rendu transparent, image recadrée au plus juste.
 * L'écran de lancement le détecte au chargement et remplace le wagon dessiné, sans
 * autre modification à faire.
 *
 * Options de détourage :
 *   --tol=60      tolérance, en distance de couleur (défaut 60)
 *   --rails       retire aussi la voie et les piliers dessinés derrière le wagon
 *   --bleu=22     seuil de la règle « décor » : écart bleu − rouge (défaut 22)
 *   --coin=x,y    pixel servant d'échantillon de fond (défaut : le coin haut-gauche)
 *
 * Options d'orientation — le wagon de l'écran de lancement roule de la gauche vers
 * la droite et s'incline tout seul en suivant la voie. L'image doit donc arriver
 * **à plat et tournée vers la droite**, sinon l'inclinaison se cumule avec celle
 * déjà présente dans la photo :
 *   --miroir        retourne l'image horizontalement
 *   --rotation=-18  redresse une photo prise en pente (degrés, sens horaire)
 *   --largeur=760   largeur finale en pixels (défaut 760)
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

const src = ["design", "public"]
  .flatMap((d) => ["png", "jpg", "jpeg"].map((e) => `${d}/wagon-source.${e}`))
  .map((f) => join(root, f)).find(existsSync);

if (!src) {
  console.error("Aucune source trouvée. Déposez l'image dans design/wagon-source.png");
  process.exit(1);
}

const tol = Number(arg("tol", 60));
const rails = process.argv.includes("--rails");
const bleu = Number(arg("bleu", 22));
const [cx, cy] = arg("coin", "2,2").split(",").map(Number);
const miroir = process.argv.includes("--miroir");
const rotation = Number(arg("rotation", 0));
const largeur = Number(arg("largeur", 760));

const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const { width: W, height: H, channels: C } = info;

const at = (x, y) => (y * W + x) * C;
const fond = [data[at(cx, cy)], data[at(cx, cy) + 1], data[at(cx, cy) + 2]];
const dist = (i, c) => Math.hypot(data[i] - c[0], data[i + 1] - c[1], data[i + 2] - c[2]);

/**
 * Le fond est bleuté, et il n'y a que lui. Son écart bleu − rouge va de 33 pour
 * la nuance la plus pâle à 87 pour le bleu nuit ; aucun pixel des passagers ne
 * dépasse 14, peau, cheveux et vêtements noirs étant neutres ou chauds. Ce seuil
 * réussit là où une simple distance au fond échouait : un sweat noir n'est qu'à
 * 89 du bleu nuit, soit moins loin que le décor qu'on veut effacer.
 */
const estFond = (i) =>
  dist(i, fond) < tol || (data[i + 2] - data[i] > bleu && Math.max(data[i], data[i + 1], data[i + 2]) < 205);

/**
 * La voie et les piliers, eux, sont peints en blanc translucide : ils empruntent
 * la teinte de ce qu'ils recouvrent et aucun seuil de couleur ne les distingue du
 * sweat gris d'une passagère. Ce qui les trahit est ailleurs — ce sont les seules
 * choses opaques qui touchent encore le bord de l'image. On les propage donc
 * depuis le cadre, à travers les gris seulement : le vide déjà découpé arrête la
 * progression, et le liseré blanc du wagon, plus clair que tout le reste, fait
 * mur là où la voie passe derrière la caisse.
 */
const estStructure = (i) =>
  data[i + 3] > 0 && Math.max(data[i], data[i + 1], data[i + 2]) < 235 && data[i + 2] - data[i] > -25;

const vu = new Uint8Array(W * H);
const file = new Int32Array(W * H);
let tete = 0, queue = 0, effaces = 0;

const remplir = (admet) => {
  const pousse = (x, y) => {
    const p = y * W + x;
    if (vu[p] || !admet(p * C)) return;
    vu[p] = 1;
    file[queue++] = p;
  };
  for (let x = 0; x < W; x++) { pousse(x, 0); pousse(x, H - 1); }
  for (let y = 0; y < H; y++) { pousse(0, y); pousse(W - 1, y); }
  while (tete < queue) {
    const p = file[tete++];
    const x = p % W, y = (p / W) | 0;
    if (data[p * C + 3]) effaces++;
    data[p * C + 3] = 0;
    if (x > 0) pousse(x - 1, y);
    if (x < W - 1) pousse(x + 1, y);
    if (y > 0) pousse(x, y - 1);
    if (y < H - 1) pousse(x, y + 1);
  }
};

// Le fond d'abord : il isole la voie, qui n'a plus alors que le cadre pour appui.
remplir(estFond);
if (rails) { vu.fill(0); tete = queue = 0; remplir(estStructure); }

/**
 * Restent les miettes que la propagation ne pouvait pas atteindre : les étoiles
 * du ciel, cernées de fond effacé, et les traverses sombres de la voie, qui
 * flottaient au milieu d'un rail devenu transparent.
 */
if (rails) {
  const comp = new Int32Array(W * H).fill(-1);
  const pile = new Int32Array(W * H);
  const tailles = [];
  for (let s = 0; s < W * H; s++) {
    if (comp[s] >= 0 || !data[s * C + 3]) continue;
    const id = tailles.length;
    let t = 0, q = 0, n = 0;
    pile[q++] = s; comp[s] = id;
    while (t < q) {
      const p = pile[t++]; n++;
      const x = p % W, y = (p / W) | 0;
      const vois = [x > 0 ? p - 1 : -1, x < W - 1 ? p + 1 : -1, y > 0 ? p - W : -1, y < H - 1 ? p + W : -1];
      for (const v of vois) { if (v < 0 || comp[v] >= 0 || !data[v * C + 3]) continue; comp[v] = id; pile[q++] = v; }
    }
    tailles.push(n);
  }
  const plusGrand = Math.max(...tailles, 0);
  const miette = tailles.map((n) => n < plusGrand * 0.02);
  for (let p = 0; p < W * H; p++) {
    if (data[p * C + 3] && miette[comp[p]]) { data[p * C + 3] = 0; effaces++; }
  }
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

/**
 * L'écran de lancement affiche le wagon sur 232 px de large ; au-delà d'un écran
 * à trois fois la densité, chaque pixel gardé est un pixel téléchargé avant que
 * l'app ne s'ouvre, sur le réseau d'un parc bondé.
 */
img = img.resize({ width: largeur, withoutEnlargement: true });

await img.png({ palette: true, quality: 90 }).toFile(join(root, "public/wagon.png"));

const pct = Math.round((effaces / (W * H)) * 100);
const fin = await sharp(join(root, "public/wagon.png")).metadata();
console.log(`public/wagon.png  ${fin.width}×${fin.height}px` +
  (miroir ? " · retourné" : "") + (rotation ? ` · redressé de ${rotation}°` : ""));
console.log(`fond échantillonné rgb(${fond.join(",")}) · ${pct} % de l'image rendue transparente`);
console.log(pct < 8 || pct > 92
  ? "\nCe taux est suspect : ajustez --tol, ou --coin=x,y si le coin haut-gauche n'est pas du fond."
  : "\nRelancez le build : le wagon apparaît sur l'écran de lancement.");
