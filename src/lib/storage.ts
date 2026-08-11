import { BY_ID } from "../data/rides";
import { emptyDay, type DayPlan } from "./planner";

const KEY = "ep.state.v3";

export type AppState = {
  days: Record<1 | 2, DayPlan>;
  day: 1 | 2;
  pace: number;
  theme: "light" | "dark";
  relay: string;
};

export const initialState = (): AppState => ({
  days: { 1: emptyDay(), 2: emptyDay() },
  day: 1,
  pace: 4.5,
  theme: "dark",
  relay: ""
});

export function load(): AppState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return initialState();
    const p = JSON.parse(raw) as AppState;
    const base = initialState();
    return {
      ...base, ...p,
      days: { 1: { ...emptyDay(), ...p.days?.[1] }, 2: { ...emptyDay(), ...p.days?.[2] } }
    };
  } catch {
    return initialState();
  }
}

export function save(s: AppState) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* quota */ }
}

/** Résumé texte de la sélection, à copier pour le partager ou le faire relire. */
export function selectionAsText(s: AppState): string {
  const L: string[] = ["Sélection Europa-Park — 4 adultes, séjour 2 jours", ""];
  ([1, 2] as const).forEach((d) => {
    const day = s.days[d];
    L.push(`## Jour ${d} — ${day.start} à ${day.end}, déjeuner ${day.lunch} (${day.lunchDur} min), tolérance ${day.tol}`);
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
