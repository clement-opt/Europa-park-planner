import { useMemo, useState } from "react";
import { BY_ID, RIDES, tagsOf, zoneOf, type Ride } from "../data/rides";
import { applyLot, newLot, updateLot } from "../lib/storage";
import type { DayPlan, Lot } from "../lib/planner";
import type { Horaire } from "../lib/sync";
import Section from "./Section";
import BoutonDanger from "./BoutonDanger";
import { Check, Pass, Star, Lock } from "./icons";

/** Préfixe `w-` : `.stop` désigne déjà une étape d'itinéraire, la collision faisait
 *  hériter les pastilles d'attente de la grille de la timeline. */
const waitClass = (w: number) => (w < 0 ? "w-closed" : w < 20 ? "w-go" : w <= 45 ? "w-mid" : "w-stop");
const waitLabel = (w: number) => (w < 0 ? "fermé" : `${w} min`);

type Props = {
  day: DayPlan;
  setDay: (p: Partial<DayPlan>) => void;
  waits: Record<number, number>;
  pace: number;
  setPace: (v: number) => void;
  toast: (s: string) => void;
  sparkle: (x: number, y: number, c: string) => void;
  horaires: Horaire[];
};

export default function Selection({ day, setDay, waits, pace, setPace, toast, sparkle, horaires }: Props) {
  const [lotName, setLotName] = useState("");
  const [q, setQ] = useState("");
  // Les quartiers restent fermés tant qu'on ne les ouvre pas : un préréglage qui
  // sélectionne vingt attractions ne doit pas déplier dix panneaux d'un coup.
  const [openZones, setOpenZones] = useState<Set<string>>(new Set());
  const [filtres, setFiltres] = useState<Set<string>>(new Set());

  const sel = useMemo(() => new Set(day.sel), [day.sel]);
  const gc = useMemo(() => new Set(day.gc), [day.gc]);
  const vl = useMemo(() => new Set(day.vl), [day.vl]);
  const done = useMemo(() => new Set(day.done), [day.done]);
  const spent = day.gc.filter((id) => done.has(id)).length;
  const locked = day.lots.some((l) => l.locked);

  const norm = (v: string) => v.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

  /** Toutes les étiquettes existantes, dans l'ordre où elles sont produites. */
  const toutesTags = useMemo(() => {
    const vus = new Map<string, string>();
    RIDES.forEach((r) => tagsOf(r).forEach((t) => vus.set(t.l, t.ton)));
    return [...vus].map(([l, ton]) => ({ l, ton }));
  }, []);

  const byZone = useMemo(() => {
    const needle = norm(q.trim());
    const z: Record<string, Ride[]> = {};
    RIDES
      .filter((r) => !needle || norm(r.n).includes(needle) || norm(r.z).includes(needle)
        || norm(r.why).includes(needle) || tagsOf(r).some((t) => norm(t.l).includes(needle)))
      // Filtres cumulatifs : « Familial » et « Aquatique » ne gardent que ce qui est
      // les deux. C'est ce qu'on attend quand on empile des critères.
      .filter((r) => !filtres.size || [...filtres].every((f) => tagsOf(r).some((t) => t.l === f)))
      .forEach((r) => (z[r.z] = z[r.z] ?? []).push(r));
    return Object.entries(z).sort(([a], [b]) => a.localeCompare(b));
  }, [q, filtres]);

  const shown = byZone.reduce((a, [, l]) => a + l.length, 0);
  const searching = q.trim().length > 0 || filtres.size > 0;

  const toggle = (list: number[], id: number) =>
    list.includes(id) ? list.filter((x) => x !== id) : [...list, id];

  const onSelect = (id: number) => {
    if (locked) return toast("Liste verrouillée : déverrouillez pour modifier la sélection");
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
    if (locked) return toast("Liste verrouillée : déverrouillez pour changer");
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
    toast("Liste enregistrée et verrouillée");
  };

  const setLots = (lots: Lot[]) => setDay({ lots });

  return (
    <>
      <Section title="La journée" badge={`${day.start} – ${day.end}`}>
        <div className="row">
          <div style={{ flex: 1, minWidth: 128 }}>
            <label className="f" htmlFor="dep">Départ</label>
            <input id="dep" type="time" value={day.start} onChange={(e) => setDay({ start: e.target.value })} />
          </div>
          <div style={{ flex: 1, minWidth: 128 }}>
            <label className="f" htmlFor="fin">Fin</label>
            <input id="fin" type="time" value={day.end} onChange={(e) => setDay({ end: e.target.value })} />
          </div>
        </div>

        {(() => {
          // On ne propose une fermeture que si la collecte a continué après la
          // dernière attraction ouverte : sinon on ne mesure que sa propre fin.
          const h = horaires.find((x) => x.fermeture_observee);
          if (!h || h.dernier_ouvert === day.end) return null;
          return (
            <p className="note" style={{ marginTop: -4, marginBottom: 14 }}>
              Le {h.jour.split("-").reverse().slice(0, 2).join("/")}, les dernières attractions
              étaient encore ouvertes à <b className="mono">{h.dernier_ouvert}</b>.{" "}
              <button className="lien" onClick={() => setDay({ end: h.dernier_ouvert, steps: [] })}>
                Utiliser cette heure de fin
              </button>
            </p>
          );
        })()}
        <div className="row">
          <div style={{ flex: 1, minWidth: 128 }}>
            <label className="f" htmlFor="dej">Déjeuner</label>
            <input id="dej" type="time" value={day.lunch} onChange={(e) => setDay({ lunch: e.target.value })} />
          </div>
          <div style={{ flex: 1, minWidth: 128 }}>
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
        </div>

        <div className="row" style={{ display: "block" }}>
          <label className="f">Attractions aquatiques</label>
          <div className="seg">
            {([["am", "Le matin"], ["pm", "L'après-midi"], ["any", "Peu importe"]] as const).map(([v, l]) => (
              <button key={v} aria-pressed={day.shape.wet === v}
                onClick={() => setDay({ shape: { ...day.shape, wet: v }, steps: [] })}>{l}</button>
            ))}
          </div>
        </div>

        {/*
          L'étoile qui impose la première attraction vivait uniquement sur la ligne de
          chaque attraction, sans autre indication qu'un `title` — invisible au doigt.
          On la rappelle ici, avec son état courant : c'est le seul réglage du jour qui
          se pose ailleurs que dans ce bloc.
        */}
        <div className="row" style={{ display: "block" }}>
          <label className="f">Attraction d'ouverture</label>
          {day.first != null && BY_ID[day.first] ? (
            <p className="note" style={{ marginTop: 0 }}>
              Le parcours commencera par <b>{BY_ID[day.first].n}</b>, avant toute optimisation.{" "}
              <button className="lien" onClick={() => setDay({ first: null, steps: [] })}>
                Ne plus l'imposer
              </button>
            </p>
          ) : (
            <p className="note" style={{ marginTop: 0 }}>
              Aucune : le parcours choisit lui-même par quoi commencer. Pour l'imposer, dépliez
              un pays plus bas et appuyez sur l'étoile <b>★</b> de la ligne de l'attraction.
            </p>
          )}
        </div>

        {/*
          Les attractions cochées « déjà faite » sortent du parcours définitivement, et
          rien ne les récapitulait : sept coches laissées par des essais la veille
          suffisaient à faire disparaître une attraction sans explication, l'étoile de
          l'ouverture comprise.
        */}
        {day.done.length > 0 && (
          <div className="row" style={{ display: "block" }}>
            <label className="f">Déjà faites</label>
            <p className="note" style={{ marginTop: 0 }}>
              <b>{day.done.length} attraction{day.done.length > 1 ? "s" : ""}</b> {day.done.length > 1 ? "sont marquées" : "est marquée"}{" "}
              comme déjà {day.done.length > 1 ? "faites" : "faite"} : {day.done.length > 1 ? "elles sont retirées" : "elle est retirée"} du parcours.
            </p>
            <BoutonDanger
              label="Tout remettre à faire"
              confirmation={`Confirmer : remettre ${day.done.length} attraction${day.done.length > 1 ? "s" : ""} à faire`}
              onConfirm={() => { setDay({ done: [], steps: [] }); toast("Tout est remis à faire"); }} />
          </div>
        )}

        <div className="row" style={{ display: "block" }}>
          <label className="f">Grosses sensations</label>
          <div className="seg">
            {([["front", "Tôt"], ["even", "Réparties"], ["back", "Tard"]] as const).map(([v, l]) => (
              <button key={v} aria-pressed={day.shape.vif === v}
                onClick={() => setDay({ shape: { ...day.shape, vif: v }, steps: [] })}>{l}</button>
            ))}
          </div>
        </div>

        <div className="row" style={{ display: "block", marginBottom: 0 }}>
          <label className="f" htmlFor="pace">
            Rythme de marche <span className="mono">{pace.toString().replace(".", ",")} km/h</span>
          </label>
          <input id="pace" type="range" min={3} max={6} step={0.25} value={pace}
            aria-label={`Rythme de marche, ${pace} kilomètres par heure`}
            onChange={(e) => setPace(Number(e.target.value))} />
        </div>
      </Section>

      <Section title={<><Pass />Green Card</>} badge={`${day.gc.length} / 6`}>
        <div className="jokers">
          {Array.from({ length: 6 }, (_, i) => {
            const id = day.gc[i];
            return (
              <span key={i} className={"tok " + (id ? (done.has(id) ? "spent" : "armed") : "")}
                title={id ? BY_ID[id].n : "joker libre"}><Pass /></span>
            );
          })}
          <span className="lbl">{6 - spent} restant{6 - spent > 1 ? "s" : ""}</span>
        </div>
        {day.gc.length ? (
          <ol className="gclist">{day.gc.map((id) => (
            <li key={id} className={done.has(id) ? "spent" : ""}>{BY_ID[id].n} <span>· {BY_ID[id].z}</span></li>
          ))}</ol>
        ) : (
          <p className="note">
            Aucun joker posé. Visez les files longues sans VirtualLine : c'est là que la carte rapporte le plus.
          </p>
        )}
        <p className="tell">
          <b>En arrivant :</b> Information sous la Tour (quartier France), carte d'invalidité et pièce d'identité.
          Le personnel <b>écrit les 6 attractions sur la carte</b> : arrivez avec la liste décidée.
        </p>
      </Section>

      <Section title={<><Lock />Listes enregistrées</>} badge={day.lots.length}>
        <p className="note" style={{ marginBottom: 12 }}>
          Une liste enregistre les attractions, les jokers, l'attraction d'ouverture <b>et son
          parcours</b>. En choisir une repart de cet état complet : rien ne reste de la
          précédente, pas même les coches « déjà faite ».
        </p>
        <div className="row">
          <input type="text" placeholder="Nom de la liste" value={lotName} aria-label="Nom de la liste à enregistrer"
            onChange={(e) => setLotName(e.target.value)} style={{ flex: 1, minWidth: 160 }} />
          <button className="ghost" onClick={saveLot}>Enregistrer</button>
        </div>
        {day.lots.map((l) => {
          // Liste active : déduite de la sélection, jamais stockée. Un drapeau posé à
          // l'application se serait périmé au premier changement de sélection.
          const active = l.ids.length === day.sel.length
            && l.ids.every((id) => day.sel.includes(id))
            && (l.first ?? null) === day.first;
          return (
            <div className={"lot" + (active ? " active" : "")} key={l.id}>
              <div>
                <b>{l.name}{active ? " · en cours" : ""}</b>
                <small>
                  {l.ids.length} attractions · {l.gc.length} jokers · {l.vl.length} VL
                  {l.first != null && BY_ID[l.first] ? ` · ouvre sur ${BY_ID[l.first].n}` : ""}
                  {l.steps?.length ? " · parcours enregistré" : " · sans parcours"}
                </small>
              </div>
              <div className="sp">
                {active ? (
                  <button className="ghost" title="Réenregistrer cette liste sur l'état courant"
                    onClick={() => { setLots(day.lots.map((x) => (x.id === l.id ? updateLot(x, day) : x))); toast(`« ${l.name} » mise à jour`); }}>
                    Mettre à jour
                  </button>
                ) : (
                  <button className="ghost" aria-pressed={false}
                    onClick={() => { setDay(applyLot(l, day)); toast(`« ${l.name} » chargée`); }}>
                    Charger
                  </button>
                )}
                <button className="lk" aria-pressed={l.locked} title={l.locked ? "Déverrouiller" : "Verrouiller"}
                  onClick={() => setLots(day.lots.map((x) => (x.id === l.id ? { ...x, locked: !x.locked } : x)))}>
                  <Lock />
                </button>
                <BoutonDanger className="lk" title={`Supprimer la liste ${l.name}`}
                  label="✕" confirmation="Supprimer ?"
                  onConfirm={() => { setLots(day.lots.filter((x) => x.id !== l.id)); toast(`« ${l.name} » supprimée`); }} />
              </div>
            </div>
          );
        })}
      </Section>

      <div className="card">
        <h3>Attractions <em>{shown} affichées · {day.sel.length} choisies</em></h3>
        <div className="pad">
          <div className="search">
            <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
            <input type="text" value={q} onChange={(e) => setQ(e.target.value)}
              placeholder={`Chercher parmi ${RIDES.length} attractions…`} aria-label="Chercher une attraction" />
          </div>
          <div className="filtres" role="group" aria-label="Filtrer par étiquette">
            {toutesTags.map((t) => (
              <button key={t.l} className={"tag " + t.ton} aria-pressed={filtres.has(t.l)}
                onClick={() => setFiltres((p) => {
                  const n = new Set(p);
                  n.has(t.l) ? n.delete(t.l) : n.add(t.l);
                  return n;
                })}>{t.l}</button>
            ))}
            {filtres.size > 0 && (
              <button className="tag vide" onClick={() => setFiltres(new Set())}>Tout afficher</button>
            )}
          </div>

          <div className="presets">
            <button className="ghost" onClick={() => preset("mix")}>Mix</button>
            <button className="ghost" onClick={() => preset("thrill")}>Sensations</button>
            <button className="ghost" onClick={() => preset("chill")}>Tout doux</button>
            <button className="ghost" onClick={() => preset("none")}>Vider</button>
          </div>
        </div>
      </div>

      {byZone.map(([zone, list]) => {
        const picked = list.filter((r) => sel.has(r.id)).length;
        return (
          <Section key={zone} className="zone" tint={zoneOf(zone).hue}
            open={searching || openZones.has(zone)}
            onToggle={(o) => setOpenZones((prev) => {
              const next = new Set(prev);
              o ? next.add(zone) : next.delete(zone);
              return next;
            })}
            title={<>{zoneOf(zone).flag} {zone}</>}
            badge={picked ? `${picked} / ${list.length}` : list.length}>
            {list.map((r) => {
              const w = waits[r.id];
              return (
                <div key={r.id} className={"ride" + (sel.has(r.id) ? " sel" : "") + (done.has(r.id) ? " ticked" : "")}>
                  <button className="chk" aria-pressed={sel.has(r.id)} onClick={() => onSelect(r.id)}
                    aria-label={`Choisir ${r.n}`}><Check /></button>

                  <div className="name">
                    <b>{r.n}</b>
                    <small>{r.dur} min · brassage {r.nau}/5{r.wet ? " · on ressort mouillé" : ""}</small>
                  </div>

                  <span className={"wt mono " + waitClass(w)}>{waitLabel(w)}</span>

                  <div className="desc">
                    <div className="tags">
                      {tagsOf(r).map((t) => <span key={t.l} className={"tag " + t.ton}>{t.l}</span>)}
                    </div>
                    <p className="why">{r.why}</p>
                    <p className="plus">{r.plus}</p>
                  </div>

                  <div className="acts">
                    <div className="intens" title={`Intensité ${r.thr}/5`}>
                      {[1, 2, 3, 4, 5].map((i) => <i key={i} className={i <= r.thr ? "on" : ""} />)}
                    </div>
                    <button className="pill gc" aria-pressed={gc.has(r.id)} title="Joker Green Card"
                      disabled={!sel.has(r.id) || (day.gc.length >= 6 && !gc.has(r.id))}
                      onClick={(e) => onGc(r.id, e)}><Pass /></button>
                    <button className="pill vl" aria-pressed={vl.has(r.id)} title="VirtualLine"
                      disabled={!sel.has(r.id) || !r.vl} onClick={() => onVl(r.id)}>VL</button>
                    <button className="pill first" aria-pressed={day.first === r.id}
                      aria-label={`Commencer la journée par ${r.n}`} title="Commencer la journée par cette attraction"
                      onClick={(e) => onFirst(r.id, e)}><Star /></button>
                    <button className="chk" style={{ marginLeft: "auto" }} aria-pressed={done.has(r.id)}
                      title="Déjà faite" onClick={(e) => onTick(r.id, e)}><Check /></button>
                  </div>
                </div>
              );
            })}
          </Section>
        );
      })}

      {!shown && <p className="hint">Aucune attraction ne correspond à « {q} ».</p>}
    </>
  );
}
