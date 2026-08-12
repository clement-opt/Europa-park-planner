# Documentation d'usage

Comment se servir de l'app, avant et pendant le séjour. Pour la mécanique interne, voir
`ARCHITECTURE.md`. Pour les règles métier et les interdits, voir `CLAUDE.md`.

## Installer l'app

L'app s'appelle **Plan de route**. Ce n'est pas une application de store, c'est une PWA :

- **iPhone / iPad** : ouvrir l'URL dans **Safari** — iOS n'autorise l'installation que
  depuis Safari — puis Partager → *Sur l'écran d'accueil*.
- **Android** : ouvrir l'URL dans Chrome → menu ⋮ → *Installer l'application*.

Une fois installée, elle fonctionne hors ligne : l'interface, les polices et le réseau
d'allées sont mis en cache. Seuls les temps d'attente ont besoin du réseau.

## La sauvegarde est partagée

Il n'y a **ni compte ni mot de passe**, seulement un **code de séjour** inscrit dans
l'app, section « Partage, export et journal ».

Tous les téléphones qui portent ce code lisent et écrivent la même fiche. Quelqu'un coche
une attraction comme faite, elle disparaît du parcours des autres dans les quinze
secondes. L'app publie une seconde et demie après le dernier appui et vérifie toutes les
quinze secondes si quelqu'un a modifié.

Un bouton coupe la synchronisation si l'un de vous veut préparer sa sélection dans son
coin. L'indicateur « Groupe » du bandeau affiche `synchro` quand tout va bien.

Les positions GPS, elles, **ne sont jamais partagées** : chacun garde la sienne.

## Les deux onglets

### Attractions

Tout ce qui se décide avant de marcher.

**Chercher et filtrer.** Un champ de recherche porte sur les noms, les quartiers, les
descriptions et les étiquettes. Au-dessus de la liste, les **filtres par étiquette** sont
cumulatifs : « Familial » plus « Aquatique » ne garde que ce qui est les deux. Ils ouvrent
automatiquement les quartiers concernés.

| Étiquette | Ce qu'elle veut dire |
| --- | --- |
| Sensations fortes | intensité 4 ou 5 |
| Sensations | intensité 3 |
| Familial | intensité ≤ 2 et brassage ≤ 2 |
| Tout-petits | attraction pour jeunes enfants |
| Aquatique | on ressort mouillé |
| Brassage élevé | brassage 4 ou 5, à surveiller |
| Calme | aucun brassage, aucune sensation |
| VirtualLine | file virtuelle disponible |

Elles sont **déduites** des caractéristiques de l'attraction, jamais saisies : corriger une
intensité met l'étiquette à jour toute seule.

**Les quartiers sont repliés** par défaut, chacun affichant son compte (`3 / 5`). Sans ça,
la page ferait trois écrans de haut avant le premier bouton utile.

**Sur chaque attraction**, quatre commandes :

| Commande | Rôle |
| --- | --- |
| case de gauche | sélectionner |
| billet | poser un joker Green Card (6 max) |
| VL | réserver une VirtualLine (grisé si non concernée) |
| étoile | imposer comme attraction d'ouverture |
| case de droite | marquer comme faite |

**Les réglages de journée** sont dans le bloc « La journée » : horaires, déjeuner,
tolérance au brassage, placement des attractions aquatiques, répartition des sensations
fortes, rythme de marche.

**Les listes enregistrées** figent un programme entier : les attractions, les jokers, les
VirtualLine, l'attraction d'ouverture **et le parcours calculé**. En charger une repart de
cet état complet et **vide les coches « déjà faite »**, qui appartenaient au programme
qu'on quitte. Celle dont la sélection est à l'écran est signalée « en cours » et se
réenregistre d'un bouton. Verrouillée, elle empêche de modifier la sélection ; seules les
attractions faites se cochent encore.

Depuis le bilan de fin de parcours, ce qui n'est pas entré dans la journée se met de côté
d'un bouton, sous la forme d'une liste « Reliquat » prête à charger sur l'autre jour.

Le bouton de calcul **suit le défilement**, en bas de l'écran, et rappelle le nombre
d'attractions retenues.

### Parcours

La carte et l'itinéraire, ensemble — l'itinéraire seul ne situe rien.

**La carte.** Trois fonds : Satellite, Plan, Sombre. Les pastilles sont colorées par temps
d'attente, les étapes numérotées et reliées par le tracé. Un badge en bas à gauche indique
si le tracé suit les **allées réelles** ou reste **approximatif**.

Cliquer une pastille ouvre une **mini-fiche** : nom, quartier, durée, brassage, attente,
description, le petit plus, la distance à pied depuis votre position, et un bouton pour
ajouter ou retirer du parcours.

**Le GPS.** Le bouton « Me localiser dans le parc » active le suivi. Il est volontairement
manuel : un GPS qui tourne en permanence vide la batterie qui doit tenir la journée. Une
fois actif :

