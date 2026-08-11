import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { ENTRANCE, RIDES, type Ride } from "../data/rides";
import type { LatLng } from "../lib/geo";
import type { Step } from "../lib/planner";

type Layer = "sat" | "plan" | "dark";

const TILES: Record<Layer, { url: string; attr: string; max: number }> = {
  sat: {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attr: "Imagerie Esri, Maxar, Earthstar Geographics",
    max: 19
  },
  plan: {
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attr: "© OpenStreetMap",
    max: 19
  },
  dark: {
    url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    attr: "© OpenStreetMap, © CARTO",
    max: 20
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
  onToggle: (id: number) => void;
  active: boolean;
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

  useEffect(() => {
    const m = map.current;
    if (!m) return;
    if (tiles.current) tiles.current.remove();
    const t = TILES[layer];
    tiles.current = L.tileLayer(t.url, { attribution: t.attr, maxZoom: t.max }).addTo(m);
    tiles.current.bringToBack();
  }, [layer]);

  useEffect(() => {
    const g = layerGroup.current;
    if (!g) return;
    g.clearLayers();

    const order = new Map<number, number>();
    const routed = props.steps.filter((s): s is Extract<Step, { kind: "ride" }> => s.kind === "ride" && !props.done.has(s.ride.id));
    routed.forEach((s, i) => order.set(s.ride.id, i + 1));

    if (routed.length) {
      const pts: L.LatLngExpression[] = [
        [ENTRANCE.lat, ENTRANCE.lng],
        ...routed.map((s) => [s.pos.lat, s.pos.lng] as L.LatLngExpression)
      ];
      L.polyline(pts, { color: "#4d87e0", weight: 4, opacity: .95, dashArray: "9 8", lineCap: "round" }).addTo(g);
      L.polyline(pts, { color: "#4d87e0", weight: 12, opacity: .16, lineCap: "round" }).addTo(g);
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
        .on("click", () => props.onToggle(r.id))
        .addTo(g);
    }
  }, [props.waits, props.selected, props.gc, props.done, props.steps, props.positions]);

  return (
    <div className="mapwrap">
      <div ref={box} className="leafmap" />
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
