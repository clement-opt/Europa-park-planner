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
 * Un plancher de 900 ms : sur une connexion rapide le bundle arrive avant que
 * l'œil ait vu quoi que ce soit, et un écran qui clignote fait plus brouillon
 * qu'un écran qui se pose.
 */
const boot = document.getElementById("boot");
if (boot) {
  const partir = () => {
    boot.classList.add("gone");
    setTimeout(() => boot.remove(), 600);
  };
  const debut = Number(boot.dataset.t ?? 0) || performance.now();
  setTimeout(partir, Math.max(0, 900 - (performance.now() - debut)));
}
