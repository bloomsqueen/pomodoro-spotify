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

  // `endsAt` : heure de fin (en millisecondes). Par défaut, `durationMs` à partir de maintenant ;
  // en passant une heure déjà enregistrée, on reprend une session retrouvée après un rechargement.
  function start(endsAt = Date.now() + durationMs) {
    if (intervalId !== null) return; // déjà en cours : on ignore un second clic
    endTime = endsAt;
    // L'intervalle est créé AVANT le premier tick : si l'heure de fin est déjà passée, tick() l'arrête aussitôt.
    intervalId = setInterval(tick, TICK_INTERVAL_MS);
    tick();
  }

  function isRunning() {
    return intervalId !== null;
  }

  return { start, stop, isRunning };
}

export function formatTime(totalSeconds) {
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  return `${minutes}:${seconds}`;
}
