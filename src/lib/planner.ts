import { BY_ID, ENTRANCE, type Ride } from "../data/rides";
import { walkMinutes, type LatLng } from "./geo";
import type { Snapshot } from "./api";

export type Step =
  | { kind: "ride"; ride: Ride; walk: number; arrive: number; wait: number; mode: "gc" | "vl" | "file"; dur: number; saved: number; end: number; pos: LatLng }
  | { kind: "break" | "vl"; at: number; dur: number; name: string; detail: string; pos: LatLng };

export type DayPlan = {
  sel: number[];
  gc: number[];
  vl: number[];
  done: number[];
  start: string;
  end: string;
  lunch: string;
  lunchDur: number;
  tol: number;
  steps: Step[];
};

export const emptyDay = (): DayPlan => ({
  sel: [], gc: [], vl: [], done: [],
  start: "09:00", end: "18:00", lunch: "12:30", lunchDur: 50, tol: 65, steps: []
});

/** Courbe de fréquentation type, utilisée pour projeter l'attente à une heure future. */
const CURVE: Record<number, number> = { 9: 0.45, 10: 0.7, 11: 0.9, 12: 1, 13: 1.05, 14: 1.1, 15: 1.05, 16: 0.95, 17: 0.78, 18: 0.5 };

export const toMin = (v: string) => { const [h, m] = v.split(":").map(Number); return h * 60 + m; };
export const hhmm = (m: number) =>
  String(Math.floor(m / 60) % 24).padStart(2, "0") + ":" + String(Math.round(m) % 60).padStart(2, "0");
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
  fromNow?: boolean;
  rides: Ride[];
};

/**
 * Glouton sous contraintes. À chaque étape on retient l'attraction au meilleur
 * rapport valeur / (marche + file + tour), sans dépasser le compteur de brassage
 * ni l'heure de fin. Les jokers Green Card valent 7 min d'attente forfaitaires,
 * une VirtualLine réservée en vaut 10 avec une fenêtre de retour à respecter.
 */
export function buildPlan({ day, snap, pace, positions, fromNow, rides }: Opts): Step[] {
  const done = new Set(day.done);
  const gc = new Set(day.gc);
  const vlSet = new Set(day.vl);

  let t = toMin(day.start);
  let pos: LatLng = { ...ENTRANCE };
  if (fromNow) {
    t = Math.max(t, clockMin());
    const last = day.done.length ? BY_ID[day.done[day.done.length - 1]] : null;
    if (last) pos = positions(last);
  }

  const end = toMin(day.end);
  const lunchAt = toMin(day.lunch);
  const lunchFor = day.lunchDur || 0;
  let nausea = 0;
  let lunchDone = lunchFor <= 0 || t > lunchAt + lunchFor;

  const left = day.sel.map((id) => BY_ID[id]).filter((r) => r && !done.has(r.id) && snap.rides[r.id]?.open !== false);
  const steps: Step[] = [];
  const vlWindow: Record<number, number> = {};

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
      const tw = walkMinutes(pos, positions(r), pace);
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
      const score = (1 + (r.thr / 5) * 0.35 + Math.min(1.2, saved / 45)) / Math.max(6, cost);
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
    left.splice(left.indexOf(best.r), 1);
  }

  if (!lunchDone && lunchFor > 0) {
    steps.push({ kind: "break", at: t, dur: lunchFor, name: "Pause déjeuner", detail: `Quartier ${nearestZone(pos, positions, rides)}`, pos: { ...pos } });
  }
  return steps;
}
