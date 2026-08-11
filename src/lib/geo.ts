import { BBOX, RIDES, ENTRANCE, type Ride } from "../data/rides";
import { buildMatrix, metres, type LatLng, type Matrix, type Node, type Ways } from "./walkgraph";

export type { LatLng, Ways } from "./walkgraph";
export { metres } from "./walkgraph";

/** Marche à vol d'oiseau majorée de 35 % pour les détours d'allées, plancher à 3 min. */
export function walkMinutes(a: LatLng, b: LatLng, kmh: number): number {
  return Math.max(3, Math.round((metres(a, b) * 1.35) / ((kmh * 1000) / 60)));
}

const norm = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9 ]/g, " ");

const ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter"
];

async function overpass(query: string, timeoutMs: number): Promise<any | null> {
  for (const url of ENDPOINTS) {
    try {
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), timeoutMs);
      const res = await fetch(url, { method: "POST", body: "data=" + encodeURIComponent(query), signal: ctl.signal });
      clearTimeout(timer);
      if (!res.ok) continue;
      return await res.json();
    } catch {
      /* endpoint suivant */
    }
  }
  return null;
}

/**
 * Récupère les positions réelles des attractions depuis OpenStreetMap.
 * En cas d'échec on garde les coordonnées de repli du référentiel.
 */
export async function fetchOsmPositions(): Promise<Record<number, LatLng>> {
  const q = `[out:json][timeout:25];
(
  nwr["attraction"](${BBOX.s},${BBOX.w},${BBOX.n},${BBOX.e});
  nwr["tourism"="attraction"](${BBOX.s},${BBOX.w},${BBOX.n},${BBOX.e});
  nwr["roller_coaster"](${BBOX.s},${BBOX.w},${BBOX.n},${BBOX.e});
);
out center tags;`;

  const json = await overpass(q, 12000);
  if (!json) return {};

  const found: { name: string; lat: number; lng: number }[] = [];
  for (const el of json.elements ?? []) {
    const name = el.tags?.name ?? el.tags?.["name:de"] ?? el.tags?.["name:en"];
    if (!name) continue;
    const lat = el.lat ?? el.center?.lat;
    const lng = el.lon ?? el.center?.lon;
    if (typeof lat !== "number" || typeof lng !== "number") continue;
    found.push({ name: norm(name), lat, lng });
  }

  const out: Record<number, LatLng> = {};
  for (const r of RIDES as Ride[]) {
    const key = norm(r.k);
    const hit = found.find((f) => f.name.includes(key)) ?? found.find((f) => key.includes(f.name) && f.name.length > 4);
    if (hit) out[r.id] = { lat: hit.lat, lng: hit.lng };
  }
  return Object.keys(out).length >= 8 ? out : {};
}

/* ------------------------------------------------------------------ */
/* Allées                                                               */
/* ------------------------------------------------------------------ */

const GRAPH_KEY = "ep.ways.v1";

/**
 * Réseau piéton du parc, au format brut. La construction du graphe et les plus
 * courts chemins se font dans le Web Worker : ici on ne fait que récupérer les
 * chemins, dans l'ordre cache local → serveur → Overpass en direct.
 */
export async function fetchFootWays(fromServer?: () => Promise<Ways | null>): Promise<Ways | null> {
  const cached = localStorage.getItem(GRAPH_KEY);
  if (cached) {
    try {
      const w = JSON.parse(cached) as Ways;
      if (w?.length) return w;
    } catch { /* cache abîmé, on refait */ }
  }

  const keep = (ways: Ways) => {
    try { localStorage.setItem(GRAPH_KEY, JSON.stringify(ways)); } catch { /* quota */ }
    return ways;
  };

  if (fromServer) {
    try {
      const ways = await fromServer();
      if (ways?.length) return keep(ways);
    } catch { /* on tente Overpass */ }
  }

  const q = `[out:json][timeout:30];
way["highway"~"^(footway|path|pedestrian|steps|living_street|service|track|corridor)$"]
   (${BBOX.s},${BBOX.w},${BBOX.n},${BBOX.e});
out geom;`;

  const json = await overpass(q, 20000);
  if (!json) return null;

  const ways: Ways = [];
  for (const w of json.elements ?? []) {
    if (!Array.isArray(w.geometry) || w.geometry.length < 2) continue;
    ways.push(w.geometry.map((p: any) => [Number(p.lat.toFixed(5)), Number(p.lon.toFixed(5))] as [number, number]));
  }
  return ways.length ? keep(ways) : null;
}

export type WalkMatrix = { m: Matrix; ok: boolean };

/** Clé de l'entrée du parc dans la matrice. Les autres clés sont les `id` d'attraction. */
export const ENTRANCE_KEY = 0;

/** Clé de votre position réelle. Négative pour ne jamais heurter un identifiant d'attraction. */
export const ME_KEY = -1;

/** Le parc, élargi de ~150 m : au-delà, une position GPS n'a plus de sens ici. */
export function inPark(p: LatLng) {
  const m = 0.0015;
  return p.lat > BBOX.s - m && p.lat < BBOX.n + m && p.lng > BBOX.w - m && p.lng < BBOX.e + m;
}

/** Les points à relier : l'entrée, puis chaque attraction à sa position connue. */
export const parkNodes = (pos: (r: Ride) => LatLng): Node[] => [
  { k: ENTRANCE_KEY, p: ENTRANCE },
  ...RIDES.map((r) => ({ k: r.id, p: pos(r) }))
];

export const walkFromMatrix = (w: WalkMatrix, from: number, to: number, kmh: number) =>
  Math.max(2, Math.round((w.m[from]?.[to] ?? 0) / ((kmh * 1000) / 60)));

/** Repli synchrone, sans graphe : utilisé tant que le worker n'a pas répondu. */
export const roughMatrix = (nodes: Node[]): WalkMatrix => ({ m: buildMatrix(null, nodes), ok: false });
