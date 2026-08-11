# Journal des sessions

Où en est le projet, session par session. À lire en premier pour reprendre le travail,
à compléter en dernier avant de clore une session.

**Convention.** Une entrée par session, la plus récente en haut. Chaque entrée dit ce qui
a été fait, ce qui a été constaté, et ce qui reste ouvert. On n'y recopie pas le diff :
git le fait déjà. On y écrit ce que git ne dit pas — pourquoi, et où on s'est arrêté.

---

## Session 10 — 11/08/2026 · Deux défauts d'ergonomie

**Le gros bouton incompréhensible.** Chaque étape portait deux boutons **sans libellé**,
et tous deux faisaient disparaître l'étape : la coche verte la marque comme accomplie et
la compte dans le bilan, la croix l'abandonne. Le geste était un pari. Ils portent
maintenant « Fait » et « Retirer », avec des couleurs distinctes.

**Les étiquettes invisibles.** Elles étaient bien rendues — vérifié au navigateur — mais
**enfermées dans les quartiers repliés**. Sans ouvrir un pays, on ne voyait rien. Le
repliage réglait le problème de scroll et en créait un autre.

Réponse : des **filtres par étiquette** au-dessus de la liste. Ils sont cumulatifs
(« Familial » + « Aquatique » ne garde que ce qui est les deux) et **ouvrent
automatiquement les quartiers concernés**. Le titre indique désormais « N affichées ·
N choisies » au lieu du seul total.

Mesuré : 8 filtres, Aquatique → 6 attractions sur 5 quartiers, + Familial → 3.

**Effets ajoutés** : entrée décalée des étapes, pulsation de l'heure sur l'étape en cours,
glissement du bandeau d'état, bordure de quartier qui prend sa couleur au survol,
rebond à la pression des filtres. Tous neutralisés sous `prefers-reduced-motion`.

## Session 9 — 11/08/2026 · Le tracé ne suivait pas les allées

**Bug trouvé**

Le tracé restait en lignes droites toute la session, alors que le réseau d'allées était
bien chargé. Deux défauts enchaînés :

1. **Séquencement.** Le tracé était demandé au worker à chaque changement d'itinéraire,
   mais `walk.ok` ne figurait pas dans les dépendances de l'effet. Or le réseau arrive par
   le réseau, souvent après le premier calcul d'itinéraire : le worker n'avait pas encore
   de graphe, renvoyait des segments droits, et n'était plus jamais resollicité.
2. **L'indicateur mentait.** Le badge se basait sur la présence de segments. Mais avant
   l'arrivée du réseau, le worker renvoie bien des segments — tous droits. Il affichait
   donc « Tracé sur les allées » alors que le tracé était approximatif. Il repose
   désormais sur l'état réel du graphe.

**Vérifié** — API REST appelée avec la clé publique depuis Postgres : `ep_foot_graph`
répond 200 et 161 682 octets d'allées, donc le réseau arrive bien jusqu'au navigateur.
Test de non-régression avec un réseau de synthèse livré volontairement en retard :

| | Badge | Segments | Points par segment |
| --- | --- | --- | --- |
| Avant l'arrivée du réseau | Tracé approximatif | 2 | 22 (une seule polyligne droite) |
| Après | Tracé sur les allées | 38 | 5 (le tracé épouse la grille) |

**Ajouté** — un badge sur la carte elle-même. La note sous la carte ne suffisait pas :
c'est en regardant le trait qu'on se demande s'il dit vrai.

## Session 8 — 11/08/2026 · Noms officiels et étiquettes

**Fait**

- **Noms alignés sur les officiels.** Les 36 noms de `rides.ts` étaient tronqués ou
  reformulés ; ils reprennent maintenant exactement ce que publie l'API :
  « Eurosat – CanCan Coaster », « Madame Freudenreich Curiosités »,
  « Whale Adventures – Northern Lights », « Old Mac Donald's Tractor Fun »…
- **Étiquettes par attraction**, visibles dans la liste, la mini-fiche et l'itinéraire :
  Sensations fortes, Sensations, Familial, Tout-petits, Aquatique, Brassage élevé, Calme,
  VirtualLine. Elles sont aussi prises en compte par la recherche.

