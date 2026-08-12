import { BY_ID, ENTRANCE, SNAPSHOT, type Ride } from "../data/rides";
import { ENTRANCE_KEY, ME_KEY, walkFromMatrix, type LatLng, type WalkMatrix } from "./geo";
import type { Snapshot } from "./api";

export type Step =
  | { kind: "ride"; ride: Ride; walk: number; arrive: number; wait: number; mode: "gc" | "vl" | "file"; dur: number; saved: number; end: number; pos: LatLng }
  | { kind: "break" | "vl"; at: number; dur: number; name: string; detail: string; pos: LatLng };

/** Quand placer les attractions aquatiques, et comment répartir les grosses sensations. */
export type Shape = { wet: "am" | "pm" | "any"; vif: "front" | "even" | "back" };

/**
 * Une liste enregistrée, et le parcours qui va avec.
 *
 * Le lot ne portait que la sélection : appliqué, il laissait derrière lui l'attraction
 * d'ouverture et les coches « déjà faite » du programme précédent, qui retiraient en
 * silence des attractions du nouveau parcours. Il emporte désormais tout ce qui décrit
 * un programme — l'ouverture imposée et l'itinéraire calculé compris — pour qu'en
 * choisir un reparte d'un état propre et complet.
 */
export type Lot = {
  id: string;
  name: string;
  ids: number[];
  gc: number[];
  vl: number[];
  locked: boolean;
  first?: number | null;
  steps?: Step[];
};

export type DayPlan = {
  sel: number[];
  gc: number[];
  vl: number[];
  done: number[];
  first: number | null;   // attraction imposée en ouverture
  lots: Lot[];
  start: string;
  end: string;
  lunch: string;
  lunchDur: number;
  tol: number;
  shape: Shape;
  steps: Step[];
};

export const emptyDay = (): DayPlan => ({
  sel: [], gc: [], vl: [], done: [], first: null, lots: [],
  // 20 h : heure de fermeture relevée sur place en août. Ce n'est pas une donnée
  // d'API — les horaires du parc n'y figurent pas — mais un défaut de saison, que
  // l'onglet Attractions permet de corriger et que la collecte sait recouper.
  start: "09:00", end: "20:00", lunch: "12:30", lunchDur: 50, tol: 65,
  shape: { wet: "pm", vif: "front" },
  steps: []
});

/**
 * Courbe de fréquentation par défaut, écrite à la main faute de mieux.
 * `Profil` la remplace dès que la collecte a de quoi la mesurer.
 */
const CURVE: Record<number, number> = { 9: 0.45, 10: 0.7, 11: 0.9, 12: 1, 13: 1.05, 14: 1.1, 15: 1.05, 16: 0.95, 17: 0.78, 18: 0.5 };

/** Facteurs mesurés : globaux, et par attraction quand elle en a assez. */
export type Profil = { global: Record<string, number>; rides: Record<string, Record<string, number>> };

export const toMin = (v: string) => { const [h, m] = v.split(":").map(Number); return h * 60 + m; };
export const hhmm = (m: number) => {
  const t = Math.round(m);
  return String(Math.floor(t / 60) % 24).padStart(2, "0") + ":" + String(t % 60).padStart(2, "0");
};
export const clockMin = (d = new Date()) => d.getHours() * 60 + d.getMinutes();

/**
 * Facteur d'affluence à une heure donnée, interpolé entre les deux heures pleines.
 *
 * Trois sources, de la plus précise à la plus grossière : le profil mesuré de
 * l'attraction, le profil mesuré global, puis `CURVE`. Une attraction n'a de profil
 * propre qu'après plusieurs jours de collecte — Silver Star et Voletarium n'ont pas
 * la même forme de journée, et c'est justement ce qu'une courbe unique ne voit pas.
 */
function curveAt(mins: number, prof?: Profil, rideId?: number) {
  const table = (rideId != null ? prof?.rides?.[String(rideId)] : undefined) ?? prof?.global;
  const lire = (h: number) => {
    const k = String(Math.min(23, Math.max(0, h)));
    const v = table?.[k];
    if (typeof v === "number") return v;
    return CURVE[Math.min(18, Math.max(9, h))] ?? 0.6;
  };
  const h = mins / 60, a = Math.floor(h);
  const va = lire(a), vb = lire(a + 1);
  return va + (vb - va) * (h - a);
}

