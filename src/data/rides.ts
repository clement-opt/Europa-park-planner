export type Ride = {
  id: number;          // identifiant queue-times.com (park 51)
  n: string;           // nom affiché
  z: string;           // quartier
  lat: number;         // position de repli, posée à la main
  lng: number;
  dur: number;         // tour + embarquement, en minutes
  thr: 0 | 1 | 2 | 3 | 4 | 5;  // intensité
  nau: 0 | 1 | 2 | 3 | 4 | 5;  // brassage / mal au coeur
  vlId?: number;       // identifiant de la file virtuelle chez queue-times
  vl?: boolean;        // VirtualLine annoncée par le parc
  kid?: boolean;
  k: string;           // clé de rapprochement avec OpenStreetMap
};

/** Entrée principale du parc. */
export const ENTRANCE = { lat: 48.2618, lng: 7.7207 };

/** Zone de recherche OpenStreetMap. */
export const BBOX = { s: 48.2575, w: 7.7095, n: 48.2725, e: 7.7335 };

/**
 * VirtualLine : 7 attractions annoncées par le parc (relevé du 11/08/2026).
 * queue-times n'expose que 3 files virtuelles nommées, renseignées dans vlId.
 */
export const RIDES: Ride[] = [
  { id: 5604, n: "Silver Star", z: "France", lat: 48.2612, lng: 7.7175, dur: 5, thr: 5, nau: 2, k: "silver star" },
  { id: 5737, n: "Eurosat CanCan Coaster", z: "France", lat: 48.2634, lng: 7.7191, dur: 5, thr: 4, nau: 4, k: "eurosat" },
  { id: 5619, n: "Euro-Tower", z: "France", lat: 48.264, lng: 7.7203, dur: 10, thr: 1, nau: 0, k: "euro-tower" },
  { id: 5738, n: "Madame Freudenreich", z: "France", lat: 48.263, lng: 7.7183, dur: 8, thr: 0, nau: 0, k: "freudenreich" },
  { id: 6280, n: "Eurosat Coastiality (VR)", z: "France", lat: 48.2636, lng: 7.7195, dur: 5, thr: 3, nau: 5, k: "coastiality" },
  { id: 5603, n: "blue fire Megacoaster", z: "Islande", lat: 48.2678, lng: 7.7203, dur: 5, thr: 5, nau: 4, vl: true, k: "blue fire" },
  { id: 5602, n: "WODAN Timburcoaster", z: "Islande", lat: 48.2673, lng: 7.7213, dur: 4, thr: 5, nau: 3, vl: true, k: "wodan" },
  { id: 5614, n: "Whale Adventures", z: "Islande", lat: 48.2682, lng: 7.7196, dur: 6, thr: 1, nau: 0, k: "whale" },
  { id: 13349, n: "Voltron Nevera", z: "Croatie", lat: 48.2688, lng: 7.7253, dur: 5, thr: 5, nau: 4, vl: true, vlId: 13504, k: "voltron" },
  { id: 5611, n: "Poseidon", z: "Grèce", lat: 48.2665, lng: 7.7178, dur: 6, thr: 4, nau: 1, vl: true, vlId: 11754, k: "poseidon" },
  { id: 5608, n: "Pegasus", z: "Grèce", lat: 48.2669, lng: 7.7186, dur: 4, thr: 3, nau: 2, k: "pegasus" },
  { id: 5615, n: "Atlantis Adventure", z: "Grèce", lat: 48.2662, lng: 7.7172, dur: 7, thr: 2, nau: 2, k: "atlantis" },
  { id: 5630, n: "Voletarium", z: "Allemagne", lat: 48.2645, lng: 7.7222, dur: 12, thr: 1, nau: 1, vl: true, vlId: 11753, k: "voletarium" },
  { id: 5631, n: "Jim Button", z: "Allemagne", lat: 48.2639, lng: 7.7228, dur: 8, thr: 0, nau: 0, k: "jim knopf" },
  { id: 5605, n: "Euro-Mir", z: "Russie", lat: 48.2668, lng: 7.7232, dur: 6, thr: 4, nau: 5, vl: true, k: "euro-mir" },
  { id: 5607, n: "Matterhorn-Blitz", z: "Suisse", lat: 48.265, lng: 7.724, dur: 4, thr: 4, nau: 5, k: "matterhorn" },
  { id: 5613, n: "Swiss Bob Run", z: "Suisse", lat: 48.2645, lng: 7.7234, dur: 4, thr: 3, nau: 3, k: "schweizer bobbahn" },
  { id: 5610, n: "Atlantica SuperSplash", z: "Portugal", lat: 48.2653, lng: 7.7174, dur: 6, thr: 3, nau: 1, k: "atlantica" },
  { id: 5612, n: "Fjord-Rafting", z: "Scandinavie", lat: 48.2684, lng: 7.7226, dur: 8, thr: 3, nau: 3, k: "fjord" },
  { id: 5628, n: "Vindjammer", z: "Scandinavie", lat: 48.2687, lng: 7.7233, dur: 4, thr: 3, nau: 4, k: "vindjammer" },
  { id: 7301, n: "Snorri Touren", z: "Scandinavie", lat: 48.2689, lng: 7.722, dur: 6, thr: 0, nau: 0, kid: true, k: "snorri" },
  { id: 5609, n: "Tirol Log Flume", z: "Autriche", lat: 48.2658, lng: 7.725, dur: 7, thr: 2, nau: 1, k: "tiroler wildwasser" },
  { id: 5606, n: "Alpine Express Enzian", z: "Autriche", lat: 48.2662, lng: 7.7256, dur: 4, thr: 2, nau: 1, k: "alpenexpress" },
  { id: 5629, n: "Vienna Wave Swing", z: "Autriche", lat: 48.2656, lng: 7.7245, dur: 4, thr: 2, nau: 3, k: "glückspilz" },
  { id: 5624, n: "Josefina's Magical Journey", z: "Autriche", lat: 48.2653, lng: 7.7256, dur: 7, thr: 0, nau: 0, k: "josefina" },
  { id: 5618, n: "ARTHUR", z: "Minimoys", lat: 48.2673, lng: 7.7264, dur: 7, thr: 3, nau: 2, k: "arthur" },
  { id: 5627, n: "Poppy Towers", z: "Minimoys", lat: 48.2676, lng: 7.7268, dur: 4, thr: 2, nau: 1, k: "poppy" },
  { id: 5617, n: "Pirates in Batavia", z: "Pays-Bas", lat: 48.2658, lng: 7.7202, dur: 10, thr: 0, nau: 0, vl: true, k: "piraten" },
  { id: 5621, n: "Arena of Football", z: "Angleterre", lat: 48.265, lng: 7.7211, dur: 8, thr: 1, nau: 0, k: "arena of football" },
  { id: 5616, n: "Castello dei Medici", z: "Italie", lat: 48.2645, lng: 7.7186, dur: 7, thr: 1, nau: 0, k: "castello" },
  { id: 5620, n: "Volo da Vinci", z: "Italie", lat: 48.2648, lng: 7.718, dur: 5, thr: 2, nau: 4, k: "volo da vinci" },
  { id: 14534, n: "Grand Prix EDventure", z: "Luxembourg", lat: 48.264, lng: 7.722, dur: 6, thr: 2, nau: 0, k: "grand prix" },
  { id: 5625, n: "Kolumbusjolle", z: "Espagne", lat: 48.2652, lng: 7.7166, dur: 4, thr: 1, nau: 2, k: "kolumbusjolle" },
  { id: 5622, n: "Ba-a-a Express", z: "Irlande", lat: 48.2668, lng: 7.7255, dur: 4, thr: 1, nau: 1, kid: true, k: "ba-a-a" },
  { id: 5623, n: "Dancing Dingie", z: "Irlande", lat: 48.267, lng: 7.725, dur: 3, thr: 2, nau: 5, k: "dingie" },
  { id: 5626, n: "Tractor Fun", z: "Irlande", lat: 48.2666, lng: 7.7259, dur: 4, thr: 0, nau: 0, kid: true, k: "traktor" }
];

export const BY_ID: Record<number, Ride> = Object.fromEntries(RIDES.map((r) => [r.id, r]));

/** Relevé de secours du 11/08/2026, utilisé si l'API reste injoignable. */
export const SNAPSHOT: Record<number, number> = {
  5606: 40, 5624: 5, 5609: 35, 5629: 5, 13349: 60, 5621: 5, 5619: 20, 5737: 55, 6280: 0,
  5738: 1, 5604: 40, 5631: 1, 5630: 50, 5615: 5, 5608: 35, 5611: 55, 5603: 50, 5614: 10,
  5602: 55, 5622: 5, 5623: 5, 5626: 5, 5616: 5, 5620: 30, 14534: 15, 5618: 40, 5627: 5,
  5617: 25, 5610: 45, 5605: 40, 5612: 40, 7301: 25, 5628: 5, 5625: 5, 5607: 55, 5613: 50
};
