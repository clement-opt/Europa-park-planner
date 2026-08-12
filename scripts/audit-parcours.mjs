/**
 * Audit fonctionnel et responsive, sur quatre gabarits.
 *
 *   npm run preview   (dans un autre terminal)
 *   URL=http://127.0.0.1:4173/ node scripts/audit-parcours.mjs
 *
 * Contrôle : débordement horizontal, erreurs console, cibles tactiles, taille de
 * texte, parcours complet (calcul, validation, retrait, ajout), bascule de thème,
 * service worker, manifest, rendu hors ligne.
 */
import { chromium } from "playwright";
import { readFileSync } from "node:fs";
const URL = process.env.URL ?? "http://127.0.0.1:4173/";
const B = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const bad = [];
const ok = [];

for (const s of [{n:"390",w:390,h:844},{n:"430",w:430,h:932},{n:"820",w:820,h:1180},{n:"1440",w:1440,h:900}]) {
  const ctx = await B.newContext({ viewport:{width:s.w,height:s.h}, deviceScaleFactor:2 });
  const p = await ctx.newPage();
  const errs=[]; p.on("pageerror",e=>errs.push(e.message.slice(0,120)));
  p.on("console",m=>{ if(m.type()==="error" && !/net::|Failed to load resource/.test(m.text())) errs.push("C:"+m.text().slice(0,120)); });
  await p.goto(URL,{waitUntil:"load"}); await p.waitForTimeout(3400);

  const of = async (label) => {
    const o = await p.evaluate(()=>({d:document.documentElement.scrollWidth,w:window.innerWidth}));
    if (o.d>o.w+1) bad.push(`${s.n} [${label}] débordement ${o.d}>${o.w}`);
  };
  await of("accueil");

  // parcours complet
  await p.getByRole("button",{name:/^Mix$/}).click(); await p.waitForTimeout(400);
  const dock = await p.locator(".dock .cta").count();
  if (s.w < 1180 && !dock) bad.push(`${s.n} barre d'action absente`);
  await p.locator(".dock .cta, .pane button.cta").first().click();
  await p.waitForTimeout(1700);
  await of("parcours");
  const n0 = await p.locator(".stop .act.fait").count();
  if (!n0) bad.push(`${s.n} aucun itinéraire calculé`);

  // Étape faite : une seule sort, les autres remontent. L'invariant n'est pas
  // « exactement une de moins » — une replanification acceptée peut en recaser
  // davantage — mais « jamais moins ». Vérifier « moins qu'avant », comme le faisait
  // ce test, laissait passer un parcours vidé d'un coup.
  await p.locator(".nextup .go").click(); await p.waitForTimeout(1600);
  const n1 = await p.locator(".stop .act.fait").count();
  if (n1 < n0 - 1) bad.push(`${s.n} validation : ${n0}->${n1} attractions, ${n0 - 1 - n1} perdues`);

  // Retrait : celle qu'on enlève sort, les autres restent.
  await p.locator(".stop .act.retirer").first().click(); await p.waitForTimeout(1500);
  const n2 = await p.locator(".stop .act.fait").count();
  if (n2 < n1 - 1) bad.push(`${s.n} retrait : ${n1}->${n2} attractions, ${n1 - 1 - n2} perdues`);
  

  // ajout en cours de route
  await p.getByRole("button",{name:/Ajouter une attraction/}).click(); await p.waitForTimeout(400);
  const dispo = await p.locator(".card .row .ghost").count();
  if (dispo) { await p.locator(".card .row .ghost").first().click(); await p.waitForTimeout(1500); }
  const n3 = await p.locator(".stop .act.fait").count();
  
  await of("apres-ajout");

  // cibles et texte
  const small = await p.evaluate(()=>{const o=[];for(const e of document.querySelectorAll("button,input,summary")){const r=e.getBoundingClientRect();if(!r.width||!r.height)continue;if(r.height<40)o.push(`${e.tagName}.${(e.className||"-").toString().slice(0,18)} ${Math.round(r.width)}x${Math.round(r.height)}`);}return [...new Set(o)].slice(0,5);});
  if (small.length) bad.push(`${s.n} cibles <40px: ${small.join(" | ")}`);
  const tiny = await p.evaluate(()=>{const o=new Set();for(const e of document.querySelectorAll("body *")){if(!e.textContent?.trim()||e.children.length)continue;const f=parseFloat(getComputedStyle(e).fontSize);if(f<12.5)o.add(`${e.tagName} ${f}px`);}return [...o].slice(0,5);});
  if (tiny.length) bad.push(`${s.n} texte <12.5px: ${tiny.join(" | ")}`);

  // thème clair
  await p.locator("header .icobtn").last().click(); await p.waitForTimeout(500);
  const th = await p.evaluate(()=>document.documentElement.getAttribute("data-theme"));
  if (th!=="light") bad.push(`${s.n} bascule de thème KO (${th})`);
  const contrast = await p.evaluate(()=>getComputedStyle(document.body).backgroundColor);
  ok.push(`${s.n}: ${n0}→${n1}→${n2}→${n3} attractions, thème ${th}, fond ${contrast}`);
  if (errs.length) bad.push(`${s.n} erreurs: ${[...new Set(errs)].slice(0,2).join(" | ")}`);
  await ctx.close();
}

