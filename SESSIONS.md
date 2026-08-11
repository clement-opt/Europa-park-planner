# Journal des sessions

Où en est le projet, session par session. À lire en premier pour reprendre le travail,
à compléter en dernier avant de clore une session.

**Convention.** Une entrée par session, la plus récente en haut. Chaque entrée dit ce qui
a été fait, ce qui a été constaté, et ce qui reste ouvert. On n'y recopie pas le diff :
git le fait déjà. On y écrit ce que git ne dit pas — pourquoi, et où on s'est arrêté.

---

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
