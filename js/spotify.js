// Tout ce qui parle à Spotify : connexion (OAuth PKCE), reprise et pause de la lecture.
// Étape suivante : implémenter ces fonctions.

export async function login() {
  // TODO : rediriger l'utilisateur vers la page de connexion Spotify (PKCE)
}

export async function handleRedirect() {
  // TODO : au retour de Spotify, échanger le code contre un jeton d'accès
}

export function isLoggedIn() {
  // TODO : renvoyer true si on a un jeton valide
  return false;
}

export async function resumePlayback() {
  // TODO : PUT /v1/me/player/play (sans corps = reprend la lecture en cours)
}

export async function pausePlayback() {
  // TODO : PUT /v1/me/player/pause
}
