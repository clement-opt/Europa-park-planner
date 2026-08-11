# Europa-Park · Plan de route

PWA d'optimisation de parcours pour Europa-Park. Pensée pour un groupe de 4 adultes
sur un séjour de 2 jours, avec une Green Card et les VirtualLine.

Elle répond à trois questions, en direct, dans le parc : **où on va maintenant**,
**à quelle heure on y sera**, et **où on dépense les jokers**.

---

## Démarrer

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # dist/ prêt à déployer
```

Stack : React 19, Vite 8 (Rolldown), TypeScript 7, Leaflet 1.9, Motion 13,
vite-plugin-pwa 1.3. CSS écrit à la main, sans framework utilitaire.

> Piège Vite 8 : le bundler est Rolldown, `manualChunks` doit être une **fonction**.
> La forme objet héritée de Rollup lève `manualChunks is not a function`.

Déploiement Vercel : importer le dépôt, framework détecté automatiquement (Vite),
aucune variable d'environnement.

Sur iPhone une fois en ligne : Partager → Sur l'écran d'accueil. L'app s'installe
en plein écran et fonctionne hors connexion grâce au service worker.

---

## Travailler avec un agent

Le dépôt embarque deux fichiers destinés aux agents de code.

`CLAUDE.md` est lu automatiquement au démarrage d'une session Claude Code. Il contient
l'architecture, les règles métier de la Green Card et des VirtualLine, les pièges connus
(CORS, Rolldown, coordonnées OSM) et les conventions. Le tenir à jour quand une règle
change vaut mieux que de la réexpliquer à chaque session.

`.mcp.json` déclare le serveur MCP GitHub en portée projet.

```bash
npm install -g @anthropic-ai/claude-code
cd europa-park-planner
claude
```

Au premier lancement, Claude Code demande d'approuver le serveur MCP du projet.
Puis `/mcp` dans la session pour lancer l'authentification GitHub.

Pour l'ajouter à la main ailleurs :

```bash
claude mcp add --transport http --scope project github https://api.githubcopilot.com/mcp/
claude mcp list    # affiche l'état : Connected, Needs authentication, Failed to connect
```

> Deux pièges de configuration MCP. Une entrée qui a une `url` mais pas de `type` est
> interprétée comme un serveur stdio et ignorée. Et les drapeaux de `claude mcp add`
> (`--transport`, `--scope`, `--header`) doivent tous précéder le nom du serveur.

Sur le connecteur GitHub de l'app Claude, la lecture fonctionne mais l'écriture renvoie
403 : les permissions sont en lecture seule. Dans Claude Code, l'écriture passe par
`git` en local, donc la question ne se pose pas.

---

## Le relais CORS

`queue-times.com` ne renvoie pas d'en-tête `Access-Control-Allow-Origin`, donc un
navigateur ne peut pas appeler l'API directement. L'app tente d'abord trois relais
publics, qui tombent régulièrement. La version fiable est dans `worker/queue-proxy.js` :

```bash
npx wrangler deploy worker/queue-proxy.js --name queue-proxy
```

Puis coller `https://queue-proxy.<votre-sous-domaine>.workers.dev/?url=` dans le champ
« relais personnel » qui apparaît quand l'API est injoignable. La valeur est mémorisée.

---

## Ce que fait le planificateur

Algorithme glouton sous contraintes. À chaque étape il retient l'attraction au meilleur
rapport valeur / coût, le coût étant `marche + file + tour`.

- **Projection d'affluence.** L'API ne donne que l'instant présent. Une courbe de
  fréquentation type (creux à l'ouverture, pic entre 13 h et 15 h, décrue en fin de
  journée) sert à estimer l'attente à l'heure où l'on arrivera réellement.
- **Compteur de brassage.** Chaque attraction porte une note de 0 à 5. Le compteur monte
  après chaque tour, redescend pendant la marche et la file. Quand il approche du plafond
  choisi, les sensations fortes sont écartées et une attraction calme ou une pause est
  insérée. C'est le garde-fou anti-nausée.
- **Jokers Green Card.** 7 minutes d'attente forfaitaires, six par jour.
- **VirtualLine.** Réservation posée en début de journée, fenêtre de retour respectée,
  10 minutes d'attente résiduelle sur place.
- **Marche.** Distance à vol d'oiseau majorée de 35 % pour les détours, plancher à
  3 minutes, vitesse réglable.

---

## Positions des attractions

Récupérées au premier lancement depuis **OpenStreetMap via Overpass** (gratuit, sans clé),
puis mises en cache. Rapprochement par mot-clé sur le nom OSM. Ce qui n'est pas trouvé
retombe sur des coordonnées posées à la main, correctes au quartier près.

L'indicateur « Positions » dans le bandeau dit laquelle des deux sources est active.

Fonds de carte : Esri World Imagery (satellite), OpenStreetMap (plan), CARTO Dark.
Aucun ne demande de clé d'API.

---

## Journal des temps d'attente

Un relevé toutes les 2 minutes tant que l'app est ouverte, stocké en local
(900 relevés glissants, environ 30 h). Chaque relevé est comparé au précédent pour
en déduire les évènements : ouverture et fermeture de VirtualLine, fermeture et
réouverture d'attraction, pic de plus de 25 minutes.

Le bouton **Télécharger le journal (.md)** produit un Markdown avec les évènements
horodatés, une synthèse min / moyenne / max par attraction, et les relevés bruts.

Pour journaliser en continu sans garder l'app ouverte, il faut un runner côté serveur :
un workflow n8n avec un Schedule Trigger toutes les 5 minutes, un HTTP Request sur
`https://queue-times.com/parks/51/queue_times.json`, et une écriture en base ou en
fichier. Le format Markdown produit ici sert de modèle de sortie.

---

## Green Card, ce qu'il faut savoir

Sur présentation d'un justificatif à l'Information sous la Tour (quartier France),
une Green Card donne accès à **six attractions avec jusqu'à quatre accompagnants**.
Elle se présente avec une pièce d'identité et se fait valider par le personnel à
chaque passage. Le temps d'attente en cours doit s'écouler avant de refaire la même
attraction.

Deux points à confirmer sur place, documentés par des sources non officielles :
les six attractions sont **écrites sur la carte au comptoir** (donc à décider avant
d'y aller), et **une nouvelle carte est délivrée chaque jour** du séjour.

---

## Structure

```
src/data/rides.ts        référentiel des 36 attractions, intensité, brassage, VirtualLine
src/lib/api.ts           client queue-times + chaîne de relais + lecture des files virtuelles
src/lib/geo.ts           distances, temps de marche, Overpass
src/lib/planner.ts       optimiseur
src/lib/journal.ts       relevés, évènements, export Markdown
src/lib/storage.ts       persistance locale, export de la sélection
src/components/ParkMap.tsx  carte Leaflet
worker/queue-proxy.js    relais CORS Cloudflare
```

---

Données de temps d'attente : [Queue-Times.com](https://queue-times.com/).
Projet personnel, sans lien avec Europa-Park.
