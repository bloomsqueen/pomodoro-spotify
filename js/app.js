// Point d'entrée : relie la page (boutons, affichage), le timer et Spotify.
// Le timer démarre la musique, et la met en pause à la fin.

import { BREAK_DURATION_MINUTES, TIMER_DURATION_MINUTES } from './config.js';
import { createTimer, formatTime } from './timer.js';
import { playChime, prepareSound, resetTitle, setTitle } from './signal.js';
import { claimSessionEnd, clearSession, onSessionChange, readSession, saveSession } from './session.js';
import {
  handleRedirect, isLoggedIn, login, logout, onConnectionChange, pausePlayback, redirectUriProblem, resumePlayback,
} from './spotify.js';

const timerDisplay = document.getElementById('timer-display');
const phaseLabel = document.getElementById('etiquette-timer');
const startButton = document.getElementById('start-button');
const stopButton = document.getElementById('stop-button');
const connectButton = document.getElementById('connect-button');
const logoutButton = document.getElementById('logout-button');
const message = document.getElementById('message');

const durationSeconds = TIMER_DURATION_MINUTES * 60;
const workMs = durationSeconds * 1000;
const breakMs = BREAK_DURATION_MINUTES * 60 * 1000;
const PHASE_NAMES = { work: 'Travail', break: 'Pause' };
const IDLE_LABEL = 'Temps restant';

// La session affichée : { phase, round, durationMs, endsAt }. null quand rien ne tourne.
let currentSession = null;

const timer = createTimer({
  durationMs: workMs,
  onTick(remainingSeconds) {
    timerDisplay.textContent = formatTime(remainingSeconds);
    setTitle(remainingSeconds, PHASE_NAMES[currentSession.phase]);
  },
  onEnd() {
    return endPhase(currentSession);
  },
});

// Combien de temps s'est écoulé depuis la fin, dit simplement.
function formatAgo(ms) {
  const minutes = Math.round(ms / 60000);
  if (minutes < 1) return 'il y a moins d\'une minute';
  if (minutes < 120) return `il y a ${minutes} min`;
  return `il y a ${Math.round(minutes / 60)} h`;
}

const formatClock = (time) => new Date(time).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

const LATE_AFTER_MS = 10 * 1000; // au-delà, on considère que la page n'a pas pu réagir à l'heure
// Si la pause a fini il y a plus longtemps que ça (page endormie, ordinateur fermé…), on ne relance pas
// la musique tout seul : la personne n'est sans doute plus devant l'écran. Elle clique sur « Démarrer ».
const MAX_AUTO_RESTART_DELAY_MS = breakMs;

// La session qui suit la session de travail `round`, ou la nouvelle session de travail qui démarre à `startsAt`.
const breakSession = (round, endsAt) => ({ phase: 'break', round, durationMs: breakMs, endsAt });
const workSession = (round, startsAt) => ({ phase: 'work', round, durationMs: workMs, endsAt: startsAt + workMs });

// Ce que montre la page pendant une phase (et au repos quand `session` vaut null).
function showPhase(session) {
  document.body.classList.toggle('is-break', session !== null && session.phase === 'break');
  phaseLabel.textContent = session ? `${PHASE_NAMES[session.phase]} · session ${session.round}` : IDLE_LABEL;
}

// On affiche une session en cours (démarrée ici, retrouvée après un rechargement, ou venue d'un autre onglet).
function beginRunning(session) {
  currentSession = session;
  document.body.classList.add('is-running');
  showPhase(session);
  updateConnectionUi();
  timer.start(session.endsAt);
}

// Plus rien ne tourne : on remet la page au repos.
function goIdle() {
  timer.stop();
  currentSession = null;
  document.body.classList.remove('is-running');
  showPhase(null);
  timerDisplay.textContent = formatTime(durationSeconds);
  resetTitle();
  updateConnectionUi();
}

// Une phrase honnête sur le résultat d'une commande de pause.
function pauseSentence(result) {
  if (result.ok) return result.already ? 'Spotify était déjà en pause.' : 'Spotify est en pause.';
  return `Mais Spotify n'a pas pu être mis en pause : mets-le en pause toi-même. ${PLAYER_ERRORS[result.reason]}`;
}