**Constaté**

- **Il n'existe pas de noms français chez queue-times.** Les endpoints `/fr/` et `/de/`
  répondent 200 mais renvoient exactement les mêmes libellés que l'anglais — vérifié en
  appelant les trois depuis Postgres. Le parc utilise des noms propres non traduits.
  `/fr-FR/` répond 404. Il n'y avait donc rien à importer, seulement à cesser de tronquer.
- **Les étiquettes sont déduites, jamais saisies.** Elles se calculent depuis `thr`, `nau`,
  `kid`, `wet` et `vl` : une attraction ne peut pas être marquée « Familial » tout en
  portant une intensité de 5. Le référentiel reste la seule source, et une correction de
  `thr` met les étiquettes à jour toute seule.
- Contrôle : 18 attractions « Familial », 8 « Sensations fortes ». Recherche par étiquette
  fonctionnelle, aucune erreur console.

## Session 7 — 11/08/2026 · Carte : tracé réel, mini-fiche, lisibilité

**Fait**

- **Le tracé sur la carte suit désormais les allées.** Il reliait les étapes par des
  segments droits qui traversaient le lac et les bâtiments, alors que les temps de marche,
  eux, suivaient déjà le graphe : le dessin contredisait le calcul. `pathBetween` rejoue
  le chemin nœud par nœud grâce à un Dijkstra qui garde les prédécesseurs, et le worker
  renvoie une polyligne par segment. Repli en droite, marqué par un pointillé plus lâche,
  quand le graphe n'a pas répondu.
- **Mini-fiche au clic sur une pastille.** Un clic sélectionnait silencieusement
  l'attraction, ce qui n'était ni visible ni réversible d'un geste. Il ouvre maintenant une
  fiche : nom, quartier, durée, brassage, attente, description, le petit plus, la distance
  à pied depuis votre position, et un bouton ajouter ou retirer.
- **Lisibilité du satellite.** `maxNativeZoom` à 19 : au-delà Leaflet agrandit la dernière
  tuile au lieu d'en demander une inexistante, ce qui produisait des trous gris en zoom
  rapproché. Le fond est légèrement assombri et désaturé par filtre CSS — sur une image
  satellite brute, une pastille verte se perd dans les arbres et le tracé bleu dans les
  toits. Tracé redessiné avec liseré sombre et trait plus épais.

**Vérifié au navigateur** : 19 segments tracés, mini-fiche ouverte au clic avec le bon
contenu, fermeture propre, aucune erreur console.

## Session 6 — 11/08/2026 · Calcul de marche en Web Worker

**Fait**

- Les 37 Dijkstra sur 7 500 nœuds passent dans un **Web Worker**. Le fil principal ne
  porte plus le calcul, ni au chargement ni à chaque déplacement GPS notable.
- `walkgraph.ts` isole le graphe et les plus courts chemins, sans aucune dépendance au
  parc : le même module sert au fil principal et au worker, sans embarquer le référentiel
  des attractions dans le bundle du worker.
- `walkClient.ts` porte le contrat : estimation à vol d'oiseau posée immédiatement pour
  que l'app soit utilisable sans attendre, remplacée par les distances réelles dès que le
  worker répond. **Repli synchrone complet** si les Workers sont indisponibles : plus lent,
  jamais cassé.
- Les lignes « moi » successives repartent toujours de la matrice de base, sinon elles
  s'empileraient et la matrice grossirait sans fin.

**Mesuré au navigateur**

| | Résultat |
| --- | --- |
| Worker lancé | `walk.worker-*.js`, 2 ko |
| Plus long blocage du fil principal | **26 ms** pendant le calcul GPS |
| Régression | aucune : parcours, GPS, thèmes, PWA, hors ligne tous verts |

Note sur les comptes d'étapes : 30 pour une journée entière planifiée depuis 09:00,
15 pour un recalcul en milieu d'après-midi. Les deux sont cohérents, le second ne
disposant que du temps restant.

## Session 5 — 11/08/2026 · Géolocalisation

**Fait**

