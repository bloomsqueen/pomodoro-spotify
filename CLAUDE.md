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
- **Aucun serveur ne stocke les jetons Spotify** (décision du propriétaire, 15 octobre 2026) : trop risqué pour la sécurité dès qu'il y aura plusieurs utilisateurs. La pause de 0:00 repose donc sur le navigateur ; voir ses limites dans la section 2 bis de `PRD.md`.
- Services de musique : **Spotify uniquement**. Apple Music et Deezer sont hors périmètre pour l'instant (évalués le 14 octobre 2026, voir la section 10 de `PRD.md`). Le contrôle de la musique est au cœur du produit.
- Playlist : pas de choix de playlist dans le MVP. L'appli reprend la lecture en cours dans l'appli Spotify de l'utilisateur.
- Adresse de retour de la connexion : calculée à partir de l'adresse où l'appli est ouverte (`getRedirectUri` dans `js/spotify.js`), donc la même appli marche en local et en ligne. Chaque adresse doit être déclarée à l'identique dans le Dashboard Spotify (Settings, puis Redirect URIs) : `http://127.0.0.1:8000/` en local, `https://pomodoro-spotify.tela-mellies.workers.dev/` en ligne. Spotify refuse `localhost` et le http hors 127.0.0.1 : l'appli l'explique au lieu de tenter la connexion.
- Si Spotify refuse de lancer la musique (pas d'appareil actif, pas Premium, jeton refusé…), le timer ne démarre pas et un message explique pourquoi.
- Si la pause échoue à 0:00, le message le dit clairement et demande de mettre Spotify en pause à la main.
- Jeton d'accès (valable 1 heure) : renouvelé automatiquement avec le jeton de rafraîchissement. Au clic sur « Démarrer », s'il ne tiendra pas jusqu'à la fin du timer, il est renouvelé tout de suite, pour que la pause de 0:00 ne dépende pas d'un appel réseau fait au dernier moment. Si Spotify refuse le renouvellement (`invalid_grant`), l'utilisateur doit se reconnecter.
- Messages à l'utilisateur : tutoiement, comme sur la page.
- Critère de réussite : « je lance un timer de 45 min, et à 0:00 ma musique Spotify se met en pause toute seule ».

- Stack : **HTML, CSS et JavaScript simples** (modules ES), sans framework, sans outil de build, sans dépendance.

## Décisions ouvertes
À trancher avec le propriétaire avant d'écrire du code. Mettre à jour cette liste au fur et à mesure.
- Aucune pour l'instant.

## Prochaines étapes (dans cet ordre)
1. ~~Retours sur le design de l'accueil~~ : validé par le propriétaire.
2. ~~Remettre la durée à 45 minutes~~ : fait.
3. ~~Renouvellement du jeton d'accès~~ : fait (option A choisie par le propriétaire).
4. PRD de la suite du projet : brouillon dans `PRD.md` (chaque fonctionnalité avec son **output attendu**). Décisions confirmées : D3 (connexion conservée **7 jours**) et D9 (**pas de serveur**). Les autres décisions (D1, D2, D4 à D8, D10, D11, tableau de la section 9) restent à confirmer **avant de coder la fonctionnalité concernée**.
5. **Prochaine session : commencer par F3 puis F4** (connexion conservée, puis timer conservé avec détection d'un onglet endormi). Constat de l'essai réel du 14 octobre 2026 (navigateur Arc) : l'onglet a été déchargé, le timer et la connexion ont été perdus, et la musique n'a jamais été mise en pause, car aucun code ne tourne dans un onglet endormi. Voir la section 2 bis du `PRD.md`. Autre constat (essai avec un onglet épinglé dans Arc, 15 octobre) : la connexion à Spotify peut s'ouvrir dans une autre fenêtre, et les valeurs gardées par onglet (`sessionStorage`) ne sont pas partagées. F3 doit donc utiliser `localStorage` (jetons et valeurs temporaires de la connexion) et mettre à jour l'écran des autres onglets quand la connexion change.
6. Ensuite, suivre l'ordre de la section 5 du PRD, une fonctionnalité à la fois (un commit par étape testable).
7. Quand F3 sera codée, mettre à jour la section « Sécurité » (les jetons ne resteront plus seulement dans l'onglet).

## Structure
- `index.html` : la page (connexion, affichage du timer, bouton Démarrer, zone de messages).
- `css/style.css` : le style.
- `js/config.js` : réglages publics (Client ID, scopes, durée du timer).
- `js/spotify.js` : connexion OAuth PKCE, renouvellement du jeton, reprise et pause de la lecture, calcul de l'adresse de retour.
- `js/timer.js` : le compte à rebours, indépendant de Spotify.
- `js/app.js` : point d'entrée, relie la page, le timer et Spotify.
- `PRD.md` : cahier des charges de la suite (fonctionnalités, output attendu, décisions en attente, risques).


## Design
- Ambiance : skyblog des années 2000 et lofi. Thème jour (ciel bleu et rose) et thème nuit (mode sombre du système, violet).
- Le texte est toujours posé sur un fond uni (panneau, bouton, écran LCD), jamais directement sur le décor. Contraste du texte : 7:1 minimum, en clair et en sombre.
- Page volontairement très simple : un titre, une fenêtre « pomodoro.exe » avec le timer et deux boutons, un pied de page. Pas de texte explicatif en plus (le propriétaire l'a retiré).
- Boutons : rectangles en relief (arêtes claires en haut à gauche, sombres en bas à droite), pas de bords arrondis ni de pilules.
- Police : Michroma (style Eurostile / Handel Gothic) pour le titre, les étiquettes et les boutons, auto-hébergée dans `fonts/` (licence OFL, fichier de licence à garder). Texte courant en Verdana/Tahoma. Chiffres du timer en Courier New. Aucune police ni image chargée depuis un site externe.
- Les décors (étoiles, notes, cœurs, kaomoji) sont en `aria-hidden`. Les « stickers » autour du timer ne recouvrent jamais les chiffres.
- Les animations respectent `prefers-reduced-motion` et se coupent avec le bouton « Animations » (classe `calm` sur `<body>`). L'égaliseur ne bouge que pendant que le timer tourne (classe `is-running`).
- Boutons inactifs : bordure pointillée, pas seulement une couleur différente.

## Contraintes Spotify
- Contrôler la lecture via l'API exige un compte **Spotify Premium**.
- Il faut une app créée sur le Spotify Developer Dashboard (Client ID).
- Un appareil Spotify actif est nécessaire, sinon l'API renvoie une erreur : gérer ce cas avec un message clair.
- Authentification sans serveur : OAuth avec PKCE. N'utilise jamais de Client Secret dans du code côté navigateur.

## Mise en ligne
- Site publié avec Cloudflare (adresse `https://pomodoro-spotify.tela-mellies.workers.dev/`), à partir de la branche `main` : rien n'est en ligne tant que le travail n'est pas fusionné dans `main`.
- Pas de commande de build : les fichiers du dépôt sont servis tels quels.
- Mode développement de l'appli Spotify : 5 utilisateurs maximum, ajoutés à la main dans le Dashboard, et le propriétaire doit avoir un compte Premium.

## Sécurité
- Aucun secret dans le dépôt. L'appli n'en a pas besoin : le Client ID est public par conception (PKCE) et vit dans `js/config.js`. Il n'y a pas de Client Secret, et il ne faut jamais en ajouter.
- Ne committe jamais de jeton (d'accès ou de rafraîchissement) Spotify. Ils restent dans `sessionStorage` : ils disparaissent à la fermeture de l'onglet, et ne sont jamais écrits dans un fichier du dépôt.
- `.env` reste dans `.gitignore` par précaution, au cas où un fichier de ce type serait ajouté un jour.

## Commandes
- Installer : rien à installer.
- Lancer : `python3 -m http.server 8000 --bind 127.0.0.1`, puis ouvrir http://127.0.0.1:8000/ (un serveur est nécessaire : les modules JavaScript ne se chargent pas depuis `file://`, et Spotify exige une URL de retour en `http`).
- Tests : pas encore.

## Conventions
- Commits courts, au présent, en français ou en anglais, mais un seul choix cohérent.
- Branche de travail : `claude/ecstatic-ride-x14865`. Ne pas ouvrir de pull request sans demande.
