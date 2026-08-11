# Architecture

État réel du code au 11/08/2026, établi par lecture intégrale des sources.
`CLAUDE.md` donne les règles métier et les interdits ; ce document décrit la mécanique.

## Vue d'ensemble

Application React 19 monopage, sans routeur. Une seule vue, trois onglets commutés par
un `useState` local. Aucune librairie d'état : tout l'état vit dans `App.tsx` et se
persiste dans `localStorage`.

```
main.tsx
└── App.tsx ........................ tout l'état, les trois onglets
    ├── data/rides.ts ............... référentiel figé des 36 attractions
    ├── lib/api.ts .................. lecture queue-times via chaîne de relais
    ├── lib/geo.ts .................. haversine, marche, Overpass
    ├── lib/planner.ts .............. optimiseur glouton
    ├── lib/journal.ts .............. relevés, évènements, export Markdown
    ├── lib/storage.ts .............. persistance, export sélection
    └── components/ParkMap.tsx ...... Leaflet, trois fonds de carte
```

`worker/queue-proxy.js` est déployé séparément sur Cloudflare : il ne fait pas partie
du bundle.

## Flux de données

Trois sources externes, trois politiques de repli distinctes. Aucune ne bloque l'app.

| Source | Chemin | Repli si échec |
| --- | --- | --- |
| queue-times.com (park 51) | `api.ts` → chaîne de relais CORS | `SNAPSHOT`, relevé figé du 11/08/2026 |
| OpenStreetMap (Overpass) | `geo.ts` → 2 endpoints | coordonnées `lat`/`lng` de `rides.ts` |
| Tuiles Esri / OSM / CARTO | `ParkMap.tsx` | aucun, la carte reste vide |

### Cycle de rafraîchissement

`App.tsx` appelle `ping()` au montage puis toutes les **120 s**. Chaque appel :

1. `fetchWaits(relay)` parcourt la chaîne de relais, premier succès gagne ;
2. le `Snapshot` obtenu alimente `setSnap` ;
3. **si et seulement si `source === "live"`**, `record(snap)` ajoute un relevé au journal.

Ce filtre est délibéré : journaliser le `SNAPSHOT` figé polluerait l'historique avec des
valeurs constantes qui ressembleraient à de la donnée réelle.

### Chaîne de relais CORS

`queue-times.com` ne renvoie pas d'en-tête `Access-Control-Allow-Origin`. `api.ts`
essaie dans l'ordre : relais personnel s'il est renseigné, puis `corsproxy.io`,
`allorigins.win`, `codetabs.com`, puis l'appel direct en dernier recours. Chaque
tentative a un timeout de 8 s via `AbortController`.

Le relais personnel se colle dans le champ prévu et doit **se terminer par le préfixe
de query** : `https://mon-worker.workers.dev/?url=`. `api.ts` concatène l'URL cible
encodée directement derrière, sans rien ajouter. Sans ce suffixe le Worker répond 400 et
la chaîne repart sur les relais publics.

Conséquence à connaître : un relais personnel cassé ne se voit pas. La chaîne bascule
silencieusement sur les publics, et l'indicateur reste « live » si l'un d'eux répond.

## Modèle de données

### `Ride` (`data/rides.ts`)

36 entrées, vérifiées sans doublon d'`id` et couvertes à 100 % par `SNAPSHOT`.

| Champ | Rôle |
| --- | --- |
| `id` | identifiant queue-times, clé de jointure avec l'API |
| `z` | quartier, sert au regroupement et à `nearestZone` |
| `lat` / `lng` | position de repli, juste au quartier près |
| `dur` | tour + embarquement, estimation jamais chronométrée |
| `thr` | intensité 0-5, pondère le score du planificateur |
| `nau` | brassage 0-5, pilote le compteur anti-nausée |
| `vl` | VirtualLine annoncée par le parc (7 attractions) |
| `vlId` | identifiant de file virtuelle chez queue-times (3 seulement) |
| `k` | clé de rapprochement avec le nom OpenStreetMap |

L'écart `vl: true` (7) contre `vlId` (3) n'est pas une erreur : queue-times n'expose que
trois files virtuelles nommées. Les quatre autres sont réservables dans l'app du parc
mais **non observables** via l'API.

