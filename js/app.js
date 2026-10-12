// Point d'entrée : relie la page (boutons, affichage), le timer et Spotify.
// Pour l'instant, la connexion à Spotify est branchée. La lecture et la pause viennent ensuite.

import { SPOTIFY_REDIRECT_URI, TIMER_DURATION_MINUTES } from './config.js';
import { createTimer, formatTime } from './timer.js';
import { handleRedirect, isLoggedIn, login } from './spotify.js';

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
  onEnd() {
    message.textContent = 'Temps écoulé !';
    updateConnectionUi();
  },
});

// Le bouton Démarrer n'est utilisable que si on est connecté à Spotify.
function updateConnectionUi() {
  const loggedIn = isLoggedIn();
  connectButton.hidden = loggedIn;
  startButton.disabled = !loggedIn;
}

connectButton.addEventListener('click', () => {
  login();
});

startButton.addEventListener('click', () => {
  message.textContent = '';
  startButton.disabled = true;
  timer.start();
});

const REDIRECT_MESSAGES = {
  connected: 'Connecté à Spotify.',
  denied: 'Connexion refusée. L\'appli a besoin de l\'accès pour contrôler la lecture.',
  error: 'La connexion à Spotify a échoué. Réessayez.',
};

async function init() {
  timerDisplay.textContent = formatTime(durationSeconds);

  // Spotify ne renvoie vers l'adresse exacte déclarée dans le Dashboard : 127.0.0.1, pas localhost.
  if (window.location.origin !== new URL(SPOTIFY_REDIRECT_URI).origin) {
    message.textContent = `Ouvrez l'appli à l'adresse ${SPOTIFY_REDIRECT_URI} pour pouvoir vous connecter à Spotify.`;
    connectButton.disabled = true;
    startButton.disabled = true;
    return;
  }

  const result = await handleRedirect();
  if (result !== 'none') message.textContent = REDIRECT_MESSAGES[result];
  updateConnectionUi();
}

init();
