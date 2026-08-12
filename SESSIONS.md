# Journal des sessions

Où en est le projet, session par session. À lire en premier pour reprendre le travail,
à compléter en dernier avant de clore une session.

**Convention.** Une entrée par session, la plus récente en haut. Chaque entrée dit ce qui
a été fait, ce qui a été constaté, et ce qui reste ouvert. On n'y recopie pas le diff :
git le fait déjà. On y écrit ce que git ne dit pas — pourquoi, et où on s'est arrêté.

---

## Session 22 — 12/08/2026 · Recalculer veut dire maintenant

**Le bouton principal partait de l'heure d'ouverture.** À 11 h dans le parc,
« Recalculer » rendait un parcours démarrant à 9 h, avec des horaires déjà passés. Il
part désormais de l'heure réelle dès que la journée est commencée, et le libellé le
dit : « Recalculer depuis 11:14 ».

**Conséquence en chaîne, et mea culpa.** La règle posée en session 17 — n'accepter un
nouveau plan que s'il place au moins autant d'attractions qu'avant — comparait deux
choses qui n'étaient pas comparables : l'ancien plan partait de 9 h, le nouveau de
l'heure réelle, donc il en plaçait toujours moins et le parcours restait **figé**.
Retirer ou ajouter une attraction ne changeait plus rien à l'écran. Les deux plans
partant maintenant de la même heure, une baisse est légitime : on ne retient plus que
le cas catastrophique, plus une seule attraction placée alors qu'il en reste.

**« Respiration » à répétition.** La pause était forfaitaire, dix à vingt minutes, sans
garantie de faire repasser quoi que ce soit sous le plafond de brassage : la boucle
empilait alors les pauses. La durée est maintenant **calculée** pour que la plus douce
des attractions restantes redevienne admissible, et on ne réessaie pas deux fois de
suite. La contrainte anti-nausée est inchangée — c'est la raison d'être de l'app —,
c'est sa mise en scène qui était absurde.

**Le reliquat devient une liste.** Ce qui n'entre pas dans la journée se met de côté
d'un bouton, depuis le bilan de fin de parcours, déverrouillé et prêt à être chargé sur
l'autre jour.

**L'heure se relit au réveil de l'app**, plus seulement toutes les vingt secondes : on
sort le téléphone de sa poche après un tour, l'étape en cours et le bandeau de fin de
journée doivent être justes tout de suite.

**`scripts/audit-scenarios.mjs`** — dix-huit scénarios de terrain indépendants, horloge
simulée et relevés pilotés depuis le test. Demandé après trois échanges perdus sur le
même symptôme. Chacun rejoue une situation vécue : parc fermé, recalcul à 11 h et à
17 h, attraction imposée fermée ou déjà faite, validation, retrait, ajout, fin de
journée dépassée, prolongation, listes enregistrées et rechargées, joker sur
VirtualLine, plafond de brassage, respirations consécutives, reliquat. Un échec n'en
masque aucun autre.

## Session 21 — 12/08/2026 · Sept coches de la veille

**Le vrai coupable, lu dans l'état serveur du séjour.** `first` valait bien 5604,
Silver Star, sur le jour actif — mais elle figurait parmi **sept attractions cochées
« déjà faites »**, à 9 h 12, douze minutes après l'ouverture du parc. Des essais de la
veille, jamais remis à zéro. Le planificateur avait raison de ne plus l'imposer ; le
défaut était de n'en rien dire, l'étoile restant allumée.

Ni l'étoile ni le cache n'étaient en cause. Trois sessions passées à corriger des
défauts réels mais secondaires, faute d'avoir regardé l'état plutôt que le code.

**Ce qui change**

- Le parcours écrit l'état de l'ouverture imposée dans **tous** les cas, avec un bouton
  pour remettre l'attraction à faire. Aucun bandeau ne se déclenchait quand l'étoile
  n'était pas posée : rien ne distinguait « pas imposée » de « imposée puis ignorée ».
- Les réglages du jour récapitulent les attractions cochées faites, avec un bouton pour
  toutes les remettre à faire.
