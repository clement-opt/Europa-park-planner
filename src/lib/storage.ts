import { BY_ID } from "../data/rides";
import { emptyDay, type DayPlan, type Lot } from "./planner";
import { DEFAULT_CODE } from "./sync";

const KEY = "ep.state.v4";

export type AppState = {
  days: Record<1 | 2, DayPlan>;
  day: 1 | 2;
  pace: number;
  theme: "light" | "dark";
  relay: string;
  code: string;      // séjour partagé
  shared: boolean;   // synchronisation active
};

export const initialState = (): AppState => ({
  days: { 1: emptyDay(), 2: emptyDay() },
  day: 1,
  pace: 4.5,
  theme: "dark",
  relay: "",
  code: DEFAULT_CODE,
  shared: true
});

/** Complète un jour lu du stockage ou du serveur avec les champs manquants. */
export const hydrateDay = (d: Partial<DayPlan> | undefined): DayPlan => ({
  ...emptyDay(),
  ...d,
  shape: { ...emptyDay().shape, ...(d?.shape ?? {}) },
  lots: d?.lots ?? []
});

export function merge(p: Partial<AppState> | null | undefined): AppState {
  const base = initialState();
  if (!p) return base;
  return {
    ...base, ...p,
    days: { 1: hydrateDay(p.days?.[1]), 2: hydrateDay(p.days?.[2]) }
  };
}

export function load(): AppState {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? merge(JSON.parse(raw)) : initialState();
  } catch {
    return initialState();
  }
}

export function save(s: AppState) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* quota */ }
}

/** Ce qui part sur le serveur : l'état du séjour, pas les préférences d'appareil. */
export const shareable = (s: AppState) => ({ days: s.days, day: s.day, pace: s.pace });

/* ---- lots d'attractions ---------------------------------------------- */

export const newLot = (name: string, day: DayPlan): Lot => ({
  id: Math.random().toString(36).slice(2, 9),
  name: name.trim() || `Lot du ${new Date().toLocaleDateString("fr-FR")}`,
  ids: [...day.sel],
  gc: [...day.gc],
  vl: [...day.vl],
  locked: true,
  first: day.first,
  steps: day.steps
});

/** Réenregistre un lot sur l'état courant, en gardant son identité et son nom. */
export const updateLot = (lot: Lot, day: DayPlan): Lot => ({
  ...lot,
  ids: [...day.sel],
  gc: [...day.gc],
  vl: [...day.vl],
  first: day.first,
  steps: day.steps
});

/**
 * Applique un lot au jour courant.
 *
 * Les coches « déjà faite » ne sont **pas** reprises : elles appartiennent au programme
 * qu'on quitte. Les garder avait fait disparaître l'attraction d'ouverture d'un
 * parcours tout neuf — elle traînait dans `done` depuis des essais de la veille, et
 * plus rien ne la plaçait. Choisir un lot, c'est repartir de sa liste, telle qu'elle a
 * été enregistrée.
 */
export const applyLot = (lot: Lot, day: DayPlan): Partial<DayPlan> => ({
  sel: [...lot.ids],
  gc: lot.gc.filter((id) => lot.ids.includes(id)),
  vl: lot.vl.filter((id) => lot.ids.includes(id)),
  first: lot.first != null && lot.ids.includes(lot.first) ? lot.first : null,
  done: [],
  steps: lot.steps ?? []
});

/* ---- exports --------------------------------------------------------- */

export function selectionAsText(s: AppState): string {
  const L: string[] = ["Sélection Europa-Park — 4 adultes, séjour 2 jours", ""];
  ([1, 2] as const).forEach((d) => {
    const day = s.days[d];
    L.push(`## Jour ${d} — ${day.start} à ${day.end}, déjeuner ${day.lunch} (${day.lunchDur} min), tolérance ${day.tol}`);
    if (day.first && BY_ID[day.first]) L.push(`Ouverture imposée : ${BY_ID[day.first].n}`);
    if (!day.sel.length) { L.push("(rien de sélectionné)", ""); return; }
    day.sel.forEach((id) => {
      const r = BY_ID[id];
      if (!r) return;
      const tags = [
        day.gc.includes(id) ? "JOKER Green Card" : "",
        day.vl.includes(id) ? "VirtualLine" : "",
        day.done.includes(id) ? "déjà faite" : ""
      ].filter(Boolean).join(", ");
      L.push(`- ${r.n} (${r.z})${tags ? " — " + tags : ""}`);
    });
    L.push(`Jokers posés : ${day.gc.length}/6`, "");
  });
  return L.join("\n");
}

export async function copySelection(s: AppState): Promise<boolean> {
  const text = selectionAsText(s);
  try { await navigator.clipboard.writeText(text); return true; }
  catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  }
}

export function exportSelectionFile(s: AppState) {
  const blob = new Blob([JSON.stringify({ days: s.days }, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "selection-europa-park.json";
  a.click();
  URL.revokeObjectURL(url);
}
