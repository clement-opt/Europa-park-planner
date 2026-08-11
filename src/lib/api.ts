import { RIDES, SNAPSHOT } from "../data/rides";

export type RideState = { wait: number; open: boolean };
export type Snapshot = {
  at: number;                          // horodatage du relevé
  source: "live" | "snapshot";
  rides: Record<number, RideState>;    // attente par attraction
  vl: Record<number, boolean>;         // file virtuelle ouverte, par identifiant vlId
};

const API = "https://queue-times.com/parks/51/queue_times.json";

/**
 * queue-times.com ne renvoie pas d'en-tête Access-Control-Allow-Origin.
 * On passe donc par un relais. Le premier de la liste est le vôtre si vous
 * en avez déployé un (voir worker/queue-proxy.js), sinon on tente les publics.
 */
const PUBLIC_RELAYS = [
  (u: string) => `https://corsproxy.io/?url=${encodeURIComponent(u)}`,
  (u: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
  (u: string) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(u)}`,
  (u: string) => u
];

const isVirtualLine = (name: string) => /virtualline/i.test(name);

export async function fetchWaits(customRelay?: string): Promise<Snapshot> {
  const chain = customRelay
    ? [(u: string) => customRelay + encodeURIComponent(u), ...PUBLIC_RELAYS]
    : PUBLIC_RELAYS;

  for (const make of chain) {
    try {
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), 8000);
      const res = await fetch(make(API), { signal: ctl.signal });
      clearTimeout(timer);
      if (!res.ok) continue;

      const json: any = await res.json();
      const rides: Record<number, RideState> = {};
      const vl: Record<number, boolean> = {};

      const take = (r: any) => {
        if (isVirtualLine(String(r.name ?? ""))) vl[r.id] = !!r.is_open;
        else rides[r.id] = { wait: r.wait_time ?? 0, open: r.is_open !== false };
      };
      (json.lands ?? []).forEach((l: any) => (l.rides ?? []).forEach(take));
      (json.rides ?? []).forEach(take);

      if (!Object.keys(rides).length) continue;
      return { at: Date.now(), source: "live", rides, vl };
    } catch {
      /* relais suivant */
    }
  }

  const rides: Record<number, RideState> = {};
  RIDES.forEach((r) => {
    const w = SNAPSHOT[r.id] ?? 0;
    rides[r.id] = { wait: w, open: w > 0 };
  });
  return { at: Date.now(), source: "snapshot", rides, vl: {} };
}
