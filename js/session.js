// La session en cours (son heure de fin), gardée dans le navigateur pour survivre à un rechargement,
// à la fermeture de l'onglet ou à sa mise en veille. L'heure de fin suffit : le temps restant s'en déduit.

import { getItem, setItem, removeItem, onChange, runIfAvailable } from './storage.js';

const KEY_SESSION = 'pomodoro_session';

export function saveSession({ endsAt, durationMs }) {
  setItem(KEY_SESSION, JSON.stringify({ endsAt, durationMs }));
}

// Renvoie { endsAt, durationMs } ou null s'il n'y a pas de session (ou si la valeur gardée est abîmée).
export function readSession() {
  const raw = getItem(KEY_SESSION);
  if (raw === null) return null;

  let session = null;
  try {
    session = JSON.parse(raw);
  } catch {
    // Valeur illisible : traitée plus bas.
  }
  const valid = session && Number.isFinite(session.endsAt) && Number.isFinite(session.durationMs) && session.durationMs > 0;
  if (!valid) {
    removeItem(KEY_SESSION); // valeur abîmée : on l'oublie
    return null;
  }
  return session;
}

export function clearSession() {
  removeItem(KEY_SESSION);
}

// Plusieurs onglets peuvent voir la même session se terminer. Un seul doit envoyer la pause à Spotify :
// celui qui « prend en charge » la fin renvoie true (et efface la session), les autres renvoient false.
// Le verrou porte l'heure de fin : il ne gêne pas une session suivante.
const END_LOCK_HOLD_MS = 5000; // voir storage.js : le temps que les autres onglets voient la session effacée

export async function claimSessionEnd(endsAt) {
  const claimed = await runIfAvailable(`pomodoro-end-${endsAt}`, () => {
    const session = readSession();
    if (!session || session.endsAt !== endsAt) return false;
    clearSession();
    return true;
  }, { holdMs: END_LOCK_HOLD_MS });
  return claimed === true;
}

// Appelle `callback()` quand un AUTRE onglet démarre ou termine une session.
export function onSessionChange(callback) {
  onChange((key) => {
    if (key === null || key === KEY_SESSION) callback();
  });
}
