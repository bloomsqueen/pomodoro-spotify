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

## Décisions ouvertes
À trancher avec le propriétaire avant d'écrire du code. Mettre à jour cette liste au fur et à mesure.
- [ ] Type d'application (recommandation : appli web sans backend)
- [ ] Déroulé d'un cycle : démarrage auto de la musique ? comportement pendant la pause ?
- [ ] Choix de la playlist : lien collé ou liste des playlists de l'utilisateur
- [ ] Critère de réussite précis du MVP

## Contraintes Spotify
- Contrôler la lecture via l'API exige un compte **Spotify Premium**.
- Il faut une app créée sur le Spotify Developer Dashboard (Client ID).
- Un appareil Spotify actif est nécessaire, sinon l'API renvoie une erreur : gérer ce cas avec un message clair.
- Authentification sans serveur : OAuth avec PKCE. N'utilise jamais de Client Secret dans du code côté navigateur.

## Sécurité
- Aucun secret (Client Secret, tokens) dans le dépôt. Les variables locales vont dans `.env`, ignoré par git. Le Client ID n'est pas secret mais reste en configuration.
- Ne committe jamais `.env`. Maintiens `.env.example` à jour avec les noms des variables, sans valeurs.

## Commandes
Pas encore de code : les commandes (installer, lancer, tester) seront ajoutées ici dès que la stack sera choisie.

## Conventions
- Commits courts, au présent, en français ou en anglais, mais un seul choix cohérent.
- Branche de travail : `claude/ecstatic-ride-x14865`. Ne pas ouvrir de pull request sans demande.