/**
 * Fin de journée dépassée. `buildPlan` part de l'heure réelle : passé l'heure de
 * fin il n'a plus une minute où poser quoi que ce soit et renvoie une liste vide.
 * Valider une étape à ce moment-là effaçait tout le parcours d'un coup, alors que
 * cinq attractions restaient à faire. Le parcours doit tenir.
 */
{
  const ctx = await B.newContext({ viewport:{width:390,height:844} });
  const p = await ctx.newPage();
  const jour = new Date(); jour.setSeconds(0,0);
  const a = (h,m)=>{ const d=new Date(jour); d.setHours(h,m); return d; };
  await p.clock.setFixedTime(a(10,0));            // en pleine journée : le plan se calcule
  await p.goto(URL,{waitUntil:"load"}); await p.waitForTimeout(3400);
  await p.getByRole("button",{name:/^Mix$/}).click(); await p.waitForTimeout(400);
  await p.locator(".dock .cta, .pane button.cta").first().click(); await p.waitForTimeout(1700);
  const avant = await p.locator(".stop .act.fait").count();

  await p.clock.setFixedTime(a(20,5));            // après la fin de journée (20:00)
  await p.locator(".nextup .go").click(); await p.waitForTimeout(1600);
  const apres = await p.locator(".stop .act.fait").count();
  ok.push(`fin de journée : ${avant} attractions à 10 h 00, ${apres} après validation à 20 h 05`);
  if (!avant) bad.push("fin de journée : aucun parcours de départ, test non concluant");
  else if (apres < avant - 1) bad.push(`fin de journée : ${avant}->${apres} après validation, ${avant-1-apres} perdues`);

  await p.locator(".stop .act.retirer").first().click(); await p.waitForTimeout(1500);
  const apresRetrait = await p.locator(".stop .act.fait").count();
  if (avant && apresRetrait < apres - 1) bad.push(`fin de journée : retrait ${apres}->${apresRetrait}, ${apres-1-apresRetrait} perdues`);
  await ctx.close();
}

