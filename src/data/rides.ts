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
  why: string;         // ce que c'est, en une phrase
  plus: string;        // le petit plus, ce qui fait qu'on y retourne
  wet?: boolean;       // on ressort mouillé : à placer aux heures chaudes
};

/** Étiquette lisible d'un coup d'œil. `ton` pilote la couleur. */
export type Tag = { l: string; ton: "fort" | "moyen" | "doux" | "eau" | "vl" | "kid" };

/**
 * Les étiquettes sont **déduites** des données existantes, jamais saisies à la main :
 * une attraction ne peut donc pas être classée « familiale » tout en portant une
 * intensité de 5. Le référentiel reste la seule source.
 */
export function tagsOf(r: Ride): Tag[] {
  const t: Tag[] = [];
  if (r.thr >= 4) t.push({ l: "Sensations fortes", ton: "fort" });
  else if (r.thr === 3) t.push({ l: "Sensations", ton: "moyen" });
  if (r.kid) t.push({ l: "Tout-petits", ton: "kid" });
  else if (r.thr <= 2 && r.nau <= 2) t.push({ l: "Familial", ton: "doux" });
  if (r.wet) t.push({ l: "Aquatique", ton: "eau" });
  if (r.nau >= 4) t.push({ l: "Brassage élevé", ton: "fort" });
  if (r.nau === 0 && r.thr <= 1) t.push({ l: "Calme", ton: "doux" });
  if (r.vl) t.push({ l: "VirtualLine", ton: "vl" });
  return t;
}

/** Entrée principale du parc. */
export const ENTRANCE = { lat: 48.2618, lng: 7.7207 };

/** Zone de recherche OpenStreetMap. */
export const BBOX = { s: 48.2575, w: 7.7095, n: 48.2725, e: 7.7335 };

/**
 * VirtualLine : 7 attractions annoncées par le parc (relevé du 11/08/2026).
 * queue-times n'expose que 3 files virtuelles nommées, renseignées dans vlId.
 */
