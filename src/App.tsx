import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BY_ID, ENTRANCE, RIDES, type Ride } from "./data/rides";
import { fetchWaits, type Snapshot } from "./lib/api";
import { fetchOsmPositions, type LatLng } from "./lib/geo";
import { buildPlan, clockMin, hhmm, type DayPlan, type Step } from "./lib/planner";
import { downloadMarkdown, loadJournal, record, clearJournal } from "./lib/journal";
import { copySelection, exportSelectionFile, load, save, type AppState } from "./lib/storage";
import ParkMap from "./components/ParkMap";
import { AnimatePresence, motion } from "motion/react";

const Clover = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M12 21c-.5-2.6-1.4-4-2.7-4.8 1.3.4 2.4.2 3.1-.6.8-.9.7-2.2-.2-3-.9-.8-2.2-.7-3 .2-.5.6-.7 1.4-.5 2.2-.9-1-2.2-1.2-3.3-.5C4.2 15.2 4 16.7 4.9 17.8c.9 1.1 2.4 1.2 3.5.4C7.2 19.4 6.7 21 12 21zM12 3c-.8 0-1.5.4-1.9 1.1-.5-.2-1.1-.2-1.7.1-1.2.6-1.6 2-1 3.1.4.8 1.2 1.3 2 1.3-.3.7-.3 1.5 0 2.2.6 1.2 2 1.6 3.2 1s1.6-2 1-3.2c-.2-.3-.4-.5-.6-.7.8-.2 1.5-.8 1.8-1.6.4-1.2-.3-2.6-1.6-3-.3-.1-.8-.2-1.2-.1V3z" />
  </svg>
);
const Check = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12l6 6L20 5" /></svg>
);

/** Petite gerbe d'étincelles à l'endroit du clic. */
function sparkle(x: number, y: number, color: string) {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  for (let i = 0; i < 14; i++) {
    const el = document.createElement("i");
    el.className = "spark";
    const a = (Math.PI * 2 * i) / 14 + Math.random();
    const d = 34 + Math.random() * 46;
    el.style.left = x + "px";
    el.style.top = y + "px";
    el.style.background = color;
    el.style.setProperty("--dx", `${Math.cos(a) * d}px`);
    el.style.setProperty("--dy", `${Math.sin(a) * d}px`);
    el.style.animation = `fly ${520 + Math.random() * 320}ms cubic-bezier(.2,.7,.3,1) forwards`;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 900);
  }
}

const waitClass = (w: number) => (w < 0 ? "closed" : w < 20 ? "go" : w <= 45 ? "mid" : "stop");
const waitLabel = (w: number) => (w < 0 ? "fermé" : `${w} min`);

