/**
 * Graphe piéton et plus courts chemins, sans aucune dépendance au parc.
 *
 * Ce module est partagé tel quel entre le fil principal et le Web Worker : il ne
 * connaît ni les attractions ni l'entrée, seulement des points et des chemins. C'est
 * ce qui permet de le charger dans le worker sans y embarquer le référentiel.
 */

export type LatLng = { lat: number; lng: number };

/** Un chemin = une liste de [lat, lng]. Format partagé avec le serveur. */
export type Ways = [number, number][][];

export type Graph = { pts: LatLng[]; adj: { to: number; d: number }[][] };

/** Un point nommé à relier aux autres : l'entrée, une attraction, votre position. */
export type Node = { k: number; p: LatLng };

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

/** Estimation de repli : vol d'oiseau majoré de 35 % pour les détours d'allées. */
export const straight = (a: LatLng, b: LatLng) => metres(a, b) * 1.35;

export function graphFromWays(ways: Ways): Graph | null {
  const index = new Map<string, number>();
  const pts: LatLng[] = [];
  const adj: { to: number; d: number }[][] = [];

  const nodeAt = (lat: number, lng: number) => {
    // 1e-5 degré ≈ 1 m : deux points d'allées à moins d'un mètre sont le même carrefour.
    const k = `${lat.toFixed(5)},${lng.toFixed(5)}`;
    let i = index.get(k);
    if (i === undefined) {
      i = pts.length;
      index.set(k, i);
      pts.push({ lat, lng });
      adj.push([]);
    }
    return i;
  };

  for (const w of ways) {
    if (!Array.isArray(w) || w.length < 2) continue;
    for (let i = 1; i < w.length; i++) {
      const a = nodeAt(Number(w[i - 1][0]), Number(w[i - 1][1]));
      const b = nodeAt(Number(w[i][0]), Number(w[i][1]));
      if (a === b) continue;
      const d = metres(pts[a], pts[b]);
      adj[a].push({ to: b, d });
      adj[b].push({ to: a, d });
    }
  }
  // Un réseau trop maigre est pire que pas de réseau : on préfère le repli.
  return pts.length >= 200 ? { pts, adj } : null;
}

export function nearest(g: Graph, p: LatLng): number {
  let best = -1;
  let bd = Infinity;
  for (let i = 0; i < g.pts.length; i++) {
    const d = (g.pts[i].lat - p.lat) ** 2 + (g.pts[i].lng - p.lng) ** 2;
    if (d < bd) { bd = d; best = i; }
  }
  return best;
}

/** Dijkstra depuis une source, tas binaire pour tenir sur ~10 000 nœuds. */
export function dijkstra(g: Graph, from: number): Float64Array {
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

export type Matrix = Record<number, Record<number, number>>;

/** Distances réelles entre tous les points nommés. Un Dijkstra par point. */
export function buildMatrix(g: Graph | null, nodes: Node[]): Matrix {
  const m: Matrix = {};
  if (!g) {
    for (const a of nodes) {
      m[a.k] = {};
      for (const b of nodes) m[a.k][b.k] = straight(a.p, b.p);
    }
    return m;
  }
  const snap = nodes.map((n) => ({ ...n, i: nearest(g, n.p) }));
  for (const a of snap) {
    const dist = dijkstra(g, a.i);
    m[a.k] = {};
    for (const b of snap) {
      const d = dist[b.i];
      // Un couple non relié dans le graphe retombe sur l'estimation à vol d'oiseau.
      m[a.k][b.k] = Number.isFinite(d) ? d : straight(a.p, b.p);
    }
  }
  return m;
}

/** Une seule ligne : distances depuis un point quelconque vers tous les autres. */
export function rowFrom(g: Graph | null, p: LatLng, nodes: Node[]): Record<number, number> {
  const row: Record<number, number> = {};
  if (!g) {
    for (const n of nodes) row[n.k] = straight(p, n.p);
    return row;
  }
  const dist = dijkstra(g, nearest(g, p));
  for (const n of nodes) {
    const d = dist[nearest(g, n.p)];
    row[n.k] = Number.isFinite(d) ? d : straight(p, n.p);
  }
  return row;
}