export function projectedWait(snap: Snapshot, r: Ride, atMin: number, prof?: Profil): number {
  const st = snap.rides[r.id];
  if (!st || !st.open) return -1;
  const maintenant = clockMin(new Date(snap.at));
  const f = curveAt(atMin, prof, r.id) / Math.max(0.3, curveAt(maintenant, prof, r.id));
  return Math.max(0, Math.round(st.wait * Math.min(2, Math.max(0.35, f))));
}

export function nearestZone(p: LatLng, pos: (r: Ride) => LatLng, rides: Ride[]) {
  let best = Infinity, zone = "";
  for (const r of rides) {
    const d = (pos(r).lat - p.lat) ** 2 + (pos(r).lng - p.lng) ** 2;
    if (d < best) { best = d; zone = r.z; }
  }
  return zone;
}

type Opts = {
  day: DayPlan;
  snap: Snapshot;
  pace: number;
  positions: (r: Ride) => LatLng;
  walk: WalkMatrix;
  fromNow?: boolean;
  rides: Ride[];
  /** Position réelle du groupe. Quand elle est connue, le recalcul part de là. */
  me?: LatLng | null;
  /** Profil d'affluence mesuré. Absent, on retombe sur la courbe écrite à la main. */
  prof?: Profil;
};

/**
 * Glouton sous contraintes. À chaque étape on retient l'attraction au meilleur
 * rapport valeur / (marche + file + tour), sans dépasser le compteur de brassage
 * ni l'heure de fin. Les jokers Green Card valent 7 min d'attente forfaitaires,
 * une VirtualLine réservée en vaut 10 avec une fenêtre de retour à respecter.
 *
 * Trois biais viennent s'ajouter au score brut, tous issus du terrain :
 * la cohérence de quartier, pour éviter de traverser le parc en diagonale ;
 * le placement des attractions aquatiques ; la répartition des sensations fortes.
 */
