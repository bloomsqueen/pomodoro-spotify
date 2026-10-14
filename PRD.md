# PRD : la suite de Pomodoro Spotify

Statut : **brouillon du 14 octobre 2026**. Les décisions marquées « à confirmer » attendent les réponses du propriétaire. Rien ici n'est encore codé.

## 1. Objectif
Un timer pomodoro qui lance la musique Spotify de la personne au démarrage, et la met en pause à la fin, pour travailler en musique sans y penser.

## 2. Où on en est (livré)
- Connexion à Spotify, sans serveur (OAuth PKCE), en local et en ligne.
- Timer fixe de 45 minutes : « Démarrer » reprend la lecture en cours, et à 0:00 la musique est mise en pause.
- Messages clairs quand Spotify refuse (pas d'appareil actif, pas Premium, connexion expirée…).
- Jeton Spotify renouvelé automatiquement.
- Design skyblog / lofi, accessible (contraste d'au moins 7:1, animations coupables).

## 3. Principes (ne changent pas)
- Appli web, sans serveur, sans framework : HTML, CSS et JavaScript simples.
- Durées fixes (45 minutes de travail, 15 minutes de pause) : pas de réglage par l'utilisateur.
- Messages en tutoiement. Accessibilité obligatoire sur tout nouvel écran.
- Aucun secret dans le dépôt ; les jetons ne sont jamais écrits dans un fichier.

## 4. Fonctionnalités
Pour chacune : l'**output attendu** (ce que la personne voit ou obtient quand ça marche), puis comment le vérifier.

### F0. Pause fiable quand l'onglet est en arrière-plan (préalable)
- **Pourquoi :** en vrai, l'onglet du timer est caché pendant les 45 minutes. Le navigateur peut y espacer les minuteurs (jusqu'à une vérification par minute, à vérifier), donc la pause pourrait partir en retard. L'heure de fin est déjà enregistrée au démarrage : l'affichage est donc juste, seul l'envoi de la pause est concerné.
- **Output attendu :** la musique s'arrête à 0:00, à quelques secondes près, même si l'onglet est resté caché pendant toute la session.
- **Comment :** une alarme unique réglée sur l'heure de fin, en plus des vérifications régulières, et une vérification immédiate quand on revient sur l'onglet.
- **Vérification :** essai réel (onglet caché 45 minutes, noter l'heure d'arrêt de la musique), plus un test avec horloge simulée.

### F1. Lire l'état de Spotify avant d'agir
- **Pourquoi :** `play` et `pause` sont deux commandes distinctes (pas de risque d'inversion), mais l'appli ne sait pas ce que fait Spotify. Si la personne a mis la musique en pause elle-même, Spotify peut refuser notre « pause » (erreur 403 « Restriction violated », d'après ma mémoire, **à vérifier**) et l'appli afficherait un message trompeur. Dans l'enchaînement des sessions (F6), un refus au démarrage pourrait même bloquer la chaîne.
- **Output attendu :**
  - Déjà en pause à 0:00 : aucune commande envoyée, message « Spotify était déjà en pause », aucune erreur.
  - Déjà en lecture au démarrage : pas de commande « play » inutile, le timer démarre normalement.
  - Musique relancée par la personne pendant la pause de 15 minutes : l'appli la respecte et ne la coupe pas.
- **Technique :** lecture de l'état (`is_playing`) via l'API Spotify. L'autorisation nécessaire est déjà demandée à la connexion.
- **Vérification :** essais réels (pause manuelle avant la fin, lecture manuelle avant le démarrage) et scénarios avec faux Spotify.
- **Décision D1 :** A (recommandée) lire l'état avant d'agir ; B ne rien lire et traiter tout refus « déjà dans l'état demandé » comme un succès (plus simple, mais cache de vraies erreurs).

### F2. Signal de fin indépendant de la musique
- **Pourquoi :** la coupure de la musique sert de signal. Si elle est déjà coupée, ou si la personne écoute de la musique pendant la pause, elle peut manquer la fin d'une phase.
- **Output attendu :** à chaque changement de phase, un court son (généré par le navigateur, sans fichier) et le titre de l'onglet indique la phase et le temps restant (par exemple « 12:34 · Travail »).
- **Option, décision D2 :** notification du navigateur en plus (demande une autorisation à la personne). A (recommandée) non pour l'instant ; B oui.
- **Vérification :** le titre change pendant le décompte et à la fin ; le son se déclenche une fois par transition, onglet actif ou caché.

### F3. Connexion Spotify conservée après fermeture de l'onglet
- **Output attendu :** je ferme l'onglet et je reviens dans les jours suivants : je suis toujours connectée, sans cliquer sur « Se connecter ». Un bouton « Se déconnecter » efface tout. Passé le délai, l'appli demande de se reconnecter.
- **Technique :** jetons gardés dans le navigateur avec une date d'expiration (aujourd'hui, ils disparaissent à la fermeture de l'onglet). Compromis : un jeton gardé plus longtemps est plus exposé sur un ordinateur partagé ; le bouton de déconnexion le limite. Spotify donne au maximum 6 mois de validité au jeton de rafraîchissement.
- **Décision D3 :** durée conservée. A (recommandée) 30 jours ; B 7 jours (plus prudent).
- **Vérification :** fermer puis rouvrir l'onglet ; simuler l'expiration ; tester « Se déconnecter ».

### F4. Garder le timer si on ferme ou recharge l'onglet
- **Output attendu :** je rouvre la page pendant une session : le timer affiche le temps restant réel et continue. Si le temps s'est écoulé pendant mon absence, je vois « Temps écoulé », et Spotify est mis en pause à la réouverture (si la musique joue encore).
- **Limite assumée :** une page fermée ne peut rien envoyer. **Si on ferme l'onglet, Spotify ne se met pas en pause à 0:00.** Ça demanderait un serveur, hors périmètre. L'appli le dit clairement.
- **Technique :** l'heure de fin et la phase en cours sont enregistrées dans le navigateur.
- **Vérification :** recharger au milieu d'une session ; fermer, attendre la fin, rouvrir.

### F5. Mettre le timer en pause
- **Output attendu :** un bouton « Pause » fige le temps restant et devient « Reprendre ». Je reprends exactement où je m'étais arrêtée. L'état de pause survit à un rechargement (F4).
- **Décision D4 :** A (recommandée) la pause du timer met aussi Spotify en pause, « Reprendre » relance la musique ; B seul le timer s'arrête.
- **Vérification :** pause puis reprise à plusieurs moments ; pause puis rechargement.

### F6. Enchaîner les sessions 45 / 15 / 45 / 15…
- **Output attendu :** à la fin d'une session de 45 minutes, la musique se met en pause, le timer de 15 minutes démarre et un libellé indique la phase (« Travail » ou « Pause ») et le numéro de session. Un bouton « Arrêter » met fin à l'enchaînement.
- **Décision D5 (musique pendant la pause) :** A (recommandée) elle reste coupée ; B elle continue.
- **Décision D6 (après la pause) :** A (recommandée) la session suivante démarre seule avec la musique, et un signal (F2) prévient ; B elle attend un clic.
- **Décision D7 (nombre de sessions) :** A (recommandée) jusqu'à « Arrêter » ; B par exemple 4 sessions puis une longue pause.
- **Vérification :** enchaînement complet avec horloge simulée (45, 15, 45) ; arrêt en cours de route ; musique relancée à la main pendant la pause (F1).

### F7. Musique selon la phase (idée en évaluation, pas décidée)
Trois niveaux, du plus simple au plus complexe (voir la section 7 pour l'évaluation) :
- **F7a. Chanson suivante** au changement de phase.
- **F7b. Remettre la playlist au début** au début de chaque session de travail.
- **F7c. Une playlist spéciale pour la pause**, puis retour à la musique de travail.
- **Décision D8 :** garder en réserve, ou lancer l'un de ces niveaux après F6.

## 5. Ordre de réalisation recommandé
1. F0 : pause fiable en arrière-plan.
2. F1 : lire l'état de Spotify.
3. F2 : signal de fin.
4. F3 : connexion conservée.
5. F4 et F5 ensemble : timer conservé et pause (même mémoire de l'état).
6. F6 : enchaînement des sessions (s'appuie sur tout ce qui précède).
7. F7 : seulement si D8 le décide.

## 6. Hors périmètre
- Durées réglables par l'utilisateur (le README les classe hors périmètre).
- Serveur ou comptes utilisateurs : pas de pause automatique appli fermée.
- Application mobile native.
- Choix de playlist, **sauf** F7c si elle est retenue.

## 7. Évaluation de F7 (musique selon la phase)
Ce que permet l'API Spotify, d'après sa documentation :

| Niveau | Faisable ? | Complexité | Points d'attention |
|---|---|---|---|
| F7a. Chanson suivante | Oui : commande « Skip To Next » | **Faible** (une commande, mêmes autorisations qu'aujourd'hui) | La chanson « suivante » dépend de la file d'attente et du mode aléatoire de la personne. |
| F7b. Playlist au début | Oui : « play » avec `context_uri` et `offset.position = 0` ; la playlist en cours se lit via l'état de lecture (F1) | **Faible à moyenne** | Si la personne écoute autre chose qu'un album ou une playlist (titres aimés, radio), il n'y a pas de contexte à relancer (à vérifier). Elle perd sa position dans la liste : à proposer comme option. |
| F7c. Playlist de pause | Oui : « play » avec le `context_uri` de la playlist de pause | **Moyenne à élevée** | Il faut un réglage mémorisé (où la personne indique sa playlist de pause, par exemple en collant un lien), sa validation, des erreurs en plus (playlist supprimée ou privée). Il faut aussi mémoriser la musique de travail pour la relancer ensuite. Choisir dans la liste de ses playlists demanderait une autorisation supplémentaire (`playlist-read-private`) et un écran de choix. Contredit la décision actuelle « pas de choix de playlist » : à réviser. |

Recommandation : réaliser F7 après F6, car tout dépend des phases et de la lecture de l'état (F1). Commencer par F7a si le besoin se confirme, puis F7c avec un lien collé (sans autorisation supplémentaire), et laisser F7b en option.

## 8. Risques et points à vérifier par un essai réel
- **Onglet en arrière-plan** (F0) : mesurer l'heure réelle d'arrêt de la musique.
- **Refus de Spotify quand le lecteur est déjà dans l'état demandé** (F1) : essai réel avec un timer court (pause manuelle avant la fin, puis lecture manuelle avant le démarrage).
- **Jetons conservés plus longtemps** (F3) : compromis de sécurité, limité par l'expiration et le bouton de déconnexion.
- **Mode développement de l'appli Spotify** : 5 utilisateurs maximum, ajoutés à la main, propriétaire avec un compte Premium.
- **Pas de tests automatisés dans le dépôt** : mes vérifications sont des scripts jetables. À décider s'il faut en ajouter.

## 9. Décisions en attente
| N° | Sujet | Recommandation | Statut |
|---|---|---|---|
| D1 | Lire l'état de Spotify | A : oui | à confirmer |
| D2 | Notification du navigateur | A : non pour l'instant | à confirmer |
| D3 | Durée de la connexion conservée | A : 30 jours | à confirmer |
| D4 | La pause du timer coupe aussi la musique | A : oui | à confirmer |
| D5 | Musique pendant les 15 minutes de pause | A : coupée | à confirmer |
| D6 | Après la pause | A : démarrage automatique + signal | à confirmer |
| D7 | Nombre de sessions | A : jusqu'à « Arrêter » | à confirmer |
| D8 | F7 (musique selon la phase) | A : en réserve | à confirmer |
