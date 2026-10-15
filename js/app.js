// Point d'entrée : relie la page (boutons, affichage), le timer et Spotify.
// Le timer démarre la musique, et la met en pause à la fin.

import { TIMER_DURATION_MINUTES } from './config.js';
import { createTimer, formatTime } from './timer.js';
import { playChime, prepareSound, resetTitle, setTitle } from './signal.js';
import { claimSessionEnd, clearSession, onSessionChange, readSession, saveSession } from './session.js';
import {
  handleRedirect, isLoggedIn, login, logout, onConnectionChange, pausePlayback, redirectUriProblem, resumePlayback,
} from './spotify.js';

const timerDisplay = document.getElementById('timer-display');
const startButton = document.getElementById('start-button');
const connectButton = document.getElementById('connect-button');
const logoutButton = document.getElementById('logout-button');
const message = document.getElementById('message');

const durationSeconds = TIMER_DURATION_MINUTES * 60;
const durationMs = durationSeconds * 1000;
let currentEndsAt = null; // heure de fin de la session affichée

const timer = createTimer({
  durationMs,
  onTick(remainingSeconds) {
    timerDisplay.textContent = formatTime(remainingSeconds);
    setTitle(remainingSeconds, 'Travail');
  },
  onEnd() {
    return endSession(currentEndsAt);
  },
});

// Combien de temps s'est écoulé depuis la fin, dit simplement.
function formatAgo(ms) {
  const minutes = Math.round(ms / 60000);
  if (minutes < 1) return 'il y a moins d\'une minute';
  if (minutes < 120) return `il y a ${minutes} min`;
  return `il y a ${Math.round(minutes / 60)} h`;
}

// Fin d'une session : on envoie la pause à Spotify, sauf si un autre onglet s'en occupe déjà.
// Si la page n'a pas pu réagir à l'heure (onglet fermé, endormi ou gelé), on le dit : la pause part
// alors en retard, dès que la page est de nouveau active.
async function endSession(endsAt) {
  document.body.classList.remove('is-running');
  timerDisplay.textContent = formatTime(0);
  resetTitle();

  if (!(await claimSessionEnd(endsAt))) {
    message.textContent = 'Temps écoulé ! Un autre onglet s\'occupe de mettre Spotify en pause.';
    updateConnectionUi();
    return;
  }

  const lateMs = Date.now() - endsAt;
  if (lateMs <= LATE_AFTER_MS) playChime(); // un signal qui ne dépend pas de la musique ; inutile s'il arrive très en retard
  const intro = lateMs > LATE_AFTER_MS
    ? `Ta session s'est terminée ${formatAgo(lateMs)}, pendant que la page n'était pas active.`
    : 'Temps écoulé !';
  const result = await pausePlayback();
  message.textContent = result.ok
    ? `${intro} ${result.already ? 'Spotify était déjà en pause.' : 'Spotify est en pause.'}`
    : `${intro} Mais Spotify n'a pas pu être mis en pause : mets-le en pause toi-même. ${PLAYER_ERRORS[result.reason]}`;
  updateConnectionUi();
}

const LATE_AFTER_MS = 10 * 1000; // au-delà, on considère que la page n'a pas pu réagir à l'heure

// On affiche une session en cours (retrouvée après un rechargement, ou démarrée dans un autre onglet).
function beginRunning(endsAt) {
  currentEndsAt = endsAt;
  document.body.classList.add('is-running');
  updateConnectionUi();
  timer.start(endsAt);
}

// À l'ouverture de la page : y a-t-il une session que cette page ne connaît pas encore ?
async function restoreSession({ fromOtherTab = false } = {}) {
  const session = readSession();
  if (!session || timer.isRunning()) return;

  const now = Date.now();
  if (session.endsAt - now > session.durationMs + 60 * 1000) {
    clearSession(); // heure de fin absurde (horloge de l'ordinateur modifiée) : on l'oublie
    return;
  }

  if (session.endsAt > now) {
    beginRunning(session.endsAt);
    if (fromOtherTab) message.textContent = 'Une session est en cours dans un autre onglet.';
    else if (document.wasDiscarded) message.textContent = 'Ta session était en cours : on l\'a retrouvée (le navigateur avait mis l\'onglet en veille).';
    else message.textContent = 'Ta session était en cours : on l\'a retrouvée.';
    return;
  }

  // La session s'est terminée pendant que la page n'était pas là.
  currentEndsAt = session.endsAt;
  await endSession(session.endsAt);
}

// Ce que l'on dit à l'utilisateur quand Spotify refuse une commande de lecture.
const PLAYER_ERRORS = {
  'no-device': 'Aucun appareil Spotify actif. Ouvre Spotify sur un de tes appareils et lance un morceau une fois, puis réessaie.',
  premium: 'Contrôler la lecture demande un compte Spotify Premium.',
  expired: 'Ta connexion à Spotify a expiré. Reconnecte-toi.',
  forbidden: 'Spotify refuse l\'accès. Ton compte doit être ajouté à la liste des utilisateurs de l\'appli dans le Dashboard Spotify.',
  'rate-limit': 'Spotify reçoit trop de requêtes. Attends un instant, puis réessaie.',
  network: 'Impossible de joindre Spotify. Vérifie ta connexion internet.',
  error: 'Spotify a répondu par une erreur inattendue. Réessaie.',
};