- La version de build et un bouton « Forcer la mise à jour » sont affichés : le service
  worker ressert la version précédente tant que l'app n'a pas été fermée, et rien à
  l'écran ne distinguait les deux.

**Les listes enregistrées deviennent l'unité de programme** — demandé pour éviter que
ce genre d'incident se reproduise. Une liste emporte désormais la sélection, les
jokers, les VirtualLine, **l'attraction d'ouverture et le parcours calculé**. La
charger repart de cet état complet et **vide les coches « déjà faite »** : ce sont
elles qui appartenaient au programme qu'on quitte. La liste dont la sélection est à
l'écran est signalée « en cours » et se réenregistre d'un bouton.

L'état actif est **déduit** de la sélection, jamais stocké : un drapeau posé à
l'application se serait périmé au premier changement, et c'est exactement la famille de
défaut qu'on essaie d'éteindre.

## Session 20 — 12/08/2026 · Une consigne n'est pas une candidate

**Sur place, à 9 h 03, parc ouvert, Swiss Bob Run en tête malgré l'étoile.** Les
relevés datent la scène à la minute : à 07 h 00 UTC Silver Star était **fermée** et
Swiss Bob Run ouverte ; à 07 h 05 Silver Star ouvrait avec dix minutes d'attente. Le
parcours a été calculé dans cet intervalle de cinq minutes.

La correction de la session 19 ne suffisait pas : elle rendait l'attraction imposée
candidate **en planification à l'avance**, mais dans le parc — donc à partir de
maintenant — l'état d'ouverture continuait de commander. Le défaut de fond était de
traiter `first` comme une candidate soumise aux mêmes filtres que les autres.

Une attraction qu'on impose est une décision. Elle est désormais placée en tête dès
qu'elle est sélectionnée et non faite, **sans consulter son état d'ouverture** ; à
défaut d'attente projetée, on prend la référence. Une ouverture décalée de quelques
minutes au lever du parc ne défait plus la consigne — un bandeau la signale, et c'est
tout.

**Constaté**

- `left.indexOf(forced)` peut valoir −1, justement quand l'attraction est fermée. Le
  `splice(-1, 1)` qui en découlait retirait la **dernière** candidate de la liste.
  C'est le genre de défaut que l'ancienne garde masquait : elle rendait la branche
  inatteignable dans ce cas précis.
- Le scénario est maintenant joué dans les deux sens : parcours préparé à l'avance, et
  recalcul depuis maintenant.

## Session 19 — 12/08/2026 · L'attraction imposée était écartée en silence

**Signalé du terrain : l'étoile sur Silver Star, et une autre attraction en tête.**
La collecte donne la réponse — Silver Star est relevée **fermée** sur 57 des 72
dernières heures, la dernière fois à 06 h 50 UTC, avant l'ouverture. Or le bloc
« attraction imposée » est gardé par `left.includes(forced)`, et `left` écarte les
attractions fermées. L'étoile restait allumée, la contrainte disparaissait, et rien
ne le disait.

Le correctif de la session 18 traite déjà le cas de fond : en planification à
l'avance, une attraction fermée maintenant redevient candidate. Restaient les
silences, tous corrigés :

- Un bandeau nomme l'attraction imposée qui n'a pas pu être placée, et donne la
  raison : hors sélection, relevée fermée, ou sans place trouvée.
- **Décocher l'attraction d'ouverture ne levait pas la contrainte.** `first` désignait
  alors une attraction absente de `sel`, que le planificateur ignorait sans un mot —
  l'étoile restait allumée sans plus rien imposer. `onRemove` nettoyait déjà `first`,
  `onSelect` non.

**Constaté — le test se trompait deux fois, dans les deux sens.**

- Il comptait `.stop`, classe partagée par les attractions **et** les pauses. Une
  replanification qui redistribue les respirations passait pour une perte
  d'attractions. Il compte maintenant les lignes qui portent le bouton « Fait ».
- L'assertion « exactement une de moins » après validation était fausse : une
  replanification acceptée peut en **recaser davantage** qu'il n'y en avait. Le bon
  invariant est « jamais moins ». Écrit ainsi, il attrape le vrai défaut — la
  disparition — sans se déclencher sur une optimisation légitime. Les deux versions
  précédentes de ce test étaient chacune fausses d'un côté : trop lâche hier, trop
  stricte ce matin.