// Fin d'une phase : un seul onglet s'en occupe (celui qui « prend en charge » la fin). Il enchaîne avec
// la phase suivante : après le travail, la pause (musique coupée) ; après la pause, une nouvelle session de
// travail avec la musique. Si la page n'a pas pu réagir à l'heure (onglet fermé, endormi ou gelé), on le dit.
async function endPhase(session) {
  if (currentSession !== session) return; // une autre session a pris la place entre-temps
  timerDisplay.textContent = formatTime(0);

  const now = Date.now();
  const lateMs = now - session.endsAt;
  const late = lateMs > LATE_AFTER_MS;

  // Quelle est la phase suivante ? (null : on s'arrête là et la personne relancera.)
  let next = null;
  let breakAlreadyOver = false; // la session de travail ET la pause qui suit sont déjà finies
  if (session.phase === 'work') {
    const breakEnd = session.endsAt + breakMs;
    if (breakEnd > now) next = breakSession(session.round, breakEnd);
    else {
      breakAlreadyOver = true;
      if (now - breakEnd <= MAX_AUTO_RESTART_DELAY_MS) next = workSession(session.round + 1, now);
    }
  } else if (lateMs <= MAX_AUTO_RESTART_DELAY_MS) {
    next = workSession(session.round + 1, now);
  }

  if (!(await claimSessionEnd(session.endsAt, next))) {
    // Un autre onglet s'en occupe : il enregistre la suite, et cette page l'affichera en la recevant.
    if (currentSession === session) message.textContent = 'Temps écoulé ! Un autre onglet s\'occupe de la suite.';
    return;
  }

  if (!late) playChime(); // un signal qui ne dépend pas de la musique ; inutile s'il arrive très en retard

  if (session.phase === 'work' && !breakAlreadyOver) await finishWork(session, next, late, lateMs);
  else if (session.phase === 'work') await restartAfterLongAbsence(session, next, lateMs);
  else await finishBreak(session, next, late, lateMs);
}

// Fin d'une session de travail : on coupe la musique, puis la pause commence.
async function finishWork(session, breakNext, late, lateMs) {
  const intro = late
    ? `Ta session s'est terminée ${formatAgo(lateMs)}, pendant que la page n'était pas active.`
    : 'Temps écoulé !';
  const result = await pausePlayback();
  beginRunning(breakNext);
  message.textContent = `${intro} ${pauseSentence(result)} C'est la pause, jusqu'à ${formatClock(breakNext.endsAt)}.`;
}

// La session de travail et la pause sont toutes les deux finies pendant que la page n'était pas active.
async function restartAfterLongAbsence(session, next, lateMs) {
  const overshoot = `Ta session s'est terminée ${formatAgo(lateMs)}, pendant que la page n'était pas active : ta pause a duré plus longtemps que prévu.`;
  if (!next) {
    // Trop longtemps : on coupe la musique si elle joue encore, et on laisse la personne relancer.
    const result = await pausePlayback();
    goIdle();
    message.textContent = `${overshoot} ${pauseSentence(result)}${result.ok || result.reason !== 'expired' ? ' Clique sur « Démarrer » quand tu veux reprendre.' : ''}`;
    return;
  }
  // La musique a pu continuer pendant toute la pause : pas de pause inutile, « play » ne fera rien si elle joue.
  await startWork(next, `${overshoot} Une nouvelle session de ${TIMER_DURATION_MINUTES} min commence maintenant.`);
}

// Fin d'une pause : la session de travail suivante démarre toute seule, avec la musique.
async function finishBreak(session, next, late, lateMs) {
  if (!next) {
    goIdle();
    message.textContent = `Ta pause devait se terminer ${formatAgo(lateMs)}, pendant que la page n'était pas active : elle a duré plus longtemps que prévu. Clique sur « Démarrer » quand tu veux reprendre.`;
    return;
  }
  await startWork(next, late
    ? `Ta pause devait se terminer ${formatAgo(lateMs)}, mais la page n'était pas active : elle a peut-être duré plus longtemps que prévu. Une nouvelle session de ${TIMER_DURATION_MINUTES} min commence maintenant.`
    : `La pause est finie : c'est reparti pour ${TIMER_DURATION_MINUTES} min.`);
}

