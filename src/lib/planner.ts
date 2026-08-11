import { BY_ID, ENTRANCE, type Ride } from "../data/rides";
import { ENTRANCE_KEY, ME_KEY, walkFromMatrix, type LatLng, type WalkMatrix } from "./geo";
import type { Snapshot } from "./api";

export type Step =
  | { kind: "ride"; ride: Ride; walk: number; arrive: number; wait: number; mode: "gc" | "vl" | "file"; dur: number; saved: number; end: number; pos: LatLng }
  | { kind: "break" | "vl"; at: number; dur: number; name: string; detail: string; pos: LatLng };

/** Quand placer les attractions aquatiques, et comment répartir les grosses sensations. */
export type Shape = { wet: "am" | "pm" | "any"; vif: "front" | "even" | "back" };

export type Lot = { id: string; name: string; ids: number[]; gc: number[]; vl: number[]; locked: boolean };

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
  start: "09:00", end: "18:00", lunch: "12:30", lunchDur: 50, tol: 65,
  shape: { wet: "pm", vif: "front" },
  steps: []
});

/** Courbe de fréquentation type, utilisée pour projeter l'attente à une heure future. */
const CURVE: Record<number, number> = { 9: 0.45, 10: 0.7, 11: 0.9, 12: 1, 13: 1.05, 14: 1.1, 15: 1.05, 16: 0.95, 17: 0.78, 18: 0.5 };

export const toMin = (v: string) => { const [h, m] = v.split(":").map(Number); return h * 60 + m; };
export const hhmm = (m: number) => {
  const t = Math.round(m);
  return String(Math.floor(t / 60) % 24).padStart(2, "0") + ":" + String(t % 60).padStart(2, "0");
};
export const clockMin = (d = new Date()) => d.getHours() * 60 + d.getMinutes();

function curveAt(mins: number) {
  const h = mins / 60, a = Math.floor(h), b = a + 1;
  const va = CURVE[Math.min(18, Math.max(9, a))] ?? 0.6;
  const vb = CURVE[Math.min(18, Math.max(9, b))] ?? 0.6;
  return va + (vb - va) * (h - a);
}

export function projectedWait(snap: Snapshot, r: Ride, atMin: number): number {
  const st = snap.rides[r.id];
  if (!st || !st.open) return -1;
  const f = curveAt(atMin) / Math.max(0.3, curveAt(clockMin(new Date(snap.at))));
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
export function buildPlan({ day, snap, pace, positions, walk, fromNow, rides, me }: Opts): Step[] {
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
      detail: list.map((r) => `${r.n} → retour vers ${hhmm(t + 3 + Math.max(30, projectedWait(snap, r, t)))}`).join(" · "),
      pos: { ...pos }
    });
    t += 3;
    list.forEach((r) => (vlWindow[r.id] = t + Math.max(30, projectedWait(snap, r, t))));
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

  // Attraction imposée en ouverture : on la sert avant toute optimisation.
  const forced = day.first != null && !done.has(day.first) ? BY_ID[day.first] : null;
  if (forced && left.includes(forced)) {
    const tw = walkFromMatrix(walk, at, forced.id, pace);
    let arrive = t + tw;
    if (vlSet.has(forced.id) && vlWindow[forced.id]) arrive = Math.max(arrive, vlWindow[forced.id]);
    const w = gc.has(forced.id) ? 7 : vlSet.has(forced.id) && vlWindow[forced.id] ? 10 : Math.max(0, projectedWait(snap, forced, arrive));
    const full = projectedWait(snap, forced, arrive);
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
    left.splice(left.indexOf(forced), 1);
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
      else { w = projectedWait(snap, r, arrive); mode = "file"; if (w < 0) continue; }

      const cost = arrive - t + w + r.dur;
      if (t + cost > end) continue;

      const cooled = Math.max(0, nausea - (arrive - t + w) * 0.55);
      const after = cooled + r.nau * 13;
      if (after > day.tol) continue;

      const full = projectedWait(snap, r, arrive);
      const saved = Math.max(0, full - w);

      // Rester dans le quartier vaut mieux que gagner deux minutes de file ailleurs :
      // c'est ce qui supprime les traversées répétées du parc.
      const sameZone = zone && r.z === zone ? 1.3 : 1;

      const score = ((1 + (r.thr / 5) * 0.35 + Math.min(1.2, saved / 45)) / Math.max(6, cost))
        * shapeFactor(r, arrive) * sameZone;

      if (!best || score > best.score) best = { r, score, tw, arrive, w, mode, saved, after };
    }

    if (!best) {
      if (nausea > 0) {
        const p = Math.max(10, Math.min(20, Math.ceil((nausea - day.tol * 0.55) / 0.55)));
        steps.push({ kind: "break", at: t, dur: p, name: "Respiration", detail: "Terrasse, glace, on laisse redescendre", pos: { ...pos } });
        t += p;
        nausea = Math.max(0, nausea - p * 0.9);
        continue;
      }
      break;
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