/**
 * Parc fermé. Préparer un parcours pour un autre jour ne doit pas dépendre de l'état
 * d'ouverture de l'instant : le soir, toutes les attractions étant fermées, elles
 * étaient toutes écartées et le calcul ne rendait rien.
 */
{
  const bloc = readFileSync("src/data/rides.ts", "utf8").match(/export const SNAPSHOT[\s\S]*?\n};/)[0];
  const ids = [...bloc.matchAll(/(\d{4,}):\s*\d+/g)].map((m) => Number(m[1]));
  const ctx = await B.newContext({ viewport:{width:390,height:844} });
  const p = await ctx.newPage();
  await p.route(/rpc\/ep_waits/, (r) => r.fulfill({
    status: 200, contentType: "application/json",
    body: JSON.stringify({ at: new Date().toISOString(), vl: {},
      rides: Object.fromEntries(ids.map((id) => [id, { wait: 0, open: false }])) })
  }));
  await p.goto(URL,{waitUntil:"load"}); await p.waitForTimeout(3600);
  await p.getByRole("button",{name:/^Mix$/}).click(); await p.waitForTimeout(400);
  await p.locator(".dock .cta, .pane button.cta").first().click(); await p.waitForTimeout(1800);
  const n = await p.locator(".stop .act.fait").count();
  const avertit = await p.getByText(/Parc fermé en ce moment/).count();
  ok.push(`parc fermé (${ids.length} attractions) : ${n} placées, avertissement ${avertit ? "affiché" : "absent"}`);
  if (!n) bad.push("parc fermé : aucun parcours préparé alors qu'on planifie à l'avance");
  if (!avertit) bad.push("parc fermé : parcours prévisionnel non signalé");

  // Attraction imposée alors que le relevé la dit fermée : c'est le cas signalé sur le
  // terrain. Elle doit ouvrir le parcours, pas être écartée en silence.
  await p.getByRole("tab",{name:/^Attractions/}).click(); await p.waitForTimeout(500);
  await p.locator("summary",{hasText:"France"}).first().click(); await p.waitForTimeout(400);
  const etoile = p.getByRole("button",{name:"Commencer la journée par Silver Star"});
  await etoile.scrollIntoViewIfNeeded(); await etoile.click(); await p.waitForTimeout(400);
  await p.locator(".dock .cta, .pane button.cta").first().click(); await p.waitForTimeout(2000);
  const premiere = await p.locator(".nextup h4").textContent().catch(() => "(aucune)");
  ok.push(`attraction imposée fermée : le parcours commence par « ${premiere} »`);
  if (premiere !== "Silver Star") bad.push(`attraction imposée : « ${premiere} » en tête au lieu de Silver Star`);
  await ctx.close();
}

/**
 * Ouverture décalée : le parc est ouvert, mais l'attraction imposée est encore
 * relevée fermée. C'est le cas observé sur le terrain — Silver Star fermée à 9 h 00,
 * ouverte à 9 h 05 — et le parcours calculé entre les deux perdait la consigne.
 */
{
  const bloc = readFileSync("src/data/rides.ts", "utf8").match(/export const SNAPSHOT[\s\S]*?\n};/)[0];
  const ids = [...bloc.matchAll(/(\d{4,}):\s*\d+/g)].map((m) => Number(m[1]));
  const SILVER = 5604;
  const ctx = await B.newContext({ viewport:{width:390,height:844} });
  const p = await ctx.newPage();
  await p.route(/rpc\/ep_waits/, (r) => r.fulfill({
    status: 200, contentType: "application/json",
    body: JSON.stringify({ at: new Date().toISOString(), vl: {},
      rides: Object.fromEntries(ids.map((id) => [id,
        id === SILVER ? { wait: 0, open: false } : { wait: 15, open: true }])) })
  }));
  await p.goto(URL,{waitUntil:"load"}); await p.waitForTimeout(3600);
  await p.getByRole("button",{name:/^Mix$/}).click(); await p.waitForTimeout(400);
  await p.locator("summary",{hasText:"France"}).first().click(); await p.waitForTimeout(400);
  const et = p.getByRole("button",{name:"Commencer la journée par Silver Star"});
  await et.scrollIntoViewIfNeeded(); await et.click(); await p.waitForTimeout(400);
  await p.locator(".dock .cta, .pane button.cta").first().click(); await p.waitForTimeout(1900);
  const tete = await p.locator(".nextup h4").textContent().catch(() => "(aucune)");
  const dit = await p.getByText(/relevée fermée à l'instant/).count();
  ok.push(`ouverture décalée : tête « ${tete} », mention ${dit ? "affichée" : "absente"}`);
  if (tete !== "Silver Star") bad.push(`ouverture décalée : « ${tete} » en tête au lieu de Silver Star`);
  if (!dit) bad.push("ouverture décalée : fermeture de l'attraction imposée non signalée");

  // Et à partir de maintenant : la consigne doit tenir là aussi.
  await p.locator(".pane .cta").first().click(); await p.waitForTimeout(1900);
  const tete2 = await p.locator(".nextup h4").textContent().catch(() => "(aucune)");
  if (tete2 !== "Silver Star") bad.push(`ouverture décalée, recalcul depuis maintenant : « ${tete2} » en tête`);
  ok.push(`ouverture décalée, recalcul depuis maintenant : tête « ${tete2} »`);
  await ctx.close();
}