// Bouton « Animations » : permet de couper les animations décoratives (en plus du réglage du système).
const motionToggle = document.getElementById('motion-toggle');
const MOTION_KEY = 'animations_off';

function setCalm(calm) {
  document.body.classList.toggle('calm', calm);
  motionToggle.setAttribute('aria-pressed', String(calm));
  motionToggle.textContent = calm ? 'Animations : désactivées' : 'Animations : activées';
  try {
    sessionStorage.setItem(MOTION_KEY, calm ? '1' : '0');
  } catch {
    // Stockage indisponible : le choix vaut simplement pour cette page.
  }
}

motionToggle.addEventListener('click', () => {
  setCalm(!document.body.classList.contains('calm'));
});

try {
  if (sessionStorage.getItem(MOTION_KEY) === '1') setCalm(true);
} catch {
  // Stockage indisponible : on garde l'état par défaut.
}

const sessionRunning = () => document.body.classList.contains('is-running');

// Le bouton Démarrer n'est utilisable que si on est connecté à Spotify. « Se déconnecter » ne l'est
// pas pendant une session : on ne pourrait plus mettre Spotify en pause à la fin.
let wasLoggedIn = false;

function updateConnectionUi() {
  const loggedIn = isLoggedIn();
  connectButton.hidden = loggedIn;
  logoutButton.hidden = !loggedIn;
  logoutButton.disabled = sessionRunning();
  startButton.disabled = !loggedIn || sessionRunning();
  wasLoggedIn = loggedIn;
}

connectButton.addEventListener('click', () => {
  login();
});

logoutButton.addEventListener('click', () => {
  logout();
  updateConnectionUi();
  message.textContent = 'La connexion à Spotify a été supprimée de cet appareil.';
});

startButton.addEventListener('click', async () => {
  message.textContent = '';
  prepareSound();

  // Une session tourne déjà (dans un autre onglet, par exemple) : on ne la double pas.
  const existing = readSession();
  if (existing && existing.endsAt > Date.now()) {
    await restoreSession({ fromOtherTab: true });
    return;
  }

  startButton.disabled = true;

  // On lance la musique d'abord : si Spotify refuse, le timer ne démarre pas et on explique pourquoi.
  const result = await resumePlayback(durationMs);
  if (!result.ok) {
    message.textContent = PLAYER_ERRORS[result.reason];
    updateConnectionUi();
    return;
  }

  const endsAt = Date.now() + durationMs;
  saveSession({ endsAt, durationMs }); // gardée dans le navigateur : la session survit à un rechargement
  beginRunning(endsAt);
});

const REDIRECT_MESSAGES = {
  connected: 'Connecté à Spotify.',
  denied: 'Connexion refusée. L\'appli a besoin de ton accord pour contrôler la lecture.',
  error: 'La connexion à Spotify a échoué. Réessaie.',
};

// Après un rechargement, le son n'est autorisé qu'après un premier geste : on le prépare dès qu'il y en a un.
for (const gesture of ['pointerdown', 'keydown']) document.addEventListener(gesture, prepareSound, { once: true });

async function init() {
  timerDisplay.textContent = formatTime(durationSeconds);

  // Spotify refuse certaines adresses de retour (localhost, http hors 127.0.0.1) : on explique quoi faire.
  const problem = redirectUriProblem();
  if (problem) {
    const port = window.location.port ? `:${window.location.port}` : '';
    message.textContent = problem === 'localhost'
      ? `Ouvre l'appli à l'adresse http://127.0.0.1${port}/ (et pas localhost) pour pouvoir te connecter à Spotify.`
      : 'Spotify n\'accepte que les adresses en https (ou 127.0.0.1). Ouvre l\'appli en https pour pouvoir te connecter.';
    connectButton.disabled = true;
    startButton.disabled = true;
    return;
  }

  // Quand un autre onglet se connecte ou se déconnecte, celui-ci se met à jour tout seul.
  onConnectionChange(() => {
    const before = wasLoggedIn;
    updateConnectionUi();
    if (!before && wasLoggedIn) message.textContent = 'Connecté à Spotify.';
    if (before && !wasLoggedIn) message.textContent = 'La connexion à Spotify a été supprimée dans un autre onglet.';
  });

  // Quand un autre onglet démarre une session, celui-ci l'affiche aussi.
  onSessionChange(() => restoreSession({ fromOtherTab: true }));

  const result = await handleRedirect();
  if (result !== 'none') message.textContent = REDIRECT_MESSAGES[result];
  updateConnectionUi();
  await restoreSession();
}

init();