export const RIDES: Ride[] = [
  { id: 5604, n: "Silver Star", z: "France", lat: 48.2612, lng: 7.7175, dur: 5, thr: 5, nau: 2, k: "silver star", why: "Le coup de canon du parc : 73 m, 130 km/h.", plus: "La première chute, plein sud, avec la plaine d'Alsace en grand écran." },
  { id: 5737, n: "Eurosat – CanCan Coaster", z: "France", lat: 48.2634, lng: 7.7191, dur: 5, thr: 4, nau: 4, k: "eurosat", why: "Montagnes russes lancées dans le dôme argenté.", plus: "Le tout dans le noir, sur fond de tableau de bord spatial revisité cancan." },
  { id: 5619, n: "Euro-Tower", z: "France", lat: 48.264, lng: 7.7203, dur: 10, thr: 1, nau: 0, k: "euro-tower", why: "Tour panoramique, montée douce à 75 m.", plus: "Le seul endroit d'où on comprend vraiment la géographie du parc. À faire tôt." },
  { id: 5738, n: "Madame Freudenreich Curiosités", z: "France", lat: 48.263, lng: 7.7183, dur: 8, thr: 0, nau: 0, k: "freudenreich", why: "Parcours scénique loufoque chez les dinosaures gourmands.", plus: "Le second degré assumé, un régal pour les yeux quand on prend le temps." },
  { id: 6280, n: "Eurosat Coastiality", z: "France", lat: 48.2636, lng: 7.7195, dur: 5, thr: 3, nau: 5, k: "coastiality", why: "Le même coaster, mais casque de réalité virtuelle sur la tête.", plus: "Sensations décuplées, estomac prévenu : c'est le brassage maximum du parc." },
  { id: 5603, n: "blue fire Megacoaster", z: "Islande", lat: 48.2678, lng: 7.7203, dur: 5, thr: 5, nau: 4, vl: true, k: "blue fire", why: "Lancement de 0 à 100 km/h en 2,5 secondes, puis looping.", plus: "Le départ à l'accélération, sans crémaillère, qui plaque au siège." },
  { id: 5602, n: "WODAN – Timburcoaster", z: "Islande", lat: 48.2673, lng: 7.7213, dur: 4, thr: 5, nau: 3, vl: true, k: "wodan", why: "Montagnes russes en bois, tout en secousses sèches.", plus: "Le bruit de la structure et les airtimes : le charme du bois, brut de décoffrage." },
  { id: 5614, n: "Whale Adventures – Northern Lights", z: "Islande", lat: 48.2682, lng: 7.7196, dur: 6, thr: 1, nau: 0, k: "whale", why: "Balade aquatique sur le thème des baleines, très douce.", plus: "Le refuge parfait quand le compteur de brassage est dans le rouge." },
  { id: 13349, n: "Voltron Nevera powered by Rimac", z: "Croatie", lat: 48.2688, lng: 7.7253, dur: 5, thr: 5, nau: 4, vl: true, vlId: 13504, k: "voltron", why: "La nouveauté lourde : multi-lancements et inversions.", plus: "La sensation de vitesse la plus moderne du parc, finitions comprises." },
  { id: 5611, n: "Poseidon", z: "Grèce", lat: 48.2665, lng: 7.7178, dur: 6, thr: 4, nau: 1, vl: true, vlId: 11754, k: "poseidon", why: "Le water coaster grec, mi-montagnes russes mi-toboggan.", plus: "On sort mouillé. À caler quand il fait chaud, jamais en fin de journée.", wet: true },
  { id: 5608, n: "Pegasus", z: "Grèce", lat: 48.2669, lng: 7.7186, dur: 4, thr: 3, nau: 2, k: "pegasus", why: "Petit coaster familial rapide, idéal pour se remettre.", plus: "Court, franc, sans conséquence : le palier entre deux grosses sensations." },
  { id: 5615, n: "Atlantis Adventure", z: "Grèce", lat: 48.2662, lng: 7.7172, dur: 7, thr: 2, nau: 2, k: "atlantis", why: "Descente en bouées sur un parcours aquatique animé.", plus: "L'ambiance sonore et les jets d'eau imprévisibles. On finit humide.", wet: true },
  { id: 5630, n: "Voletarium", z: "Allemagne", lat: 48.2645, lng: 7.7222, dur: 12, thr: 1, nau: 1, vl: true, vlId: 11753, k: "voletarium", why: "Vol simulé au-dessus de l'Europe, écran géant et sièges suspendus.", plus: "Le grand moment contemplatif. Douze minutes assis, très bien placées après le déjeuner." },
  { id: 5631, n: "Jim Button – Journey through Morrowland", z: "Allemagne", lat: 48.2639, lng: 7.7228, dur: 8, thr: 0, nau: 0, k: "jim knopf", why: "Parcours scénique tiré du conte allemand, très soigné.", plus: "Les décors ; c'est l'attraction qu'on ne fait pas et qu'on regrette." },
  { id: 5605, n: "Euro-Mir", z: "Russie", lat: 48.2668, lng: 7.7232, dur: 6, thr: 4, nau: 5, vl: true, k: "euro-mir", why: "Ascension en spirale puis descente en cabines qui tournent.", plus: "La rotation libre des cabines : c'est ce qui la rend inoubliable et redoutable." },
  { id: 5607, n: "Matterhorn-Blitz", z: "Suisse", lat: 48.265, lng: 7.724, dur: 4, thr: 4, nau: 5, k: "matterhorn", why: "Bobsleigh sur rails, virages serrés et enchaînés.", plus: "Le rythme sec et les changements de direction, sans temps mort." },
  { id: 5613, n: "Swiss Bob Run", z: "Suisse", lat: 48.2645, lng: 7.7234, dur: 4, thr: 3, nau: 3, k: "schweizer bobbahn", why: "Descente de bobsleigh classique, sensations franches.", plus: "La ligne rapide et lisible, sans la brutalité du Matterhorn." },
  { id: 5610, n: "Atlantica SuperSplash", z: "Portugal", lat: 48.2653, lng: 7.7174, dur: 6, thr: 3, nau: 1, k: "atlantica", why: "Splash portugais : montée, chute, gerbe d'eau.", plus: "La vague qui arrose les spectateurs sur le pont. Mieux vaut être dedans que devant.", wet: true },
  { id: 5612, n: "Fjord-Rafting", z: "Scandinavie", lat: 48.2684, lng: 7.7226, dur: 8, thr: 3, nau: 3, k: "fjord", why: "Rafting circulaire, bouées qui tournent au hasard.", plus: "On ne sait jamais qui va prendre l'eau. Le meilleur des attractions humides à plusieurs.", wet: true },
  { id: 5628, n: "Vindjammer", z: "Scandinavie", lat: 48.2687, lng: 7.7233, dur: 4, thr: 3, nau: 4, k: "vindjammer", why: "Bateau à bascule scandinave, grande amplitude.", plus: "Court mais intense sur l'estomac. Ne pas enchaîner après un repas." },
  { id: 7301, n: "Snorri Touren", z: "Scandinavie", lat: 48.2689, lng: 7.722, dur: 6, thr: 0, nau: 0, kid: true, k: "snorri", why: "Parcours familial très doux, univers scandinave.", plus: "Fait pour souffler, littéralement." },
  { id: 5609, n: "Tirol Log Flume", z: "Autriche", lat: 48.2658, lng: 7.725, dur: 7, thr: 2, nau: 1, k: "tiroler wildwasser", why: "Le classique bûches et chute finale.", plus: "La chute est courte mais la remontée en file offre une des plus belles vues du quartier.", wet: true },
  { id: 5606, n: "Alpine Express « Enzian »", z: "Autriche", lat: 48.2662, lng: 7.7256, dur: 4, thr: 2, nau: 1, k: "alpenexpress", why: "Petit coaster couvert, thème alpin, rythme enlevé.", plus: "Le tunnel et l'ambiance musicale kitsch assumée." },
  { id: 5629, n: "Vienna Wave Swing « Glückspilz »", z: "Autriche", lat: 48.2656, lng: 7.7245, dur: 4, thr: 2, nau: 3, k: "glückspilz", why: "Chaises volantes en hauteur, rotation ample.", plus: "La vue circulaire sur le quartier autrichien pendant la rotation." },
  { id: 5624, n: "Josefina’s Magical Imperial Journey", z: "Autriche", lat: 48.2653, lng: 7.7256, dur: 7, thr: 0, nau: 0, k: "josefina", why: "Parcours scénique musical, tout en douceur.", plus: "L'attraction refuge du quartier. Zéro brassage, décor charmant." },
  { id: 5618, n: "ARTHUR", z: "Minimoys", lat: 48.2673, lng: 7.7264, dur: 7, thr: 3, nau: 2, k: "arthur", why: "Le parcours des Minimoys : circuit suspendu, virages rapides.", plus: "La longueur inattendue et les changements de niveau. Une des mieux thématisées." },
  { id: 5627, n: "Poppy Towers", z: "Minimoys", lat: 48.2676, lng: 7.7268, dur: 4, thr: 2, nau: 1, k: "poppy", why: "Tour de chute miniature, très accessible.", plus: "La petite frayeur sans conséquence, à faire en passant." },
  { id: 5617, n: "Pirates in Batavia", z: "Pays-Bas", lat: 48.2658, lng: 7.7202, dur: 10, thr: 0, nau: 0, vl: true, k: "piraten", why: "Balade en bateau chez les pirates, décors et animatroniques.", plus: "Le grand classique contemplatif. Dix minutes assis au frais : imbattable en pleine chaleur." },
  { id: 5621, n: "Arena of Football", z: "Angleterre", lat: 48.265, lng: 7.7211, dur: 8, thr: 1, nau: 0, k: "arena of football", why: "Espace football interactif, tirs au but et parcours.", plus: "À faire si le groupe a besoin de bouger autrement qu'en file." },
  { id: 5616, n: "Castello dei Medici", z: "Italie", lat: 48.2645, lng: 7.7186, dur: 7, thr: 1, nau: 0, k: "castello", why: "Parcours scénique italien dans un château.", plus: "Le calme et les décors soignés, souvent désert." },
  { id: 5620, n: "Volo da Vinci", z: "Italie", lat: 48.2648, lng: 7.718, dur: 5, thr: 2, nau: 4, k: "volo da vinci", why: "Simulateur de vol à la Léonard de Vinci, pédalage compris.", plus: "On actionne soi-même les ailes. Amusant, mais ça tourne : brassage élevé." },
  { id: 14534, n: "GRAND PRIX EDventure", z: "Luxembourg", lat: 48.264, lng: 7.722, dur: 6, thr: 2, nau: 0, k: "grand prix", why: "Circuit de karts thématisé, on conduit vraiment.", plus: "Le plaisir de tenir un volant, rare dans un parc. Bien pour couper une série de coasters." },
  { id: 5625, n: "Kolumbusjolle", z: "Espagne", lat: 48.2652, lng: 7.7166, dur: 4, thr: 1, nau: 2, k: "kolumbusjolle", why: "Barques à rames dans le quartier espagnol.", plus: "Détente pure, et on choisit son rythme.", wet: true },
  { id: 5622, n: "Ba-a-a Express", z: "Irlande", lat: 48.2668, lng: 7.7255, dur: 4, thr: 1, nau: 1, kid: true, k: "ba-a-a", why: "Petit train familial irlandais.", plus: "Le passage lent qui permet de discuter. Utile en récupération." },
  { id: 5623, n: "Dancing Dingie", z: "Irlande", lat: 48.267, lng: 7.725, dur: 3, thr: 2, nau: 5, k: "dingie", why: "Tasses tournantes version irlandaise.", plus: "On dose soi-même la rotation, donc on dose soi-même le désastre." },
  { id: 5626, n: "Old Mac Donald’s Tractor Fun", z: "Irlande", lat: 48.2666, lng: 7.7259, dur: 4, thr: 0, nau: 0, kid: true, k: "traktor", why: "Parcours de tracteurs pour les plus jeunes.", plus: "Sans intérêt pour un groupe d'adultes, sauf pour la photo." }
];

