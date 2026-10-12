// Point d'entrée : relie la page (boutons, affichage), le timer et Spotify.
// Le timer démarre la musique, et la met en pause à la fin.

import { SPOTIFY_REDIRECT_URI, TIMER_DURATION_MINUTES } from './config.js';
import { createTimer, formatTime } from './timer.js';
import { handleRedirect, isLoggedIn, login, pausePlayback, resumePlayback } from './spotify.js';

const timerDisplay = document.getElementById('timer-display');
const startButton = document.getElementById('start-button');
const connectButton = document.getElementById('connect-button');
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

// Le bouton Démarrer n'est utilisable que si on est connecté à Spotify.
function updateConnectionUi() {
  const loggedIn = isLoggedIn();
  connectButton.hidden = loggedIn;
  startButton.disabled = !loggedIn;
}

connectButton.addEventListener('click', () => {
  login();
});

startButton.addEventListener('click', async () => {
  message.textContent = '';
  startButton.disabled = true;

  // On lance la musique d'abord : si Spotify refuse, le timer ne démarre pas et on explique pourquoi.
  const result = await resumePlayback();
  if (!result.ok) {
    message.textContent = PLAYER_ERRORS[result.reason];
    updateConnectionUi();
    return;
  }

  document.body.classList.add('is-running');
  timer.start();
});

const REDIRECT_MESSAGES = {
  connected: 'Connecté à Spotify.',
  denied: 'Connexion refusée. L\'appli a besoin de ton accord pour contrôler la lecture.',
  error: 'La connexion à Spotify a échoué. Réessaie.',
};

async function init() {
  timerDisplay.textContent = formatTime(durationSeconds);

  // Spotify ne renvoie vers l'adresse exacte déclarée dans le Dashboard : 127.0.0.1, pas localhost.
  if (window.location.origin !== new URL(SPOTIFY_REDIRECT_URI).origin) {
    message.textContent = `Ouvre l'appli à l'adresse ${SPOTIFY_REDIRECT_URI} pour pouvoir te connecter à Spotify.`;
    connectButton.disabled = true;
    startButton.disabled = true;
    return;
  }

  const result = await handleRedirect();
  if (result !== 'none') message.textContent = REDIRECT_MESSAGES[result];
  updateConnectionUi();
}

init();
