import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

/**
 * Retrait de l'écran de lancement défini dans index.html.
 *
 * On laisse le wagon finir sa course : l'animation dure 2,3 s et s'arrête au bout
 * de la voie. Couper avant donnerait un train qui disparaît au milieu d'une côte.
 * Le compte part du chargement de la page, pas de l'exécution de ce fichier, donc
 * un bundle lent ne rallonge pas l'attente.
 */
const boot = document.getElementById("boot");
if (boot) {
  const RIDE_MS = 2300;
  const ecoule = performance.now();
  setTimeout(() => {
    boot.classList.add("gone");
    setTimeout(() => boot.remove(), 650);
  }, Math.max(200, RIDE_MS - ecoule));
}
