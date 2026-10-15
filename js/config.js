// Configuration publique de l'appli.
// Le Client ID n'est PAS un secret : avec OAuth PKCE, il est fait pour être visible dans le navigateur.
// Il n'y a aucun Client Secret dans cette appli, et il ne faut jamais en ajouter.

export const SPOTIFY_CLIENT_ID = 'f359a71dcc4f4f9390772ee1bf05aaf5'; // visible dans le Spotify Developer Dashboard
// L'adresse de retour après la connexion n'est pas écrite ici : elle est calculée à partir de l'adresse
// où l'appli est ouverte (voir getRedirectUri dans spotify.js). Chaque adresse utilisée doit être
// déclarée dans le Dashboard Spotify (Settings, puis Redirect URIs) :
//   - en local : http://127.0.0.1:8000/
//   - en ligne : https://pomodoro-spotify.tela-mellies.workers.dev/
export const SPOTIFY_SCOPES = [
  'user-read-playback-state',
  'user-modify-playback-state',
];

export const TIMER_DURATION_MINUTES = 45; // durée fixe d'une session de travail
export const BREAK_DURATION_MINUTES = 15; // durée fixe de la pause qui suit
