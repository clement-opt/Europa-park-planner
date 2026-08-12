import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { ENTRANCE, RIDES, type Ride } from "../data/rides";
import type { LatLng } from "../lib/geo";
import type { Step } from "../lib/planner";

type Layer = "sat" | "plan" | "dark";

/**
 * `maxNative` est la profondeur réellement servie par le fournisseur ; au-delà,
 * Leaflet agrandit la dernière tuile au lieu d'en demander une qui n'existe pas.
 * Sans ça, le satellite renvoyait des tuiles manquantes en zoom rapproché — c'est
 * ce qui donnait ces trous gris dans le parc.
 */
const TILES: Record<Layer, { url: string; attr: string; max: number; maxNative: number }> = {
  sat: {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attr: "Imagerie Esri, Maxar, Earthstar Geographics",
    max: 21, maxNative: 19
  },
  plan: {
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attr: "© OpenStreetMap",
    max: 20, maxNative: 19
  },
  dark: {
    url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    attr: "© OpenStreetMap, © CARTO",
    max: 21, maxNative: 20
  }
};

const colorFor = (wait: number) =>
  wait < 0 ? "#697380" : wait < 20 ? "#16a06a" : wait <= 45 ? "#d59320" : "#dd4c43";

export default function ParkMap(props: {
  waits: Record<number, number>;
  positions: (r: Ride) => LatLng;
  selected: Set<number>;
  gc: Set<number>;
  done: Set<number>;
  steps: Step[];
  onPick: (id: number) => void;
  active: boolean;
  me: LatLng | null;
  legs: LatLng[][];
  /** Le graphe des allées est chargé : le tracé dit vrai. */
  real: boolean;
  /** Demande de recentrage : on incrémente pour recentrer, même position inchangée. */
  recentrer?: number;
  /** Le bouton de la carte allume le GPS quand il est éteint. */
  onLocaliser?: () => void;
  geoActif?: boolean;
}) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const tiles = useRef<L.TileLayer | null>(null);
  const layerGroup = useRef<L.LayerGroup | null>(null);
  const [layer, setLayer] = useState<Layer>("sat");

  useEffect(() => {
    if (!box.current || map.current) return;
    const m = L.map(box.current, { zoomControl: false, attributionControl: true })
      .setView([48.2655, 7.7215], 16);
    L.control.zoom({ position: "bottomright" }).addTo(m);
    layerGroup.current = L.layerGroup().addTo(m);
    map.current = m;
    setTimeout(() => m.invalidateSize(), 120);
    return () => { m.remove(); map.current = null; };
  }, []);

  /**
   * Leaflet mesure son conteneur au montage. Quand l'onglet est masqué en CSS,
   * cette mesure vaut zéro et la carte reste grise jusqu'à un redimensionnement.
   * On la force à se remesurer à chaque fois que l'onglet redevient visible.
   */
  useEffect(() => {
    if (!props.active) return;
    const m = map.current;
    if (!m) return;
    const t = setTimeout(() => m.invalidateSize(), 60);
    return () => clearTimeout(t);
  }, [props.active]);

  /**
   * Recentrage sur soi. « Me localiser » allumait le GPS et posait un point sur la
   * carte, mais laissait la vue où elle était : on cherchait son propre point à la
   * main. Le compteur permet de redemander un recentrage alors que la position, elle,
   * n'a pas bougé d'un mètre.
   */
  useEffect(() => {
    const m = map.current;
    if (!m || !props.me || !props.recentrer) return;
    m.setView([props.me.lat, props.me.lng], Math.max(m.getZoom(), 17), { animate: true });
  }, [props.recentrer, props.me]);

  useEffect(() => {
    const m = map.current;
    if (!m) return;
    if (tiles.current) tiles.current.remove();
    const t = TILES[layer];
    tiles.current = L.tileLayer(t.url, {
      attribution: t.attr, maxZoom: t.max, maxNativeZoom: t.maxNative, detectRetina: true
    }).addTo(m);
    tiles.current.bringToBack();
    // Le fond est assombri et désaturé pour que les pastilles et le tracé ressortent :
    // sur une image satellite brute, un point vert se perd dans les arbres.
    box.current?.setAttribute("data-layer", layer);
  }, [layer]);

  useEffect(() => {
    const g = layerGroup.current;
    if (!g) return;
    g.clearLayers();

    const order = new Map<number, number>();
    const routed = props.steps.filter((s): s is Extract<Step, { kind: "ride" }> => s.kind === "ride" && !props.done.has(s.ride.id));
    routed.forEach((s, i) => order.set(s.ride.id, i + 1));

    // Le tracé suit les allées quand le graphe a répondu ; sinon on relie les
    // étapes en droite, en le montrant par un pointillé plus lâche.
    //
    // La distinction repose sur `real`, pas sur la présence de segments : avant
    // l'arrivée du réseau, le worker renvoie bien des segments, mais tous droits.
    // S'appuyer sur leur nombre faisait afficher « tracé sur les allées » à tort.
    const suitLesAllees = props.real && props.legs.length > 0;
    const traces: L.LatLngExpression[][] = suitLesAllees
      ? props.legs.map((leg) => leg.map((p) => [p.lat, p.lng] as L.LatLngExpression))
      : routed.length
        ? [[[ENTRANCE.lat, ENTRANCE.lng], ...routed.map((s) => [s.pos.lat, s.pos.lng] as L.LatLngExpression)]]
        : [];

    for (const t of traces) {
      L.polyline(t, { color: "#0E2438", weight: 11, opacity: .3, lineCap: "round", lineJoin: "round" }).addTo(g);
      L.polyline(t, { color: "#5FA8DC", weight: 5, opacity: .98, lineCap: "round", lineJoin: "round",
        dashArray: suitLesAllees ? undefined : "10 9" }).addTo(g);
    }

    if (props.me) {
      // Halo puis pastille : on distingue la position du groupe des attractions.
      L.circleMarker([props.me.lat, props.me.lng], {
        radius: 16, color: "#2E7CB6", weight: 2, opacity: .45, fillColor: "#2E7CB6", fillOpacity: .16
      }).addTo(g);
      L.marker([props.me.lat, props.me.lng], {
        icon: L.divIcon({
          className: "",
          html: `<div class="pinmark me" style="width:20px;height:20px;background:#2E7CB6"></div>`,
          iconSize: [20, 20], iconAnchor: [10, 10]
        }), zIndexOffset: 900
      }).bindTooltip("Vous êtes ici").addTo(g);
    }

    L.marker([ENTRANCE.lat, ENTRANCE.lng], {
      icon: L.divIcon({
        className: "",
        html: `<div class="pinmark" style="width:20px;height:20px;background:#1E3A6B;border-radius:6px">E</div>`,
        iconSize: [20, 20], iconAnchor: [10, 10]
      })
    }).bindTooltip("Entrée du parc").addTo(g);

    for (const r of RIDES) {
      const w = props.waits[r.id] ?? -1;
      const num = order.get(r.id);
      const size = num ? 26 : props.selected.has(r.id) ? 18 : 13;
      const cls = [
        "pinmark",
        num ? "big" : "",
        props.gc.has(r.id) ? "gc" : "",
        props.done.has(r.id) ? "ticked" : ""
      ].filter(Boolean).join(" ");
      const p = props.positions(r);
      L.marker([p.lat, p.lng], {
        icon: L.divIcon({
          className: "",
          html: `<div class="${cls}" style="width:${size}px;height:${size}px;background:${colorFor(w)}">${num ?? ""}</div>`,
          iconSize: [size, size], iconAnchor: [size / 2, size / 2]
        })
      })
        .bindTooltip(`${r.n} · ${w < 0 ? "fermé" : w + " min"}`, { direction: "top" })
        .on("click", () => props.onPick(r.id))
        .addTo(g);
    }
  }, [props.waits, props.selected, props.gc, props.done, props.steps, props.positions, props.me, props.legs, props.real]);

  return (
    <div className="mapwrap">
      <div ref={box} className="leafmap" />
      <div className={"tracehint " + (props.real ? "vrai" : "approx")}>
        {props.real ? "Tracé sur les allées" : "Tracé approximatif"}
      </div>
      <button className={"mapme" + (props.geoActif ? " on" : "")} onClick={props.onLocaliser}
        aria-label={props.geoActif ? "Recentrer sur ma position" : "Me localiser dans le parc"}
        title={props.geoActif ? "Recentrer sur ma position" : "Me localiser dans le parc"}>
        <span aria-hidden="true">◎</span>
      </button>

      <div className="layers">
        {(["sat", "plan", "dark"] as Layer[]).map((l) => (
          <button key={l} aria-pressed={layer === l} onClick={() => setLayer(l)}>
            {l === "sat" ? "Satellite" : l === "plan" ? "Plan" : "Sombre"}
          </button>
        ))}
      </div>
    </div>
  );
}
