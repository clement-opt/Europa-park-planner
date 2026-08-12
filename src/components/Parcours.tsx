import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { BY_ID, RIDES, tagsOf, zoneOf, type Ride } from "../data/rides";
import { hhmm, toMin, type DayPlan, type Step } from "../lib/planner";
import { ME_KEY, walkFromMatrix, type LatLng, type WalkMatrix } from "../lib/geo";
import { geoLabel, type GeoState } from "../lib/position";
import ParkMap from "./ParkMap";
import { Check, Chevron, Pass, Star } from "./icons";

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
  me: LatLng | null;
  geoState: GeoState;
  onGeo: () => void;
  walk: WalkMatrix;
  pace: number;
  legs: LatLng[][];
  journeeFinie: boolean;
  previsionnel: boolean;
  onReliquat: (ids: number[]) => void;
  onProlonger: (heures: number) => void;
};

export default function Parcours({ day, now, positions, waits, onTick, onSelect, compute, graphOk, osmCount, active, planning, onRemove, onAdd, me, geoState, onGeo, walk, pace, legs, journeeFinie, previsionnel, onReliquat, onProlonger }: Props) {
  const [adding, setAdding] = useState(false);
  /**
   * Quel geste a fait sortir l'étape. `AnimatePresence` fige les propriétés de
   * l'élément au moment où il quitte la liste : on ne peut pas décider de l'animation
   * depuis l'étape elle-même, puisqu'elle n'est plus rendue. On retient donc le geste.
   */
  const [geste, setGeste] = useState<"fait" | "retire">("fait");
  const [fiche, setFiche] = useState<number | null>(null);
  const done = new Set(day.done);

  // L'itinéraire ne montre que ce qui reste : une étape faite disparaît et
  // la numérotation se resserre. C'est la vue « où on va maintenant ».
  const live = day.steps.filter((s) => s.kind !== "ride" || !done.has(s.ride.id));
  const rides = live.filter((s): s is RideStep => s.kind === "ride");
  const next = rides[0] ?? null;
  const order = new Map(rides.map((s, i) => [s.ride.id, i + 1]));

  /**
   * Autour de vous : les attractions les plus proches à pied, avec leur attente.
   * C'est la réponse à « on voit un truc en passant, ça vaut le coup ? ».
   */
  const autour = me && walk.m[ME_KEY]
    ? RIDES
        .filter((r) => !done.has(r.id) && waits[r.id] >= 0)
        .map((r) => ({ r, min: walkFromMatrix(walk, ME_KEY, r.id, pace) }))
        .sort((a, b) => a.min - b.min)
        .slice(0, 6)
    : [];

  /**
   * Horaires qui viennent de changer. Un recalcul refait tout le parcours, mais à
   * l'écran seule la ligne retirée bougeait visiblement : les nouvelles heures
   * d'arrivée s'écrivaient sans que rien ne les distingue des anciennes.
   */
  const heuresPrec = useRef(new Map<number, number>());
  const [rehausse, setRehausse] = useState<Set<number>>(new Set());
  useEffect(() => {
    const change = new Set<number>();
    const suivant = new Map<number, number>();
    for (const s of day.steps) {
      if (s.kind !== "ride") continue;
      suivant.set(s.ride.id, s.arrive);
      const avant = heuresPrec.current.get(s.ride.id);
      if (avant !== undefined && avant !== s.arrive) change.add(s.ride.id);
    }
    heuresPrec.current = suivant;
    if (!change.size) return;
    setRehausse(change);
    const t = window.setTimeout(() => setRehausse(new Set()), 1500);
    return () => window.clearTimeout(t);
  }, [day.steps]);

  const minFile = rides.reduce((a, s) => a + s.wait, 0);
  const gagnees = rides.reduce((a, s) => a + s.saved, 0);

  return (
    <>
      <ParkMap waits={waits} positions={positions} selected={new Set(day.sel)} gc={new Set(day.gc)}
        done={done} steps={day.steps} onPick={setFiche} active={active} me={me} legs={legs} real={graphOk} />

      {fiche !== null && BY_ID[fiche] && (() => {
        const r = BY_ID[fiche];
        const dedans = day.sel.includes(r.id);
        const w = waits[r.id];
        return (
          <div className="sheet" role="dialog" aria-modal="true" aria-label={r.n}
            onClick={(e) => { if (e.target === e.currentTarget) setFiche(null); }}>
            <div className="sheetcard" style={{ ["--zh" as string]: zoneOf(r.z).hue }}>
              <div className="sheethead">
                <div>
                  <h4>{r.n}</h4>
                  <small>{zoneOf(r.z).flag} {r.z} · {r.dur} min · brassage {r.nau}/5</small>
                </div>
                <span className={"wt mono " + (w < 0 ? "w-closed" : w < 20 ? "w-go" : w <= 45 ? "w-mid" : "w-stop")}>
                  {w < 0 ? "fermé" : `${w} min`}
                </span>
              </div>
              <div className="tags">
                {tagsOf(r).map((t) => <span key={t.l} className={"tag " + t.ton}>{t.l}</span>)}
              </div>
              <p className="why">{r.why}</p>
              <p className="plus">{r.plus}</p>
              {me && walk.m[ME_KEY] && (
                <p className="note" style={{ marginTop: 8 }}>
                  À <b>{walkFromMatrix(walk, ME_KEY, r.id, pace)} min</b> à pied d'où vous êtes.
                </p>
              )}
              <div className="row" style={{ marginTop: 14, marginBottom: 0 }}>
                <button className="ghost" style={{ flex: 1 }}
                  onClick={() => { setGeste("retire"); dedans ? onRemove(r.id) : onAdd(r.id); setFiche(null); }}>
                  {dedans ? "Retirer du parcours" : "Ajouter au parcours"}
                </button>
                <button className="ghost" onClick={() => setFiche(null)}>Fermer</button>
              </div>
            </div>
          </div>
        );
      })()}

      <div className="row" style={{ marginTop: 12, marginBottom: 0 }}>
        <button className="ghost" style={{ flex: 1 }} aria-pressed={geoState === "on"} onClick={onGeo}>
          {geoState === "on" ? "Suivi GPS actif · couper" : "Me localiser dans le parc"}
        </button>
      </div>

      <p className="note" style={{ margin: "10px 0 16px" }}>
        {graphOk
          ? "Temps de marche calculés sur les allées réelles du parc."
          : "Allées non chargées : les temps de marche sont estimés à vol d'oiseau."}
        {osmCount ? ` Positions OpenStreetMap pour ${osmCount} attractions.` : " Positions estimées par quartier."}
      </p>

      {geoState === "denied" && (
        <p className="note" style={{ marginTop: 10 }}>
          Localisation refusée. Autorisez-la dans les réglages du navigateur pour que les temps
          de marche partent d'où vous êtes.
        </p>
      )}
      {geoState === "outside" && (
        <p className="note" style={{ marginTop: 10 }}>
          Position trouvée mais hors du parc : le plan repart de la dernière attraction cochée.
        </p>
      )}

      {autour.length > 0 && (
        <div className="card" style={{ marginTop: 16 }}>
          <h3>Autour de vous <em>à pied</em></h3>
          <div className="autour">
            {autour.map(({ r, min }) => (
              <button key={r.id} className="prox" style={{ ["--zh" as string]: zoneOf(r.z).hue }}
                onClick={() => onAdd(r.id)} disabled={day.sel.includes(r.id)}
                title={day.sel.includes(r.id) ? "Déjà dans le parcours" : "Ajouter au parcours"}>
                <b>{r.n}</b>
                <small>{zoneOf(r.z).flag} {r.z}</small>
                <span className="mono d">{min} min</span>
                <span className={"mono w " + (waits[r.id] < 20 ? "w-go" : waits[r.id] <= 45 ? "w-mid" : "w-stop")}>
                  file {waits[r.id]} min
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {next && (
        <div className="nextup" style={{ ["--zh" as string]: zoneOf(next.ride.z).hue }}>
          <u>Prochaine étape · {hhmm(next.arrive)}</u>
          <h4>{next.ride.n}</h4>
          <p>
            {zoneOf(next.ride.z).flag} {next.ride.z} · {next.walk} min à pied ·
            file {next.wait} min{next.mode === "gc" ? " avec le joker" : next.mode === "vl" ? " en VirtualLine" : ""}
          </p>
          <p style={{ marginTop: 8 }}>{next.ride.plus}</p>
          <button className="go" onClick={(e) => { setGeste("fait"); onTick(next.ride.id, e); }}>
            <Check /> Étape faite, on passe à la suivante
          </button>
        </div>
      )}

      <div className="card">
        <h3>Itinéraire <em>{rides.length} restantes</em></h3>
        <div className="recap">
          <div><b className="mono">{rides.length}</b><u>restantes</u></div>
          <div><b className="mono">{minFile}</b><u>min de file</u></div>
          <div><b className="mono">{gagnees}</b><u>min gagnées</u></div>
        </div>
        {/*
          L'état de l'étoile ne se lisait que dans la liste des attractions, repliée par
          pays. Quand elle n'était pas posée, aucun bandeau ne se déclenchait et rien ne
          distinguait « pas imposée » de « imposée puis ignorée ». On l'écrit toujours.
        */}
        <p className="note" style={{ margin: "0 14px 14px" }}>
          {day.first == null || !BY_ID[day.first]
            ? <>Aucune attraction imposée en ouverture : le parcours choisit par quoi commencer.</>
            : done.has(day.first)
              // Une attraction faite n'est plus imposée, à raison — mais la consigne
              // semblait alors ignorée sans motif, l'étoile restant allumée.
              ? <>Ouverture imposée : <b>{BY_ID[day.first].n}</b>, mais elle est <b>marquée comme
                  déjà faite</b>, donc le parcours ne la place plus.{" "}
                  <button className="lien" onClick={() => onTick(day.first!)}>La remettre à faire</button></>
              : <>Ouverture imposée : <b>{BY_ID[day.first].n}</b>.</>}
        </p>
      </div>

      {/*
        L'attraction imposée en ouverture était écartée sans un mot quand le relevé la
        disait fermée : l'étoile restait allumée, une autre attraction ouvrait le
        parcours, et rien n'expliquait pourquoi.
      */}
      {day.first != null && BY_ID[day.first] && !done.has(day.first)
        && !rides.some((s) => s.ride.id === day.first) && (
        <div className="warn">
          <b>{BY_ID[day.first].n} est imposée en ouverture</b>, mais elle n'a pas pu être placée :{" "}
          {!day.sel.includes(day.first)
            ? "elle ne fait plus partie de votre sélection."
            : waits[day.first] < 0
              ? "elle est relevée fermée en ce moment. Recalculez sur place une fois le parc ouvert."
              : "le parcours n'a pas trouvé où la caser."}
        </div>
      )}

      {/*
        Imposée et relevée fermée : on le dit, mais on ne défait pas la consigne. Au
        lever du parc c'est presque toujours une ouverture décalée de quelques minutes.
      */}
      {day.first != null && BY_ID[day.first] && !done.has(day.first)
        && rides.some((s) => s.ride.id === day.first) && waits[day.first] < 0 && (
        <div className="warn">
          <b>{BY_ID[day.first].n} est relevée fermée à l'instant</b>, mais le parcours la garde
          en ouverture puisque vous l'avez imposée. Au lever du parc, c'est le plus souvent une
          ouverture décalée de quelques minutes.
        </div>
      )}

      {previsionnel && (
        <div className="warn">
          <b>Parc fermé en ce moment</b> : ce parcours est prévisionnel. Les attentes viennent
          des valeurs de référence, pas du direct. Rouvrez-le sur place le jour venu et
          appuyez sur « Recalculer à partir de maintenant » pour l'ajuster aux files réelles.
        </div>
      )}

      {journeeFinie && (
        <div className="warn">
          <b>Votre journée se termine à {day.end}</b>, et il est plus tard. Tout recalcul
          « à partir de maintenant » sortirait vide. Prolongez-la pour continuer.
          <div className="row" style={{ marginTop: 10, marginBottom: 0 }}>
            <button className="ghost" onClick={() => onProlonger(1)}>+ 1 heure</button>
            <button className="ghost" onClick={() => onProlonger(2)}>+ 2 heures</button>
            <button className="ghost" onClick={() => onProlonger(3)}>+ 3 heures</button>
          </div>
        </div>
      )}

      <button className="cta" onClick={() => compute(true)} disabled={planning || journeeFinie}>
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

      {rides.length > 0 && (() => {
        const fin = Math.max(...rides.map((r) => r.end));
        const reste = toMin(day.end) - fin;
        const restantes = day.sel.filter((id) => !done.has(id) && !rides.some((r) => r.ride.id === id));
        const nonPlacees = restantes.length;
        return (
          <div className="card bilan">
            <h3>Fin du parcours <em>{hhmm(fin)}</em></h3>
            <div className="pad">
              <p className="note" style={{ marginTop: 0 }}>
                {nonPlacees > 0
                  ? <>Le parcours s'arrête à <b>{hhmm(fin)}</b> : <b>{nonPlacees} attraction{nonPlacees > 1 ? "s" : ""}</b>{" "}
                     n'ont pas pu être placées — faute de temps avant votre heure de fin, ou parce
                     qu'elles sont fermées ou écartées par le plafond de brassage.</>
                  : <>Toutes vos attractions sont placées. Le parcours s'arrête à <b>{hhmm(fin)}</b>{" "}
                     parce qu'il n'y a plus rien à faire, pas parce que le temps manque.</>}
                {reste > 20 && <> Il reste <b>{Math.floor(reste / 60)} h {reste % 60} min</b> avant votre heure de fin.</>}
              </p>
              <div className="row" style={{ marginTop: 10, marginBottom: 0 }}>
                {reste > 20 && (
                  <button className="ghost" onClick={() => setAdding(true)}>
                    Ajouter des attractions pour occuper ce temps
                  </button>
                )}
                {/*
                  Le reliquat ne se perd pas : il devient une liste, qu'on charge le
                  lendemain ou après avoir prolongé la journée.
                */}
                {nonPlacees > 0 && (
                  <button className="ghost" onClick={() => onReliquat(restantes)}>
                    Faire une liste avec ces {nonPlacees} attractions
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/*
        Ce qu'on a fait ne se retrouvait nulle part : l'étape sort du parcours, et dans
        l'onglet Attractions elle est enfouie dans un pays replié. On la relit ici, dans
        l'ordre où elle a été cochée, avec de quoi défaire un appui malheureux.
      */}
      {day.done.length > 0 && (
        <details className="sect faites">
          <summary>
            <span className="t">Déjà faites</span>
            <em>{day.done.length}</em>
            <Chevron />
          </summary>
          <div className="inner">
            {day.done.map((id, i) => BY_ID[id] && (
              <div className="lot" key={id}>
                <div>
                  <b>{i + 1}. {BY_ID[id].n}</b>
                  <small>
                    {zoneOf(BY_ID[id].z).flag} {BY_ID[id].z}
                    {day.gc.includes(id) ? " · joker consommé" : ""}
                  </small>
                </div>
                <div className="sp">
                  <button className="ghost" onClick={() => { setGeste("retire"); onTick(id); }}>
                    Remettre à faire
                  </button>
                </div>
              </div>
            ))}
          </div>
        </details>
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
              className={["stop", s.mode === "gc" ? "gc" : "", current ? "now" : "", rehausse.has(s.ride.id) ? "maj" : ""].filter(Boolean).join(" ")}
              style={{ ["--zh" as string]: zoneOf(s.ride.z).hue }}
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              exit={geste === "fait"
                ? { opacity: 0, scale: 1.08, y: -18, height: 0, marginBottom: 0 }
                : { opacity: 0, x: -30, height: 0, marginBottom: 0 }}
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
                    {s.mode === "gc" && <span className="badge gc"><Pass />JOKER</span>}
                    {s.mode === "vl" && <span className="badge vl">VIRTUALLINE</span>}
                    {day.first === s.ride.id && <span className="badge first"><Star />OUVERTURE</span>}
                  </h4>
                  <div className="tags">
                    {tagsOf(s.ride).slice(0, 2).map((t) => <span key={t.l} className={"tag " + t.ton}>{t.l}</span>)}
                  </div>
                  <p className="why">{s.ride.plus}</p>
                  <div className="meta">
                    <span>{zoneOf(s.ride.z).flag} {s.ride.z}</span>
                    <span className="mono">file {s.wait} min</span>
                    <span className="mono">tour {s.dur} min</span>
                    {s.saved > 4 && <span className="mono" style={{ color: "var(--go)" }}>−{s.saved} min</span>}
                  </div>
                </div>
                {/*
                  Deux boutons faisaient disparaître l'étape sans dire lequel faisait
                  quoi : « fait » la marque comme accomplie et la compte, « retirer »
                  l'abandonne. Sans libellé, le geste était un pari.
                */}
                <div className="stopacts">
                  <button className="act fait" onClick={(e) => { setGeste("fait"); onTick(s.ride.id, e); }}
                    aria-label={`Marquer ${s.ride.n} comme faite`}>
                    <Check /><span>Fait</span>
                  </button>
                  <button className="act retirer" onClick={() => { setGeste("retire"); onRemove(s.ride.id); }}
                    aria-label={`Retirer ${s.ride.n} du parcours`}>
                    <span aria-hidden="true">✕</span><span>Retirer</span>
                  </button>
                </div>
              </div></div>
            </motion.div>
          );
        })}</AnimatePresence>
      )}
    </>
  );
}
