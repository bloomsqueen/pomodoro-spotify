// Le compte à rebours, indépendant de Spotify et de la page.
// Étape suivante : implémenter createTimer.
//
// Important : on calcule le temps restant à partir de l'heure de fin (Date.now()),
// pas en comptant les secondes. Les navigateurs ralentissent les onglets en arrière-plan,
// et un compteur de secondes prendrait du retard.

export function createTimer({ durationMs, onTick, onEnd }) {
  // TODO : renvoyer { start, stop }
  return { start() {}, stop() {} };
}

export function formatTime(totalSeconds) {
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  return `${minutes}:${seconds}`;
}
