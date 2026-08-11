import { useEffect, useState, type ReactNode } from "react";

/**
 * Une action irréversible demande deux gestes : le premier arme le bouton, le second
 * exécute. L'armement retombe seul au bout de cinq secondes — on ne laisse pas un
 * bouton dangereux amorcé dans une feuille de réglages qu'on rouvrira plus tard, et
 * dans le parc on tape vite sur un écran qu'on regarde à peine.
 *
 * Deux gestes plutôt qu'un `confirm()` : la boîte native se place hors de la page,
 * bloque le rendu, et sur iOS en mode autonome elle apparaît sans le contexte de ce
 * qu'on s'apprête à perdre. Ici la question est écrite sur le bouton lui-même.
 */
export default function BoutonDanger({ label, confirmation, onConfirm, className = "ghost", title }: {
  label: ReactNode;
  confirmation: ReactNode;
  onConfirm: () => void;
  className?: string;
  title?: string;
}) {
  const [arme, setArme] = useState(false);

  useEffect(() => {
    if (!arme) return;
    const t = window.setTimeout(() => setArme(false), 5000);
    return () => window.clearTimeout(t);
  }, [arme]);

  return (
    <button
      className={arme ? `${className} arme` : className}
      title={title}
      onClick={() => { if (!arme) return setArme(true); setArme(false); onConfirm(); }}
    >
      {arme ? confirmation : label}
    </button>
  );
}
