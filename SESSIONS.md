# Journal des sessions

Où en est le projet, session par session. À lire en premier pour reprendre le travail,
à compléter en dernier avant de clore une session.

**Convention.** Une entrée par session, la plus récente en haut. Chaque entrée dit ce qui
a été fait, ce qui a été constaté, et ce qui reste ouvert. On n'y recopie pas le diff :
git le fait déjà. On y écrit ce que git ne dit pas — pourquoi, et où on s'est arrêté.

---

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
- Quatre points d'attention mineurs relevés au review, aucun bloquant, listés en fin
  d'`ARCHITECTURE.md`.

**Non vérifié, et pourquoi**

L'environnement d'exécution de cette session bloque tout l'egress hors GitHub et registres
de paquets. `queue-times.com`, `overpass-api.de`, les tuiles, `api.vercel.com` et
`api.cloudflare.com` répondent tous `403 CONNECT` au proxy. Conséquences :

- les identifiants d'attractions de `rides.ts` **n'ont pas pu être croisés** avec la
  réponse réelle de l'API. La cohérence interne est vérifiée, la correspondance externe non ;
- le Worker Cloudflare n'a pas pu être déployé ni testé.

Pour lever ce blocage : environnement Claude Code → **Network access: Custom** → ajouter
`queue-times.com`, `overpass-api.de`, `*.workers.dev`, en gardant la liste par défaut
cochée. Les variables et l'accès réseau sont lus **au démarrage de session** : il faut une
session neuve.

**Reste ouvert**

- [ ] Déployer le Worker Cloudflare et coller son URL dans « relais personnel ».
      Tant que ce n'est pas fait, l'app tourne sur `SNAPSHOT` figé.
- [ ] Croiser les 36 `id` et les 3 `vlId` avec la réponse réelle de queue-times.
- [ ] Collecte continue pour remplacer `CURVE` par du réel.
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
