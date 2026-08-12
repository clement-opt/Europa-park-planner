/**
 * Batterie de scénarios de terrain, joués un par un dans un contexte neuf.
 *
 *   npm run preview   (dans un autre terminal)
 *   node scripts/audit-scenarios.mjs
 *
 * Chaque scénario reproduit une situation vécue dans le parc, avec l'horloge simulée
 * et les temps d'attente pilotés depuis le test. Ils sont indépendants : un échec n'en
 * masque aucun autre, et la sortie dit lequel a cédé.
 *
 * L'histoire de ce fichier est celle des défauts qu'un audit trop global a laissés
 * passer — parcours effacé à la validation, attraction imposée écartée en silence,
 * recalcul partant d'une matinée déjà passée.
 */
import { chromium } from "playwright";
import { readFileSync } from "node:fs";

const URL = process.env.URL ?? "http://127.0.0.1:4173/";
const SILVER = 5604;

const bloc = readFileSync("src/data/rides.ts", "utf8").match(/export const SNAPSHOT[\s\S]*?\n};/)[0];
const IDS = [...bloc.matchAll(/(\d{4,}):\s*\d+/g)].map((m) => Number(m[1]));

const B = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const resultats = [];

/** Un <details> replié sort de l'arbre d'accessibilité : on ouvre tout avant de cliquer. */
const ouvrirTout = (p) => p.evaluate(() => document.querySelectorAll("details").forEach((d) => (d.open = true)));

const heures = (p) => p.locator(".stop .hh b").evaluateAll((ns) => ns.map((n) => n.textContent.trim()));
const noms = (p) => p.locator(".stop .stopcard h4").evaluateAll((ns) => ns.map((n) => n.textContent.trim()));
const tete = (p) => p.locator(".nextup h4").textContent().catch(() => "(aucune)");

/** Réveille l'app pour qu'elle relise l'heure, comme au sortir de la poche. */
const reveiller = async (p) => {
  await p.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
  await p.waitForTimeout(400);
};
const nbAttractions = (p) => p.locator(".stop .act.fait").count();

/**
 * Prépare une page : horloge figée, relevés pilotés, app chargée.
 * `etat` reçoit un identifiant et rend l'état de l'attraction ; par défaut tout est
 * ouvert avec douze minutes d'attente.
 */
async function page({ heure = [10, 0], etat = () => ({ wait: 12, open: true }) } = {}) {
  const ctx = await B.newContext({ viewport: { width: 390, height: 844 } });
  const p = await ctx.newPage();
  p.__ctx = ctx;
  p.__erreurs = [];
  p.on("pageerror", (e) => p.__erreurs.push(e.message.slice(0, 140)));
  const j = new Date(); j.setSeconds(0, 0); j.setHours(heure[0], heure[1]);
  await p.clock.setFixedTime(j);
  await p.route(/rpc\/ep_waits/, (route) => route.fulfill({
    status: 200, contentType: "application/json",
    body: JSON.stringify({ at: j.toISOString(), vl: {}, rides: Object.fromEntries(IDS.map((id) => [id, etat(id)])) })
  }));
  await p.goto(URL, { waitUntil: "load" });
  await p.waitForTimeout(3400);
  return p;
}

/** Sélection « Mix » puis calcul par le bouton principal. */
async function planMix(p) {
  await p.getByRole("button", { name: /^Mix$/ }).click();
  await p.waitForTimeout(400);
  await p.locator(".dock .cta, .pane button.cta").first().click();
  await p.waitForTimeout(1900);
}

async function imposer(p, nom) {
  await ouvrirTout(p);
  await p.waitForTimeout(250);
  const b = p.getByRole("button", { name: `Commencer la journée par ${nom}` });
  await b.scrollIntoViewIfNeeded();
  await b.click();
  await p.waitForTimeout(350);
}

