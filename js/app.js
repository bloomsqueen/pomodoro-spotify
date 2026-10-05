// Point d'entrée : relie la page (boutons, affichage), le timer et Spotify.
// Pour l'instant, seul le timer est branché. Spotify viendra à l'étape suivante.

import { TIMER_DURATION_MINUTES } from './config.js';
import { createTimer, formatTime } from './timer.js';

const timerDisplay = document.getElementById('timer-display');
const startButton = document.getElementById('start-button');
const message = document.getElementById('message');

const durationSeconds = TIMER_DURATION_MINUTES * 60;

const timer = createTimer({
  durationMs: durationSeconds * 1000,
  onTick(remainingSeconds) {
    timerDisplay.textContent = formatTime(remainingSeconds);
  },
  onEnd() {
    message.textContent = 'Temps écoulé !';
    startButton.disabled = false;
  },
});

startButton.addEventListener('click', () => {
  message.textContent = '';
  startButton.disabled = true;
  timer.start();
});

timerDisplay.textContent = formatTime(durationSeconds);