- Un `<details>` fermé sort de l'arbre d'accessibilité : l'étoile d'une attraction
  n'existe ni pour le clavier ni pour le test tant que son pays est replié.

## Session 18 — 11/08/2026 · Préparer un parcours quand le parc est fermé

**On ne pouvait pas organiser sa journée le soir.** `buildPlan` écartait toute
attraction dont le relevé disait « fermée », y compris quand on planifie à l'avance :
après la fermeture, les 36 étaient écartées et le calcul rendait une liste vide, sans
raison lisible. Or préparer un parcours pour demain, c'est le préparer pour un jour où
le parc sera ouvert — l'état de l'instant n'en dit rien.

Distinction posée : en cours de journée (`fromNow`) une attraction fermée l'est
vraiment et reste écartée ; à l'avance, on repart des attentes de référence de
`SNAPSHOT` pour celles que le direct dit fermées, et on garde le relevé réel pour les
autres. Le parcours porte alors un bandeau qui dit qu'il est prévisionnel et invite à
le recalculer sur place. Mesuré : **25 étapes préparées au lieu d'aucune**.

**L'attraction d'ouverture était introuvable.** L'étoile qui l'impose ne vivait que sur
la ligne de chaque attraction, sans autre indication qu'un `title` — invisible au doigt.
Un réglage « Attraction d'ouverture » rejoint le bloc « La journée » : il affiche le
choix courant, permet de le retirer, et dit où appuyer quand il n'y en a pas. Le bouton
a désormais un nom accessible explicite.

**Constaté**

- Le test du parc fermé simule la réponse du serveur plutôt que d'attendre la nuit :
  `page.route` sur `rpc/ep_waits` renvoie les 36 attractions fermées.

## Session 17 — 11/08/2026 · Valider une étape effaçait le parcours

**Deux planificateurs qui ne parlaient pas de la même journée.** Le bouton principal
calcule la journée entière depuis l'heure de début ; tout ce qui vient ensuite —
valider une étape, en retirer, en ajouter — replanifie depuis l'heure **réelle**.
À 18 h, un plan de 34 attractions bâti pour la journée complète retombait à 8. Passé
l'heure de fin, à zéro. Cocher la première attraction en effaçait donc vingt-six.

`compute` avait bien le garde-fou — il refuse de recalculer passé l'heure de fin — mais
les trois autres chemins ne l'avaient pas. Règle posée : **une replanification
automatique n'accepte le nouveau plan que s'il place au moins autant d'attractions
qu'il en restait.** C'est le cas courant en cours de journée, et les horaires s'y
rafraîchissent ; sinon l'ordre est gardé, l'étape cochée sort de l'affichage, le reste
remonte, et un message dit pourquoi. Le bouton « Mettre à jour » reste le moyen
explicite d'obtenir un parcours calé sur le temps qui reste.

**Deux défauts de la même famille, trouvés en cherchant.**

- « Réinitialiser le jour » effaçait sélection, jokers, VirtualLine et parcours en un
  seul tap, sans retour arrière. Passé à deux gestes via `BoutonDanger`, qui écrit la
  question et ce qu'on perd sur le bouton lui-même, et se désarme après cinq secondes.
  Même traitement pour « Effacer le journal » et pour la croix qui supprimait un lot —
  une sélection qu'on a justement pris le temps de figer.
- **La sauvegarde partagée pouvait écraser le groupe.** La poussée est différée d'une
  seconde et demie, la lecture n'a aucun délai garanti : sur le réseau du parc, un
  téléphone qui démarre publiait son état local avant d'avoir lu celui des autres.
  Rien ne part plus tant qu'une lecture n'a pas abouti. Et un état reçu du serveur n'y
  retourne plus : les quatre appareils se renvoyaient la même sauvegarde toutes les
  quinze secondes, chaque aller-retour offrant une occasion de perdre une modification.

**Constaté**

