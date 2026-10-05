// Le compte à rebours, indépendant de Spotify et de la page.
//
// Important : on calcule le temps restant à partir de l'heure de fin (Date.now()),
// pas en comptant les secondes. Les navigateurs ralentissent les onglets en arrière-plan,
// et un compteur de secondes prendrait du retard.

const TICK_INTERVAL_MS = 250; // on vérifie souvent pour que l'affichage change à la bonne seconde

export function createTimer({ durationMs, onTick, onEnd }) {
  let endTime = null;
  let intervalId = null;

  function stop() {
    clearInterval(intervalId);
    intervalId = null;
    endTime = null;
  }

  function tick() {
    const remainingMs = Math.max(0, endTime - Date.now());
    // ceil : 44:59,9 s s'affiche « 45:00 », et « 00:00 » n'apparaît qu'à la toute fin
    onTick(Math.ceil(remainingMs / 1000));

    if (remainingMs === 0) {
      stop();
      onEnd();
    }
  }

  function start() {
    if (intervalId !== null) return; // déjà en cours : on ignore un second clic
    endTime = Date.now() + durationMs;
    tick();
    intervalId = setInterval(tick, TICK_INTERVAL_MS);
  }

  return { start, stop };
}

export function formatTime(totalSeconds) {
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  return `${minutes}:${seconds}`;
}
