import { useCallback, useEffect, useRef, useState } from "react";
import { ME_KEY, parkNodes, roughMatrix, type WalkMatrix } from "./geo";
import { buildMatrix, graphFromWays, rowFrom, type Graph, type LatLng, type Matrix, type Node, type Ways } from "./walkgraph";
import type { WalkOut } from "./walk.worker";
import type { Ride } from "../data/rides";

/**
 * Matrice des temps de marche, calculée dans un Web Worker.
 *
 * L'estimation à vol d'oiseau est posée immédiatement pour que l'app soit utilisable
 * sans attendre, puis remplacée par les distances réelles dès que le worker répond.
 * Si les Workers sont indisponibles, tout se fait sur le fil principal : c'est plus
 * lent, mais jamais cassé.
 */
export function useWalk(positions: (r: Ride) => LatLng) {
  const [walk, setWalk] = useState<WalkMatrix>(() => roughMatrix(parkNodes(positions)));
  const [ready, setReady] = useState(false);

  const worker = useRef<Worker | null>(null);
  const fallback = useRef<Graph | null>(null);
  const nodes = useRef<Node[]>(parkNodes(positions));
  const base = useRef<WalkMatrix | null>(null);

  useEffect(() => { nodes.current = parkNodes(positions); }, [positions]);

  useEffect(() => {
    try {
      worker.current = new Worker(new URL("./walk.worker.ts", import.meta.url), { type: "module" });
    } catch {
      worker.current = null; // navigateur sans Worker : on restera synchrone
    }

    const w = worker.current;
    if (!w) return;

    w.onmessage = (e: MessageEvent<WalkOut>) => {
      const msg = e.data;
      if (msg.type === "matrix") {
        const next = { m: msg.m, ok: msg.ok };
        base.current = next;
        setWalk(next);
        setReady(true);
      }
      if (msg.type === "row") {
        // On repart toujours de la matrice de base : sinon les lignes « moi »
        // successives s'empileraient et la matrice grossirait sans fin.
        const b = base.current;
        if (!b) return;
        const m: Matrix = { ...b.m, [ME_KEY]: { ...msg.row, [ME_KEY]: 0 } };
        for (const n of nodes.current) m[n.k] = { ...(m[n.k] ?? {}), [ME_KEY]: msg.row[n.k] };
        setWalk({ m, ok: b.ok });
      }
    };

    return () => { w.terminate(); worker.current = null; };
  }, []);

  /** Charge le réseau d'allées et lance le calcul complet. */
  const load = useCallback((ways: Ways | null) => {
    const ns = parkNodes(positions);
    nodes.current = ns;

    if (!ways) {
      const next = roughMatrix(ns);
      base.current = next;
      setWalk(next);
      setReady(true);
      return;
    }

    if (worker.current) {
      worker.current.postMessage({ type: "init", ways, nodes: ns });
      return;
    }

    fallback.current = graphFromWays(ways);
    const next = { m: buildMatrix(fallback.current, ns), ok: !!fallback.current };
    base.current = next;
    setWalk(next);
    setReady(true);
  }, [positions]);

  /** Ajoute la position réelle à la matrice. */
  const locate = useCallback((p: LatLng) => {
    const ns = nodes.current;
    if (worker.current) {
      worker.current.postMessage({ type: "me", lat: p.lat, lng: p.lng, nodes: ns });
      return;
    }
    const b = base.current;
    if (!b) return;
    const row = rowFrom(fallback.current, p, ns);
    const m: Matrix = { ...b.m, [ME_KEY]: { ...row, [ME_KEY]: 0 } };
    for (const n of ns) m[n.k] = { ...(m[n.k] ?? {}), [ME_KEY]: row[n.k] };
    setWalk({ m, ok: b.ok });
  }, []);

  return { walk, ready, load, locate, threaded: !!worker.current };
}
