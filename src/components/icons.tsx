/**
 * Le joker Green Card était figuré par un trèfle : mauvais signe, mauvaise
 * lecture. Un coupe-file se comprend mieux par un billet à encoches.
 */
export const Pass = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M3 7.5A1.5 1.5 0 0 1 4.5 6h15A1.5 1.5 0 0 1 21 7.5v2a2.5 2.5 0 0 0 0 5v2a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 16.5v-2a2.5 2.5 0 0 0 0-5v-2z" />
    <path d="M14 7v1.6M14 11.2v1.6M14 15.4V17" stroke="var(--surface, #fff)" strokeWidth="1.7" strokeLinecap="round" fill="none" />
  </svg>
);

export const Check = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12l6 6L20 5" /></svg>
);

export const Star = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M12 2.6l2.9 5.9 6.5.9-4.7 4.6 1.1 6.4-5.8-3-5.8 3 1.1-6.4L2.6 9.4l6.5-.9z" />
  </svg>
);

const stroke = {
  fill: "none", stroke: "currentColor", strokeWidth: 2,
  strokeLinecap: "round" as const, strokeLinejoin: "round" as const
};

export const Lock = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" style={{ width: 20, height: 20, ...stroke }}>
    <rect x="4" y="10" width="16" height="10" rx="2.5" />
    <path d="M8 10V7a4 4 0 0 1 8 0v3" />
  </svg>
);

export const Chevron = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className="chev" style={{ width: 20, height: 20, ...stroke }}>
    <path d="M6 9l6 6 6-6" />
  </svg>
);