- « Recalculer à partir de maintenant » **part d'où vous êtes** ;
- le panneau **« Autour de vous »** liste les six attractions les plus proches à pied, avec
  leur file. Un appui les ajoute au parcours.

**La prochaine étape** est mise en avant en haut, avec un gros bouton
**« Étape faite, on passe à la suivante »**.

**Chaque étape** porte deux actions, à ne pas confondre :

- **Fait** — l'attraction est accomplie, elle compte dans le bilan, le joker est consommé
- **Retirer** — elle sort du parcours, comme si vous ne l'aviez jamais choisie

Dans les deux cas l'étape disparaît et le reste est recalculé depuis l'heure et le lieu
réels. Si la 3 est devenue meilleure que la 2, elle passe devant sans qu'on le demande.

## Avant de partir

### Décider les six jokers

C'est la contrainte la plus importante et la plus facile à rater.

Les six attractions de la Green Card sont **écrites sur la carte au comptoir
d'information**, sous la Tour, quartier France, sur présentation de la carte d'invalidité
et d'une pièce d'identité. Une fois écrites, elles ne changent plus de la journée.

La liste se décide donc **avant** d'arriver au comptoir. Une carte par jour, renouvelable
chaque jour, jusqu'à quatre accompagnants.

**Ne jamais poser un joker sur une attraction VirtualLine.** La file virtuelle est gratuite
et fait le même travail. L'app retire automatiquement le VL quand on pose un billet, et
inversement.

### Régler la tolérance au brassage

C'est le réglage qui change le plus le résultat :

- **Estomac fragile (45)** — deux grosses sensations d'affilée deviennent impossibles
- **Équilibré (65)** — défaut, une pause calme s'intercale toutes les deux ou trois
- **On encaisse (88)** — quasiment aucune contrainte

## Sur place, la boucle

1. Activer le GPS en arrivant.
2. Appuyer sur **Étape faite** après chaque attraction.
3. Surveiller le bandeau : « hors ligne » veut dire que les temps affichés sont figés.

Le compteur « Jokers restants » décompte les jokers **consommés**, c'est-à-dire posés
ET cochés comme faits. Poser un joker ne le dépense pas.

## Le bandeau du haut

| Indicateur | Lecture |
| --- | --- |
| Données | âge du dernier relevé ; « hors ligne » = valeurs figées |
| Jokers restants | sur 6, décompte à la consommation |
| Étapes restantes | ce qu'il reste à faire dans le parcours |
| Attente moyenne | moyenne des attractions ouvertes |
| Marche | `allées` si le réseau piéton est chargé, `estimée` sinon |
| Position | état du GPS et précision |
| Groupe | état de la synchronisation |
| Relevés | taille du journal local |

## Les temps d'attente

L'app les lit dans cet ordre : **le serveur** d'abord, les relais publics ensuite, un relevé
figé en dernier recours. Le serveur collecte queue-times toutes les cinq minutes, ce qui
est la cadence de rafraîchissement de la source elle-même.

**Il n'y a rien à configurer.** Le champ « relais personnel » ne sert que si le serveur
devient injoignable, et il est rangé derrière un dépliant.

## Ce que l'app ne fait pas

- Pas de réservation de VirtualLine. Elle dit quand et quoi réserver ; la réservation se
  fait dans l'app officielle Europa-Park.
- **Entrée anticipée de 45 minutes** pour les résidents des hôtels du resort : non
  modélisée. Avancer l'heure de départ ne suffit pas, l'affluence des premières minutes
  n'a rien à voir avec celle de 9 h.
- Les durées de tour sont des estimations incluant l'embarquement, jamais vérifiées
  chronomètre en main.
- Les fiches d'attraction sont écrites de mémoire et méritent d'être confrontées au terrain.

## Développement

```bash
npm install
npm run dev      # serveur de dev
npm run build    # tsc -b puis vite build, doit passer avant tout commit
npm run preview  # sert dist/ pour tester le service worker

node scripts/check-api.mjs        # croise le référentiel avec l'API réelle
node scripts/audit-ergonomie.mjs  # contraste, cibles, noms accessibles, focus
node scripts/audit-scenarios.mjs  # 18 scénarios de terrain, horloge et relevés simulés
node scripts/cut-wagon.mjs --rails --rotation=-26   # détoure le wagon
node scripts/make-icons.mjs                        # icônes de la PWA, d'après le wagon
node scripts/cut-heads.mjs                         # découpe les visages du groupe
```

L'ordre compte : `make-icons` reprend le wagon détouré, donc `cut-wagon` passe avant.
L'original du wagon vit dans `design/`, jamais dans `public/` — ce dossier est recopié
tel quel dans `dist/` puis préchargé en entier par le service worker.

Le déploiement est branché sur GitHub : tout push sur `main` déclenche un build Vercel.
