// Point d'entrée : relie la page (boutons, affichage), le timer et Spotify.
// Étape suivante : brancher les boutons.

import { TIMER_DURATION_MINUTES } from './config.js';
import { formatTime } from './timer.js';

const timerDisplay = document.getElementById('timer-display');

timerDisplay.textContent = formatTime(TIMER_DURATION_MINUTES * 60);
