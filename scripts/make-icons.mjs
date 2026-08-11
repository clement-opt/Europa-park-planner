/**
 * Fabrique les icônes de la PWA.
 *
 *   node scripts/make-icons.mjs
 *
 * Si `public/equipe.jpg` existe, la photo est recadrée au centre, détourée en rond et
 * posée sur le fond rétro. Sinon on retombe sur un emblème dessiné.
 *
 * Le rond n'est pas décoratif : Android applique un masque (cercle, goutte, écusson)
 * aux icônes `maskable`. Une photo carrée à bord franc y est rognée n'importe comment.
 * On dessine donc nous-mêmes le disque, centré dans la zone sûre des 80 %.
 */
import sharp from "sharp";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const photo = join(root, "public/equipe.jpg");
const hasPhoto = existsSync(photo);

const CREAM = "#F6F1E7";
const INK = "#241C14";
const RAIL = "#1F5C8B";
const GOLD = "#C99A2E";

/** Fond commun : ciel de nuit chaud, halo doré, liseré crème. */
const background = (s) => `
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

async function disc(size) {
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

for (const size of [192, 512]) {
  await sharp(await disc(size)).toFile(join(root, `public/icon-${size}.png`));
  console.log(`public/icon-${size}.png`);
}
await sharp(await disc(180)).toFile(join(root, "public/apple-touch-icon.png"));
console.log("public/apple-touch-icon.png");

// Favicon SVG : la photo est encapsulée en data URI dans un clip circulaire, donc
// nette à toutes les tailles, contrairement à un PNG de 32 px.
const inner = 340;
const payload = hasPhoto
  ? (await sharp(photo).resize(inner, inner, { fit: "cover", position: "attention" }).jpeg({ quality: 82 }).toBuffer())
      .toString("base64")
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
  ${payload
    ? `<image href="data:image/jpeg;base64,${payload}" x="${256 - inner / 2}" y="${256 - inner / 2}" width="${inner}" height="${inner}" clip-path="url(#c)"/>`
    : emblem.replace(/<\/?svg[^>]*>/g, "")}
</svg>`;

await sharp(Buffer.from(favicon)).png().toFile(join(root, "public/icon-fallback.png"));
const { writeFile } = await import("node:fs/promises");
await writeFile(join(root, "public/icon.svg"), favicon);
console.log("public/icon.svg");
console.log(hasPhoto ? "→ photo public/equipe.jpg utilisée" : "→ emblème dessiné (déposez public/equipe.jpg pour la photo)");