### Rapprochement OpenStreetMap

`fetchOsmPositions` interroge Overpass sur la bbox du parc, normalise les noms
(minuscules, accents retirés, ponctuation en espaces) et cherche pour chaque attraction
un élément dont le nom **contient** la clé `k`, avec un repli sur l'inclusion inverse
pour les noms longs. Le résultat n'est retenu que si **au moins 8 attractions** ont été
appariées, garde-fou contre une réponse partielle. Il est ensuite mis en cache dans
`localStorage` sous `ep.osm.v1`, définitivement : aucune expiration, aucun rafraîchissement.

Si une attraction n'est jamais trouvée, corriger `k`, jamais les coordonnées.

## Le planificateur

`buildPlan` est un glouton sous contraintes. À chaque itération il évalue toutes les
attractions restantes et retient la meilleure, sans retour arrière.

### Score

```
score = (1 + (thr / 5) * 0.35 + min(1.2, saved / 45)) / max(6, cost)
cost  = marche + attente + durée du tour
saved = attente réelle projetée − attente effective (joker ou VirtualLine)
```

Le dénominateur plancher à 6 empêche une attraction très courte de rafler la mise par
seule division. `saved` valorise l'endroit où le joker rapporte, plafonné pour qu'une
file de trois heures ne dérègle pas tout.

### Contraintes dures, dans l'ordre d'évaluation

1. **Heure de fin** — `t + cost > end` écarte l'attraction.
2. **Brassage** — `cooled + nau * 13 > tol` écarte l'attraction.
3. **Fermeture** — `projectedWait` renvoie `-1`, l'attraction est sautée.

Quand plus rien ne passe et que le compteur de brassage est non nul, une pause
« Respiration » de 10 à 20 min est insérée, puis la boucle reprend. Quand plus rien ne
passe et que le compteur est à zéro, la boucle s'arrête.

### Compteur de brassage

C'est la raison d'être de l'app, pas un réglage cosmétique.

```
après un tour   : compteur += nau * 13
marche et file  : compteur -= 0.55 par minute
pause déjeuner  : compteur -= 0.9 par minute
```

Trois plafonds proposés : 45 (estomac fragile), 65 (équilibré), 88 (on encaisse).

### Modes d'attente

| Mode | Attente retenue | Origine |
| --- | --- | --- |
| `gc` | 7 min forfaitaires | joker Green Card |
| `vl` | 10 min résiduelles | VirtualLine réservée, fenêtre de retour respectée |
| `file` | `projectedWait` | file classique |

