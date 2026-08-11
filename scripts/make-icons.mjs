/**
 * Fabrique les icônes de la PWA.
 *
 *   node scripts/make-icons.mjs
 *
 * Trois sources possibles, de la meilleure à la dernière :
 *   public/wagon.png   le wagon détouré, posé sur un rail — vous cinq, et le thème
 *   public/equipe.jpg  une photo recadrée au centre et détourée en rond
 *   à défaut           un emblème dessiné
 *
 * Le wagon passe devant la photo brute : un selfie rogné en rond à 192 px ne garde
 * qu'un visage ou deux, alors que le wagon tient les cinq sur toute sa largeur.
 *
 * Le rond n'est pas décoratif : Android applique un masque (cercle, goutte, écusson)
 * aux icônes `maskable`. Une photo carrée à bord franc y est rognée n'importe comment.
 * On garde donc tout le contenu dans la zone sûre des 80 %.
 */
import sharp from "sharp";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const photo = join(root, "public/equipe.jpg");
const wagon = join(root, "public/wagon.png");
const hasWagon = existsSync(wagon);
const hasPhoto = existsSync(photo);

const CREAM = "#F6F1E7";
const INK = "#241C14";
const RAIL = "#1F5C8B";
const GOLD = "#C99A2E";

/**
 * Voie sur laquelle le wagon se pose, reprise de l'écran de lancement. Le sommet
 * de l'arc est calé quelques pixels au-dessus du bas du wagon : les roues mordent
 * le rail au lieu de le survoler.
 */
const VOIE = `
  <g stroke="${CREAM}" stroke-linecap="round" opacity=".75">
    <path d="M96 340 Q256 250 416 340" fill="none" stroke-width="13"/>
    <g stroke-width="7" stroke-opacity=".4">
      <path d="M136 316V404 M196 288V404 M316 288V404 M376 316V404"/>
    </g>
  </g>`;

/** Fond commun : ciel de nuit chaud, halo doré, liseré crème. */
const background = (s, voie = false) => `
<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 512 512">
  <defs>
    <radialGradient id="halo" cx="50%" cy="38%" r="62%">
      <stop offset="0%"  stop-color="#2E7CB6"/>
      <stop offset="55%" stop-color="${RAIL}"/>
      <stop offset="100%" stop-color="#122C42"/>
    </radialGradient>
  </defs>
  <rect width="512" height="512" fill="url(#halo)"/>
  ${[...Array(9)].map((_, i) => {
    const a = (Math.PI * 2 * i) / 9;
    return `<circle cx="${256 + Math.cos(a) * 205}" cy="${256 + Math.sin(a) * 205}" r="6" fill="${GOLD}" opacity=".55"/>`;
  }).join("")}
  <circle cx="256" cy="256" r="196" fill="none" stroke="${CREAM}" stroke-width="10" opacity=".9"/>
  <circle cx="256" cy="256" r="182" fill="none" stroke="${GOLD}" stroke-width="4" stroke-dasharray="14 12" opacity=".85"/>
  ${voie ? VOIE : ""}
</svg>`;

/** Emblème de repli : une colline de montagnes russes et une étoile. */
const emblem = `
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <circle cx="256" cy="256" r="168" fill="${CREAM}"/>
  <path d="M118 316c40-96 82-142 138-142s98 46 138 142" fill="none"
        stroke="${RAIL}" stroke-width="20" stroke-linecap="round"/>
  <path d="M118 316h276" stroke="${INK}" stroke-width="14" stroke-linecap="round"/>
  ${[150, 200, 256, 312, 362].map((x) => `<path d="M${x} 316v-26" stroke="${INK}" stroke-width="9" stroke-linecap="round"/>`).join("")}
  <path d="M256 148l16 33 36 5-26 25 6 36-32-17-32 17 6-36-26-25 36-5z" fill="${GOLD}"/>
</svg>`;

/** Cadre du wagon dans le repère 512, tenu à l'intérieur de la zone sûre. */
const CADRE = { left: 106, top: 121, width: 300 };

