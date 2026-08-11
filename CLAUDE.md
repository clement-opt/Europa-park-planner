# Contexte projet

Fichier lu automatiquement par Claude Code au démarrage d'une session.
Il donne le contexte qu'un nouvel arrivant mettrait une heure à reconstituer.

## Ce que fait l'app

PWA de planification de visite à Europa-Park, pour un groupe de 4 adultes sur 2 jours.
Elle répond à trois questions dans le parc : où on va maintenant, à quelle heure on y
sera, où on dépense les jokers Green Card.

Ce n'est pas un produit. C'est un outil personnel pour un séjour daté. Optimiser pour
la clarté du code et la fiabilité sur le terrain, pas pour la généricité.

## Commandes

```bash
npm install
npm run dev      # serveur de dev
npm run build    # tsc -b puis vite build, doit passer sans erreur avant tout commit
npm run preview  # sert dist/ pour tester le service worker
```

## Architecture

Une seule vue, trois onglets, pas de routeur. L'état vit dans `App.tsx` via `useState`
et se persiste dans `localStorage`. Pas de librairie d'état : à cette taille elle
ajouterait une couche sans rien résoudre.

```
src/data/rides.ts           36 attractions : id queue-times, quartier, durée,
                            intensité, brassage, éligibilité VirtualLine, clé OSM
src/lib/api.ts              client queue-times, chaîne de relais CORS, files virtuelles
src/lib/geo.ts              haversine, temps de marche, Overpass
src/lib/planner.ts          optimiseur glouton sous contraintes
src/lib/journal.ts          relevés, détection d'évènements, export Markdown
src/lib/storage.ts          persistance, export de la sélection
src/components/ParkMap.tsx  Leaflet, trois fonds de carte
src/styles.css              tous les tokens de design, aucun framework utilitaire
worker/queue-proxy.js       relais CORS Cloudflare
```

## Règles métier à ne pas casser

Elles viennent du terrain, pas d'une spec. Les modifier demande une source.

**Green Card.** Six attractions par carte, avec jusqu'à quatre accompagnants. Une carte
par jour, renouvelable chaque jour du séjour. Les six attractions sont **écrites sur la
carte au comptoir d'information**, donc la liste se décide avant d'y aller : l'app doit
produire une liste figée, pas une allocation qui change en cours de journée. Le temps
d'attente en cours doit s'écouler avant de refaire la même attraction. Modélisée à
7 minutes d'attente forfaitaires.

**VirtualLine.** Sept attractions concernées, marquées `vl: true` dans `rides.ts` :
blue fire, WODAN, Voltron Nevera, Poseidon, Voletarium, Euro-Mir, Pirates in Batavia.
queue-times n'expose que trois files virtuelles nommées, renseignées dans `vlId`, les
autres ne sont pas observables via l'API. Réservation posée en début de journée, fenêtre
de retour respectée, 10 minutes d'attente résiduelle.

**Un joker ne se pose jamais sur une attraction VirtualLine.** La file virtuelle est
gratuite et fait le même travail. Le préréglage « Mix » applique déjà cette règle.

**Compteur de brassage.** Chaque attraction porte `nau` de 0 à 5. Le compteur monte de
`nau * 13` après un tour, redescend de 0.55 par minute de marche et de file. Au-delà du
plafond choisi, l'attraction est écartée et une pause ou une attraction calme est
insérée. C'est la contrainte anti-nausée, c'est la raison d'être de l'app, ne pas la
contourner pour gagner des minutes.

**Projection d'affluence.** L'API ne donne que l'instant présent. `CURVE` dans
`planner.ts` estime l'attente à l'heure d'arrivée réelle. C'est une heuristique assumée,
à remplacer par des données réelles si un historique est collecté.

## Pièges connus

**CORS.** `queue-times.com` ne renvoie pas d'en-tête `Access-Control-Allow-Origin`. Les
relais publics dans `api.ts` tombent régulièrement. La version fiable est le Worker
Cloudflare, dont l'URL se colle dans le champ « relais personnel ».

**Rolldown.** Vite 8 utilise Rolldown : `manualChunks` doit être une **fonction**. La
forme objet héritée de Rollup lève `manualChunks is not a function` au build.

**Coordonnées.** L'API ne fournit pas les positions. Overpass les récupère au premier
lancement et les met en cache, avec repli sur des coordonnées posées à la main, justes
au quartier près. Le rapprochement se fait par la clé `k` de chaque attraction sur le
nom OSM. Si une attraction n'est jamais trouvée, corriger `k`, pas les coordonnées.

**Fonds de carte.** Esri World Imagery, OpenStreetMap, CARTO Dark. Aucun ne demande de
clé. Ne pas introduire un fournisseur à clé sans raison forte.

## Conventions

- Français dans l'interface, les commentaires et les messages de commit.
- Commentaires : expliquer le pourquoi, jamais le quoi. Une règle métier mérite un
  commentaire, une boucle non.
- CSS : tokens dans `:root` et `[data-theme="dark"]`. Pas de valeur en dur dans les
  composants, pas de framework utilitaire ajouté.
- Pas de `localStorage` dans du code destiné à tourner en artefact Claude ; ici on est
  dans un vrai déploiement, c'est autorisé et utilisé.
- Accessibilité : `aria-pressed` sur les bascules, focus visible conservé,
  `prefers-reduced-motion` respecté dans `styles.css` et dans la fonction `sparkle`.

## Ce qui reste ouvert

- Journalisation continue côté serveur : n8n, Schedule Trigger toutes les 5 minutes,
  HTTP Request sur l'endpoint JSON, insertion en base. Remplacerait `CURVE` par du réel.
- `App.tsx` approche les 500 lignes. Le découper par onglet avant d'y ajouter une
  fonctionnalité.
- Entrée anticipée de 45 minutes pour les résidents des hôtels du resort, non modélisée.
- Les durées de tour sont des estimations incluant l'embarquement, jamais vérifiées
  chronomètre en main.