export const BY_ID: Record<number, Ride> = Object.fromEntries(RIDES.map((r) => [r.id, r]));

/** Relevé de secours du 11/08/2026, utilisé si l'API reste injoignable. */
export const SNAPSHOT: Record<number, number> = {
  5606: 40, 5624: 5, 5609: 35, 5629: 5, 13349: 60, 5621: 5, 5619: 20, 5737: 55, 6280: 0,
  5738: 1, 5604: 40, 5631: 1, 5630: 50, 5615: 5, 5608: 35, 5611: 55, 5603: 50, 5614: 10,
  5602: 55, 5622: 5, 5623: 5, 5626: 5, 5616: 5, 5620: 30, 14534: 15, 5618: 40, 5627: 5,
  5617: 25, 5610: 45, 5605: 40, 5612: 40, 7301: 25, 5628: 5, 5625: 5, 5607: 55, 5613: 50
};

/**
 * Identité visuelle par quartier. Le parc est organisé en pays : la couleur
 * sert de repère de lieu, pas de décoration. Elle est reprise sur les cartes,
 * les pastilles de la carte et les étapes de l'itinéraire.
 */
export const ZONES: Record<string, { hue: number; flag: string }> = {
  France:      { hue: 220, flag: "🇫🇷" },
  Islande:     { hue: 195, flag: "🇮🇸" },
  Croatie:     { hue: 350, flag: "🇭🇷" },
  Grèce:       { hue: 205, flag: "🇬🇷" },
  Allemagne:   { hue: 45,  flag: "🇩🇪" },
  Russie:      { hue: 265, flag: "🇷🇺" },
  Suisse:      { hue: 0,   flag: "🇨🇭" },
  Portugal:    { hue: 150, flag: "🇵🇹" },
  Scandinavie: { hue: 185, flag: "🇳🇴" },
  Autriche:    { hue: 15,  flag: "🇦🇹" },
  Minimoys:    { hue: 285, flag: "🌿" },
  "Pays-Bas":  { hue: 30,  flag: "🇳🇱" },
  Angleterre:  { hue: 340, flag: "🏴" },
  Italie:      { hue: 130, flag: "🇮🇹" },
  Luxembourg:  { hue: 200, flag: "🇱🇺" },
  Espagne:     { hue: 40,  flag: "🇪🇸" },
  Irlande:     { hue: 145, flag: "🇮🇪" }
};

export const zoneOf = (z: string) => ZONES[z] ?? { hue: 210, flag: "•" };