- **Suivi GPS du téléphone.** Bouton « Me localiser dans le parc » dans l'onglet Parcours.
  La position ne quitte jamais l'appareil : elle n'est ni enregistrée, ni poussée dans
  l'état partagé du groupe. Le suivi est explicite, jamais automatique — un GPS qui tourne
  sans qu'on l'ait demandé vide la batterie qui doit tenir la journée.
- **Recalcul depuis la position réelle.** `buildPlan` accepte un point de départ : quand le
  GPS est actif, « Recalculer à partir de maintenant » part d'où vous êtes et non de la
  dernière attraction cochée. Un Dijkstra de plus depuis le point d'allée le plus proche.
- **Amortissement** : la matrice n'est recalculée qu'au-delà de ~25 m de déplacement. En
  deçà, les temps de marche ne bougent pas d'une minute.
- **« Autour de vous »** : les six attractions les plus proches à pied, avec leur temps de
  marche réel et leur file. Un appui les ajoute au parcours. C'est la réponse à « on passe
  devant un truc, ça vaut le coup ? ».
- Le quartier de départ amorce la prime de cohérence quand on part du GPS, sinon le premier
  saut pouvait traverser le parc avec trois attractions sous les pieds.
- Marqueur de position sur la carte, halo de précision, anneau pulsé.

**Bug trouvé et corrigé**

`.stop` désignait à la fois une étape d'itinéraire et une file d'attente longue
(`.wt.stop`). Les pastilles de temps d'attente héritaient donc de `display: grid` et de
`grid-template-columns: 64px 22px 1fr`, la grille de la timeline. Visuellement ça passait
par chance, mais **cela faussait aussi les mesures des sessions précédentes** : les
comptes d'étapes annoncés (38, 23, 24) additionnaient les étapes et les pastilles. Le
compte réel est de 15 étapes pour un préréglage Mix. Les vérifications faites *par nom*
d'attraction, elles, restent valides. Niveaux d'attente renommés `w-go`, `w-mid`,
`w-stop`, `w-closed`.

**Vérifié au navigateur**, position simulée en Islande près de blue fire :

- « Autour de vous » renvoie blue fire, WODAN et Whale Adventures à 2 min — cohérent ;
- la cellule Position affiche `suivi actif · ±12 m` ;
- le plan change avec le GPS : Eurosat CanCan Coaster → Tirol Log Flume en tête ;
- aucune erreur console.

**Reste ouvert**

- [ ] Déposer `public/equipe.jpg` puis `node scripts/cut-heads.mjs`.
- [ ] Comparer `europa_park.curve` à `CURVE` une fois quelques jours collectés.
- [ ] Confirmer si sept VirtualLine sont réservables simultanément.
- [x] ~~`buildWalkMatrix` sur le fil principal~~ — fait en session 6.

## Session 4 — 11/08/2026 · Serveur, écran de lancement, audit

**Fait**

- **Temps d'attente servis par le serveur** (`ep_waits()`). La collecte tournait déjà
  côté Postgres toutes les 5 minutes, sans contrainte CORS : autant servir ce qu'on a.
  L'app lit serveur → relais publics → relevé figé. **Le Worker Cloudflare devient
  facultatif**, plus rien à déployer ni à coller.
- **Réseau piéton figé côté serveur** (`ep_foot_graph()`) : 1104 chemins, 7594 points,
  158 ko. Overpass n'est plus qu'un secours. Mis en cache localement après le premier
  chargement, donc disponible hors ligne.
- **Écran de lancement** refait autour d'une montagne russe qui traverse l'écran. Le
  wagon suit le tracé en `animateMotion`, s'incline dans les côtes, et sa course est la
  barre de chargement. Cinq passagers dessinés, bras en l'air.
- **Barre d'action collante** : le bouton de calcul suivait mal une page de 3 000 px.
- **Blocs repliables** pour les réglages et les quartiers, échelle typo baissée d'un cran,
  trèfle remplacé par un billet, bouton « Étape faite » sur la carte de tête.
- `scripts/cut-heads.mjs` : découpe les visages de `public/equipe.jpg` en ronds ;
  l'écran de lancement les détecte et remplace les passagers dessinés.

**Audit navigateur** (390, 430, 820, 1440 px)

