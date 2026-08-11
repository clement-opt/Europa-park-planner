import { BBOX, RIDES, ENTRANCE, type Ride } from "../data/rides";

export type LatLng = { lat: number; lng: number };

export function metres(a: LatLng, b: LatLng): number {
  const R = 6371000;
  const t = Math.PI / 180;
  const dLat = (b.lat - a.lat) * t;
  const dLng = (b.lng - a.lng) * t;
  const la = a.lat * t;
  const lb = b.lat * t;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la) * Math.cos(lb) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

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
/* Graphe des allées                                                    */
/* ------------------------------------------------------------------ */

type Graph = { pts: LatLng[]; adj: { to: number; d: number }[][] };

/** 1e-5 degré ≈ 1 m : deux points d'allées à moins d'un mètre sont le même carrefour. */
const key = (lat: number, lng: number) => `${lat.toFixed(5)},${lng.toFixed(5)}`;

/**
 * Construit le réseau piéton du parc à partir d'OpenStreetMap.
 *
 * La distance à vol d'oiseau majorée de 35 % suffit à comparer deux attractions
 * voisines, mais elle sous-estime lourdement les traversées : au milieu du parc il y
 * a un lac, des bâtiments et pas d'allée droite. C'est ce qui produisait des
 * itinéraires qui traversent le parc en diagonale plusieurs fois de suite.
 */
export async function fetchFootGraph(): Promise<Graph | null> {
  const q = `[out:json][timeout:30];
way["highway"~"^(footway|path|pedestrian|steps|living_street|service|track|corridor)$"]
   (${BBOX.s},${BBOX.w},${BBOX.n},${BBOX.e});
out geom;`;

  const json = await overpass(q, 20000);
  if (!json) return null;

  const index = new Map<string, number>();
  const pts: LatLng[] = [];
  const adj: { to: number; d: number }[][] = [];

  const nodeAt = (lat: number, lng: number) => {
    const k = key(lat, lng);
    let i = index.get(k);
    if (i === undefined) {
      i = pts.length;
      index.set(k, i);
      pts.push({ lat, lng });
      adj.push([]);
    }
    return i;
  };

  for (const w of json.elements ?? []) {
    const geom = w.geometry;
    if (!Array.isArray(geom) || geom.length < 2) continue;
    for (let i = 1; i < geom.length; i++) {
      const a = nodeAt(geom[i - 1].lat, geom[i - 1].lon);
      const b = nodeAt(geom[i].lat, geom[i].lon);
      if (a === b) continue;
      const d = metres(pts[a], pts[b]);
      adj[a].push({ to: b, d });
      adj[b].push({ to: a, d });
    }
  }

  // Un réseau trop maigre est pire que pas de réseau : on préfère le repli.
  return pts.length >= 200 ? { pts, adj } : null;
}

const nearest = (g: Graph, p: LatLng) => {
  let best = -1;
  let bd = Infinity;
  for (let i = 0; i < g.pts.length; i++) {
    const d = (g.pts[i].lat - p.lat) ** 2 + (g.pts[i].lng - p.lng) ** 2;
    if (d < bd) { bd = d; best = i; }
  }
  return best;
};

/** Dijkstra depuis une source, tas binaire pour rester rapide sur ~10 000 nœuds. */
function dijkstra(g: Graph, from: number): Float64Array {
  const dist = new Float64Array(g.pts.length).fill(Infinity);
  dist[from] = 0;
  const heap: number[] = [from];
  const hd: number[] = [0];

  const swap = (i: number, j: number) => {
    [heap[i], heap[j]] = [heap[j], heap[i]];
    [hd[i], hd[j]] = [hd[j], hd[i]];
  };
  const up = (i: number) => { while (i > 0) { const p = (i - 1) >> 1; if (hd[p] <= hd[i]) break; swap(p, i); i = p; } };
  const down = (i: number) => {
    for (;;) {
      const l = 2 * i + 1, r = l + 1;
      let m = i;
      if (l < hd.length && hd[l] < hd[m]) m = l;
      if (r < hd.length && hd[r] < hd[m]) m = r;
      if (m === i) break;
      swap(m, i); i = m;
    }
  };

  while (heap.length) {
    const u = heap[0], du = hd[0];
    swap(0, heap.length - 1); heap.pop(); hd.pop(); down(0);
    if (du > dist[u]) continue;
    for (const e of g.adj[u]) {
      const nd = du + e.d;
      if (nd < dist[e.to]) {
        dist[e.to] = nd;
        heap.push(e.to); hd.push(nd); up(heap.length - 1);
      }
    }
  }
  return dist;
}

export type WalkMatrix = { m: Record<number, Record<number, number>>; ok: boolean };

/** Clé de l'entrée du parc dans la matrice. Les autres clés sont les `id` d'attraction. */
export const ENTRANCE_KEY = 0;

/**
 * Distances réelles à pied entre l'entrée et toutes les attractions.
 * Trente-sept Dijkstra sur un graphe de quelques milliers de nœuds : quelques
 * centaines de millisecondes, calculé une fois au chargement.
 */
export function buildWalkMatrix(g: Graph | null, pos: (r: Ride) => LatLng): WalkMatrix {
  const m: Record<number, Record<number, number>> = {};
  const nodes: { k: number; p: LatLng }[] = [
    { k: ENTRANCE_KEY, p: ENTRANCE },
    ...RIDES.map((r) => ({ k: r.id, p: pos(r) }))
  ];

  if (!g) {
    for (const a of nodes) {
      m[a.k] = {};
      for (const b of nodes) m[a.k][b.k] = metres(a.p, b.p) * 1.35;
    }
    return { m, ok: false };
  }

  const snapped = nodes.map((n) => ({ ...n, i: nearest(g, n.p) }));
  for (const a of snapped) {
    const dist = dijkstra(g, a.i);
    m[a.k] = {};
    for (const b of snapped) {
      const d = dist[b.i];
      // Un couple non relié dans le graphe retombe sur l'estimation à vol d'oiseau.
      m[a.k][b.k] = Number.isFinite(d) ? d : metres(a.p, b.p) * 1.35;
    }
  }
  return { m, ok: true };
}

export const walkFromMatrix = (w: WalkMatrix, from: number, to: number, kmh: number) =>
  Math.max(2, Math.round((w.m[from]?.[to] ?? 0) / ((kmh * 1000) / 60)));
