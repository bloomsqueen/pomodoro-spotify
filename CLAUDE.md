# pomodoro-spotify

Timer pomodoro synchronisé avec Spotify : l'utilisateur lance un timer de 45 minutes avec sa propre playlist, et Spotify est mis en pause automatiquement à la fin.

Le `README.md` est la source de vérité sur le périmètre (MVP et hors-périmètre). En cas de doute, il prime sur ce fichier.

## Rôle de Claude
Le propriétaire du dépôt construit sa **première application** et découvre le développement.
- Agis comme un mentor : explique le « pourquoi » de chaque décision technique, en français et avec des mots simples.
- Propose la solution la plus simple qui marche, pas la plus sophistiquée.
- Avance par petites étapes testables. Une étape = un commit.
- Avant une décision qui engage la suite (framework, architecture, nouvelle dépendance), présente 2 options maximum avec une recommandation, puis attends la réponse.
- Ne crée pas de fonctionnalité hors MVP sans accord explicite.

## Périmètre (voir README)
- MVP : connexion Spotify, timer de 45 minutes, pause de Spotify à la fin.
- Hors périmètre : timer personnalisable, autres outils musicaux.

## Décisions prises
- Type d'application : **appli web sans backend**.
- Déroulé du MVP : un seul timer fixe de 45 minutes. La musique démarre automatiquement avec le timer. Pas de phase de pause ni de reprise de la musique : pour recommencer, l'utilisateur relance un timer.
- Playlist : pas de choix de playlist dans le MVP. L'appli reprend la lecture en cours dans l'appli Spotify de l'utilisateur.
- Critère de réussite : « je lance un timer de 45 min, et à 0:00 ma musique Spotify se met en pause toute seule ».

- Stack : **HTML, CSS et JavaScript simples** (modules ES), sans framework, sans outil de build, sans dépendance.

## Décisions ouvertes
À trancher avec le propriétaire avant d'écrire du code. Mettre à jour cette liste au fur et à mesure.
- Aucune pour l'instant.

## Structure
- `index.html` : la page (connexion, affichage du timer, bouton Démarrer, zone de messages).
- `css/style.css` : le style.
- `js/config.js` : réglages publics (Client ID, URL de retour, scopes, durée du timer).
- `js/spotify.js` : connexion OAuth PKCE, reprise et pause de la lecture.
- `js/timer.js` : le compte à rebours, indépendant de Spotify.
- `js/app.js` : point d'entrée, relie la page, le timer et Spotify.

Les fichiers `spotify.js` et `timer.js` contiennent des fonctions à implémenter (marquées TODO).

## Design
- Ambiance : skyblog des années 2000 et lofi. Thème jour (ciel bleu et rose) et thème nuit (mode sombre du système, violet).
- Le texte est toujours posé sur un fond uni (panneau, bouton, écran LCD), jamais directement sur le décor. Contraste du texte : 7:1 minimum, en clair et en sombre.
- Les décors (étoiles, notes, cœurs, kaomoji) sont en `aria-hidden`. Aucune image externe, aucune police externe.
- Les animations respectent `prefers-reduced-motion` et se coupent avec le bouton « Animations » (classe `calm` sur `<body>`). L'égaliseur ne bouge que pendant que le timer tourne (classe `is-running`).
- Boutons inactifs : bordure pointillée, pas seulement une couleur différente.

## Contraintes Spotify
- Contrôler la lecture via l'API exige un compte **Spotify Premium**.
- Il faut une app créée sur le Spotify Developer Dashboard (Client ID).
- Un appareil Spotify actif est nécessaire, sinon l'API renvoie une erreur : gérer ce cas avec un message clair.
- Authentification sans serveur : OAuth avec PKCE. N'utilise jamais de Client Secret dans du code côté navigateur.

## Sécurité
- Aucun secret dans le dépôt. L'appli n'en a pas besoin : le Client ID est public par conception (PKCE) et vit dans `js/config.js`. Il n'y a pas de Client Secret, et il ne faut jamais en ajouter.
- Ne committe jamais de jeton d'accès Spotify. Le navigateur peut les garder en mémoire de session, jamais dans un fichier du dépôt.
- `.env` reste dans `.gitignore` par précaution, au cas où un fichier de ce type serait ajouté un jour.

## Commandes
- Installer : rien à installer.
- Lancer : `python3 -m http.server 8000 --bind 127.0.0.1`, puis ouvrir http://127.0.0.1:8000/ (un serveur est nécessaire : les modules JavaScript ne se chargent pas depuis `file://`, et Spotify exige une URL de retour en `http`).
- Tests : pas encore.

## Conventions
- Commits courts, au présent, en français ou en anglais, mais un seul choix cohérent.
- Branche de travail : `claude/ecstatic-ride-x14865`. Ne pas ouvrir de pull request sans demande.
