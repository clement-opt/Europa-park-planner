import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BY_ID, RIDES, type Ride } from "./data/rides";
import { fetchWaits, type Snapshot } from "./lib/api";
import { buildWalkMatrix, fetchFootGraph, fetchOsmPositions, withMe, type Graph, type LatLng, type WalkMatrix } from "./lib/geo";
import { buildPlan, clockMin, hhmm, type DayPlan } from "./lib/planner";
import { downloadMarkdown, loadJournal, record, clearJournal } from "./lib/journal";
import { copySelection, exportSelectionFile, load, merge, save, shareable, type AppState } from "./lib/storage";
import { deviceName, fetchFootWays, pullState, pushState, stampState, type SyncState } from "./lib/sync";
import Selection from "./components/Selection";
import Parcours from "./components/Parcours";
import Section from "./components/Section";
import { geoLabel, usePosition } from "./lib/position";

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

export default function App() {
  const [st, setSt] = useState<AppState>(() => load());
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [osm, setOsm] = useState<Record<number, LatLng>>({});
  const [walk, setWalk] = useState<WalkMatrix>({ m: {}, ok: false });
  const [graph, setGraph] = useState<Graph | null>(null);
  const geo = usePosition();
  const [tab, setTab] = useState<"sel" | "go">("sel");
  const [busy, setBusy] = useState(false);
  const [toastMsg, setToast] = useState("");
  const [now, setNow] = useState(clockMin());
  const [journalSize, setJournalSize] = useState(() => loadJournal().samples.length);
  const [sync, setSync] = useState<SyncState>("idle");
  const [planning, setPlanning] = useState(false);

  const relayRef = useRef(st.relay);
  const stampRef = useRef<string | null>(null);
  const pushTimer = useRef<number | null>(null);
  const me = useRef(deviceName());

  const day = st.days[st.day];
  const toast = useCallback((s: string) => setToast(s), []);
  const setDay = useCallback((patch: Partial<DayPlan>) =>
    setSt((s) => ({ ...s, days: { ...s.days, [s.day]: { ...s.days[s.day], ...patch } } })), []);

  useEffect(() => { save(st); relayRef.current = st.relay; }, [st]);
  useEffect(() => { document.documentElement.setAttribute("data-theme", st.theme); }, [st.theme]);
  useEffect(() => { const t = setInterval(() => setNow(clockMin()), 20000); return () => clearInterval(t); }, []);
  useEffect(() => { if (!toastMsg) return; const t = setTimeout(() => setToast(""), 2600); return () => clearTimeout(t); }, [toastMsg]);

  /* ---- temps d'attente ---- */
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

  /* ---- positions et allées ---- */
  useEffect(() => {
    const cached = localStorage.getItem("ep.osm.v1");
    if (cached) { try { setOsm(JSON.parse(cached)); } catch { /* refetch */ } }
    else {
      fetchOsmPositions().then((p) => {
        if (Object.keys(p).length) {
          setOsm(p);
          try { localStorage.setItem("ep.osm.v1", JSON.stringify(p)); } catch { /* quota */ }
        }
      });
    }
  }, []);

  const positions = useCallback((r: Ride): LatLng => osm[r.id] ?? { lat: r.lat, lng: r.lng }, [osm]);

  useEffect(() => {
    let alive = true;
    // Le graphe des allées coûte un appel Overpass ; le repli à vol d'oiseau
    // est posé immédiatement pour que l'app soit utilisable sans attendre.
    setWalk(buildWalkMatrix(null, positions));
    fetchFootGraph(fetchFootWays).then((g) => {
      if (!alive || !g) return;
      setGraph(g);
      setWalk(buildWalkMatrix(g, positions));
    });
    return () => { alive = false; };
  }, [positions]);

  /**
   * La position rejoint la matrice de marche. On ne recalcule pas à chaque
   * frémissement du GPS : en dessous de 25 m de déplacement, les temps de marche
   * ne bougent pas d'une minute, et un Dijkstra de plus ne sert à rien.
   */
  const dernierFix = useRef<LatLng | null>(null);
  useEffect(() => {
    if (!geo.usable || !geo.fix) return;
    const p = geo.fix.p;
    const d = dernierFix.current;
    if (d && Math.abs(d.lat - p.lat) < 2.3e-4 && Math.abs(d.lng - p.lng) < 3.4e-4) return;
    dernierFix.current = p;
    setWalk((w) => withMe(w, graph, p, positions));
  }, [geo.usable, geo.fix, graph, positions]);

  /* ---- sauvegarde partagée ---- */
  useEffect(() => {
    if (!st.shared) { setSync("off"); return; }
    let alive = true;
    (async () => {
      try {
        setSync("pull");
        const remote = await pullState(st.code);
        stampRef.current = await stampState(st.code);
        if (alive && remote && Object.keys(remote).length) {
          setSt((s) => merge({ ...s, ...remote }));
          setToast("Sélection du groupe chargée");
        }
        if (alive) setSync("idle");
      } catch {
        if (alive) setSync("error");
      }
    })();
    return () => { alive = false; };
  }, [st.shared, st.code]);

  // Poussée différée : on ne publie qu'une fois les clics retombés.
  useEffect(() => {
    if (!st.shared) return;
    if (pushTimer.current) clearTimeout(pushTimer.current);
    pushTimer.current = window.setTimeout(async () => {
      try {
        setSync("push");
        stampRef.current = await pushState(st.code, shareable(st), me.current);
        setSync("idle");
      } catch {
        setSync("error");
      }
    }, 1500);
    return () => { if (pushTimer.current) clearTimeout(pushTimer.current); };
  }, [st]);

  // Sonde : on ne retélécharge que si quelqu'un d'autre a écrit.
  useEffect(() => {
    if (!st.shared) return;
    const t = setInterval(async () => {
      try {
        const s = await stampState(st.code);
        if (s && s !== stampRef.current) {
          const remote = await pullState(st.code);
          stampRef.current = s;
          if (remote) { setSt((x) => merge({ ...x, ...remote })); setToast("Mise à jour du groupe reçue"); }
        }
      } catch { /* réseau capricieux dans le parc */ }
    }, 15000);
    return () => clearInterval(t);
  }, [st.shared, st.code]);

  /* ---- dérivés ---- */
  const waits = useMemo(() => {
    const out: Record<number, number> = {};
    for (const r of RIDES) {
      const s = snap?.rides[r.id];
      out[r.id] = s ? (s.open ? s.wait : -1) : -1;
    }
    return out;
  }, [snap]);

  /**
   * Le calcul prend quelques millisecondes : sans marquage visible, on ne sait pas
   * si l'app a travaillé. On affiche l'état le temps d'une respiration.
   */
  const compute = useCallback((fromNow: boolean) => {
    if (!snap) return setToast("Temps d'attente pas encore chargés");
    if (!day.sel.length) return setToast("Sélectionnez d'abord vos attractions");
    setPlanning(true);
    setTab("go");
    window.setTimeout(() => {
      const steps = buildPlan({ day, snap, pace: st.pace, positions, walk, fromNow, rides: RIDES, me: geo.usable ? geo.fix!.p : null });
      setDay({ steps });
      setPlanning(false);
      const n = steps.filter((x) => x.kind === "ride").length;
      setToast(`Parcours calculé · ${n} attraction${n > 1 ? "s" : ""}`);
    }, 420);
  }, [snap, day, st.pace, positions, walk, setDay, geo.usable, geo.fix]);

  /** Recalcul silencieux, après un ajout ou un retrait en cours de route. */
  const replan = useCallback((patch: Partial<DayPlan>) => {
    const next = { ...day, ...patch };
    if (!snap || !day.steps.length) return setDay(patch);
    setDay({ ...patch, steps: buildPlan({ day: next, snap, pace: st.pace, positions, walk, fromNow: true, rides: RIDES, me: geo.usable ? geo.fix!.p : null }) });
  }, [day, snap, st.pace, positions, walk, setDay, geo.usable, geo.fix]);

  const onRemove = useCallback((id: number) => {
    replan({
      sel: day.sel.filter((x) => x !== id),
      gc: day.gc.filter((x) => x !== id),
      vl: day.vl.filter((x) => x !== id),
      first: day.first === id ? null : day.first
    });
    setToast("Retirée du parcours");
  }, [day, replan]);

  const onAdd = useCallback((id: number) => {
    replan({ sel: [...day.sel, id] });
    setToast(`${BY_ID[id].n} ajoutée`);
  }, [day, replan]);

  /**
   * Ré-optimisation dynamique : dès qu'une attraction est cochée, le reste du
   * parcours est recalculé à partir de l'heure et du lieu réels. Si la 3 est
   * devenue meilleure que la 2, elle passe devant sans qu'on ait à le demander.
   */
  const doneKey = day.done.join(",");
  const lastDone = useRef(doneKey);
  useEffect(() => {
    if (doneKey === lastDone.current) return;
    lastDone.current = doneKey;
    if (!snap || !day.steps.length) return;
    setDay({ steps: buildPlan({ day, snap, pace: st.pace, positions, walk, fromNow: true, rides: RIDES, me: geo.usable ? geo.fix!.p : null }) });
  }, [doneKey, snap, day, st.pace, positions, walk, setDay, geo.usable, geo.fix]);

  const onTick = useCallback((id: number, e?: React.MouseEvent) => {
    const has = day.done.includes(id);
    if (!has && e) sparkle(e.clientX, e.clientY, day.gc.includes(id) ? "#2F8F5B" : "#2E7CB6");
    setDay({
      done: has ? day.done.filter((x) => x !== id) : [...day.done, id],
      sel: day.sel.includes(id) ? day.sel : [...day.sel, id]
    });
  }, [day, setDay]);

  const onSelect = useCallback((id: number) => {
    setDay(day.sel.includes(id)
      ? { sel: day.sel.filter((x) => x !== id), gc: day.gc.filter((x) => x !== id), vl: day.vl.filter((x) => x !== id) }
      : { sel: [...day.sel, id] });
  }, [day, setDay]);

  const openWaits = RIDES.map((r) => waits[r.id]).filter((w) => w > 0);
  const avg = openWaits.length ? Math.round(openWaits.reduce((a, b) => a + b, 0) / openWaits.length) : null;
  const liveAge = snap ? Math.round((Date.now() - snap.at) / 60000) : 0;
  const spent = day.gc.filter((id) => day.done.includes(id)).length;
  const restantes = day.steps.filter((s) => s.kind === "ride" && !day.done.includes(s.ride.id)).length;

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
        <button className="icobtn" aria-label={st.theme === "dark" ? "Passer en clair" : "Passer en sombre"}
          onClick={() => setSt((s) => ({ ...s, theme: s.theme === "dark" ? "light" : "dark" }))}>
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
        <div className="cell"><u>Étapes restantes</u><b className="mono">{restantes}</b></div>
        <div className="cell"><u>Attente moyenne</u><b className="mono">{avg !== null ? `${avg} min` : "—"}</b></div>
        <div className="cell"><u>Marche</u><b className="mono">{walk.ok ? "allées" : "estimée"}</b></div>
        <div className="cell"><u>Position</u><b className="mono">
          <span className={"dot " + (geo.usable ? "live" : geo.state === "off" ? "off" : "stale")} />
          {geoLabel(geo.state)}{geo.usable && geo.fix ? ` · ±${Math.round(geo.fix.acc)} m` : ""}
        </b></div>
        <div className="cell"><u>Groupe</u><b className="mono">
          {sync === "error" ? "hors ligne" : sync === "off" ? "local" : sync === "push" ? "envoi…" : sync === "pull" ? "lecture…" : "synchro"}
        </b></div>
        <div className="cell"><u>Relevés</u><b className="mono">{journalSize}</b></div>
      </div>

      {tab === "sel" && day.sel.length > 0 && (
        <div className="dock">
          <button className="cta" onClick={() => compute(false)} disabled={planning}>
            {planning ? "Optimisation en cours…"
              : day.steps.length ? `Recalculer · ${day.sel.length} attractions`
              : `Calculer l'itinéraire · ${day.sel.length} attractions`}
          </button>
        </div>
      )}

      <nav className="tabs" role="tablist">
        <button role="tab" aria-selected={tab === "sel"} onClick={() => setTab("sel")}>
          Attractions<span className="cnt">{day.sel.length}</span>
        </button>
        <button role="tab" aria-selected={tab === "go"} onClick={() => setTab("go")}>
          Parcours<span className="cnt">{restantes}</span>
        </button>
      </nav>

      <div className="wrap">
        <section className={"pane" + (tab === "sel" ? " on" : "")}>
          {snap?.source === "snapshot" && (
            <div className="warn">
              <b>Temps d'attente figés.</b> Ni le serveur ni les relais publics n'ont répondu : les valeurs
              affichées sont celles du relevé de secours. Vérifiez la connexion, puis appuyez sur
              le bouton d'actualisation en haut à droite.
              <details style={{ marginTop: 10 }}>
                <summary className="mini">Relais personnel (optionnel)</summary>
                <p className="note" style={{ margin: "8px 0" }}>
                  Utile seulement si le serveur reste injoignable. Déployez <code>worker/queue-proxy.js</code>
                  sur Cloudflare et collez l'URL du Worker suivie de <code>/?url=</code>.
                </p>
                <input id="relay" type="text" placeholder="https://mon-worker.workers.dev/?url=" defaultValue={st.relay}
                  onBlur={(e) => { setSt((s) => ({ ...s, relay: e.target.value.trim() })); ping(true); }} />
              </details>
            </div>
          )}

          <div className="row" style={{ marginBottom: 16 }}>
            {([1, 2] as const).map((d) => (
              <button key={d} className="ghost" style={{ flex: 1 }} aria-pressed={st.day === d}
                onClick={() => setSt((s) => ({ ...s, day: d }))}>
                Jour {d} · {st.days[d].sel.length} choisies
              </button>
            ))}
          </div>

          <Selection day={day} setDay={setDay} waits={waits} pace={st.pace}
            setPace={(v) => setSt((s) => ({ ...s, pace: v }))} toast={toast} sparkle={sparkle} />

          <Section title="Partage, export et journal" badge={st.shared ? "synchro" : "local"}>
            <p className="note" style={{ marginTop: 0 }}>
              Code de séjour <b className="mono">{st.code}</b>. Tous les téléphones qui portent ce code
              partagent la même sélection et le même avancement.
            </p>
            <div className="row" style={{ marginTop: 12 }}>
              <button className="ghost" aria-pressed={st.shared}
                onClick={() => setSt((s) => ({ ...s, shared: !s.shared }))}>
                {st.shared ? "Synchronisation active" : "Synchronisation coupée"}
              </button>
              <button className="ghost" onClick={async () => setToast((await copySelection(st)) ? "Sélection copiée" : "Copie impossible")}>
                Copier la sélection
              </button>
              <button className="ghost" onClick={() => exportSelectionFile(st)}>Exporter (.json)</button>
              <button className="ghost" onClick={downloadMarkdown}>Journal (.md)</button>
              <button className="ghost" onClick={() => { clearJournal(); setJournalSize(0); setToast("Journal effacé"); }}>
                Effacer le journal
              </button>
              <button className="ghost" onClick={() => setDay({ sel: [], gc: [], vl: [], done: [], first: null, steps: [] })}>
                Réinitialiser le jour {st.day}
              </button>
            </div>
          </Section>
        </section>

        <section className={"pane" + (tab === "go" ? " on" : "")}>
          <Parcours day={day} now={now} positions={positions} waits={waits} onTick={onTick}
            onSelect={onSelect} compute={compute} graphOk={walk.ok} osmCount={Object.keys(osm).length}
            active={tab === "go"} planning={planning} onRemove={onRemove} onAdd={onAdd}
            me={geo.usable && geo.fix ? geo.fix.p : null} geoState={geo.state}
            onGeo={geo.toggle} walk={walk} pace={st.pace} />
        </section>
      </div>

      <footer className="foot">
        <a href="https://queue-times.com/" target="_blank" rel="noopener noreferrer">Powered by Queue-Times.com</a>
        <br />Outil personnel, sans lien avec Europa-Park. Vérifiez toujours l'affichage sur place.
      </footer>

      {toastMsg && <div className="toast">{toastMsg}</div>}
    </>
  );
}