export default function App() {
  const [st, setSt] = useState<AppState>(() => load());
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [osm, setOsm] = useState<Record<number, LatLng>>({});
  const [tab, setTab] = useState<"sel" | "map" | "plan">("sel");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState("");
  const [now, setNow] = useState(clockMin());
  const [journalSize, setJournalSize] = useState(() => loadJournal().samples.length);
  const relayRef = useRef(st.relay);

  const day = st.days[st.day];
  const setDay = (patch: Partial<DayPlan>) =>
    setSt((s) => ({ ...s, days: { ...s.days, [s.day]: { ...s.days[s.day], ...patch } } }));

  useEffect(() => { save(st); relayRef.current = st.relay; }, [st]);
  useEffect(() => { document.documentElement.setAttribute("data-theme", st.theme); }, [st.theme]);
  useEffect(() => { const t = setInterval(() => setNow(clockMin()), 20000); return () => clearInterval(t); }, []);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(""), 2400); return () => clearTimeout(t); }, [toast]);

  /** Relevé : on rafraîchit et on journalise. */
  const ping = useCallback(async (announce?: boolean) => {
    setBusy(true);
    const s = await fetchWaits(relayRef.current || undefined);
    setSnap(s);
    if (s.source === "live") setJournalSize(record(s).samples.length);
    setBusy(false);
    if (announce) setToast(s.source === "live" ? "Temps d'attente à jour" : "API injoignable, valeurs figées");
  }, []);

  useEffect(() => {
    ping();
    const t = setInterval(() => ping(), 120000);
    return () => clearInterval(t);
  }, [ping]);

  useEffect(() => {
    const cached = localStorage.getItem("ep.osm.v1");
    if (cached) { try { setOsm(JSON.parse(cached)); return; } catch { /* refetch */ } }
    fetchOsmPositions().then((p) => {
      if (Object.keys(p).length) {
        setOsm(p);
        try { localStorage.setItem("ep.osm.v1", JSON.stringify(p)); } catch { /* quota */ }
      }
    });
  }, []);

  const positions = useCallback((r: Ride): LatLng => osm[r.id] ?? { lat: r.lat, lng: r.lng }, [osm]);
  const waits = useMemo(() => {
    const out: Record<number, number> = {};
    for (const r of RIDES) {
      const s = snap?.rides[r.id];
      out[r.id] = s ? (s.open ? s.wait : -1) : -1;
    }
    return out;
  }, [snap]);

  const sel = useMemo(() => new Set(day.sel), [day.sel]);
  const gc = useMemo(() => new Set(day.gc), [day.gc]);
  const vl = useMemo(() => new Set(day.vl), [day.vl]);
  const done = useMemo(() => new Set(day.done), [day.done]);
  const spent = day.gc.filter((id) => done.has(id)).length;

  const toggle = (list: number[], id: number) =>
    list.includes(id) ? list.filter((x) => x !== id) : [...list, id];

  const onSelect = (id: number) => {
    if (sel.has(id)) setDay({ sel: day.sel.filter((x) => x !== id), gc: day.gc.filter((x) => x !== id), vl: day.vl.filter((x) => x !== id) });
    else setDay({ sel: [...day.sel, id] });
  };
  const onGc = (id: number, e: React.MouseEvent) => {
    if (gc.has(id)) return setDay({ gc: day.gc.filter((x) => x !== id) });
    if (day.gc.length >= 6) return setToast("Les 6 jokers du jour sont déjà posés");
    sparkle(e.clientX, e.clientY, "#3ECB8B");
    setDay({ gc: [...day.gc, id], vl: day.vl.filter((x) => x !== id) });
  };
  const onVl = (id: number) => {
    if (vl.has(id)) return setDay({ vl: day.vl.filter((x) => x !== id) });
    setDay({ vl: [...day.vl, id], gc: day.gc.filter((x) => x !== id) });
  };
  const onTick = (id: number, e?: React.MouseEvent) => {
    const has = done.has(id);
    if (!has && e) sparkle(e.clientX, e.clientY, gc.has(id) ? "#3ECB8B" : "#6E9BE0");
    setDay({ done: toggle(day.done, id), sel: has || sel.has(id) ? day.sel : [...day.sel, id] });
  };

  const compute = (fromNow: boolean) => {
    if (!snap) return;
    if (!day.sel.length) return setToast("Sélectionnez d'abord vos attractions");
    const steps = buildPlan({ day, snap, pace: st.pace, positions, fromNow, rides: RIDES });
    setDay({ steps });
    setTab("plan");
  };

  /** Les préréglages ne s'appliquent que sur clic explicite : rien n'est coché au démarrage. */
  const preset = (kind: "mix" | "thrill" | "chill" | "none") => {
    if (kind === "none") return setDay({ sel: [], gc: [], vl: [], steps: [] });
    const pick = new Set<number>();
    if (kind === "thrill") RIDES.filter((r) => r.thr >= 4).forEach((r) => pick.add(r.id));
    if (kind === "chill") RIDES.filter((r) => r.nau <= 1 && !r.kid).forEach((r) => pick.add(r.id));
    if (kind === "mix") {
      RIDES.filter((r) => r.thr >= 4).forEach((r) => pick.add(r.id));
      RIDES.filter((r) => r.nau <= 1 && r.thr <= 2 && !r.kid).forEach((r) => pick.add(r.id));
    }
    const list = [...pick];
    const jok = list.map((id) => BY_ID[id]).filter((r) => !r.vl && waits[r.id] >= 0)
      .sort((a, b) => waits[b.id] - waits[a.id]).slice(0, 6).map((r) => r.id);
    const virt = list.map((id) => BY_ID[id]).filter((r) => r.vl && !jok.includes(r.id)).map((r) => r.id);
    setDay({ sel: list, gc: kind === "mix" ? jok : [], vl: kind === "mix" ? virt : [], steps: [] });
  };

  const byZone = useMemo(() => {
    const z: Record<string, Ride[]> = {};
    RIDES.forEach((r) => (z[r.z] = z[r.z] ?? []).push(r));
    return Object.entries(z).sort(([a], [b]) => a.localeCompare(b));
  }, []);

  const openWaits = RIDES.map((r) => waits[r.id]).filter((w) => w > 0);
  const avg = openWaits.length ? Math.round(openWaits.reduce((a, b) => a + b, 0) / openWaits.length) : null;
  const liveAge = snap ? Math.round((Date.now() - snap.at) / 60000) : 0;
  const remaining = day.steps.filter((s): s is Extract<Step, { kind: "ride" }> => s.kind === "ride" && !done.has(s.ride.id));

  return (
    <>
      <div className="aurora"><span /><span /><span /></div>

      <header className="top">
        <div className="brand"><b>Plan de route</b><span>Europa-Park · 4 adultes</span></div>
        <div className="clock">
          <b className="mono">{hhmm(now)}</b>
          <span>{now >= 540 && now < 1080 ? "parc ouvert" : "parc fermé"}</span>
        </div>
        <button className={"icobtn" + (busy ? " spin" : "")} onClick={() => ping(true)} aria-label="Actualiser">
          <svg viewBox="0 0 24 24"><path d="M21 12a9 9 0 1 1-2.6-6.4" /><path d="M21 3v6h-6" /></svg>
        </button>
        <button className="icobtn" onClick={() => setSt((s) => ({ ...s, theme: s.theme === "dark" ? "light" : "dark" }))} aria-label="Thème">
          {st.theme === "dark"
            ? <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>
            : <svg viewBox="0 0 24 24"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" /></svg>}
        </button>
      </header>

      <div className="strip">
        <div className="cell"><u>Données</u><b className="mono">
          <span className={"dot " + (snap?.source === "live" ? (liveAge > 12 ? "stale" : "live") : "off")} />
          {snap?.source === "live" ? (liveAge < 1 ? "à l'instant" : `${liveAge} min`) : "hors ligne"}
        </b></div>
        <div className="cell"><u>Jokers restants</u><b className="mono">{6 - spent} / 6</b></div>
        <div className="cell"><u>Relevés journalisés</u><b className="mono">{journalSize}</b></div>
        <div className="cell"><u>Attente moyenne</u><b className="mono">{avg !== null ? `${avg} min` : "—"}</b></div>
        <div className="cell"><u>Positions</u><b className="mono">{Object.keys(osm).length ? "OSM" : "estimées"}</b></div>
      </div>

      <nav className="tabs" role="tablist">
        <button role="tab" aria-selected={tab === "sel"} onClick={() => setTab("sel")}>
          Attractions<span className="cnt">{day.sel.length}</span>
        </button>
        <button role="tab" aria-selected={tab === "map"} onClick={() => setTab("map")}>Carte</button>
        <button role="tab" aria-selected={tab === "plan"} onClick={() => setTab("plan")}>Itinéraire</button>
      </nav>

      <div className="wrap">
        {/* ---------------- sélection ---------------- */}
        <section className={"pane" + (tab === "sel" ? " on" : "")}>
          {snap?.source === "snapshot" && (
            <div className="warn">
              <b>Temps d'attente figés.</b> queue-times.com ne renvoie pas d'en-tête CORS et les relais publics n'ont pas répondu.
              Déployez le Worker fourni dans <code>worker/queue-proxy.js</code> et collez son URL ci-dessous.
              <div style={{ marginTop: 8 }}>
                <label className="f" htmlFor="relay">Relais personnel (préfixe d'URL)</label>
                <input id="relay" type="text" placeholder="https://mon-worker.workers.dev/?url="
                  defaultValue={st.relay}
                  onBlur={(e) => { setSt((s) => ({ ...s, relay: e.target.value.trim() })); ping(true); }} />
              </div>
            </div>
          )}

          <div className="days">
            {([1, 2] as const).map((d) => (
              <button key={d} aria-pressed={st.day === d} onClick={() => setSt((s) => ({ ...s, day: d }))}>
                <b>Jour {d}</b>
                <u>{st.days[d].sel.length} choisies · {st.days[d].done.length} faites</u>
              </button>
            ))}
          </div>

          <div className="card">
            <h3><span style={{ width: 15, height: 15, display: "inline-block", color: "var(--clover)" }}><Clover /></span>
              Green Card du jour <em>{day.gc.length} / 6 posés</em></h3>
            <div className="jokers">
              {Array.from({ length: 6 }, (_, i) => {
                const id = day.gc[i];
                const cls = id ? (done.has(id) ? "spent" : "armed") : "";
                return <span key={i} className={"tok " + cls} title={id ? BY_ID[id].n : "joker libre"}><Clover /></span>;
              })}
              <span className="lbl">{6 - spent} restant{6 - spent > 1 ? "s" : ""}</span>
            </div>
            <div className="gclist">
              {day.gc.length ? (
                <ol>{day.gc.map((id) => (
                  <li key={id} className={done.has(id) ? "spent" : ""}>{BY_ID[id].n} <span>· {BY_ID[id].z}</span></li>
                ))}</ol>
              ) : (
                <p className="note" style={{ margin: 0 }}>
                  Aucun joker posé. Visez les files longues qui n'ont pas de VirtualLine : c'est là que la carte rapporte le plus.
                </p>
              )}
            </div>
            <div className="pad" style={{ borderTop: "1px solid var(--line)" }}>
              <p className="tell">
                <b>En arrivant :</b> Information sous la Tour (quartier France), avec la carte d'invalidité et une pièce d'identité.
                Le personnel <b>écrit les 6 attractions sur la carte</b>, donc arrivez avec cette liste décidée.
                Une nouvelle carte est délivrée chaque jour du séjour.
              </p>
            </div>
          </div>

          <div className="card">
            <h3>La journée</h3>
            <div className="pad">
              <div className="row">
                <div style={{ flex: 1 }}><label className="f">Départ</label>
                  <input type="time" value={day.start} onChange={(e) => setDay({ start: e.target.value })} /></div>
                <div style={{ flex: 1 }}><label className="f">Fin</label>
                  <input type="time" value={day.end} onChange={(e) => setDay({ end: e.target.value })} /></div>
              </div>
              <div className="row">
                <div style={{ flex: 1 }}><label className="f">Déjeuner</label>
                  <input type="time" value={day.lunch} onChange={(e) => setDay({ lunch: e.target.value })} /></div>
                <div style={{ flex: 1 }}><label className="f">Durée (min)</label>
                  <input type="number" min={0} max={180} step={5} value={day.lunchDur}
                    onChange={(e) => setDay({ lunchDur: Number(e.target.value) })} /></div>
              </div>
              <div className="row" style={{ display: "block" }}>
                <label className="f">Tolérance au brassage</label>
                <div className="seg">
                  {[{ v: 45, l: "Estomac fragile" }, { v: 65, l: "Équilibré" }, { v: 88, l: "On encaisse" }].map((o) => (
                    <button key={o.v} aria-pressed={day.tol === o.v} onClick={() => setDay({ tol: o.v })}>{o.l}</button>
                  ))}
                </div>
                <p className="note" style={{ margin: "8px 0 0" }}>
                  Le plan intercale du calme dès que le compteur approche la limite. C'est le garde-fou anti-nausée.
                </p>
              </div>
              <div className="row" style={{ display: "block" }}>
                <label className="f">Rythme de marche <span className="mono">{st.pace.toString().replace(".", ",")} km/h</span></label>
                <input type="range" min={3} max={6} step={0.25} value={st.pace}
                  onChange={(e) => setSt((s) => ({ ...s, pace: Number(e.target.value) }))} />
              </div>
            </div>
          </div>

          <div className="card">
            <h3>Attractions <em>{day.sel.length} sélectionnée{day.sel.length > 1 ? "s" : ""}</em></h3>
            <div className="pad" style={{ borderBottom: "1px solid var(--line)" }}>
              <div className="row">
                <button className="ghost" onClick={() => preset("mix")}>Mix sensations + calme</button>
                <button className="ghost" onClick={() => preset("thrill")}>Grosses sensations</button>
                <button className="ghost" onClick={() => preset("chill")}>Tout doux</button>
                <button className="ghost" onClick={() => preset("none")}>Tout décocher</button>
              </div>
              <p className="note" style={{ margin: "9px 0 0" }}>
                Rien n'est coché au démarrage : les préréglages ne s'appliquent que si vous cliquez.
                Le <b style={{ color: "var(--clover)" }}>trèfle</b> pose un joker, <b style={{ color: "var(--vline)" }}>VL</b> réserve une file virtuelle,
                la case de droite marque l'attraction comme faite.
              </p>
            </div>
            {byZone.map(([zone, list]) => (
              <div className="zone" key={zone}>
                <b>{zone}</b>
                {list.map((r) => {
                  const w = waits[r.id];
                  return (
                    <div key={r.id} className={"ride" + (sel.has(r.id) ? " sel" : "") + (done.has(r.id) ? " ticked" : "")}>
                      <button className="chk" aria-pressed={sel.has(r.id)} onClick={() => onSelect(r.id)} aria-label={`Choisir ${r.n}`}><Check /></button>
                      <div className="name">{r.n}{r.kid && <small>pour les petits</small>}
                        <small>{r.dur} min · brassage {r.nau}/5</small></div>
                      <div className="intens">{[1, 2, 3, 4, 5].map((i) => <i key={i} className={i <= r.thr ? "on" : ""} />)}</div>
                      <span className={"wt mono " + waitClass(w)}>{waitLabel(w)}</span>
                      <button className="pill gc" aria-pressed={gc.has(r.id)} disabled={!sel.has(r.id) || (day.gc.length >= 6 && !gc.has(r.id))}
                        onClick={(e) => onGc(r.id, e)} title="Joker Green Card"><Clover /></button>
                      <button className="pill vl" aria-pressed={vl.has(r.id)} disabled={!sel.has(r.id) || !r.vl}
                        onClick={() => onVl(r.id)} title="VirtualLine">VL</button>
                      <button className="chk tickbox" aria-pressed={done.has(r.id)} onClick={(e) => onTick(r.id, e)} title="Déjà faite"><Check /></button>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          <button className="cta" onClick={() => compute(false)}>Calculer l'itinéraire</button>
          <button className="cta alt" onClick={async () => setToast((await copySelection(st)) ? "Sélection copiée" : "Copie impossible")}>
            Copier ma sélection
          </button>
          <button className="cta alt" onClick={() => exportSelectionFile(st)}>Exporter la sélection (.json)</button>

          <div className="card" style={{ marginTop: 12 }}>
            <h3>Journal des relevés <em>{journalSize} relevés</em></h3>
            <div className="pad">
              <p className="note" style={{ marginTop: 0 }}>
                Un relevé toutes les 2 minutes tant que l'app est ouverte : attentes, fermetures, ouvertures et fermetures de VirtualLine.
                Le fichier Markdown contient les évènements, une synthèse par attraction et les relevés bruts.
              </p>
              <div className="row">
                <button className="ghost" onClick={downloadMarkdown}>Télécharger le journal (.md)</button>
                <button className="ghost" onClick={() => { clearJournal(); setJournalSize(0); setToast("Journal effacé"); }}>Effacer</button>
              </div>
            </div>
          </div>

          <button className="cta alt" onClick={() => setDay({ sel: [], gc: [], vl: [], done: [], steps: [] })}>
            Réinitialiser le jour {st.day}
          </button>
        </section>

        {/* ---------------- carte ---------------- */}
        <section className={"pane" + (tab === "map" ? " on" : "")}>
          <ParkMap waits={waits} positions={positions} selected={sel} gc={gc} done={done}
            steps={day.steps} onToggle={onSelect} />
          <p className="note" style={{ marginTop: 10 }}>
            {Object.keys(osm).length
              ? `Positions issues d'OpenStreetMap pour ${Object.keys(osm).length} attractions, estimées pour les autres.`
              : "Positions estimées par quartier : OpenStreetMap n'a pas répondu, les temps de marche restent des ordres de grandeur."}
          </p>
        </section>

        {/* ---------------- itinéraire ---------------- */}
        <section className={"pane" + (tab === "plan" ? " on" : "")}>
          <div className="card">
            <h3>Itinéraire <em>jour {st.day}</em></h3>
            <div className="recap">
              <div><b className="mono">{remaining.length}</b><u>restantes</u></div>
              <div><b className="mono">{remaining.reduce((a, s) => a + s.wait, 0)}</b><u>min de file</u></div>
              <div><b className="mono">{remaining.reduce((a, s) => a + s.saved, 0)}</b><u>min gagnées</u></div>
            </div>
          </div>
          <button className="cta" onClick={() => compute(true)} style={{ marginBottom: 12 }}>
            Recalculer à partir de maintenant
          </button>

          {!day.steps.length ? (
            <div className="card"><div className="empty">
              <b>Pas encore d'itinéraire</b>
              Choisissez vos attractions, posez vos jokers, puis lancez le calcul.
            </div></div>
          ) : (
            <AnimatePresence initial={false}>{day.steps.map((s, i) => {
              if (s.kind !== "ride") {
                return (
                  <motion.div layout className={"stop " + (s.kind === "vl" ? "vlstep" : "brk")}
                    key={s.kind + s.name + s.at}
                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }}
                    transition={{ type: "spring", stiffness: 380, damping: 34 }}>
                    <div className="hh"><b className="mono">{hhmm(s.at)}</b><u className="mono">{s.dur} min</u></div>
                    <div className="track"><span className="node" /></div>
                    <div className="body"><div className="stopcard"><div className="txt">
                      <h4>{s.name}</h4><div className="meta"><span>{s.detail}</span></div>
                    </div></div></div>
                  </motion.div>
                );
              }
              const tk = done.has(s.ride.id);
              const current = !tk && s.arrive <= now && now < s.end;
              return (
                <motion.div layout key={"r" + s.ride.id}
                  className={["stop", s.mode === "gc" ? "gc" : "", tk ? "ticked" : "", current ? "now" : ""].filter(Boolean).join(" ")}
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }}
                  transition={{ type: "spring", stiffness: 380, damping: 34 }}>
                  <div className="hh"><b className="mono">{hhmm(s.arrive)}</b><u className="mono">{s.walk} min à pied</u></div>
                  <div className="track"><span className="node" /></div>
                  <div className="body"><div className="stopcard">
                    <div className="txt">
                      <h4>{s.ride.n}
                        {s.mode === "gc" && <span className="badge gc"><Clover />JOKER</span>}
                        {s.mode === "vl" && <span className="badge vl">VIRTUALLINE</span>}
                      </h4>
                      <div className="meta">
                        <span>{s.ride.z}</span>
                        <span className="mono">file {s.wait} min</span>
                        <span className="mono">tour {s.dur} min</span>
                        {s.saved > 4 && <span className="mono" style={{ color: "var(--go)" }}>−{s.saved} min</span>}
                      </div>
                    </div>
                    <button className="tick" aria-pressed={tk} onClick={(e) => onTick(s.ride.id, e)} aria-label="Marquer comme faite"><Check /></button>
                  </div></div>
                </motion.div>
              );
            })}</AnimatePresence>
          )}
        </section>
      </div>

      <footer className="foot">
        <a href="https://queue-times.com/" target="_blank" rel="noopener noreferrer">Powered by Queue-Times.com</a>
        <br />Outil personnel, sans lien avec Europa-Park. Vérifiez toujours l'affichage sur place.
      </footer>

      {toast && <div className="toast">{toast}</div>}
    </>
  );
}