async function disc(size) {
  if (hasWagon) {
    const k = size / 512;
    const w = Math.round(CADRE.width * k);
    const cart = await sharp(wagon).resize({ width: w }).png().toBuffer();
    return sharp(Buffer.from(background(size, true)))
      .composite([{ input: cart, left: Math.round(CADRE.left * k), top: Math.round(CADRE.top * k) }])
      .png()
      .toBuffer();
  }

  const inner = Math.round(size * 0.66);      // zone sûre du masque Android
  const mask = Buffer.from(
    `<svg width="${inner}" height="${inner}"><circle cx="${inner / 2}" cy="${inner / 2}" r="${inner / 2}" fill="#fff"/></svg>`
  );

  const content = hasPhoto
    ? await sharp(photo).resize(inner, inner, { fit: "cover", position: "attention" })
        .composite([{ input: mask, blend: "dest-in" }]).png().toBuffer()
    : await sharp(Buffer.from(emblem)).resize(inner, inner)
        .composite([{ input: mask, blend: "dest-in" }]).png().toBuffer();

  return sharp(Buffer.from(background(size)))
    .composite([{ input: content, top: Math.round((size - inner) / 2), left: Math.round((size - inner) / 2) }])
    .png()
    .toBuffer();
}

// Palette indexée : ces icônes sont préchargées par le service worker, donc
// téléchargées avant la première ouverture, parfois sur le réseau du parc.
const ecrire = async (buf, nom) => {
  await sharp(buf).png({ palette: true, quality: 90 }).toFile(join(root, `public/${nom}`));
  console.log(`public/${nom}`);
};

for (const size of [192, 512]) await ecrire(await disc(size), `icon-${size}.png`);
await ecrire(await disc(180), "apple-touch-icon.png");

// Favicon SVG : la photo est encapsulée en data URI dans un clip circulaire, donc
// nette à toutes les tailles, contrairement à un PNG de 32 px.
const inner = 340;
const payload = hasPhoto
  ? (await sharp(photo).resize(inner, inner, { fit: "cover", position: "attention" }).jpeg({ quality: 82 }).toBuffer())
      .toString("base64")
  : null;

// Le wagon est réduit avant d'être encapsulé : un favicon ne s'affiche jamais
// au-delà de quelques dizaines de pixels, et la charge voyage dans le HTML.
const chariot = hasWagon
  ? (await sharp(wagon).resize({ width: 300 }).png({ palette: true, quality: 80 }).toBuffer()).toString("base64")
  : null;

const favicon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <radialGradient id="h" cx="50%" cy="38%" r="62%">
      <stop offset="0%" stop-color="#2E7CB6"/><stop offset="55%" stop-color="${RAIL}"/><stop offset="100%" stop-color="#122C42"/>
    </radialGradient>
    <clipPath id="c"><circle cx="256" cy="256" r="${inner / 2}"/></clipPath>
  </defs>
  <rect width="512" height="512" rx="110" fill="url(#h)"/>
  <circle cx="256" cy="256" r="196" fill="none" stroke="${CREAM}" stroke-width="10" opacity=".9"/>
  ${chariot
    ? `${VOIE}<image href="data:image/png;base64,${chariot}" x="${CADRE.left}" y="${CADRE.top}" width="${CADRE.width}"/>`
    : payload
      ? `<image href="data:image/jpeg;base64,${payload}" x="${256 - inner / 2}" y="${256 - inner / 2}" width="${inner}" height="${inner}" clip-path="url(#c)"/>`
      : emblem.replace(/<\/?svg[^>]*>/g, "")}
</svg>`;

const { writeFile } = await import("node:fs/promises");
await writeFile(join(root, "public/icon.svg"), favicon);
console.log("public/icon.svg");
console.log(hasWagon
  ? "→ wagon détouré public/wagon.png utilisé"
  : hasPhoto
    ? "→ photo public/equipe.jpg utilisée"
    : "→ emblème dessiné (lancez scripts/cut-wagon.mjs pour le wagon)");
