// Configuration publique de l'appli.
// Le Client ID n'est PAS un secret : avec OAuth PKCE, il est fait pour être visible dans le navigateur.
// Il n'y a aucun Client Secret dans cette appli, et il ne faut jamais en ajouter.

export const SPOTIFY_CLIENT_ID = 'f359a71dcc4f4f9390772ee1bf05aaf5'; // visible dans le Spotify Developer Dashboard
export const SPOTIFY_REDIRECT_URI = 'http://127.0.0.1:8000/'; // à déclarer aussi dans le Dashboard
export const SPOTIFY_SCOPES = [
  'user-read-playback-state',
  'user-modify-playback-state',
];

export const TIMER_DURATION_MINUTES = 0.1; // durée fixe pour le MVP
