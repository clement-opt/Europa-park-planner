import { useCallback, useEffect, useRef, useState } from "react";
import { inPark, type LatLng } from "./geo";

export type Fix = { at: number; p: LatLng; acc: number };
export type GeoState = "off" | "asking" | "on" | "denied" | "unavailable" | "outside";

/**
 * Suivi de la position dans le parc.
 *
 * La position ne quitte jamais l'appareil : elle n'est ni enregistrée, ni envoyée
 * dans l'état partagé du groupe. Elle sert uniquement à recalculer les temps de
 * marche depuis l'endroit où l'on se trouve vraiment.
 *
 * Le suivi est explicite, jamais automatique : un GPS qui tourne sans qu'on l'ait
 * demandé vide la batterie, et c'est la batterie qui fait tenir la journée.
 */
export function usePosition() {
  const [state, setState] = useState<GeoState>("off");
  const [fix, setFix] = useState<Fix | null>(null);
  const watch = useRef<number | null>(null);

  const stop = useCallback(() => {
    if (watch.current !== null) navigator.geolocation.clearWatch(watch.current);
    watch.current = null;
    setState("off");
    setFix(null);
  }, []);

  const start = useCallback(() => {
    if (!("geolocation" in navigator)) return setState("unavailable");
    if (watch.current !== null) return;
    setState("asking");

    watch.current = navigator.geolocation.watchPosition(
      (pos) => {
        const p = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        // Hors du parc, la position ne dit rien d'utile : on l'affiche mais on
        // n'en fait pas le point de départ du plan.
        setState(inPark(p) ? "on" : "outside");
        setFix({ at: pos.timestamp, p, acc: pos.coords.accuracy ?? 0 });
      },
      (err) => setState(err.code === err.PERMISSION_DENIED ? "denied" : "unavailable"),
      { enableHighAccuracy: true, maximumAge: 15000, timeout: 20000 }
    );
  }, []);

  const toggle = useCallback(() => (watch.current === null ? start() : stop()), [start, stop]);

  useEffect(() => () => { if (watch.current !== null) navigator.geolocation.clearWatch(watch.current); }, []);

  return { state, fix, start, stop, toggle, usable: state === "on" && !!fix };
}

export const geoLabel = (s: GeoState) =>
  s === "on" ? "suivi actif"
  : s === "asking" ? "recherche…"
  : s === "denied" ? "refusée"
  : s === "outside" ? "hors du parc"
  : s === "unavailable" ? "indisponible"
  : "coupée";
