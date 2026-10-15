// La session en cours (sa phase, son numéro et son heure de fin), gardée dans le navigateur pour survivre
// à un rechargement, à la fermeture de l'onglet ou à sa mise en veille. L'heure de fin suffit :
// le temps restant s'en déduit. Phase : 'work' (travail) ou 'break' (pause).

import { getItem, setItem, removeItem, onChange, runIfAvailable } from './storage.js';

const KEY_SESSION = 'pomodoro_session';

const PHASES = ['work', 'break'];

export function saveSession({ endsAt, durationMs, phase = 'work', round = 1 }) {
  setItem(KEY_SESSION, JSON.stringify({ endsAt, durationMs, phase, round }));
}

// Renvoie { endsAt, durationMs, phase, round } ou null s'il n'y a pas de session (ou si la valeur gardée est abîmée).
export function readSession() {
  const raw = getItem(KEY_SESSION);
  if (raw === null) return null;

  let session = null;
  try {
    session = JSON.parse(raw);
  } catch {
    // Valeur illisible : traitée plus bas.
  }
  // Une session enregistrée avant l'arrivée des pauses n'a ni phase ni numéro : c'est une session de travail n°1.
  const valid = session && Number.isFinite(session.endsAt) && Number.isFinite(session.durationMs) && session.durationMs > 0
    && (session.phase === undefined || PHASES.includes(session.phase))
    && (session.round === undefined || (Number.isInteger(session.round) && session.round >= 1));
  if (!valid) {
    removeItem(KEY_SESSION); // valeur abîmée : on l'oublie
    return null;
  }
  return { endsAt: session.endsAt, durationMs: session.durationMs, phase: session.phase ?? 'work', round: session.round ?? 1 };
}

export function clearSession() {
  removeItem(KEY_SESSION);
}

// Plusieurs onglets peuvent voir la même session se terminer. Un seul doit envoyer la pause à Spotify :
// celui qui « prend en charge » la fin renvoie true, les autres renvoient false.
// En le prenant, il remplace la session par la suivante (`next`), ou l'efface si `next` vaut null :
// d'un seul geste, pour que les autres onglets ne voient jamais « aucune session » entre deux phases.
// Le verrou porte l'heure de fin : il ne gêne pas la phase suivante.
const END_LOCK_HOLD_MS = 5000; // voir storage.js : le temps que les autres onglets voient la session effacée

export async function claimSessionEnd(endsAt, next = null) {
  const claimed = await runIfAvailable(`pomodoro-end-${endsAt}`, () => {
    const session = readSession();
    if (!session || session.endsAt !== endsAt) return false;
    if (next) saveSession(next);
    else clearSession();
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
