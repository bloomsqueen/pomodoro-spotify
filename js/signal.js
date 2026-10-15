// Les signaux de fin, indépendants de la musique : le titre de l'onglet et un petit son.
//
// Le son est fabriqué par le navigateur (Web Audio), sans fichier à charger. Les navigateurs n'autorisent
// un son qu'après un geste de la personne (un clic) : on prépare donc le son au clic sur « Démarrer ».
// Si la page a été rechargée sans clic, le son peut être refusé : le titre de l'onglet reste le signal.

import { formatTime } from './timer.js';

const BASE_TITLE = document.title;

// Titre de l'onglet pendant une session, par exemple « 12:34 · Travail ».
export function setTitle(remainingSeconds, phaseLabel) {
  const title = `${formatTime(remainingSeconds)} · ${phaseLabel}`;
  if (document.title !== title) document.title = title;
}

export function resetTitle() {
  document.title = BASE_TITLE;
}

let audioContext = null;

// À appeler dans un geste de la personne (clic, touche) : prépare ou réveille le son.
export function prepareSound() {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    if (!audioContext) audioContext = new AudioContextClass();
    if (audioContext.state === 'suspended') audioContext.resume();
  } catch {
    // Pas de son possible : le titre de l'onglet fait le travail.
  }
}

// Un petit carillon de trois notes, doux.
export function playChime() {
  try {
    if (!audioContext || audioContext.state !== 'running') return;
    const start = audioContext.currentTime + 0.05;
    [659.25, 783.99, 1046.5].forEach((frequency, index) => {
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      const at = start + index * 0.22;
      oscillator.type = 'sine';
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(0.25, at + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.6);
      oscillator.connect(gain).connect(audioContext.destination);
      oscillator.start(at);
      oscillator.stop(at + 0.65);
    });
  } catch {
    // Son refusé : tant pis, le titre et le message restent.
  }
}
