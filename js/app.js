// Point d'entrée : relie la page (boutons, affichage), le timer et Spotify.
// Le timer démarre la musique, et la met en pause à la fin.

import { TIMER_DURATION_MINUTES } from './config.js';
import { createTimer, formatTime } from './timer.js';
import {
  handleRedirect, isLoggedIn, login, logout, onConnectionChange, pausePlayback, redirectUriProblem, resumePlayback,
} from './spotify.js';

const timerDisplay = document.getElementById('timer-display');
const startButton = document.getElementById('start-button');
const connectButton = document.getElementById('connect-button');
const logoutButton = document.getElementById('logout-button');
const message = document.getElementById('message');

const durationSeconds = TIMER_DURATION_MINUTES * 60;

const timer = createTimer({
  durationMs: durationSeconds * 1000,
  onTick(remainingSeconds) {
    timerDisplay.textContent = formatTime(remainingSeconds);
  },
  async onEnd() {
    document.body.classList.remove('is-running');
    const result = await pausePlayback();
    message.textContent = result.ok
      ? 'Temps écoulé ! Spotify est en pause.'
      : `Temps écoulé ! Mais Spotify n'a pas pu être mis en pause : mets-le en pause toi-même. ${PLAYER_ERRORS[result.reason]}`;
    updateConnectionUi();
  },
});

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
  startButton.disabled = true;

  // On lance la musique d'abord : si Spotify refuse, le timer ne démarre pas et on explique pourquoi.
  const result = await resumePlayback(durationSeconds * 1000);
  if (!result.ok) {
    message.textContent = PLAYER_ERRORS[result.reason];
    updateConnectionUi();
    return;
  }

  document.body.classList.add('is-running');
  updateConnectionUi();
  timer.start();
});

const REDIRECT_MESSAGES = {
  connected: 'Connecté à Spotify.',
  denied: 'Connexion refusée. L\'appli a besoin de ton accord pour contrôler la lecture.',
  error: 'La connexion à Spotify a échoué. Réessaie.',
};

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

  const result = await handleRedirect();
  if (result !== 'none') message.textContent = REDIRECT_MESSAGES[result];
  updateConnectionUi();
}

init();
