import { BY_ID, RIDES } from "../data/rides";
import type { Snapshot } from "./api";

export type Sample = { at: number; waits: Record<number, number>; vl: Record<number, boolean> };
export type Event = { at: number; kind: "vl-open" | "vl-close" | "ride-close" | "ride-open" | "spike"; label: string };

const KEY = "ep.journal.v1";
const MAX_SAMPLES = 900; // ~30 h à un relevé toutes les 2 min

type Store = { samples: Sample[]; events: Event[] };

export function loadJournal(): Store {
  try { return JSON.parse(localStorage.getItem(KEY) ?? "") as Store; }
  catch { return { samples: [], events: [] }; }
}

function save(s: Store) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* quota */ }
}

const vlLabel = (vlId: number) => {
  const parent = RIDES.find((r) => r.vlId === vlId);
  return parent ? parent.n : `file virtuelle ${vlId}`;
};

/** Ajoute un relevé et en déduit les évènements par rapport au précédent. */
export function record(snap: Snapshot): Store {
  const store = loadJournal();
  const prev = store.samples[store.samples.length - 1];

  const waits: Record<number, number> = {};
  for (const r of RIDES) {
    const st = snap.rides[r.id];
    waits[r.id] = st ? (st.open ? st.wait : -1) : -1;
  }
  const sample: Sample = { at: snap.at, waits, vl: snap.vl };

  if (prev) {
    for (const [k, open] of Object.entries(snap.vl)) {
      const id = Number(k);
      const was = prev.vl[id];
      if (was === undefined) continue;
      if (!was && open) store.events.push({ at: snap.at, kind: "vl-open", label: `VirtualLine ouverte · ${vlLabel(id)}` });
      if (was && !open) store.events.push({ at: snap.at, kind: "vl-close", label: `VirtualLine fermée · ${vlLabel(id)}` });
    }
    for (const r of RIDES) {
      const a = prev.waits[r.id], b = waits[r.id];
      if (a === undefined) continue;
      if (a >= 0 && b < 0) store.events.push({ at: snap.at, kind: "ride-close", label: `Fermeture · ${r.n}` });
      if (a < 0 && b >= 0) store.events.push({ at: snap.at, kind: "ride-open", label: `Réouverture · ${r.n}` });
      if (a >= 0 && b >= 0 && b - a >= 25) store.events.push({ at: snap.at, kind: "spike", label: `Pic +${b - a} min · ${r.n} (${a} → ${b})` });
    }
  }

  store.samples.push(sample);
  if (store.samples.length > MAX_SAMPLES) store.samples = store.samples.slice(-MAX_SAMPLES);
  if (store.events.length > 400) store.events = store.events.slice(-400);
  save(store);
  return store;
}

export function clearJournal() { try { localStorage.removeItem(KEY); } catch { /* noop */ } }

const stamp = (ms: number) => {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

/** Produit le journal en Markdown : évènements, courbes par attraction, tableau brut. */
export function toMarkdown(): string {
  const { samples, events } = loadJournal();
  if (!samples.length) return "# Journal des temps d'attente\n\nAucun relevé enregistré.\n";

  const from = stamp(samples[0].at);
  const to = stamp(samples[samples.length - 1].at);
  const L: string[] = [];

  L.push("# Journal des temps d'attente · Europa-Park");
  L.push("");
  L.push(`Relevés : **${samples.length}** · du ${from} au ${to}`);
  L.push("Source : queue-times.com (park 51). Un relevé toutes les 2 minutes pendant que l'app est ouverte.");
  L.push("");

  L.push("## Évènements");
  L.push("");
  if (!events.length) L.push("_Aucun évènement détecté sur la période._");
  else {
    L.push("| Heure | Type | Détail |");
    L.push("| --- | --- | --- |");
    for (const e of events.slice(-120)) L.push(`| ${stamp(e.at)} | ${e.kind} | ${e.label} |`);
  }
  L.push("");

  L.push("## Synthèse par attraction");
  L.push("");
  L.push("| Attraction | Quartier | Min | Moy | Max | Dernier |");
  L.push("| --- | --- | --- | --- | --- | --- |");
  for (const r of RIDES) {
    const vals = samples.map((s) => s.waits[r.id]).filter((v) => typeof v === "number" && v >= 0) as number[];
    if (!vals.length) continue;
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const avg = Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
    L.push(`| ${r.n} | ${r.z} | ${min} | ${avg} | ${max} | ${vals[vals.length - 1]} |`);
  }
  L.push("");

  L.push("## Relevés bruts");
  L.push("");
  const cols = RIDES.filter((r) => samples.some((s) => (s.waits[r.id] ?? -1) >= 0));
  L.push("| Heure | " + cols.map((c) => c.n).join(" | ") + " |");
  L.push("| --- |" + cols.map(() => " --- |").join(""));
  for (const s of samples.slice(-200)) {
    L.push("| " + stamp(s.at) + " | " + cols.map((c) => (s.waits[c.id] >= 0 ? s.waits[c.id] : "×")).join(" | ") + " |");
  }
  L.push("");
  L.push("_× = attraction fermée au moment du relevé._");
  L.push("");
  return L.join("\n");
}

export function downloadMarkdown() {
  const blob = new Blob([toMarkdown()], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const d = new Date();
  a.href = url;
  a.download = `journal-attentes-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}.md`;
  a.click();
  URL.revokeObjectURL(url);
}