// Lance la musique puis affiche la session de travail `next`, déjà enregistrée par celui qui a pris la fin en charge.
// Si Spotify refuse, on s'arrête là et on explique pourquoi (comme au clic sur « Démarrer »).
async function startWork(next, successMessage) {
  const result = await resumePlayback(workMs);
  if (!result.ok) {
    const stored = readSession();
    if (stored && stored.endsAt === next.endsAt) clearSession();
    goIdle();
    message.textContent = `La pause est finie, mais Spotify n'a pas pu lancer la musique. ${PLAYER_ERRORS[result.reason]}${result.reason === 'expired' ? '' : ' Clique ensuite sur « Démarrer ».'}`;
    return;
  }
  beginRunning(next);
  message.textContent = successMessage;
}

// À l'ouverture de la page, ou quand un autre onglet change la session : que faut-il afficher ?
async function restoreSession({ fromOtherTab = false } = {}) {
  const session = readSession();

  if (!session) {
    // La session a été arrêtée dans un autre onglet.
    if (fromOtherTab && sessionRunning()) {
      goIdle();
      message.textContent = 'La session a été arrêtée dans un autre onglet.';
    }
    return;
  }
  if (currentSession && currentSession.endsAt === session.endsAt) return; // déjà affichée

  const now = Date.now();
  if (session.endsAt - now > session.durationMs + 60 * 1000) {
    clearSession(); // heure de fin absurde (horloge de l'ordinateur modifiée) : on l'oublie
    return;
  }

  timer.stop(); // on remplace l'affichage précédent s'il y en avait un

  if (session.endsAt > now) {
    beginRunning(session);
    const isBreak = session.phase === 'break';
    if (fromOtherTab) message.textContent = isBreak ? 'Une pause est en cours dans un autre onglet.' : 'Une session est en cours dans un autre onglet.';
    else if (document.wasDiscarded) message.textContent = `${isBreak ? 'Ta pause' : 'Ta session'} était en cours : on l'a retrouvée (le navigateur avait mis l'onglet en veille).`;
    else message.textContent = `${isBreak ? 'Ta pause' : 'Ta session'} était en cours : on l'a retrouvée.`;
    return;
  }

  // La phase s'est terminée pendant que la page n'était pas là.
  currentSession = session;
  document.body.classList.add('is-running');
  showPhase(session);
  updateConnectionUi();
  await endPhase(session);
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

// Le bouton Démarrer n'est utilisable que si on est connecté à Spotify. « Se déconnecter » l'est toujours,
// même pendant une session : c'est le moyen de tout arrêter et d'effacer ses données.
let wasLoggedIn = false;

function updateConnectionUi() {
  const loggedIn = isLoggedIn();
  connectButton.hidden = loggedIn;
  logoutButton.hidden = !loggedIn;
  startButton.disabled = !loggedIn || sessionRunning();
  stopButton.hidden = !sessionRunning();
  wasLoggedIn = loggedIn;
}

connectButton.addEventListener('click', () => {
  login();
});

logoutButton.addEventListener('click', () => {
  const hadSession = sessionRunning();
  timer.stop();
  clearSession(); // plus de session : les autres onglets s'arrêtent aussi
  logout();
  goIdle(); // remet la page au repos et met les boutons à jour
  message.textContent = hadSession
    ? 'La connexion à Spotify a été supprimée de cet appareil et la session est arrêtée. Spotify n\'a pas été mis en pause : fais-le toi-même si besoin.'
    : 'La connexion à Spotify a été supprimée de cet appareil.';
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
  const result = await resumePlayback(workMs);
  if (!result.ok) {
    message.textContent = PLAYER_ERRORS[result.reason];
    updateConnectionUi();
    return;
  }

  const session = workSession(1, Date.now());
  saveSession(session); // gardée dans le navigateur : la session survit à un rechargement
  beginRunning(session);
});

// « Arrêter » met fin à l'enchaînement. Si la musique joue (session de travail), on la coupe.
stopButton.addEventListener('click', async () => {
  const session = currentSession;
  if (!session) return;
  stopButton.disabled = true;
  timer.stop();
  clearSession(); // les autres onglets s'arrêtent aussi
  const result = session.phase === 'work' ? await pausePlayback() : null;
  goIdle();
  stopButton.disabled = false;
  message.textContent = result ? `C'est arrêté. ${pauseSentence(result)}` : 'C\'est arrêté.';
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