/**
 * Actions irréversibles : un seul geste effaçait la sélection entière du jour, sans
 * confirmation ni retour arrière. Le premier tap doit armer, le second seul exécuter.
 */
{
  const ctx = await B.newContext({ viewport:{width:390,height:844} });
  const p = await ctx.newPage();
  await p.goto(URL,{waitUntil:"load"}); await p.waitForTimeout(3400);
  await p.getByRole("button",{name:/^Mix$/}).click(); await p.waitForTimeout(500);
  const choisies = await p.locator(".chk[aria-pressed=true], .tick[aria-pressed=true]").count();
  await p.locator("summary",{hasText:"Partage, export et journal"}).click(); await p.waitForTimeout(400);
  const reset = p.getByRole("button",{name:/Réinitialiser le jour/});
  await reset.click(); await p.waitForTimeout(300);
  const arme = await p.getByRole("button",{name:/Confirmer : effacer les/}).count();
  if (!arme) bad.push("réinitialisation : premier tap non armé, effacement immédiat");
  await p.getByRole("button",{name:/Confirmer : effacer les/}).click(); await p.waitForTimeout(500);
  const apres = await p.locator(".chk[aria-pressed=true], .tick[aria-pressed=true]").count();
  ok.push(`réinitialisation : ${choisies} attractions, armement puis confirmation → ${apres}`);
  if (apres) bad.push(`réinitialisation : ${apres} attractions encore choisies après confirmation`);
  await ctx.close();
}

// PWA
const ctx = await B.newContext({ viewport:{width:390,height:844} });
const p = await ctx.newPage();
await p.goto(URL,{waitUntil:"load"}); await p.waitForTimeout(4000);
const pwa = await p.evaluate(async()=>{
  const reg = await navigator.serviceWorker.getRegistration();
  const m = await fetch("/manifest.webmanifest").then(r=>r.json());
  return { sw:!!reg, active:!!reg?.active, name:m.name, short:m.short_name, display:m.display,
           icons:m.icons.length, maskable:m.icons.some(i=>i.purpose==="maskable"), theme:m.theme_color };
});
ok.push("PWA: "+JSON.stringify(pwa));
if (!pwa.sw || !pwa.active) bad.push("PWA: service worker non actif");
if (!pwa.maskable) bad.push("PWA: pas d'icône maskable");

// hors ligne
await p.context().setOffline(true);
await p.reload({waitUntil:"load"}).catch(()=>bad.push("hors ligne: rechargement impossible"));
await p.waitForTimeout(2500);
const offline = await p.evaluate(()=>!!document.querySelector(".top") || !!document.getElementById("boot"));
ok.push("hors ligne: app rendue = "+offline);
if (!offline) bad.push("hors ligne: page vide");
await ctx.close(); await B.close();

console.log("--- OK ---"); ok.forEach(l=>console.log("  "+l));
console.log("--- À CORRIGER ---");
console.log(bad.length ? bad.map(l=>"  "+l).join("\n") : "  rien");
