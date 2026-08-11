import { useMemo, useState } from "react";
import { BY_ID, RIDES, zoneOf, type Ride } from "../data/rides";
import { applyLot, newLot } from "../lib/storage";
import type { DayPlan, Lot } from "../lib/planner";
import { Check, Clover, Star, Lock } from "./icons";

const waitClass = (w: number) => (w < 0 ? "closed" : w < 20 ? "go" : w <= 45 ? "mid" : "stop");
const waitLabel = (w: number) => (w < 0 ? "fermé" : `${w} min`);

type Props = {
  day: DayPlan;
  setDay: (p: Partial<DayPlan>) => void;
  waits: Record<number, number>;
  pace: number;
  setPace: (v: number) => void;
  toast: (s: string) => void;
  sparkle: (x: number, y: number, c: string) => void;
};

export default function Selection({ day, setDay, waits, pace, setPace, toast, sparkle }: Props) {
  const [lotName, setLotName] = useState("");
  const [q, setQ] = useState("");

  const sel = useMemo(() => new Set(day.sel), [day.sel]);
  const gc = useMemo(() => new Set(day.gc), [day.gc]);
  const vl = useMemo(() => new Set(day.vl), [day.vl]);
  const done = useMemo(() => new Set(day.done), [day.done]);
  const spent = day.gc.filter((id) => done.has(id)).length;

  const locked = day.lots.some((l) => l.locked);

  const norm = (v: string) => v.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  const byZone = useMemo(() => {
    const needle = norm(q.trim());
    const z: Record<string, Ride[]> = {};
    RIDES
      .filter((r) => !needle || norm(r.n).includes(needle) || norm(r.z).includes(needle) || norm(r.why).includes(needle))
      .forEach((r) => (z[r.z] = z[r.z] ?? []).push(r));
    return Object.entries(z).sort(([a], [b]) => a.localeCompare(b));
  }, [q]);

  const shown = byZone.reduce((a, [, l]) => a + l.length, 0);

  const toggle = (list: number[], id: number) =>
    list.includes(id) ? list.filter((x) => x !== id) : [...list, id];

  const onSelect = (id: number) => {
    if (locked) return toast("Lot verrouillé : déverrouillez pour modifier la sélection");
    if (sel.has(id)) {
      setDay({
        sel: day.sel.filter((x) => x !== id),
        gc: day.gc.filter((x) => x !== id),
        vl: day.vl.filter((x) => x !== id),
        first: day.first === id ? null : day.first
      });
    } else setDay({ sel: [...day.sel, id] });
  };

  const onGc = (id: number, e: React.MouseEvent) => {
    if (gc.has(id)) return setDay({ gc: day.gc.filter((x) => x !== id) });
    if (day.gc.length >= 6) return toast("Les 6 jokers du jour sont déjà posés");
    sparkle(e.clientX, e.clientY, "#2F8F5B");
    setDay({ gc: [...day.gc, id], vl: day.vl.filter((x) => x !== id) });
  };

  const onVl = (id: number) =>
    vl.has(id)
      ? setDay({ vl: day.vl.filter((x) => x !== id) })
      : setDay({ vl: [...day.vl, id], gc: day.gc.filter((x) => x !== id) });

  const onFirst = (id: number, e: React.MouseEvent) => {
    if (day.first === id) return setDay({ first: null, steps: [] });
    sparkle(e.clientX, e.clientY, "#C99A2E");
    setDay({ first: id, sel: sel.has(id) ? day.sel : [...day.sel, id], steps: [] });
  };

  const onTick = (id: number, e?: React.MouseEvent) => {
    const has = done.has(id);
    if (!has && e) sparkle(e.clientX, e.clientY, gc.has(id) ? "#2F8F5B" : "#2E7CB6");
    setDay({ done: toggle(day.done, id), sel: has || sel.has(id) ? day.sel : [...day.sel, id] });
  };

  const preset = (kind: "mix" | "thrill" | "chill" | "none") => {
    if (locked) return toast("Lot verrouillé : déverrouillez pour changer");
    if (kind === "none") return setDay({ sel: [], gc: [], vl: [], first: null, steps: [] });
    const pick = new Set<number>();
    if (kind === "thrill") RIDES.filter((r) => r.thr >= 4).forEach((r) => pick.add(r.id));
    if (kind === "chill") RIDES.filter((r) => r.nau <= 1 && !r.kid).forEach((r) => pick.add(r.id));
    if (kind === "mix") {
      RIDES.filter((r) => r.thr >= 4).forEach((r) => pick.add(r.id));
      RIDES.filter((r) => r.nau <= 1 && r.thr <= 2 && !r.kid).forEach((r) => pick.add(r.id));
    }
    const list = [...pick];
    // Un joker ne se pose jamais sur une VirtualLine : la file virtuelle est gratuite.
    const jok = list.map((id) => BY_ID[id]).filter((r) => !r.vl && waits[r.id] >= 0)
      .sort((a, b) => waits[b.id] - waits[a.id]).slice(0, 6).map((r) => r.id);
    const virt = list.map((id) => BY_ID[id]).filter((r) => r.vl && !jok.includes(r.id)).map((r) => r.id);
    setDay({ sel: list, gc: kind === "mix" ? jok : [], vl: kind === "mix" ? virt : [], steps: [] });
  };

  const saveLot = () => {
    if (!day.sel.length) return toast("Rien à enregistrer");
    setDay({ lots: [...day.lots, newLot(lotName, day)] });
    setLotName("");
    toast("Lot enregistré et verrouillé");
  };

  const setLots = (lots: Lot[]) => setDay({ lots });

  return (
    <>
      <div className="card">
        <h3>La journée</h3>
        <div className="pad">
          <div className="row">
            <div style={{ flex: 1, minWidth: 130 }}>
              <label className="f" htmlFor="dep">Départ</label>
              <input id="dep" type="time" value={day.start} onChange={(e) => setDay({ start: e.target.value })} />
            </div>
            <div style={{ flex: 1, minWidth: 130 }}>
              <label className="f" htmlFor="fin">Fin</label>
              <input id="fin" type="time" value={day.end} onChange={(e) => setDay({ end: e.target.value })} />
            </div>
          </div>
          <div className="row">
            <div style={{ flex: 1, minWidth: 130 }}>
              <label className="f" htmlFor="dej">Déjeuner</label>
              <input id="dej" type="time" value={day.lunch} onChange={(e) => setDay({ lunch: e.target.value })} />
            </div>
            <div style={{ flex: 1, minWidth: 130 }}>
              <label className="f" htmlFor="dur">Durée (min)</label>
              <input id="dur" type="number" min={0} max={180} step={5} value={day.lunchDur}
                onChange={(e) => setDay({ lunchDur: Number(e.target.value) })} />
            </div>
          </div>

          <div className="row" style={{ display: "block" }}>
            <label className="f">Tolérance au brassage</label>
            <div className="seg">
              {[{ v: 45, l: "Estomac fragile" }, { v: 65, l: "Équilibré" }, { v: 88, l: "On encaisse" }].map((o) => (
                <button key={o.v} aria-pressed={day.tol === o.v} onClick={() => setDay({ tol: o.v, steps: [] })}>{o.l}</button>
              ))}
            </div>
            <p className="note" style={{ margin: "9px 0 0" }}>
              Le plan intercale du calme dès que le compteur approche la limite. C'est le garde-fou anti-nausée.
            </p>
          </div>

          <div className="row" style={{ display: "block" }}>
            <label className="f">Attractions aquatiques</label>
            <div className="seg">
              {([["am", "Le matin"], ["pm", "L'après-midi"], ["any", "Peu importe"]] as const).map(([v, l]) => (
                <button key={v} aria-pressed={day.shape.wet === v}
                  onClick={() => setDay({ shape: { ...day.shape, wet: v }, steps: [] })}>{l}</button>
              ))}
            </div>
            <p className="note" style={{ margin: "9px 0 0" }}>
              Six attractions mouillent. L'après-midi laisse le temps de sécher avant la fermeture.
            </p>
          </div>

          <div className="row" style={{ display: "block" }}>
            <label className="f">Grosses sensations</label>
            <div className="seg">
              {([["front", "Tôt"], ["even", "Réparties"], ["back", "Tard"]] as const).map(([v, l]) => (
                <button key={v} aria-pressed={day.shape.vif === v}
                  onClick={() => setDay({ shape: { ...day.shape, vif: v }, steps: [] })}>{l}</button>
              ))}
            </div>
            <p className="note" style={{ margin: "9px 0 0" }}>
              Tôt, c'est moins de file et l'estomac frais. Tard, c'est finir en apothéose.
            </p>
          </div>

          <div className="row" style={{ display: "block", marginBottom: 0 }}>
            <label className="f">Rythme de marche <span className="mono">{pace.toString().replace(".", ",")} km/h</span></label>
            <input type="range" min={3} max={6} step={0.25} value={pace} onChange={(e) => setPace(Number(e.target.value))} />
          </div>
        </div>
      </div>

      <div className="card">
        <h3><Clover />Green Card du jour <em>{day.gc.length} / 6 posés</em></h3>
        <div className="jokers">
          {Array.from({ length: 6 }, (_, i) => {
            const id = day.gc[i];
            return (
              <span key={i} className={"tok " + (id ? (done.has(id) ? "spent" : "armed") : "")}
                title={id ? BY_ID[id].n : "joker libre"}><Clover /></span>
            );
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
        <div className="pad" style={{ borderTop: "2px solid var(--line)" }}>
          <p className="tell">
            <b>En arrivant :</b> Information sous la Tour (quartier France), avec la carte d'invalidité et une pièce
            d'identité. Le personnel <b>écrit les 6 attractions sur la carte</b>, donc arrivez avec cette liste décidée.
            Une nouvelle carte est délivrée chaque jour du séjour.
          </p>
        </div>
      </div>

      <div className="card">
        <h3><Lock />Lots d'attractions <em>{day.lots.length}</em></h3>
        <div className="pad" style={{ borderBottom: day.lots.length ? "2px solid var(--line)" : undefined }}>
          <p className="note" style={{ marginTop: 0, marginBottom: 12 }}>
            Un lot fige une sélection pour comparer plusieurs parcours. Tant qu'un lot est verrouillé,
            la sélection ne bouge plus : seules les attractions faites se cochent.
          </p>
          <div className="row" style={{ marginBottom: 0 }}>
            <input type="text" placeholder="Nom du lot (ex. Jour 1 sensations)" value={lotName}
              onChange={(e) => setLotName(e.target.value)} style={{ flex: 1, minWidth: 180 }} />
            <button className="ghost" onClick={saveLot}>Enregistrer</button>
          </div>
        </div>
        {day.lots.map((l) => (
          <div className="lot" key={l.id}>
            <div>
              <b>{l.name}</b>
              <small>{l.ids.length} attractions · {l.gc.length} jokers · {l.vl.length} VirtualLine</small>
            </div>
            <div className="sp">
              <button className="ghost" onClick={() => { setDay(applyLot(l, day)); toast(`Lot « ${l.name} » appliqué`); }}>
                Appliquer
              </button>
              <button className="lk" aria-pressed={l.locked} title={l.locked ? "Déverrouiller" : "Verrouiller"}
                onClick={() => setLots(day.lots.map((x) => (x.id === l.id ? { ...x, locked: !x.locked } : x)))}>
                <Lock />
              </button>
              <button className="lk" title="Supprimer"
                onClick={() => setLots(day.lots.filter((x) => x.id !== l.id))}>✕</button>
            </div>
          </div>
        ))}
      </div>

      <div className="card">
        <h3>Attractions <em>{day.sel.length} / {RIDES.length} sélectionnées</em></h3>
        <div className="pad" style={{ borderBottom: "2px solid var(--line)" }}>
          <div className="search">
            <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
            <input type="text" value={q} onChange={(e) => setQ(e.target.value)}
              placeholder={`Chercher parmi les ${RIDES.length} attractions…`} aria-label="Chercher une attraction" />
          </div>
          <div className="row">
            <button className="ghost" onClick={() => preset("mix")}>Mix sensations + calme</button>
            <button className="ghost" onClick={() => preset("thrill")}>Grosses sensations</button>
            <button className="ghost" onClick={() => preset("chill")}>Tout doux</button>
            <button className="ghost" onClick={() => preset("none")}>Tout décocher</button>
          </div>
          <p className="note" style={{ margin: "10px 0 0" }}>
            Le <b style={{ color: "var(--clover)" }}>trèfle</b> pose un joker,
            <b style={{ color: "var(--vline)" }}> VL</b> réserve une file virtuelle,
            l'<b style={{ color: "var(--gold) " }}>étoile</b> impose l'attraction d'ouverture,
            la case de droite marque l'attraction comme faite.
          </p>
        </div>

        {byZone.map(([zone, list]) => (
          <div className="zone" key={zone} style={{ ["--zh" as string]: zoneOf(zone).hue }}>
            <b>{zoneOf(zone).flag} {zone} <span style={{ marginLeft: "auto", opacity: .7 }}>{list.length}</span></b>
            {list.map((r) => {
              const w = waits[r.id];
              return (
                <div key={r.id} className={"ride" + (sel.has(r.id) ? " sel" : "") + (done.has(r.id) ? " ticked" : "")}>
                  <button className="chk" aria-pressed={sel.has(r.id)} onClick={() => onSelect(r.id)}
                    aria-label={`Choisir ${r.n}`}><Check /></button>
                  <div className="name">
                    <b>{r.n}</b>
                    <small>{r.dur} min · brassage {r.nau}/5 {r.wet ? "· on ressort mouillé" : ""}</small>
                  </div>
                  <span className={"wt mono " + waitClass(w)}>{waitLabel(w)}</span>
                  <p className="why">{r.why} <em>{r.plus}</em></p>
                  <div className="acts">
                    <div className="intens" title={`Intensité ${r.thr}/5`}>
                      {[1, 2, 3, 4, 5].map((i) => <i key={i} className={i <= r.thr ? "on" : ""} />)}
                    </div>
                    <button className="pill gc" aria-pressed={gc.has(r.id)} title="Joker Green Card"
                      disabled={!sel.has(r.id) || (day.gc.length >= 6 && !gc.has(r.id))}
                      onClick={(e) => onGc(r.id, e)}><Clover /></button>
                    <button className="pill vl" aria-pressed={vl.has(r.id)} title="VirtualLine"
                      disabled={!sel.has(r.id) || !r.vl} onClick={() => onVl(r.id)}>VL</button>
                    <button className="pill first" aria-pressed={day.first === r.id} title="Attraction d'ouverture"
                      onClick={(e) => onFirst(r.id, e)}><Star /></button>
                    <button className="chk" style={{ marginLeft: "auto" }} aria-pressed={done.has(r.id)}
                      title="Déjà faite" onClick={(e) => onTick(r.id, e)}><Check /></button>
                  </div>
                </div>
              );
            })}
          </div>
        ))}
        {!shown && <p className="hint">Aucune attraction ne correspond à « {q} ».</p>}
      </div>
    </>
  );
}
