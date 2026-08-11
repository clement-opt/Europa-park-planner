import { BBOX, RIDES, type Ride } from "../data/rides";

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
  s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9 ]/g, " ");

/**
 * Récupère les positions réelles des attractions depuis OpenStreetMap.
 * Overpass est gratuit, sans clé, et autorise les appels navigateur.
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

  const endpoints = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter"
  ];

  for (const url of endpoints) {
    try {
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), 12000);
      const res = await fetch(url, { method: "POST", body: "data=" + encodeURIComponent(q), signal: ctl.signal });
      clearTimeout(timer);
      if (!res.ok) continue;
      const json: any = await res.json();

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
      if (Object.keys(out).length >= 8) return out;
    } catch {
      /* endpoint suivant */
    }
  }
  return {};
}
