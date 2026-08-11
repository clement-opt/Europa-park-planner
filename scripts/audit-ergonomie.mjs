/**
 * Audit d'ergonomie mesuré, sur les deux thèmes.
 *
 *   npm run preview   (dans un autre terminal)
 *   node scripts/audit-ergonomie.mjs
 *
 * Contrôle : noms accessibles, contraste WCAG AA, atteignabilité au pouce de
 * l'action principale, nombre de gestes du parcours de base, libellés homonymes
 * dans une même carte, visibilité du focus clavier.
 *
 * Les seuils sont ceux de WCAG 2.1 AA : 4,5 pour le texte courant, 3 pour le
 * texte large (18,66 px, ou 14 px en gras).
 */
import { chromium } from "playwright";
const B = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const pb = [];

const lum = (c) => {
  const [r,g,b] = c.match(/\d+/g).map(Number).slice(0,3).map(v=>{v/=255;return v<=.03928?v/12.92:((v+.055)/1.055)**2.4;});
  return .2126*r + .7152*g + .0722*b;
};
const ratio = (a,b) => { const l1=lum(a), l2=lum(b); return ((Math.max(l1,l2)+.05)/(Math.min(l1,l2)+.05)); };

for (const theme of ["dark","light"]) {
  const ctx = await B.newContext({ viewport:{width:390,height:844}, deviceScaleFactor:2 });
  const p = await ctx.newPage();
  await p.goto(process.env.URL ?? "http://127.0.0.1:4173/",{waitUntil:"load"}); await p.waitForTimeout(3600);
  if (theme === "light") { await p.locator("header .icobtn").last().click(); await p.waitForTimeout(500); }

  // 1. noms accessibles
  const sansNom = await p.evaluate(() => {
    const out=[];
    for (const e of document.querySelectorAll("button, a[href], input, summary")) {
      const r=e.getBoundingClientRect(); if(!r.width||!r.height) continue;
      // Un <label for> est un nom accessible parfaitement valide : l'omettre
      // du contrôle produisait de faux positifs sur les champs horaires.
      const lie = e.id ? document.querySelector('label[for="' + e.id + '"]') : null;
      const nom = (e.getAttribute("aria-label") || e.getAttribute("title")
                   || e.getAttribute("aria-labelledby") || lie?.textContent || e.textContent || "").trim();
      if (!nom) out.push(e.tagName + "." + (e.className || "-").toString().slice(0, 26) + " #" + (e.id || "?"));
    }
    return [...new Set(out)];
  });
  if (sansNom.length) pb.push(`[${theme}] sans nom accessible : ${sansNom.join(" | ")}`);

  // 2. contraste du texte
  const faible = await p.evaluate(() => {
    const out=[];
    const fond = (e) => { let n=e; while(n){ const c=getComputedStyle(n).backgroundColor;
      if(c && c!=="rgba(0, 0, 0, 0)" && !c.endsWith(", 0)")) return c; n=n.parentElement; } return "rgb(255,255,255)"; };
    for (const e of document.querySelectorAll("body *")) {
      if (!e.textContent?.trim() || e.children.length) continue;
      const st=getComputedStyle(e); const r=e.getBoundingClientRect();
      if (!r.width||!r.height||st.visibility==="hidden") continue;
      out.push({ t:e.textContent.trim().slice(0,26), fg:st.color, bg:fond(e), px:parseFloat(st.fontSize), w:st.fontWeight });
    }
    return out;
  });
  for (const f of faible) {
    const r = ratio(f.fg, f.bg);
    const gros = f.px >= 18.66 || (f.px >= 14 && Number(f.w) >= 700);
    const seuil = gros ? 3 : 4.5;
    if (r < seuil) pb.push(`[${theme}] contraste ${r.toFixed(2)} < ${seuil} — « ${f.t} » ${f.px}px`);
  }

  // 3. atteignabilité : la zone du pouce est le tiers bas de l'écran
  if (theme === "dark") {
    await p.getByRole("button",{name:/^Mix$/}).click(); await p.waitForTimeout(400);
    const dock = await p.locator(".dock .cta").boundingBox();
    console.log("action principale : bas d'écran à", Math.round(844 - dock.y - dock.height), "px");

    // 4. nombre de gestes pour le parcours de base
    let gestes = 1; // Mix
    await p.locator(".dock .cta").click(); gestes++;
    await p.waitForTimeout(1700);
    const vu = await p.locator(".nextup h4").isVisible();
    console.log("gestes jusqu'à la prochaine étape :", gestes, vu ? "(visible)" : "(NON visible)");

    // 5. libellés ambigus : deux actions au même nom dans une même carte
    const dup = await p.evaluate(() => {
      const out=[];
      for (const carte of document.querySelectorAll(".stopcard")) {
        const noms=[...carte.querySelectorAll("button")].map(b=>(b.textContent||"").trim());
        if (new Set(noms).size !== noms.length) out.push(noms.join("/"));
      }
      return [...new Set(out)];
    });
    if (dup.length) pb.push(`[${theme}] boutons homonymes dans une étape : ${dup.join(" | ")}`);

    // 6. focus visible au clavier
    await p.keyboard.press("Tab");
    const focus = await p.evaluate(() => {
      const e=document.activeElement; if(!e||e===document.body) return null;
      const s=getComputedStyle(e);
      return { el:e.tagName, outline:s.outlineWidth, style:s.outlineStyle };
    });
    if (!focus || focus.outline === "0px" || focus.style === "none")
      pb.push(`[${theme}] focus clavier invisible sur ${focus?.el ?? "rien"}`);
    else console.log("focus clavier :", focus.el, focus.outline, focus.style);
  }
  await ctx.close();
}
await B.close();
console.log("\n=== ERGONOMIE : À CORRIGER ===");
console.log(pb.length ? [...new Set(pb)].map(l=>"  "+l).join("\n") : "  rien");
