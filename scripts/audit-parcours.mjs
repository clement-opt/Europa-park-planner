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
  const n0 = await p.locator(".stop").count();
  if (!n0) bad.push(`${s.n} aucun itinéraire calculé`);

  // étape faite
  await p.locator(".nextup .go").click(); await p.waitForTimeout(1600);
  const n1 = await p.locator(".stop").count();
  if (n1 >= n0) bad.push(`${s.n} étape non retirée ${n0}->${n1}`);

  // retrait d'une étape
  await p.locator(".stop .act.retirer").first().click(); await p.waitForTimeout(1500);
  const n2 = await p.locator(".stop").count();
  

  // ajout en cours de route
  await p.getByRole("button",{name:/Ajouter une attraction/}).click(); await p.waitForTimeout(400);
  const dispo = await p.locator(".card .row .ghost").count();
  if (dispo) { await p.locator(".card .row .ghost").first().click(); await p.waitForTimeout(1500); }
  const n3 = await p.locator(".stop").count();
  
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
  ok.push(`${s.n}: ${n0}→${n1}→${n2}→${n3} étapes, thème ${th}, fond ${contrast}`);
  if (errs.length) bad.push(`${s.n} erreurs: ${[...new Set(errs)].slice(0,2).join(" | ")}`);
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