- Le test « étape faite » de `audit-parcours.mjs` vérifiait « moins d'étapes qu'avant ».
  Un parcours vidé d'un coup passait donc le test — c'est ce qui a laissé le défaut
  vivre. Il vérifie maintenant l'égalité stricte, `n − 1`, et deux scénarios sont
  ajoutés : validation après l'heure de fin avec horloge simulée, et double geste sur
  les actions irréversibles.
- La carte de bilan attribuait les attractions non placées aux fermetures et au plafond
  de brassage, en oubliant la cause la plus fréquente : le temps qui manque.

## Session 16 — 11/08/2026 · La photo du wagon, enfin posée

**La photo n'avait jamais été intégrée** : le mécanisme était prêt depuis la session 8,
mais aucun fichier source n'était dans le dépôt, donc l'écran de lancement retombait
sur les passagers dessinés. Le fichier était pourtant sur le disque de la session, dans
`~/.claude/uploads/` — je ne l'y avais pas cherché.

**Le détourage a dû être refait.** L'ancienne règle — distance de couleur au fond,
balayée sur toute l'image — ne pouvait pas marcher ici : un sweat noir n'est qu'à 89 du
bleu nuit, soit plus près que le pilier à effacer. Elle aurait percé les vêtements avant
de nettoyer le décor. Deux critères l'ont remplacée :

- **Le fond** est le seul élément bleuté. Son écart bleu − rouge va de 33 à 87 ; aucun
  pixel des passagers ne dépasse 14, peau, cheveux et noirs étant neutres ou chauds.
- **La voie et les piliers** sont peints en blanc translucide : ils prennent la teinte
  de ce qu'ils recouvrent, et aucun seuil ne les distingue du sweat gris d'une
  passagère. Ce qui les trahit est topologique — ce sont les seules choses opaques qui
  touchent encore le bord de l'image.

Les deux passes propagent depuis le cadre au lieu de balayer : une couleur de décor
prisonnière du sujet n'est jamais atteinte, donc ne perce pas de trou. C'est ce qui
laisse quelques échardes bleues entre une épaule et la caisse — invisibles, elles ont
la couleur du ciel de l'écran de lancement. Une dernière passe retire les miettes que
la propagation ne pouvait pas atteindre : les étoiles, et les traverses sombres restées
à flotter dans un rail devenu transparent.

**Redressée de 26°.** `animateMotion` incline déjà le wagon selon la pente ; une photo
en pente aurait cumulé les deux. Et comme le wagon photographié est bien plus long que
celui qu'il remplace, il décollait du rail par les deux bouts sur une crête : enfoncé de
6 unités, il enjambe la voie au lieu de la survoler. Vérifié à cinq instants du trajet.

**L'icône reprend le wagon** plutôt qu'un selfie rogné en rond, qui ne gardait qu'un
visage ou deux à 192 px.

**Constaté**

- `public/` est recopié tel quel dans `dist/` puis préchargé **en entier** par le service
  worker. L'original de 1,5 Mo y aurait été téléchargé sur chaque téléphone sans jamais
  être affiché : il vit maintenant dans `design/`, hors de la publication.
- `icon-fallback.png` était généré mais référencé nulle part — 93 Ko préchargés pour
  rien. Supprimé.
- Malgré l'ajout de la photo, le précache est revenu à son niveau d'avant (1 199 Ko) :
  la palette indexée a plus que compensé.

## Session 15 — 11/08/2026 · Le défilement animé se faisait écraser

**Le retour en haut ne marchait toujours pas sur l'appareil**, alors qu'il passait au
test. Cause : `behavior: "smooth"`. Le défilement animé démarre, puis la liste rétrécit
sous lui — les étapes validées disparaissent et `motion` anime leur hauteur — et le
navigateur écrête la course en plein vol. Le test ne le voyait pas parce qu'il mesurait
après stabilisation.

Trois changements : défilement **instantané** au lieu d'animé, `document.scrollingElement`
ajouté aux cibles, et **trois passes** — après le rendu de React, après la peinture, puis
260 ms plus tard quand les animations de hauteur sont retombées. Mesuré à 120 ms, 520 ms
et 2 s après le clic : 0 partout, sur « Fait » comme sur « Retirer ».

