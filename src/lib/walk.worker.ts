/**
 * Calcul des temps de marche, hors du fil principal.
 *
 * Trente-sept Dijkstra sur un graphe de 7 500 nœuds tenaient quelques centaines de
 * millisecondes sur un ordinateur, mais bloquaient l'interface le temps du calcul sur
 * un téléphone — et le GPS en redemande un à chaque déplacement notable. Le worker
 * rend ce coût invisible.
 */
import { buildMatrix, graphFromWays, pathBetween, rowFrom, type Graph, type LatLng, type Matrix, type Node, type Ways } from "./walkgraph";

type In =
  | { type: "init"; ways: Ways; nodes: Node[] }
  | { type: "me"; lat: number; lng: number; nodes: Node[] }
  | { type: "route"; pts: LatLng[] };

export type WalkOut =
  | { type: "matrix"; m: Matrix; ok: boolean }
  | { type: "row"; row: Record<number, number> }
  | { type: "path"; legs: LatLng[][] };

let graph: Graph | null = null;

self.onmessage = (e: MessageEvent<In>) => {
  const msg = e.data;

  if (msg.type === "init") {
    graph = graphFromWays(msg.ways);
    const out: WalkOut = { type: "matrix", m: buildMatrix(graph, msg.nodes), ok: !!graph };
    self.postMessage(out);
    return;
  }

  if (msg.type === "me") {
    const out: WalkOut = { type: "row", row: rowFrom(graph, { lat: msg.lat, lng: msg.lng }, msg.nodes) };
    self.postMessage(out);
    return;
  }

  if (msg.type === "route") {
    const legs: LatLng[][] = [];
    for (let i = 1; i < msg.pts.length; i++) legs.push(pathBetween(graph, msg.pts[i - 1], msg.pts[i]));
    const out: WalkOut = { type: "path", legs };
    self.postMessage(out);
  }
};