async function scenario(nom, fn) {
  let p;
  const echecs = [];
  try {
    p = await fn((o) => page(o), (m) => echecs.push(m));
  } catch (e) {
    echecs.push("exception : " + String(e.message).split("\n")[0].slice(0, 110));
  }
  if (p?.__erreurs?.length) echecs.push("erreur console : " + [...new Set(p.__erreurs)][0]);
  await p?.__ctx?.close().catch(() => undefined);
  resultats.push({ nom, echecs });
  console.log(`${echecs.length ? "✗" : "✓"} ${nom}${echecs.length ? " — " + echecs.join(" | ") : ""}`);
}

/* ---------------------------------------------------------------- scénarios */

await scenario("1. Parc fermé, on prépare quand même la journée", async (ouvrir, ko) => {
  const p = await ouvrir({ heure: [22, 0], etat: () => ({ wait: 0, open: false }) });
  await planMix(p);
  const n = await nbAttractions(p);
  if (!n) ko("aucune attraction placée");
  if (!(await p.getByText(/Parc fermé en ce moment/).count())) ko("parcours prévisionnel non signalé");
  return p;
});

await scenario("2. Recalcul à 11 h : le parcours part de 11 h", async (ouvrir, ko) => {
  const p = await ouvrir({ heure: [11, 0] });
  await planMix(p);
  const h = (await heures(p))[0] ?? "";
  if (!/^1[1-9]:/.test(h)) ko(`première étape à ${h}`);
  return p;
});

await scenario("3. Recalcul à 17 h : rien avant 17 h", async (ouvrir, ko) => {
  const p = await ouvrir({ heure: [17, 0] });
  await planMix(p);
  const hs = await heures(p);
  if (!hs.length) ko("parcours vide alors qu'il reste trois heures");
  const tot = hs.filter((h) => /^\d\d:/.test(h) && Number(h.slice(0, 2)) < 17);
  if (tot.length) ko(`${tot.length} étapes avant l'heure réelle`);
  return p;
});

await scenario("4. Attraction imposée, relevée fermée, plan à l'avance", async (ouvrir, ko) => {
  const p = await ouvrir({ heure: [8, 0], etat: (id) => (id === SILVER ? { wait: 0, open: false } : { wait: 12, open: true }) });
  await p.getByRole("button", { name: /^Mix$/ }).click(); await p.waitForTimeout(400);
  await imposer(p, "Silver Star");
  await p.locator(".dock .cta, .pane button.cta").first().click(); await p.waitForTimeout(1900);
  const t = await tete(p);
  if (t !== "Silver Star") ko(`« ${t} » en tête`);
  return p;
});