**« Ça s'arrête à 15 h 19 »** — ce n'était pas la collecte : 1 950 relevés, 50 exécutions,
zéro erreur, dernière à 19 h 00 locale. C'était l'itinéraire, qui s'arrêtait sans dire
pourquoi. Une carte de fin l'explique désormais : soit toutes les attractions sont
placées et il n'y a plus rien à faire, soit certaines n'ont pas pu l'être — fermées ou
écartées par le plafond de brassage — et elle en donne le nombre. Elle indique aussi le
temps restant avant l'heure de fin, avec un bouton pour ajouter des attractions.

## Session 14 — 11/08/2026 · Le retour en haut ne couvrait qu'un chemin sur quatre

Le retour en haut n'était posé que dans `compute`, donc sur « Calculer » et
« Recalculer ». « Étape faite » passe par l'effet de ré-optimisation, « Retirer » et
« Ajouter » par `replan` : **trois chemins sur quatre refaisaient le parcours sans jamais
remonter**, laissant l'écran au milieu d'une liste dont les étapes avaient changé.

Le défilement est extrait dans un `remonter()` unique, appelé par les quatre. Il ne
s'applique **que dans l'onglet Parcours** : cocher une attraction depuis la liste des 36
ne doit pas faire perdre sa place. Fenêtre et panneaux défilent tous les deux, puisque
c'est la fenêtre qui porte le défilement sur téléphone et le panneau au-delà de 1180 px.

Mesuré, départ à 1400 px dans tous les cas :

| Action | Avant → après |
| --- | --- |
| Fait | 1400 → 0 |
| Retirer | 1400 → 0 |
| Recalculer | 1400 → 0 |
| Ajouter | 1400 → 0 |
| Onglet Attractions | reste en place |

## Session 13 — 11/08/2026 · Horaires réels et parcours d'après l'historique

**Fermeture à 20 h.** Information de terrain : le parc fermait à 20 h ce jour-là. Le défaut
de fin de journée passe de 18 h à 20 h. Ce n'est **pas** une donnée d'API — les horaires du
parc n'y figurent pas — mais un défaut de saison, corrigeable dans les réglages.

Surtout, la collecte sait maintenant le recouper : `ep_horaires()` renvoie l'amplitude
réellement observée par jour, et l'app propose l'heure mesurée sous le champ « Fin ».
Le garde-fou compte : une fermeture n'est proposée que si **la collecte a continué après**
la dernière attraction ouverte. Sinon on ne mesurerait que sa propre fin de créneau.

**Parcours d'après l'historique.** `ep_courbe()` calcule le facteur d'affluence par heure,
globalement et par attraction, depuis les relevés. `projectedWait` s'en sert par ordre de
précision : profil de l'attraction, profil global, puis `CURVE` écrite à la main.

Deux seuils, parce qu'une prédiction bâtie sur trois relevés est pire que l'heuristique
qu'elle remplace : **20 relevés** pour retenir une heure, **4 heures couvertes** pour
qu'une attraction ait son profil propre. Résultat aujourd'hui : le profil est **vide**, et
c'est correct — une après-midi ne donne que ~12 relevés par tranche horaire. Il s'activera
tout seul dès le deuxième jour de collecte. Le bandeau affiche `estimée` ou `N h mesurées`.

**Le tracé repartait toujours de l'entrée du parc**, même après cinq attractions faites,
quand le GPS était coupé. Il part maintenant de la dernière attraction cochée.

**Vérifié** : fin par défaut à 20:00 ; l'indice d'horaires ne s'affiche pas quand la fin
est déjà juste ; la carte se met bien à jour sur « Étape faite » (21 → 11 pastilles
numérotées) ; avec un profil simulé de 11 h, l'indicateur bascule et les files projetées
changent.

## Session 12 — 11/08/2026 · Trois bugs de fin de journée

Signalés à 18 h 30 sur le terrain. Les deux derniers avaient la **même cause**.