| Contrôle | Résultat |
| --- | --- |
| Débordement horizontal | aucun |
| Erreurs console | aucune |
| Cibles tactiles | toutes ≥ 40 px |
| Texte | rien sous 12,5 px hors attribution Leaflet |
| Parcours complet | calcul, validation, retrait, ajout : tous vérifiés par nom |
| Thème clair / sombre | bascule OK |
| Service worker | actif |
| Manifest | 4 icônes dont une maskable, `standalone` |
| Hors ligne | l'app se rend |
| Charge utile synchro | 25 ko pour deux jours planifiés, plafond serveur 200 ko |

**Constaté**

- Le retrait d'une étape fait parfois **monter** le nombre d'étapes : le planificateur
  remplit le temps libéré. C'est le comportement voulu, pas une régression — un premier
  test l'avait signalé à tort.
- La photo du groupe ne peut pas être extraite de la conversation. Tout est prêt pour
  l'accueillir : `public/equipe.jpg` puis `node scripts/cut-heads.mjs`.

**Reste ouvert**

- [ ] Déposer `public/equipe.jpg` et lancer les deux scripts d'images.
- [ ] Comparer `europa_park.curve` à `CURVE` une fois quelques jours collectés.
- [ ] Confirmer si sept VirtualLine sont réservables simultanément.
- [ ] `buildWalkMatrix` fait 37 Dijkstra sur le fil principal ; à passer en Web Worker
      si un ralentissement se voit au chargement sur téléphone.
- [ ] Vérifier durées de tour et fiches attractions sur place.

## Session 3 — 11/08/2026 · Refonte v2

**Fait**

- **Interface** : direction rétro parc d'attraction. Fraunces en titres, Figtree en lecture,
  JetBrains Mono pour les heures, toutes auto-hébergées via npm — donc précachées par le
  service worker, ce qui corrige la typographie dégradée hors ligne relevée en session 2.
  Corps à 17px, plus rien sous 12,5px, cibles tactiles à 44px minimum.
  Onglets en barre basse sur téléphone. Modes clair et sombre complets.
  Couleur et drapeau par quartier sur les listes, la carte et les étapes.
- **Parcours** : carte et itinéraire fusionnés. Affichage point par point, l'étape validée
  disparaît et le reste est recalculé depuis l'heure et le lieu réels. Ajout et retrait
  d'une attraction en cours de route. Attraction d'ouverture imposable. Forme de journée
  (aquatiques matin/après-midi, sensations tôt/réparties/tard).
- **Marche réelle** : graphe des allées OpenStreetMap, Dijkstra depuis chaque attraction,
  repli à vol d'oiseau si Overpass ne répond pas. Prime de cohérence de quartier.
- **Lots** d'attractions enregistrables et verrouillables.
- **Sauvegarde partagée** entre téléphones par code de séjour, via trois fonctions RPC
  étroites sur Supabase. Le schéma `europa_park` reste non exposé à PostgREST.
- **Fiches** : les 36 attractions portent une description et un « petit plus ».
- Recherche parmi les 36 attractions. `App.tsx` découpé en composants.

**Constaté**

- **Bug corrigé : la carte restait grise.** Leaflet mesure son conteneur au montage ;
  monté dans un onglet masqué en CSS, il mesurait zéro. La taille est désormais recalculée
  à chaque retour sur l'onglet.
- **Aucune attraction ne manque.** Croisement refait contre l'API : queue-times n'expose
  que 39 entrées pour le parc 51, soit nos 36 attractions plus 3 files virtuelles. Silver
  Star est bien présente (id 5604, quartier France). Ce n'est pas un manque de données mais
  un problème de repérage dans une liste de 36 groupée par pays, d'où la recherche ajoutée.
  Les 3 attractions pour les tout-petits restent marquées `kid` et exclues des préréglages.
- **La ré-optimisation dynamique fonctionne** : test navigateur, 38 étapes au calcul initial,
  23 après validation d'une étape en milieu d'après-midi. Ce n'est pas un simple retrait,
  c'est un recalcul complet sur le temps réellement restant.

**Non testé**

- Le graphe des allées : Overpass est bloqué depuis la session, le repli à vol d'oiseau est
  seul exercé ici. À vérifier dans le navigateur, l'indicateur « Marche » du bandeau
  affiche `allées` quand le graphe est chargé, `estimée` sinon.