export function buildPlan({ day, snap: direct, pace, positions, walk, fromNow, rides, me, prof }: Opts): Step[] {
  /**
   * Préparer un parcours à l'avance, c'est le préparer pour un jour où le parc sera
   * ouvert : l'état de l'instant ne dit rien de demain matin. Préparé le soir après
   * la fermeture, un parcours ne contenait aucune attraction — toutes étaient
   * fermées, donc toutes écartées, et l'app renvoyait une liste vide sans raison
   * compréhensible. On repart alors des attentes de référence, et on ne garde le
   * relevé en direct que là où il a quelque chose à dire.
   *
   * En cours de journée (`fromNow`), au contraire, une attraction fermée l'est
   * vraiment : on continue de l'écarter.
   */
  const snap: Snapshot = fromNow ? direct : {
    ...direct,
    rides: Object.fromEntries(rides.map((r) => {
      const s = direct.rides[r.id];
      return [r.id, s?.open ? s : { wait: SNAPSHOT[r.id] ?? 20, open: true }];
    }))
  };

  const done = new Set(day.done);
  const gc = new Set(day.gc);
  const vlSet = new Set(day.vl);

  let t = toMin(day.start);
  let pos: LatLng = { ...ENTRANCE };
  let at = ENTRANCE_KEY;

  if (fromNow) {
    t = Math.max(t, clockMin());
    // Le GPS prime : on est peut-être déjà reparti depuis la dernière attraction cochée.
    if (me && walk.m[ME_KEY]) {
      pos = { ...me };
      at = ME_KEY;
    } else {
      const last = day.done.length ? BY_ID[day.done[day.done.length - 1]] : null;
      if (last) { pos = positions(last); at = last.id; }
    }
  }

  const end = toMin(day.end);
  const lunchAt = toMin(day.lunch);
  const lunchFor = day.lunchDur || 0;
  const span = Math.max(60, end - toMin(day.start));
  let nausea = 0;
  let lunchDone = lunchFor <= 0 || t > lunchAt + lunchFor;

  const left = day.sel.map((id) => BY_ID[id]).filter((r) => r && !done.has(r.id) && snap.rides[r.id]?.open !== false);
  const steps: Step[] = [];
  const vlWindow: Record<number, number> = {};
  // Le quartier de départ amorce la prime de cohérence : sans lui, le premier
  // saut peut traverser le parc alors qu'on a trois attractions sous les pieds.
  let zone = fromNow
    ? (me && walk.m[ME_KEY] ? nearestZone(me, positions, rides)
       : day.done.length ? BY_ID[day.done[day.done.length - 1]]?.z ?? "" : "")
    : "";

  const vlPending = day.vl.filter((id) => day.sel.includes(id) && !done.has(id));
  if (vlPending.length) {
    const list = vlPending.map((id) => BY_ID[id]);
    steps.push({
      kind: "vl", at: t, dur: 3,
      name: "Réserver les VirtualLine dans l'app Europa-Park",
      detail: list.map((r) => `${r.n} → retour vers ${hhmm(t + 3 + Math.max(30, projectedWait(snap, r, t, prof)))}`).join(" · "),
      pos: { ...pos }
    });
    t += 3;
    list.forEach((r) => (vlWindow[r.id] = t + Math.max(30, projectedWait(snap, r, t, prof))));
  }

  /** Position relative dans la journée, de 0 à l'ouverture à 1 à la fermeture. */
  const progress = (m: number) => Math.min(1, Math.max(0, (m - toMin(day.start)) / span));

  /**
   * Facteur d'opportunité selon la forme de journée demandée. Multiplie le score :
   * au-dessus de 1 l'attraction est favorisée à cette heure, en dessous elle est repoussée.
   */
  const shapeFactor = (r: Ride, arrive: number) => {
    const p = progress(arrive);
    let f = 1;

    if (r.wet) {
      // Ressortir trempé en fin de journée, c'est finir la journée mouillé.
      if (day.shape.wet === "am") f *= p < 0.45 ? 1.5 : 0.45;
      if (day.shape.wet === "pm") f *= p > 0.35 && p < 0.85 ? 1.5 : 0.45;
    }

    if (r.thr >= 4) {
      if (day.shape.vif === "front") f *= p < 0.5 ? 1.35 : 0.8;
      if (day.shape.vif === "back") f *= p > 0.5 ? 1.35 : 0.8;
    }
    return f;
  };

  /**
   * Attraction imposée en ouverture : on la sert avant toute optimisation, et surtout
   * sans la soumettre à l'état d'ouverture de l'instant.
   *
   * Le relevé de 9 h 00 disait Silver Star fermée, celui de 9 h 05 l'annonçait ouverte
   * avec dix minutes d'attente : un parcours calculé entre les deux perdait la
   * consigne, et Swiss Bob Run passait en tête sans que rien ne l'explique. Une
   * attraction qu'on impose est une décision, pas une candidate — le planificateur
   * n'a pas à l'annuler sur un relevé vieux de trois minutes, d'autant qu'une
   * ouverture décalée de quelques minutes est la norme au lever du parc.
   */
  const forced = day.first != null && !done.has(day.first) && day.sel.includes(day.first)
    ? BY_ID[day.first] : null;
  if (forced) {
    const tw = walkFromMatrix(walk, at, forced.id, pace);
    let arrive = t + tw;
    if (vlSet.has(forced.id) && vlWindow[forced.id]) arrive = Math.max(arrive, vlWindow[forced.id]);
    // Fermée à l'instant, elle n'a pas d'attente projetée : on prend la référence.
    const projetee = projectedWait(snap, forced, arrive, prof);
    const full = projetee >= 0 ? projetee : SNAPSHOT[forced.id] ?? 20;
    const w = gc.has(forced.id) ? 7 : vlSet.has(forced.id) && vlWindow[forced.id] ? 10 : full;
    steps.push({
      kind: "ride", ride: forced, walk: tw, arrive, wait: w,
      mode: gc.has(forced.id) ? "gc" : vlSet.has(forced.id) && vlWindow[forced.id] ? "vl" : "file",
      dur: forced.dur, saved: Math.max(0, full - w), end: arrive + w + forced.dur, pos: positions(forced)
    });
    t = arrive + w + forced.dur;
    nausea = forced.nau * 13;
    pos = positions(forced);
    at = forced.id;
    zone = forced.z;
    // Elle peut ne pas figurer parmi les candidates — justement parce qu'elle est
    // relevée fermée. `indexOf` vaut alors -1, qu'il ne faut pas donner à `splice`.
    const i = left.indexOf(forced);
    if (i >= 0) left.splice(i, 1);
  }

  let guard = 0;
  while (left.length && t < end && guard++ < 90) {
    if (!lunchDone && t >= lunchAt) {
      steps.push({ kind: "break", at: t, dur: lunchFor, name: "Pause déjeuner", detail: `Quartier ${nearestZone(pos, positions, rides)}`, pos: { ...pos } });
      t += lunchFor;
      nausea = Math.max(0, nausea - lunchFor * 0.9);
      lunchDone = true;
      continue;
    }

    let best: { r: Ride; score: number; tw: number; arrive: number; w: number; mode: "gc" | "vl" | "file"; saved: number; after: number } | null = null;

    for (const r of left) {
      const tw = walkFromMatrix(walk, at, r.id, pace);
      let arrive = t + tw;
      if (vlSet.has(r.id) && vlWindow[r.id]) arrive = Math.max(arrive, vlWindow[r.id]);

      let w: number, mode: "gc" | "vl" | "file";
      if (gc.has(r.id)) { w = 7; mode = "gc"; }
      else if (vlSet.has(r.id) && vlWindow[r.id]) { w = 10; mode = "vl"; }
      else { w = projectedWait(snap, r, arrive, prof); mode = "file"; if (w < 0) continue; }

      const cost = arrive - t + w + r.dur;
      if (t + cost > end) continue;

      const cooled = Math.max(0, nausea - (arrive - t + w) * 0.55);
      const after = cooled + r.nau * 13;
      if (after > day.tol) continue;

      const full = projectedWait(snap, r, arrive, prof);
      const saved = Math.max(0, full - w);

      // Rester dans le quartier vaut mieux que gagner deux minutes de file ailleurs :
      // c'est ce qui supprime les traversées répétées du parc.
      const sameZone = zone && r.z === zone ? 1.3 : 1;

      const score = ((1 + (r.thr / 5) * 0.35 + Math.min(1.2, saved / 45)) / Math.max(6, cost))
        * shapeFactor(r, arrive) * sameZone;

      if (!best || score > best.score) best = { r, score, tw, arrive, w, mode, saved, after };
    }

    if (!best) {
      /**
       * Aucune attraction admissible : on laisse simplement le temps passer, sans
       * écrire d'étape.
       *
       * Les pauses « Respiration » posées d'office ont été retirées sur demande du
       * terrain — on gère sa pause soi-même et on recalcule si besoin. Le plafond de
       * brassage, lui, ne bouge pas : il continue d'écarter ce qui enchaîne trop, et
       * le battement se lit dans l'écart entre deux horaires d'arrivée.
       *
       * Ce temps-là refroidit au rythme ordinaire, 0,55 par minute, et non au rythme
       * d'une pause assise : on ne prescrit plus de terrasse, on ne peut donc pas la
       * supposer. Compter 0,9 aurait fait passer le compteur au-dessus du plafond.
       */
      const douce = Math.min(...left.map((r) => r.nau));
      const besoin = Math.ceil((nausea - (day.tol - douce * 13)) / 0.55);
      if (nausea <= 0 || besoin <= 0) break;
      const battement = Math.min(45, besoin);
      if (t + battement >= end) break;
      t += battement;
      nausea = Math.max(0, nausea - battement * 0.55);
      continue;
    }

    steps.push({
      kind: "ride", ride: best.r, walk: best.tw, arrive: best.arrive, wait: best.w,
      mode: best.mode, dur: best.r.dur, saved: best.saved,
      end: best.arrive + best.w + best.r.dur, pos: positions(best.r)
    });
    t = best.arrive + best.w + best.r.dur;
    nausea = best.after;
    pos = positions(best.r);
    at = best.r.id;
    zone = best.r.z;
    left.splice(left.indexOf(best.r), 1);
  }

  if (!lunchDone && lunchFor > 0) {
    steps.push({ kind: "break", at: t, dur: lunchFor, name: "Pause déjeuner", detail: `Quartier ${nearestZone(pos, positions, rides)}`, pos: { ...pos } });
  }
  return steps;
}
