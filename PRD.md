# PRD : la suite de Pomodoro Spotify

Statut : **brouillon, mis à jour le 14 octobre 2026** (après un essai réel, voir la section 2 bis). Les décisions marquées « à confirmer » attendent les réponses du propriétaire. Rien ici n'est encore codé.

## 1. Objectif
Un timer pomodoro qui lance la musique Spotify de la personne au démarrage, et la met en pause à la fin, pour travailler en musique sans y penser.

## 2. Où on en est (livré)
- Connexion à Spotify, sans serveur (OAuth PKCE), en local et en ligne.
- Timer fixe de 45 minutes : « Démarrer » reprend la lecture en cours, et à 0:00 la musique est mise en pause.
- Messages clairs quand Spotify refuse (pas d'appareil actif, pas Premium, connexion expirée…).
- Jeton Spotify renouvelé automatiquement.
- Design skyblog / lofi, accessible (contraste d'au moins 7:1, animations coupables).

## 2 bis. Ce que l'essai réel a montré (14 octobre 2026)
Le propriétaire a lancé une vraie session de 45 minutes sur le site en ligne, avec le navigateur **Arc**. Constats : à son retour, vers la 40e minute, le timer affichait **45:00**, la **page de connexion** était revenue, et **la musique ne s'est jamais arrêtée**.

Explication retenue (reproduite avec une horloge simulée, pas avec le vrai Spotify) :
- L'onglet a été déchargé puis rechargé par le navigateur : le timer, qui n'existe qu'en mémoire, est perdu. La connexion l'a été aussi (déduction : un simple rechargement la garde en temps normal, d'après la simulation).
- Dans un onglet endormi, **aucun code ne tourne** : la pause de 0:00 n'est jamais envoyée. Ce n'est pas un problème de renouvellement du jeton (il n'a même pas été utilisé).
- Aucun changement dans la page ne peut envoyer la pause à 0:00 si l'onglet dort. F3 et F4 permettent de **retrouver la session et d'envoyer la pause au retour**. Une pause envoyée par un serveur (F8) aurait tenu la promesse à 100 %, mais cette piste a été écartée par le propriétaire (D9).
- Piste non confirmée : épingler l'onglet dans Arc pourrait empêcher sa mise en veille (simple commentaire d'utilisateur trouvé en ligne, pas de réglage officiel confirmé).
- **Essai avec un onglet épinglé (15 octobre 2026) :** le clic sur « Se connecter à Spotify » ouvre une fenêtre séparée, et la connexion s'y fait, pas dans l'onglet épinglé. Les valeurs gardées par l'appli sont aujourd'hui propres à chaque onglet : l'onglet épinglé ne voit donc jamais la connexion. F3 doit en tenir compte.

## 3. Principes (ne changent pas)
- Appli web, sans serveur, sans framework : HTML, CSS et JavaScript simples.
- **Le contrôle de la musique est au cœur du produit** : pas de « mode sans contrôle » où la personne lance sa musique elle-même.
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
- **Statut : codée le 15 octobre 2026**, vérifiée avec un faux Spotify (dont le cas d'une connexion terminée dans un autre onglet). **À essayer en vrai** avec l'onglet épinglé dans Arc.
- **Output attendu :** je ferme l'onglet et je reviens dans les jours suivants : je suis toujours connectée, sans cliquer sur « Se connecter ». Un bouton « Se déconnecter » efface tout. Passé le délai, l'appli demande de se reconnecter.
- **Technique :** jetons gardés dans le navigateur avec une date d'expiration (aujourd'hui, ils disparaissent à la fermeture de l'onglet). Compromis : un jeton gardé plus longtemps est plus exposé sur un ordinateur partagé ; le bouton de déconnexion le limite. Spotify donne au maximum 6 mois de validité au jeton de rafraîchissement.
- **Connexion depuis un autre onglet ou une fenêtre (cas constaté avec Arc et un onglet épinglé) :** si Spotify s'ouvre ailleurs, l'onglet d'origine doit quand même devenir connecté, sans rechargement. Les valeurs temporaires de la connexion (code secret et `state`) doivent donc pouvoir être retrouvées par l'onglet qui reçoit le retour de Spotify.
- **Technique de ce cas :** jetons et valeurs temporaires dans `localStorage` (partagé entre tous les onglets du même site, contrairement à `sessionStorage`), les valeurs temporaires étant effacées dès leur utilisation ; chaque onglet écoute les changements et met son écran à jour. Pas de cookies : un cookie voyage vers un serveur à chaque requête, ce qui n'a pas d'intérêt ici.
- **Décision D3 : 7 jours** (confirmé par le propriétaire le 14 octobre 2026). Au bout de 7 jours, l'appli demande de se reconnecter.
- **Pourquoi c'est prioritaire :** l'essai réel a montré que la connexion peut être perdue quand le navigateur décharge l'onglet.
- **Vérification :** fermer puis rouvrir l'onglet ; simuler l'expiration ; tester « Se déconnecter » ; simuler une connexion terminée dans un second onglet pendant que le premier reste ouvert.

### F4. Garder le timer si on ferme ou recharge l'onglet
- **Output attendu :** je rouvre la page pendant une session : le timer affiche le temps restant réel et continue. Si le temps s'est écoulé pendant mon absence, je vois « Temps écoulé », et Spotify est mis en pause à la réouverture (si la musique joue encore).
- **Limite assumée :** une page fermée ou endormie ne peut rien envoyer. **Si l'onglet est fermé, déchargé ou endormi (cas constaté avec Arc), Spotify ne se met pas en pause à 0:00.** À la réouverture ou au réveil, l'appli détecte que la session a continué sans elle, envoie la pause tout de suite et le dit clairement (par exemple « ta session s'est interrompue, Spotify a été mis en pause »). Un serveur (F8) aurait pu l'envoyer à l'heure exacte, mais il a été écarté (D9).
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

### F8. Pause garantie par un serveur (écartée)
- **Pourquoi :** c'est la seule façon de tenir la promesse « Spotify se met en pause tout seul à 0:00 » quand l'onglet est fermé, déchargé ou endormi.
- **Output attendu :** la musique s'arrête à 0:00, à quelques secondes près, **quel que soit l'état de l'onglet**.
- **Compromis (non chiffrés, à étudier) :** un petit service (par exemple chez Cloudflare, avec une alarme programmée à l'heure de fin) devrait **garder le jeton Spotify** de la personne et envoyer lui-même la pause. Cela change le modèle de sécurité et de confidentialité (un jeton gardé côté serveur), demande d'identifier chaque personne, ajoute du code à écrire et à maintenir, et contredit la décision « sans serveur ».
- **Décision D9 : écartée** par le propriétaire (15 octobre 2026). Faire garder les jetons Spotify par un serveur n'est pas acceptable pour des raisons de sécurité dès qu'il y aura plusieurs utilisateurs. L'appli reste sans serveur.

### F9. Garder l'onglet éveillé (idée à évaluer, pas décidée)
- **Pourquoi :** si le navigateur ne décharge pas l'onglet, la pause part à l'heure sans autre changement. Aucune solution ne peut l'**interdire** : le navigateur décide.
- **Output attendu :** l'onglet reste actif en arrière-plan pendant les 45 minutes, et la musique s'arrête à l'heure.
- **Pistes**, d'après la page de Chrome sur son « Memory Saver » (qui liste ce qui peut empêcher la désactivation d'un onglet : audio ou vidéo en cours, partage d'écran, notifications de la page, téléchargements, formulaire rempli, onglet épinglé, appareil USB ou Bluetooth) :
  - **épingler l'onglet** : aucun code ;
  - **notifications de la page** : honnête, et utile comme signal de fin (lié à D2) ;
  - **un son inaudible en boucle** : possible en théorie, mais c'est un contournement qui consomme de la batterie et dont on ne sait pas s'il compte si le son est silencieux. Au mieux un réglage optionnel, jamais par défaut ;
  - **réglages du navigateur** (« Toujours garder ces sites actifs » dans Chrome), côté personne, pas côté code.
- **Limites :** tout cela est documenté pour Chrome. Pour Arc, rien n'est vérifié. Aucune garantie.
- **Vérification :** essais réels dans Arc et dans Chrome (Chrome permet de forcer un déchargement sur `chrome://discards`), onglet caché pendant 45 minutes, heure d'arrêt de la musique notée.
- **Complexité :** faible (épingler, notifications) à moyenne.
- **Décision D10 :** A (recommandée) commencer par les essais sans code (onglet épinglé, puis notifications avec D2) et décider ensuite ; B ajouter le son inaudible en option.

### F10. Extension de navigateur (idée à évaluer, pas décidée)
- **Pourquoi :** c'est la seule piste trouvée qui tienne la promesse « pause à 0:00 » **sans serveur**, même onglet fermé ou endormi.
- **Output attendu :** la musique s'arrête à l'heure, quel que soit l'état de l'onglet. Les jetons sont gardés dans l'extension, **sur l'ordinateur de la personne**, pas sur un serveur.
- **Ce que la documentation de Chrome indique :** les extensions peuvent programmer des alarmes qui continuent onglet fermé, au plus une toutes les 30 secondes et avec un décalage possible (la pause pourrait donc partir quelques secondes après 0:00) ; si l'ordinateur dort, l'alarme se déclenche à son réveil (elle ne le réveille pas). Une extension peut aussi demander que son onglet ne soit pas déchargé (propriété `autoDiscardable`), sans qu'on sache si Arc la respecte.
- **Coûts :** une deuxième application à écrire, publier et faire installer à chaque personne ; une connexion à Spotify différente ; un fonctionnement propre à chaque navigateur (Chrome et navigateurs basés sur Chrome d'abord, puis Firefox et Safari). Ne règle pas le cas d'un ordinateur en veille.
- **Complexité :** élevée.
- **Décision D11 :** A (recommandée) en réserve : on y revient seulement si F3, F4 et F9 ne suffisent pas à l'usage ; B la lancer dès maintenant.

## 5. Ordre de réalisation recommandé
**Prochaine session : commencer par F3 puis F4** (décision du propriétaire, après l'essai réel du 14 octobre).
1. F3 : connexion conservée (7 jours).
2. F4 : timer conservé, avec détection d'un onglet qui a dormi (pause envoyée au retour).
3. F0 : pause fiable en arrière-plan (alarme unique à l'heure de fin).
4. F1 : lire l'état de Spotify.
5. F2 : signal de fin.
6. F5 : pause du timer (s'appuie sur la mémoire de l'état de F4).
7. F6 : enchaînement des sessions (s'appuie sur tout ce qui précède).
8. F7 : seulement si D8 le décide.
9. ~~F8~~ : écartée (D9).
10. F9 : d'abord des essais sans code, juste après F4, pour décider si du code est utile (D10).
11. F10 : en réserve (D11).

## 6. Hors périmètre
- Durées réglables par l'utilisateur (le README les classe hors périmètre).
- Serveur ou comptes utilisateurs : **aucun serveur ne stocke de jeton** (décision du 15 octobre 2026), donc pas de pause envoyée par un serveur quand l'appli est fermée.
- Application mobile native.
- Choix de playlist, **sauf** F7c si elle est retenue.
- **Apple Music et Deezer : hors périmètre pour l'instant** (décision du propriétaire, 14 octobre 2026). Spotify est le seul service pris en charge. Voir la section 10 pour ce qui a été évalué.

## 7. Évaluation de F7 (musique selon la phase)
Ce que permet l'API Spotify, d'après sa documentation :

| Niveau | Faisable ? | Complexité | Points d'attention |
|---|---|---|---|
| F7a. Chanson suivante | Oui : commande « Skip To Next » | **Faible** (une commande, mêmes autorisations qu'aujourd'hui) | La chanson « suivante » dépend de la file d'attente et du mode aléatoire de la personne. |
| F7b. Playlist au début | Oui : « play » avec `context_uri` et `offset.position = 0` ; la playlist en cours se lit via l'état de lecture (F1) | **Faible à moyenne** | Si la personne écoute autre chose qu'un album ou une playlist (titres aimés, radio), il n'y a pas de contexte à relancer (à vérifier). Elle perd sa position dans la liste : à proposer comme option. |
| F7c. Playlist de pause | Oui : « play » avec le `context_uri` de la playlist de pause | **Moyenne à élevée** | Il faut un réglage mémorisé (où la personne indique sa playlist de pause, par exemple en collant un lien), sa validation, des erreurs en plus (playlist supprimée ou privée). Il faut aussi mémoriser la musique de travail pour la relancer ensuite. Choisir dans la liste de ses playlists demanderait une autorisation supplémentaire (`playlist-read-private`) et un écran de choix. Contredit la décision actuelle « pas de choix de playlist » : à réviser. |

Recommandation : réaliser F7 après F6, car tout dépend des phases et de la lecture de l'état (F1). Commencer par F7a si le besoin se confirme, puis F7c avec un lien collé (sans autorisation supplémentaire), et laisser F7b en option.

## 8. Risques et points à vérifier par un essai réel
- **Onglet endormi ou déchargé par le navigateur** (constaté avec Arc le 14 octobre) : aucun code ne tourne, la pause n'est pas envoyée. Atténué par F3 et F4 (récupération au retour). La solution par serveur est écartée (D9).
- **Onglet en arrière-plan ralenti** (F0) : mesurer l'heure réelle d'arrêt de la musique.
- **Refus de Spotify quand le lecteur est déjà dans l'état demandé** (F1) : essai réel avec un timer court (pause manuelle avant la fin, puis lecture manuelle avant le démarrage).
- **Jetons conservés plus longtemps** (F3, 7 jours) : compromis de sécurité, limité par l'expiration et le bouton de déconnexion.
- **Mode développement de l'appli Spotify** : 5 utilisateurs maximum, ajoutés à la main, propriétaire avec un compte Premium.
- **Pas de tests automatisés dans le dépôt** : mes vérifications sont des scripts jetables. À décider s'il faut en ajouter.

## 9. Décisions en attente
| N° | Sujet | Recommandation | Statut |
|---|---|---|---|
| D1 | Lire l'état de Spotify | A : oui | à confirmer |
| D2 | Notification du navigateur | A : non pour l'instant | à confirmer |
| D3 | Durée de la connexion conservée | 7 jours | **confirmé** (14 octobre 2026) |
| D4 | La pause du timer coupe aussi la musique | A : oui | à confirmer |
| D5 | Musique pendant les 15 minutes de pause | A : coupée | à confirmer |
| D6 | Après la pause | A : démarrage automatique + signal | à confirmer |
| D7 | Nombre de sessions | A : jusqu'à « Arrêter » | à confirmer |
| D8 | F7 (musique selon la phase) | A : en réserve | à confirmer |
| D9 | F8 (pause garantie par un serveur) | sans serveur | **confirmé : écartée** (15 octobre 2026) |
| D10 | F9 (garder l'onglet éveillé) | A : essais sans code d'abord | à confirmer |
| D11 | F10 (extension de navigateur) | A : en réserve | à confirmer |

## 10. Apple Music et Deezer : ce qui a été évalué (14 octobre 2026)
Décision : **hors périmètre pour l'instant.** Ce qui suit évite de refaire la recherche si la question revient.

**La différence de fond.** Avec Spotify, l'appli est une télécommande : la musique joue dans l'appli Spotify de la personne et la page envoie « play » ou « pause ». Chez Apple Music et Deezer, la page devient le lecteur (MusicKit JS d'un côté, plugins et SDK JavaScript de l'autre). Déduction (non testée) : la musique s'arrêterait avec l'onglet, il faudrait choisir une playlist dans l'appli, et la lecture automatique de la session suivante pourrait être bloquée par les règles du navigateur. Cela toucherait F4, F6 et la décision « pas de choix de playlist ». Ajouter un service demanderait de réorganiser l'appli autour d'un « fournisseur de musique », pas seulement d'ajouter une connexion.

**Apple Music (complexité élevée).**
- Jeton de développeur signé avec une clé privée créée dans le compte développeur d'Apple, valable 6 mois au maximum.
- Compte développeur payant : réponse d'un forum Apple, non confirmée par la documentation officielle.
- Peut-être possible sans serveur, avec un jeton collé dans la configuration et renouvelé à la main : non confirmé.
- Abonnement Apple Music actif obligatoire pour la personne ; script externe (MusicKit JS) chargé depuis un serveur d'Apple, ce qui irait contre la règle « aucune dépendance externe ».

**Deezer (complexité et risque élevés).**
- Confirmé par les règles de Deezer : l'API ne donne que des extraits de 30 secondes. Les morceaux entiers passent par les plugins web et le SDK JavaScript, pour les abonnés Premium. Usage strictement non commercial.
- Non vérifié : la documentation du SDK et la création d'application sont derrière une connexion à un compte Deezer. Impossible de dire si de nouvelles applications peuvent encore être créées, ni comment piloter la lecture. Les conditions d'utilisation semblent anciennes.

**Si la question revient :** se connecter sur developers.deezer.com pour vérifier que la création d'application est ouverte ; vérifier auprès d'Apple si un compte développeur payant est requis ; puis chiffrer le travail de réorganisation autour d'un « fournisseur de musique ».
