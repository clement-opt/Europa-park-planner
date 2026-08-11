import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { RIDES, zoneOf, type Ride } from "../data/rides";
import { hhmm, type DayPlan, type Step } from "../lib/planner";
import type { LatLng } from "../lib/geo";
import ParkMap from "./ParkMap";
import { Check, Clover, Star } from "./icons";

type RideStep = Extract<Step, { kind: "ride" }>;

type Props = {
  day: DayPlan;
  now: number;
  positions: (r: Ride) => LatLng;
  waits: Record<number, number>;
  onTick: (id: number, e?: React.MouseEvent) => void;
  onSelect: (id: number) => void;
  compute: (fromNow: boolean) => void;
  graphOk: boolean;
  osmCount: number;
  active: boolean;
  planning: boolean;
  onRemove: (id: number) => void;
  onAdd: (id: number) => void;
};

export default function Parcours({ day, now, positions, waits, onTick, onSelect, compute, graphOk, osmCount, active, planning, onRemove, onAdd }: Props) {
  const [adding, setAdding] = useState(false);
  const done = new Set(day.done);

  // L'itinéraire ne montre que ce qui reste : une étape faite disparaît et
  // la numérotation se resserre. C'est la vue « où on va maintenant ».
  const live = day.steps.filter((s) => s.kind !== "ride" || !done.has(s.ride.id));
  const rides = live.filter((s): s is RideStep => s.kind === "ride");
  const next = rides[0] ?? null;
  const order = new Map(rides.map((s, i) => [s.ride.id, i + 1]));

  const minFile = rides.reduce((a, s) => a + s.wait, 0);
  const gagnees = rides.reduce((a, s) => a + s.saved, 0);

  return (
    <>
      <ParkMap waits={waits} positions={positions} selected={new Set(day.sel)} gc={new Set(day.gc)}
        done={done} steps={day.steps} onToggle={onSelect} active={active} />

      <p className="note" style={{ margin: "10px 0 16px" }}>
        {graphOk
          ? "Temps de marche calculés sur les allées réelles du parc."
          : "Allées non chargées : les temps de marche sont estimés à vol d'oiseau."}
        {osmCount ? ` Positions OpenStreetMap pour ${osmCount} attractions.` : " Positions estimées par quartier."}
      </p>

      {next && (
        <div className="nextup" style={{ ["--zh" as string]: zoneOf(next.ride.z).hue }}>
          <u>Prochaine étape · {hhmm(next.arrive)}</u>
          <h4>{next.ride.n}</h4>
          <p>
            {zoneOf(next.ride.z).flag} {next.ride.z} · {next.walk} min à pied ·
            file {next.wait} min{next.mode === "gc" ? " avec le joker" : next.mode === "vl" ? " en VirtualLine" : ""}
          </p>
          <p style={{ marginTop: 8 }}>{next.ride.plus}</p>
        </div>
      )}

      <div className="card">
        <h3>Itinéraire <em>{rides.length} restantes</em></h3>
        <div className="recap">
          <div><b className="mono">{rides.length}</b><u>restantes</u></div>
          <div><b className="mono">{minFile}</b><u>min de file</u></div>
          <div><b className="mono">{gagnees}</b><u>min gagnées</u></div>
        </div>
      </div>

      <button className="cta" onClick={() => compute(true)} disabled={planning}>
        {planning ? "Optimisation en cours…" : "Recalculer à partir de maintenant"}
      </button>

      <div className="row" style={{ marginBottom: 16 }}>
        <button className="ghost" style={{ flex: 1 }} aria-pressed={adding} onClick={() => setAdding((v) => !v)}>
          {adding ? "Fermer" : "Ajouter une attraction au parcours"}
        </button>
      </div>

      {adding && (
        <div className="card">
          <h3>Ajouter en cours de route <em>{RIDES.filter((r) => !day.sel.includes(r.id)).length} disponibles</em></h3>
          <div className="pad">
            <p className="note" style={{ marginTop: 0, marginBottom: 12 }}>
              L'attraction est insérée puis le parcours est recalculé à partir de maintenant.
            </p>
            <div className="row" style={{ marginBottom: 0 }}>
              {RIDES.filter((r) => !day.sel.includes(r.id)).map((r) => (
                <button key={r.id} className="ghost" onClick={() => { onAdd(r.id); setAdding(false); }}>
                  {zoneOf(r.z).flag} {r.n}
                  <span className="mono" style={{ color: "var(--ink-3)", marginLeft: 6 }}>
                    {waits[r.id] < 0 ? "fermé" : waits[r.id] + " min"}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {!live.length ? (
        <div className="card"><div className="empty">
          <b>Pas encore d'itinéraire</b>
          Choisissez vos attractions, posez vos jokers, puis lancez le calcul depuis l'onglet Attractions.
        </div></div>
      ) : (
        <AnimatePresence initial={false}>{live.map((s) => {
          if (s.kind !== "ride") {
            return (
              <motion.div layout className="stop" key={s.kind + s.name + s.at}
                style={{ ["--zh" as string]: 40 }}
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }}
                transition={{ type: "spring", stiffness: 380, damping: 34 }}>
                <div className="hh"><b className="mono">{hhmm(s.at)}</b><u>{s.dur} min</u></div>
                <div className="track"><span className="node" /></div>
                <div className="body"><div className="stopcard"><div className="txt">
                  <h4>{s.name}</h4>
                  <p className="why">{s.detail}</p>
                </div></div></div>
              </motion.div>
            );
          }
          const current = s.arrive <= now && now < s.end;
          const num = order.get(s.ride.id);
          return (
            <motion.div layout key={"r" + s.ride.id}
              className={["stop", s.mode === "gc" ? "gc" : "", current ? "now" : ""].filter(Boolean).join(" ")}
              style={{ ["--zh" as string]: zoneOf(s.ride.z).hue }}
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0, marginBottom: 0 }}
              transition={{ type: "spring", stiffness: 380, damping: 34 }}>
              <div className="hh">
                <b className="mono">{hhmm(s.arrive)}</b>
                <u>{s.walk} min à pied</u>
              </div>
              <div className="track"><span className="node" /></div>
              <div className="body"><div className="stopcard">
                <div className="txt">
                  <h4>
                    <span className="mono" style={{ color: "var(--ink-3)" }}>{num}.</span> {s.ride.n}
                    {s.mode === "gc" && <span className="badge gc"><Clover />JOKER</span>}
                    {s.mode === "vl" && <span className="badge vl">VIRTUALLINE</span>}
                    {day.first === s.ride.id && <span className="badge first"><Star />OUVERTURE</span>}
                  </h4>
                  <p className="why">{s.ride.plus}</p>
                  <div className="meta">
                    <span>{zoneOf(s.ride.z).flag} {s.ride.z}</span>
                    <span className="mono">file {s.wait} min</span>
                    <span className="mono">tour {s.dur} min</span>
                    {s.saved > 4 && <span className="mono" style={{ color: "var(--go)" }}>−{s.saved} min</span>}
                  </div>
                </div>
                <div className="stopacts">
                  <button className="tick" aria-pressed={false} onClick={(e) => onTick(s.ride.id, e)}
                    aria-label={`Marquer ${s.ride.n} comme faite`}><Check /></button>
                  <button className="drop" onClick={() => onRemove(s.ride.id)}
                    aria-label={`Retirer ${s.ride.n} du parcours`} title="Retirer du parcours">✕</button>
                </div>
              </div></div>
            </motion.div>
          );
        })}</AnimatePresence>
      )}
    </>
  );
}