Les VirtualLine génèrent une étape préalable de 3 min en début de journée (« Réserver
les VirtualLine dans l'app Europa-Park »), et chaque réservation ouvre une fenêtre de
retour à `max(30, attente projetée)` minutes. Le planificateur ne peut pas arriver avant.

### Projection d'affluence

`CURVE` est une courbe horaire de 9 h à 18 h, interpolée linéairement par `curveAt`.
`projectedWait` applique le **rapport** entre la courbe à l'heure d'arrivée et la courbe
à l'heure du relevé, borné entre 0,35 et 2.

```
w(arrivée) = w(relevé) × clamp(curve(arrivée) / curve(relevé), 0.35, 2)
```

C'est une heuristique assumée. L'API ne donne que l'instant présent ; sans historique il
n'y a pas mieux. Voir « Collecte continue » plus bas.

## Persistance

Trois clés `localStorage`, indépendantes, toutes tolérantes à l'échec (quota, mode privé).

| Clé | Contenu | Écrit par |
| --- | --- | --- |
| `ep.state.v3` | jours 1 et 2, rythme, thème, relais | `storage.ts`, à chaque changement d'état |
| `ep.journal.v1` | relevés et évènements | `journal.ts`, à chaque relevé live |
| `ep.osm.v1` | positions OSM appariées | `App.tsx`, une fois |

`load()` fusionne l'état lu avec `initialState()` et `emptyDay()`, donc l'ajout d'un champ
dans `DayPlan` ne casse pas un état déjà persisté. Le suffixe `v3` reste à incrémenter
manuellement en cas de changement incompatible.

## Journalisation

`journal.ts` conserve jusqu'à **900 relevés** (≈ 30 h à un relevé toutes les 2 min) et
400 évènements, en fenêtre glissante. À chaque relevé il compare au précédent et déduit
quatre types d'évènements : `vl-open`, `vl-close`, `ride-close`, `ride-open`, plus `spike`
au-delà de +25 min d'un relevé à l'autre.

`toMarkdown()` produit trois sections : évènements, synthèse min/moyenne/max par
attraction, et relevés bruts (200 derniers).

### Limite structurelle

**Le journal n'alimente pas `CURVE`.** Les deux mécanismes coexistent sans se parler :
`CURVE` reste une constante écrite à la main, et le journal ne sert qu'à l'export manuel.
De plus la collecte ne tourne que pendant que l'app est ouverte, dans un seul navigateur,
et les données disparaissent avec le `localStorage`.

C'est le principal écart entre ce que l'app fait et ce qu'elle prétend estimer.

## Collecte continue

Opérationnelle depuis le 11/08/2026. Elle tourne **entièrement dans Postgres**, sur le
projet Supabase « BDD CRM » (`vcezvyosrxoeewtmhttq`), dans un schéma isolé `europa_park`.

Ni n8n ni Cloudflare : `pg_cron` était déjà actif sur le projet et l'extension `http`
permet d'appeler l'API depuis une fonction SQL. Côté serveur il n'y a pas de contrainte
CORS, donc pas besoin de relais.

```
pg_cron  */5 6-21 * * * (UTC)
  └── europa_park.collect()
        └── http_get queue-times park 51, timeout 15 s
              └── insert into europa_park.wait_sample
```

### Objets créés

| Objet | Rôle |
| --- | --- |
| `europa_park.ride` | attractions vues dans l'API, `is_virtual` pour les files virtuelles |
| `europa_park.wait_sample` | série brute `(ride_id, observed_at, wait_minutes, is_open)` |
| `europa_park.collection_run` | une ligne par exécution : statut HTTP, volumes, erreur |
| `europa_park.hourly_profile` | vue, profil horaire par attraction |
| `europa_park.curve` | vue, facteur d'affluence par heure — l'équivalent de `CURVE` |
| `europa_park.collect()` | la fonction de collecte |
| job pg_cron `europa_park_collect` | la planification |

### Choix à connaître

- **Schéma dédié.** Tout retirer tient en une commande, sans toucher au CRM :
  `drop schema europa_park cascade; select cron.unschedule('europa_park_collect');`
- **Clé primaire `(ride_id, observed_at)`** avec `observed_at` tronqué à la minute : une
  double exécution du cron n'écrit pas de doublon. La collecte est idempotente.
- **`wait_minutes` est `null` quand l'attraction est fermée**, jamais `0`. Zéro est une
  vraie valeur d'attente ; les confondre fausserait toutes les moyennes.
- **Agrégations en `Europe/Berlin`.** Le parc est en Allemagne ; agréger en UTC décalerait
  les tranches horaires d'une ou deux heures selon la saison.
- **Cadence 5 min**, alignée sur le rafraîchissement de queue-times. Plus souvent
  n'ajouterait que des doublons.
- **`collection_run` existe pour rendre l'échec visible.** Une collecte qui tombe en
  silence produit une courbe fausse sans prévenir. `select * from
  europa_park.collection_run order by id desc limit 20;` donne l'état réel.
- **RLS activée sans policy** sur les trois tables : refus par défaut. Le schéma n'est de
  toute façon pas exposé par PostgREST.

Volume : 39 entrées × 12 relevés/heure × 15 h ≈ **7 000 lignes par jour**. Négligeable.

### Ce que l'historique ne peut pas donner

queue-times **n'expose pas d'historique intra-journée**. L'API publique renvoie l'instant
présent, et l'endpoint d'agrégats ne donne que moyenne et maximum par attraction et par
jour. Reconstituer a posteriori une courbe horaire du mois d'août est donc impossible
depuis cette source. Seul un service tiers payant (Thrill Data Plus) publie des
téléchargements historiques.

Conséquence : la courbe se construit **à partir de maintenant**. C'est la raison d'être du
cron, et la raison pour laquelle il a été posé sans attendre.

### Exploitation

`europa_park.curve` renvoie déjà un facteur par heure directement comparable à `CURVE`
dans `planner.ts`. L'étape suivante est de passer à une courbe **par attraction** plutôt
que globale : Silver Star et Voletarium n'ont pas le même profil horaire, et c'est
exactement ce que la courbe unique ne peut pas capturer. `hourly_profile` porte déjà cette
granularité.

`projectedWait` est le seul point d'entrée à modifier dans l'app.

## Points d'attention repérés au review

Aucun n'est bloquant pour le séjour. Classés par ordre d'importance.

1. **Sept VirtualLine réservées d'un coup à l'ouverture.** `buildPlan` pose toutes les
   réservations dans une étape unique de 3 min en début de journée, et leur fenêtre de
   retour se calcule identiquement — dans le plan de test, les sept renvoyaient toutes à
   09 h 33. Les systèmes de file virtuelle limitent en général à **une réservation active
   à la fois**. Si c'est le cas à Europa-Park, le plan est optimiste sur les sept
   attractions concernées. Modifier cette règle demande une source, conformément à
   `CLAUDE.md` — à vérifier dans les conditions officielles avant le séjour.

2. **Les polices ne sont pas précachées.** `index.html` charge Archivo et IBM Plex
   Mono depuis `fonts.googleapis.com`. Le `globPatterns` de workbox ne couvre que les
   fichiers locaux et le `runtimeCaching` ne liste qu'Esri et OSM. Hors ligne, ou en 3G
   dans le parc, les polices ne se chargent pas et la typographie retombe sur les polices
   système. Vérifié : `0` occurrence de `fonts.g*` dans `vite.config.ts`. Les tuiles CARTO
   (`basemaps.cartocdn.com`, fond « Sombre ») ne sont pas cachées non plus.

3. **Cibles tactiles sous le seuil.** Mesuré au navigateur : `.chk` 20×20 px,
   `.pill.gc` 24×20, `.pill.vl` 26×22, `.chk.tickbox` 20×20. Le minimum WCAG 2.2 est
   24×24, la recommandation tactile courante 44×44. Or le trèfle et la case « faite » sont
   les deux boutons les plus sollicités sur le terrain, à une main, en marchant.

4. **Les préréglages dépendent du premier relevé.** `preset("mix")` choisit les six
   jokers en triant sur `waits`, qui vaut `-1` partout tant que `snap` est `null`. Cliquer
   un préréglage dans la seconde qui suit l'ouverture donne une liste sans aucun joker.
   En pratique le premier `ping()` répond avant, mais le cas existe.

5. **Un relais personnel invalide est indiscernable.** La chaîne bascule sur les relais
   publics sans le signaler. Si l'indicateur affiche « live », rien ne dit lequel a répondu.

6. **Le cache OSM n'expire jamais.** Un appariement partiel (8 attractions suffisent pour
   être retenu) est figé définitivement dans `ep.osm.v1`. Vider cette clé est le seul
   moyen de relancer la recherche.

7. **`hhmm` peut décaler d'une heure sur une entrée fractionnaire.** `Math.floor(m / 60)`
   utilise la valeur brute alors que les minutes sont arrondies : `599.6` rend `09:00` au
   lieu de `10:00`. Latent uniquement — toutes les valeurs qui atteignent `hhmm`
   aujourd'hui sont entières.

8. **`App.tsx` fait 443 lignes.** Le seuil posé dans `CLAUDE.md` est atteint : découper
   par onglet avant d'ajouter une fonctionnalité.

## Contraintes de build

- **Rolldown.** Vite 8 impose que `manualChunks` soit une **fonction**. La forme objet
  héritée de Rollup lève `manualChunks is not a function` au build.
- **Découpage** en quatre chunks : `react`, `leaflet`, `motion`, `index`.
- **PWA** via `vite-plugin-pwa` en `generateSW`, précache de 16 entrées, `CacheFirst` sur
  les tuiles Esri et OSM avec 900 entrées et 30 jours de rétention.
- `tsc -b` produit `tsconfig.tsbuildinfo` à la racine, non couvert par `.gitignore`.
