# Documentation d'usage

Comment se servir de l'app, avant et pendant le séjour. Pour la mécanique interne, voir
`ARCHITECTURE.md`. Pour les règles métier et les interdits, voir `CLAUDE.md`.

## Ce que l'app répond

Trois questions, dans le parc, téléphone en main :

- **Où on va maintenant ?** onglet Itinéraire
- **À quelle heure on y sera ?** heure d'arrivée sur chaque étape
- **Où on dépense les jokers Green Card ?** onglet Attractions, bouton trèfle

Elle ne remplace pas l'affichage sur place. Elle ordonne une journée, elle ne la garantit
pas.

## Avant de partir

### 1. Déployer le relais

Sans relais personnel, l'app affiche « hors ligne » et sert des temps d'attente figés.
Les trois relais publics tombent régulièrement, c'est attendu.

1. Dashboard Cloudflare → Workers → Create → coller `worker/queue-proxy.js` → Deploy.
2. Dans l'app, onglet Attractions, champ « Relais personnel ».
3. Coller l'URL **terminée par `/?url=`** :

```
https://mon-worker.workers.dev/?url=
```

Le suffixe est obligatoire. Sans lui, le Worker répond 400 et l'app repart sur les relais
publics sans le dire.

Le champ n'apparaît que lorsque l'app est en mode figé. Une fois le relais valide, le
bandeau disparaît ; l'URL reste enregistrée.

### 2. Décider les six jokers

C'est la contrainte la plus importante et la plus facile à rater.

Les six attractions de la Green Card sont **écrites sur la carte au comptoir
d'information**, sous la Tour, quartier France, sur présentation de la carte d'invalidité
et d'une pièce d'identité. Une fois écrites, elles ne changent plus de la journée.

Donc : la liste se décide **avant** d'arriver au comptoir. C'est tout l'objet de l'onglet
Attractions.

Une carte par jour, renouvelable chaque jour du séjour. Jusqu'à quatre accompagnants par
carte. Le temps d'attente en cours doit s'écouler avant de refaire la même attraction.

**Ne jamais poser un joker sur une attraction VirtualLine.** La file virtuelle est
gratuite et fait le même travail ; le joker y est gaspillé. Le préréglage « Mix » applique
déjà cette règle, et l'app retire automatiquement le VL quand on pose un trèfle, et
inversement.

### 3. Régler la journée

| Réglage | Effet |
| --- | --- |
| Départ / Fin | bornes du plan, rien n'est programmé au-delà |
| Déjeuner + durée | pause insérée dès que l'heure est atteinte |
| Tolérance au brassage | plafond du compteur anti-nausée |
| Rythme de marche | 3 à 6 km/h, majoré de 35 % pour les détours d'allées |

La tolérance au brassage est le réglage qui change le plus le résultat :

- **Estomac fragile (45)** — deux grosses sensations d'affilée deviennent impossibles
- **Équilibré (65)** — défaut, une pause calme s'intercale toutes les deux ou trois
- **On encaisse (88)** — quasiment aucune contrainte

## Les trois onglets

### Attractions

Regroupées par quartier. Chaque ligne porte quatre commandes :

| Commande | Rôle |
| --- | --- |
| case de gauche | sélectionner l'attraction |
| trèfle | poser un joker Green Card (6 max) |
| VL | réserver une VirtualLine (grisé si non concernée) |
| case de droite | marquer comme faite |

Les boutons trèfle et VL ne s'activent qu'après avoir sélectionné l'attraction.

**Rien n'est coché au démarrage.** Les quatre préréglages ne s'appliquent que sur clic :

- **Mix sensations + calme** — grosses sensations plus attractions douces, pose
  automatiquement les six jokers sur les files les plus longues sans VirtualLine
- **Grosses sensations** — intensité ≥ 4, aucun joker posé
- **Tout doux** — brassage ≤ 1, aucun joker posé
- **Tout décocher** — remet le jour à zéro

Cliquer un préréglage dans la première seconde après l'ouverture peut donner une liste
sans jokers : les temps d'attente ne sont pas encore arrivés. Recliquer suffit.

### Carte

Trois fonds : Satellite (Esri), Plan (OSM), Sombre (CARTO). Aucun ne demande de clé.