await scenario("5. Attraction imposée, ouverture décalée, recalcul depuis maintenant", async (ouvrir, ko) => {
  const p = await ouvrir({ heure: [9, 3], etat: (id) => (id === SILVER ? { wait: 0, open: false } : { wait: 12, open: true }) });
  await p.getByRole("button", { name: /^Mix$/ }).click(); await p.waitForTimeout(400);
  await imposer(p, "Silver Star");
  await p.locator(".dock .cta, .pane button.cta").first().click(); await p.waitForTimeout(1900);
  await p.locator(".pane .cta").first().click(); await p.waitForTimeout(1900);
  const t = await tete(p);
  if (t !== "Silver Star") ko(`« ${t} » en tête après recalcul`);
  if (!(await p.getByText(/relevée fermée à l'instant/).count())) ko("fermeture non signalée");
  return p;
});

await scenario("6. Attraction imposée mais déjà faite : dit pourquoi, et se répare", async (ouvrir, ko) => {
  const p = await ouvrir({ heure: [10, 0] });
  await p.getByRole("button", { name: /^Mix$/ }).click(); await p.waitForTimeout(400);
  await imposer(p, "Silver Star");
  await p.locator(".dock .cta, .pane button.cta").first().click(); await p.waitForTimeout(1900);
  await p.locator(".nextup .go").click(); await p.waitForTimeout(1600);
  if (!(await p.getByText(/marquée comme déjà faite/).count())) ko("aucune explication affichée");
  await p.getByRole("button", { name: "La remettre à faire" }).click(); await p.waitForTimeout(1800);
  const t = await tete(p);
  if (t !== "Silver Star") ko(`« ${t} » en tête après remise à faire`);
  return p;
});

await scenario("7. Validation : aucune attraction ne disparaît", async (ouvrir, ko) => {
  const p = await ouvrir({ heure: [10, 0] });
  await planMix(p);
  const avant = await nbAttractions(p);
  const premiere = await tete(p);
  await p.locator(".nextup .go").click(); await p.waitForTimeout(1600);
  const apres = await nbAttractions(p);
  if (apres < avant - 1) ko(`${avant}→${apres}, ${avant - 1 - apres} perdues`);
  if ((await noms(p)).some((n) => n.includes(premiere))) ko("l'étape validée est encore là");
  return p;
});

await scenario("8. Retrait : la ligne sort et le parcours se recalcule", async (ouvrir, ko) => {
  const p = await ouvrir({ heure: [11, 0] });
  await planMix(p);
  const avantN = await noms(p), avantH = await heures(p);
  await p.locator(".stop .act.retirer").first().click(); await p.waitForTimeout(1600);
  const apresN = await noms(p);
  if (!avantN.find((n) => !apresN.includes(n))) ko("aucune attraction n'est sortie");
  if (JSON.stringify(await heures(p)) === JSON.stringify(avantH.slice(1))) ko("parcours non recalculé");
  return p;
});

await scenario("9. Ajout en cours de route : l'attraction entre au parcours", async (ouvrir, ko) => {
  const p = await ouvrir({ heure: [10, 0] });
  await p.getByRole("button", { name: /^Tout doux$/ }).click(); await p.waitForTimeout(400);
  await p.locator(".dock .cta, .pane button.cta").first().click(); await p.waitForTimeout(1900);
  const avant = await nbAttractions(p);
  await p.getByRole("button", { name: /Ajouter une attraction/ }).click(); await p.waitForTimeout(500);
  const dispo = p.locator(".card .row .ghost").first();
  if (!(await dispo.count())) return ko("aucune attraction proposée à l'ajout"), p;
  await dispo.click(); await p.waitForTimeout(1700);
  if ((await nbAttractions(p)) <= avant) ko(`${avant}→${await nbAttractions(p)} : rien n'a été ajouté`);
  return p;
});

await scenario("10. Fin de journée dépassée : le parcours tient", async (ouvrir, ko) => {
  const p = await ouvrir({ heure: [10, 0] });
  await planMix(p);
  const avant = await nbAttractions(p);
  await p.clock.setFixedTime(new Date(new Date().setHours(21, 0, 0, 0)));
  await reveiller(p);
  await p.locator(".nextup .go").click(); await p.waitForTimeout(1700);
  const apres = await nbAttractions(p);
  if (apres < avant - 1) ko(`${avant}→${apres} après validation à 21 h`);
  if (!(await p.getByText(/Votre journée se termine/).count())) ko("aucun bandeau de fin de journée");
  return p;
});

await scenario("11. Prolonger la journée rouvre le recalcul", async (ouvrir, ko) => {
  const p = await ouvrir({ heure: [10, 0] });
  await planMix(p);
  await p.clock.setFixedTime(new Date(new Date().setHours(21, 0, 0, 0)));
  await reveiller(p);
  await p.locator(".nextup .go").click(); await p.waitForTimeout(1700);
  const cta = p.locator(".pane .cta").first();
  if (!(await cta.isDisabled())) ko("le recalcul n'est pas bloqué après la fin de journée");
  await p.getByRole("button", { name: "+ 2 heures" }).click(); await p.waitForTimeout(900);
  if (await cta.isDisabled()) ko("le recalcul reste bloqué après prolongation");
  return p;
});

await scenario("12. Liste enregistrée : elle emporte parcours et ouverture", async (ouvrir, ko) => {
  const p = await ouvrir({ heure: [10, 0] });
  await p.getByRole("button", { name: /^Mix$/ }).click(); await p.waitForTimeout(400);
  await imposer(p, "Silver Star");
  await p.locator(".dock .cta, .pane button.cta").first().click(); await p.waitForTimeout(1900);
  await p.getByRole("tab", { name: /^Attractions/ }).click(); await p.waitForTimeout(400);
  await ouvrirTout(p);
  await p.getByLabel("Nom de la liste à enregistrer").fill("Test");
  await p.getByRole("button", { name: "Enregistrer" }).click(); await p.waitForTimeout(700);
  const r = await p.locator(".lot small").first().innerText();
  if (!/parcours enregistré/.test(r)) ko("parcours non embarqué");
  if (!/ouvre sur Silver Star/.test(r)) ko("attraction d'ouverture non embarquée");
  if ((await p.locator(".lot.active").count()) !== 1) ko("liste en cours non signalée");
  return p;
});

await scenario("13. Liste rechargée : état complet, sans les coches de la précédente", async (ouvrir, ko) => {
  const p = await ouvrir({ heure: [10, 0] });
  await p.getByRole("button", { name: /^Mix$/ }).click(); await p.waitForTimeout(400);
  await imposer(p, "Silver Star");
  await p.locator(".dock .cta, .pane button.cta").first().click(); await p.waitForTimeout(1900);
  await p.getByRole("tab", { name: /^Attractions/ }).click(); await p.waitForTimeout(400);
  await ouvrirTout(p);
  await p.getByLabel("Nom de la liste à enregistrer").fill("Test");
  await p.getByRole("button", { name: "Enregistrer" }).click(); await p.waitForTimeout(700);

  await p.getByRole("tab", { name: /^Parcours/ }).click(); await p.waitForTimeout(400);
  for (let i = 0; i < 3; i++) { await p.locator(".nextup .go").click(); await p.waitForTimeout(900); }
  await p.getByRole("tab", { name: /^Attractions/ }).click(); await p.waitForTimeout(400);
  await ouvrirTout(p);
  await p.getByRole("button", { name: "Déverrouiller" }).click(); await p.waitForTimeout(300);
  await p.getByRole("button", { name: /^Tout doux$/ }).click(); await p.waitForTimeout(600);
  await ouvrirTout(p);
  if (await p.locator(".lot.active").count()) ko("liste encore signalée en cours après changement");
  await p.getByRole("button", { name: "Charger" }).click(); await p.waitForTimeout(1000);
  if (await p.getByText(/comme déjà faites?\s*:/).count()) ko("des coches « déjà faite » ont survécu");
  await p.getByRole("tab", { name: /^Parcours/ }).click(); await p.waitForTimeout(800);
  const t = await tete(p);
  if (t !== "Silver Star") ko(`« ${t} » en tête après rechargement`);
  return p;
});

await scenario("14. Un joker ne se pose jamais sur une VirtualLine", async (ouvrir, ko) => {
  const p = await ouvrir({ heure: [10, 0] });
  await planMix(p);
  const conflit = await p.evaluate(() => {
    const s = JSON.parse(localStorage.getItem("ep.state.v4") ?? "{}");
    const d = s.days?.[s.day ?? 1] ?? {};
    return (d.gc ?? []).filter((id) => (d.vl ?? []).includes(id)).length;
  });
  if (conflit) ko(`${conflit} attractions à la fois joker et VirtualLine`);
  return p;
});

await scenario("15. Réinitialiser le jour demande deux gestes", async (ouvrir, ko) => {
  const p = await ouvrir({ heure: [10, 0] });
  await p.getByRole("button", { name: /^Mix$/ }).click(); await p.waitForTimeout(500);
  const choisies = await p.evaluate(() => {
    const s = JSON.parse(localStorage.getItem("ep.state.v4") ?? "{}");
    return (s.days?.[s.day ?? 1]?.sel ?? []).length;
  });
  await ouvrirTout(p);
  await p.getByRole("button", { name: /Réinitialiser le jour/ }).click(); await p.waitForTimeout(300);
  const apresPremier = await p.evaluate(() => {
    const s = JSON.parse(localStorage.getItem("ep.state.v4") ?? "{}");
    return (s.days?.[s.day ?? 1]?.sel ?? []).length;
  });
  if (apresPremier !== choisies) ko("le premier geste a déjà effacé");
  await p.getByRole("button", { name: /Confirmer : effacer les/ }).click(); await p.waitForTimeout(600);
  const fin = await p.evaluate(() => {
    const s = JSON.parse(localStorage.getItem("ep.state.v4") ?? "{}");
    return (s.days?.[s.day ?? 1]?.sel ?? []).length;
  });
  if (fin) ko(`${fin} attractions encore choisies après confirmation`);
  return p;
});

await scenario("16. Le plafond de brassage est respecté", async (ouvrir, ko) => {
  const p = await ouvrir({ heure: [9, 0] });
  await p.locator(".presets button", { hasText: "Sensations" }).click();
  await p.waitForTimeout(500);
  await p.locator(".dock .cta, .pane button.cta").first().click(); await p.waitForTimeout(1900);
  const depasse = await p.evaluate(() => {
    const s = JSON.parse(localStorage.getItem("ep.state.v4") ?? "{}");
    const d = s.days?.[s.day ?? 1] ?? {};
    let n = 0, pire = 0, prec = null;
    for (const e of d.steps ?? []) {
      if (e.kind !== "ride") { n = Math.max(0, n - (e.dur ?? 0) * 0.9); continue; }
      if (prec !== null) n = Math.max(0, n - (e.arrive - prec + e.wait) * 0.55);
      n += (e.ride?.nau ?? 0) * 13;
      pire = Math.max(pire, n);
      prec = e.end;
    }
    return { pire: Math.round(pire), tol: d.tol };
  });
  if (depasse.pire > depasse.tol + 1) ko(`brassage ${depasse.pire} au-dessus du plafond ${depasse.tol}`);
  return p;
});

await scenario("17. Jamais deux respirations d'affilée", async (ouvrir, ko) => {
  const p = await ouvrir({ heure: [9, 0] });
  await p.locator(".presets button", { hasText: "Sensations" }).click(); await p.waitForTimeout(500);
  // Estomac fragile : le plafond le plus bas, donc le cas où les pauses s'empilaient.
  await ouvrirTout(p);
  await p.getByRole("button", { name: "Estomac fragile" }).click(); await p.waitForTimeout(400);
  await p.locator(".dock .cta, .pane button.cta").first().click(); await p.waitForTimeout(2100);
  const suite = await p.locator(".stop .stopcard h4").evaluateAll((ns) => ns.map((n) => n.textContent.trim()));
  const doublons = suite.filter((n, i) => i > 0 && n === "Respiration" && suite[i - 1] === "Respiration").length;
  if (doublons) ko(`${doublons} respirations consécutives`);
  const pauses = suite.filter((n) => n === "Respiration").length;
  if (pauses > Math.ceil(suite.length / 3)) ko(`${pauses} respirations pour ${suite.length} étapes`);
  return p;
});

await scenario("18. Le reliquat devient une liste", async (ouvrir, ko) => {
  const p = await ouvrir({ heure: [16, 30] });   // peu de temps : il restera des attractions
  await planMix(p);
  const bouton = p.getByRole("button", { name: /Faire une liste avec ces \d+ attractions/ });
  if (!(await bouton.count())) return ko("aucune proposition de liste pour le reliquat"), p;
  const libelle = await bouton.innerText();
  await bouton.click(); await p.waitForTimeout(800);
  await p.getByRole("tab", { name: /^Attractions/ }).click(); await p.waitForTimeout(400);
  await ouvrirTout(p);
  const lots = await p.locator(".lot b").evaluateAll((ns) => ns.map((n) => n.textContent.trim()));
  if (!lots.some((n) => /^Reliquat du jour/.test(n))) ko(`liste non créée (${libelle})`);
  return p;
});

await B.close();

const rates = resultats.filter((r) => r.echecs.length);
console.log(`\n=== ${resultats.length - rates.length}/${resultats.length} scénarios passent ===`);
if (rates.length) {
  console.log("--- À CORRIGER ---");
  rates.forEach((r) => console.log(`  ${r.nom} : ${r.echecs.join(" | ")}`));
  process.exitCode = 1;
}