- La synchro entre téléphones : l'aller-retour RPC est validé côté serveur, mais pas depuis
  le navigateur, le réseau de la session bloquant Supabase.

**Reste ouvert**

- [ ] Déployer le Worker Cloudflare (l'app tourne toujours sur `SNAPSHOT` figé sans lui).
- [ ] Comparer `europa_park.curve` à `CURVE` une fois quelques jours collectés.
- [ ] Confirmer auprès du parc si sept VirtualLine sont réservables simultanément.
- [ ] Vérifier les durées de tour et les fiches attractions sur place.

## Session 2 — 11/08/2026 · Déploiement, review, documentation

**Fait**

- Déploiement Vercel opérationnel via l'intégration GitHub. Tout push sur `main` déclenche
  un build. Pas de `vercel.json` : le préréglage Vite est détecté automatiquement
  (`npm run build` → `dist`).
- Review intégrale des sources. Résultats consignés dans `ARCHITECTURE.md`.
- Import du framework AI-Driven Dev : marketplace `aidd-framework` et six plugins stables
  déclarés dans `.claude/settings.json`. Ils s'installent au démarrage de session.
- Rédaction de `ARCHITECTURE.md`, `DOCUMENTATION.md` et de ce journal, référencés depuis
  `CLAUDE.md`.
- `tsconfig.tsbuildinfo` ajouté au `.gitignore` — point laissé ouvert en session 1.
- Vérification PWA et responsive au navigateur réel (Chromium/Playwright) sur quatre
  gabarits : 390, 820, 1180 et 1440 px. Captures dans le scratchpad de session.
- `scripts/check-api.mjs` : croise les 36 `id` et les 3 `vlId` du référentiel avec la
  réponse réelle de queue-times, signale les identifiants morts, les renommages et les
  files virtuelles non rattachées. Sort en code 1 si le référentiel est à corriger.
- **Collecte continue en service.** Schéma `europa_park` sur le projet Supabase
  « BDD CRM », alimenté toutes les 5 minutes par un job `pg_cron` de 06:00 à 21:00 UTC.
  Première collecte réussie : HTTP 200, 39 attractions, 39 lignes. Détail et commandes de
  suppression dans `ARCHITECTURE.md`.

**Constaté**

- **Données `rides.ts` saines.** 36 attractions, aucun `id` en doublon, `SNAPSHOT` couvre
  les 36. 7 attractions `vl: true`, 3 `vlId` renseignés — l'écart est conforme à ce que
  queue-times expose, ce n'est pas une donnée manquante.
- **Le journal n'alimente pas `CURVE`.** Les deux mécanismes coexistent sans se parler.
  La projection d'affluence reste une constante écrite à la main, et le journal ne sert
  qu'à l'export manuel. C'est le principal écart entre ce que l'app fait et ce qu'elle
  prétend estimer. Dispositif de collecte détaillé dans `ARCHITECTURE.md`.
- **Le premier écran affichait « hors ligne » et « positions estimées ».** Les deux sont
  des replis normaux, pas des bugs : aucun relais personnel n'était configuré, et Overpass
  n'avait pas répondu au premier chargement.
- **Responsive et PWA sains.** Aucun débordement horizontal aux quatre gabarits testés.
  Service worker enregistré, manifest valide, 3 icônes, `display: standalone`. Un seul
  point de rupture à 1080 px : en dessous, onglets et colonne unique ; au-dessus, les
  onglets disparaissent et les trois panneaux passent en grille. C'est délibéré et ça
  fonctionne. Safe-area insets et `prefers-reduced-motion` correctement pris en charge.
- **Trois défauts réels trouvés au navigateur**, détaillés en fin d'`ARCHITECTURE.md` :
  les polices Google ne sont pas précachées (typographie dégradée hors ligne, ce qui est
  précisément le cas d'usage), les cibles tactiles font 20-26 px là où le minimum WCAG est
  24 et le confort 44, et les sept VirtualLine sont réservées d'un bloc à l'ouverture avec
  la même fenêtre de retour.
- **Référentiel `rides.ts` confirmé exact contre l'API réelle.** Croisement fait depuis
  Postgres : les 36 `id` et les 3 `vlId` existent tous, l'API ne renvoie rien d'autre
  (36 + 3 = 39 entrées). Les trois files virtuelles pointent bien sur Voltron Nevera,
  Poseidon et Voletarium. Zéro écart.
- **Pas d'historique intra-journée chez queue-times.** L'API n'expose que l'instant présent
  et des agrégats quotidiens (moyenne et max par attraction et par jour). Reconstituer une
  courbe horaire d'août a posteriori est impossible depuis cette source — seul Thrill Data
  Plus, payant, publie des téléchargements historiques. La courbe se construit donc à
  partir de maintenant, d'où la mise en service immédiate du cron.
- Huit points d'attention au total, aucun bloquant, listés en fin d'`ARCHITECTURE.md`.

**Non vérifié, et pourquoi**

L'environnement d'exécution de cette session bloque tout l'egress hors GitHub et registres
de paquets : `queue-times.com`, `overpass-api.de`, les tuiles, `api.vercel.com` et
`api.cloudflare.com` répondent `403 CONNECT` au proxy.

Contourné pour l'API : la collecte tourne dans Postgres, donc l'appel part de Supabase et
non de la session. C'est ce qui a permis de valider le référentiel malgré le blocage.

Reste non testé :

- le Worker Cloudflare, ni déployé ni testé — il demande de toute façon un compte
  Cloudflare hors de portée de cette session ;
- Overpass, donc l'appariement des positions réelles.

Pour lever le blocage côté session : environnement Claude Code → **Network access:
Custom** → ajouter `queue-times.com`, `overpass-api.de`, `*.workers.dev`, en gardant la
liste par défaut cochée. L'accès réseau est lu **au démarrage de session** : il faut une
session neuve.

**Reste ouvert**

- [ ] Déployer le Worker Cloudflare et coller son URL dans « relais personnel ».
      Tant que ce n'est pas fait, l'app tourne sur `SNAPSHOT` figé.
- [ ] Laisser la collecte tourner quelques jours, puis comparer `europa_park.curve` à
      `CURVE` dans `planner.ts` et remplacer l'heuristique.
- [ ] Passer à une courbe par attraction plutôt que globale (`hourly_profile`).
- [ ] Précacher les polices dans le service worker — typographie dégradée hors ligne.
- [ ] Agrandir les cibles tactiles du trèfle et de la case « faite » (20 px actuellement).
- [ ] Confirmer auprès du parc si sept VirtualLine peuvent être réservées simultanément.
- [ ] Découper `App.tsx` par onglet — 443 lignes, seuil de `CLAUDE.md` atteint.
- [ ] Entrée anticipée de 45 min pour les résidents du resort, non modélisée.
- [ ] Vérifier les durées de tour chronomètre en main, sur place.

---

## Session 1 — 11/08/2026 · Mise en place du dépôt

**Fait**

- Décompression de `europa-park-planner.zip` à la racine, contenu remonté d'un niveau,
  fichiers cachés compris (`.gitignore`, `.mcp.json`).
- Suppression de l'archive, du dossier vide et du `README.MD` provisoire — distinct du
  `README.md` du projet, conservé.
- `npm install` (356 paquets, 0 vulnérabilité) puis `npm run build` : passe sans erreur.
  `tsc -b` puis Rolldown, 428 modules, service worker généré, 16 entrées précachées.
- `package-lock.json` ajouté au dépôt : absent de l'archive, nécessaire à un build
  reproductible côté Vercel.

**Constaté**

- `tsconfig.tsbuildinfo` est produit par `tsc -b` et n'est pas couvert par `.gitignore`.
  Écarté du commit plutôt que d'ajouter la ligne, sur consigne de ne modifier aucun fichier
  source. Il réapparaît en untracked à chaque build local.
- `images.jpeg` était déjà à la racine avant intervention, hors de l'arborescence attendue.
  Laissé en place.

**Reste ouvert**

- [ ] Ajouter `tsconfig.tsbuildinfo` au `.gitignore` si le untracked récurrent gêne.
- [ ] Statuer sur `images.jpeg`.