Les pastilles sont colorées par temps d'attente — vert sous 20 min, orange jusqu'à 45,
rouge au-delà, gris si fermé. Une fois l'itinéraire calculé, les étapes sont numérotées et
reliées par un tracé pointillé depuis l'entrée. Cliquer une pastille sélectionne ou
désélectionne l'attraction.

La mention sous la carte indique la provenance des positions. « Positions estimées » signifie
qu'OpenStreetMap n'a pas répondu : les temps de marche restent des ordres de grandeur.

### Itinéraire

Chaque étape affiche l'heure d'arrivée, le temps de marche, la file attendue, la durée du
tour, et le gain quand le joker ou la VirtualLine fait économiser plus de 4 min. L'étape en
cours est mise en évidence selon l'heure réelle.

**« Recalculer à partir de maintenant »** est le bouton du terrain. Il repart de l'heure
courante et de la position de la dernière attraction cochée, pas du début de journée.
À utiliser dès que le plan a dérivé.

## Sur place, la boucle

1. Marquer chaque attraction faite au fur et à mesure (case de droite ou bouton sur l'étape).
2. Quand le plan a dérivé de plus de vingt minutes, **Recalculer à partir de maintenant**.
3. Surveiller le bandeau de données : « hors ligne » veut dire que les temps affichés sont
   figés et que le plan repose sur des valeurs mortes.

Le compteur « Jokers restants » décompte les jokers **consommés**, c'est-à-dire posés
ET cochés comme faits. Poser un joker ne le dépense pas.

## Bandeau du haut

| Indicateur | Lecture |
| --- | --- |
| Données | âge du dernier relevé ; « hors ligne » = valeurs figées |
| Jokers restants | sur 6, décompte à la consommation |
| Relevés journalisés | taille du journal local |
| Attente moyenne | moyenne des attractions ouvertes |
| Positions | `OSM` si l'appariement a réussi, `estimées` sinon |

Le point de l'indicateur Données passe à l'orange au-delà de 12 minutes sans relevé frais.

## Journal des relevés

L'app enregistre un relevé toutes les 2 minutes **tant qu'elle est ouverte**, uniquement
quand les données sont réelles. Elle en déduit les ouvertures et fermetures d'attractions,
les ouvertures et fermetures de VirtualLine, et les pics de plus de 25 minutes.

« Télécharger le journal (.md) » produit un Markdown avec les évènements, une synthèse
min/moyenne/max par attraction et les 200 derniers relevés bruts.

Deux limites à connaître :

- la collecte s'arrête dès que l'onglet est fermé ;
- les données vivent dans le `localStorage` du navigateur, donc un seul appareil, et elles
  disparaissent si le stockage est vidé.

**Exporter le journal chaque soir** est le seul moyen de ne pas les perdre. C'est aussi la
matière première de la collecte continue décrite dans `ARCHITECTURE.md`.

## Sauvegarde et partage

- **Copier ma sélection** — résumé texte des deux jours, jokers et VirtualLine compris
- **Exporter la sélection (.json)** — les deux jours en JSON
- **Réinitialiser le jour N** — vide sélection, jokers, VL, faites et itinéraire du jour courant

Il n'y a pas d'import : le JSON sert d'archive et de moyen de relecture, pas de
synchronisation entre appareils.

## Ce que l'app ne fait pas

- Pas de synchronisation entre les téléphones du groupe. Chacun a son état local.
- Pas de réservation de VirtualLine. L'app dit quand et quoi réserver, la réservation se
  fait dans l'app officielle Europa-Park.
- **Entrée anticipée de 45 minutes** pour les résidents des hôtels du resort : non modélisée.
  Si vous en bénéficiez, avancer l'heure de départ ne suffit pas — l'affluence des premières
  minutes n'a rien à voir avec celle de 9 h.
- Les durées de tour sont des estimations incluant l'embarquement, jamais vérifiées
  chronomètre en main.

## Développement

```bash
npm install
npm run dev      # serveur de dev
npm run build    # tsc -b puis vite build, doit passer avant tout commit
npm run preview  # sert dist/ pour tester le service worker
```

Le déploiement est branché sur GitHub : tout push sur `main` déclenche un build Vercel.