**1. « Parc fermé » à 18 h 30 alors qu'il était ouvert.** L'en-tête affichait l'ouverture
d'après une plage `9 h – 18 h` **écrite en dur**. En août le parc ferme bien plus tard :
l'heure inventée contredisait la réalité. L'état se lit désormais dans les données —
le parc est ouvert si au moins une attraction l'est — et affiche `—` tant que les
relevés ne sont pas réels, plutôt que d'affirmer quoi que ce soit.

**2 et 3. Le parcours sortait vide après 18 h.** `buildPlan` pose
`t = max(début, heure courante)` puis boucle tant que `t < fin`. Avec une fin de journée
à 18 h 00 et une heure courante à 18 h 30, **la boucle ne tournait jamais** : tout
« recalculer à partir de maintenant », tout retrait et tout ajout renvoyaient un plan
vide, sans le moindre message. C'est ce qui donnait « ça met pas bien » et « ça met pas à
jour selon les horaires ».

Trois correctifs :

- un bandeau explicite quand l'heure dépasse la fin choisie, avec **+ 1 h, + 2 h, + 3 h**
  pour prolonger d'un geste, sans ouvrir les réglages ;
- le bouton de recalcul est désactivé tant que la journée est finie, au lieu de produire
  un vide silencieux ;
- un plan vide le dit : « Aucune attraction ne rentre dans le temps restant ».

**4. Le recalcul ne remontait pas en haut.** On restait au milieu de l'ancienne liste, sur
des étapes qui n'étaient plus les mêmes. Il défile désormais en tête, fenêtre et panneau.

**Vérifié** en simulant 18 h 30 dans le navigateur : bandeau présent, bouton désactivé,
prolongation de 2 h → bandeau disparu, recalcul rendant **7 étapes** au lieu de 0,
défilement revenu à 0.

**Note pour plus tard** : les horaires réels du parc ne sont pas dans l'API. La fin de
journée reste donc un réglage, pas une donnée. La collecte permettra à terme de déduire
l'heure de fermeture des relevés, en observant quand toutes les attractions ferment.

## Session 11 — 11/08/2026 · Ergonomie, documentation, audits versionnés

**Ergonomie corrigée** — trois défauts mesurés, pas devinés :

- **Contraste.** `--ink-3` était à 3,97 en sombre et 3,57 en clair, sous le seuil AA de 4,5.
  Valeurs recalculées : `#978A77` et `#786956`, mesurées à 4,59 et 4,56.
- **Le pire cas était l'état sélectionné.** En thème sombre `--rail` est un bleu clair, et
  le blanc posé dessus tombait à **2,59** : « Jour 1 », « Équilibré », « Tôt » étaient les
  libellés les moins lisibles de l'écran, alors que ce sont ceux qui disent ce qui est
  actif. Un jeton `--on-rail` porte l'encre à poser sur un aplat rail — 6,11 en sombre.
- **Trois champs sans nom accessible** : curseur de rythme, nom de lot, URL du relais.
- Puces de filtre portées de 36 à 40 px, attribution Leaflet de 11 à 12,5 px.

**Faux positif de ma propre méthode** : l'audit signalait les champs horaires comme
« sans nom ». Il ne reconnaissait pas les `<label for>`, pourtant valides. C'est le
contrôle qui était faux, pas le code.

**Documentation remise à niveau.** `DOCUMENTATION.md` décrivait encore trois onglets, le
Worker obligatoire, ni GPS ni étiquettes ni lots. `ARCHITECTURE.md` a été repris sur
l'arborescence, les sources de données et l'ordre de lecture des temps d'attente.

**Audits versionnés** — `scripts/audit-ergonomie.mjs` et `scripts/audit-parcours.mjs`,
rejouables sur `npm run preview`. Les deux passent à zéro défaut.

**Collecte** : 1 131 relevés sur 4 heures, **aucun échec**.

**Reste ouvert** — tout est bloqué sur un élément extérieur :

- [x] Photo du wagon — faite en session 16, la source était dans `~/.claude/uploads/`.
- [ ] Comparer `europa_park.curve` à `CURVE` : demande plusieurs jours de collecte.
- [ ] Confirmer si sept VirtualLine sont réservables simultanément : demande une source.
- [ ] Vérifier durées de tour et fiches d'attraction sur place.

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
