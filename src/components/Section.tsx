import type { ReactNode } from "react";
import { Chevron } from "./icons";

/**
 * Bloc repliable. Bâti sur <details>, donc pliable au clavier et lisible par les
 * lecteurs d'écran sans code supplémentaire.
 *
 * Tout était déplié : 36 attractions plus quatre panneaux de réglages, on scrollait
 * une page entière avant d'atteindre le bouton de calcul. Ici on ne déplie que ce
 * qu'on regarde.
 */
export default function Section({
  title, badge, children, open, onToggle, tint, className
}: {
  title: ReactNode;
  badge?: ReactNode;
  children: ReactNode;
  open?: boolean;
  onToggle?: (open: boolean) => void;
  tint?: number;
  className?: string;
}) {
  return (
    <details className={"sect " + (className ?? "")} open={open}
      onToggle={(e) => onToggle?.((e.currentTarget as HTMLDetailsElement).open)}
      style={tint !== undefined ? ({ ["--zh" as string]: tint }) : undefined}>
      <summary>
        <span className="t">{title}</span>
        {badge !== undefined && <em>{badge}</em>}
        <Chevron />
      </summary>
      <div className="inner">{children}</div>
    </details>
  );
}
