// Tout ce qui parle à Spotify : connexion (OAuth PKCE), reprise et pause de la lecture.

import { SPOTIFY_CLIENT_ID, SPOTIFY_SCOPES } from './config.js';
import { getItem, setItem, removeItem, listKeys, onChange, runExclusive } from './storage.js';

const REFRESH_LOCK_HOLD_MS = 2000; // voir storage.js : le temps que les autres onglets voient les nouveaux jetons

const AUTHORIZE_URL = 'https://accounts.spotify.com/authorize';
const TOKEN_URL = 'https://accounts.spotify.com/api/token';

// Les jetons sont gardés dans le navigateur (localStorage, partagé entre les onglets) pendant
// 7 jours à partir de la connexion, puis il faut se reconnecter. Rien n'est jamais écrit dans un
// fichier du dépôt, et le bouton « Se déconnecter » efface tout.
const KEY_TOKENS = 'spotify_tokens';
const LOGIN_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;

// Valeurs temporaires de la connexion (code secret), retrouvables par le `state` que Spotify
// nous renvoie : c'est ce qui permet de terminer la connexion dans un autre onglet que celui
// où l'on a cliqué (cas constaté avec un onglet épinglé dans Arc).
const PKCE_PREFIX = 'spotify_pkce_';
const PKCE_MAX_AGE_MS = 10 * 60 * 1000;

// Anciennes versions : les jetons étaient dans sessionStorage. On les efface (il faudra se reconnecter une fois).
try {
  sessionStorage.removeItem('spotify_tokens');
  sessionStorage.removeItem('spotify_code_verifier');
  sessionStorage.removeItem('spotify_state');
} catch {
  // Pas de sessionStorage : rien à nettoyer.
}

// --- PKCE : le « code secret » et son empreinte ---

export function generateRandomString(length) {
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const values = crypto.getRandomValues(new Uint8Array(length));
  return values.reduce((text, value) => text + possible[value % possible.length], '');
}

// Empreinte SHA-256 du code secret, encodée en base64 « url-safe » (sans =, + ni /).
export async function createCodeChallenge(verifier) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

// --- Adresse de retour ---

// Spotify renvoie l'utilisateur à cette adresse après la connexion. Elle doit être déclarée à
// l'identique dans le Dashboard : on la calcule donc à partir de l'adresse où l'appli est ouverte,
// ce qui fonctionne en local (http://127.0.0.1:8000/) comme en ligne (https://…/).
export function getRedirectUri() {
  return `${window.location.origin}/`;
}

// Spotify n'accepte que le https, ou une adresse de boucle locale écrite en chiffres (127.0.0.1).
// Renvoie null si tout va bien, sinon 'localhost' ou 'insecure'.
export function redirectUriProblem() {
  const { protocol, hostname } = window.location;
  if (hostname === 'localhost') return 'localhost';
  const loopback = hostname === '127.0.0.1' || hostname === '[::1]';
  if (protocol !== 'https:' && !loopback) return 'insecure';
  return null;
}

// --- Connexion ---

// Envoie l'utilisateur sur la page de connexion de Spotify.
export async function login() {
  forgetStalePkce();
  const verifier = generateRandomString(64);
  const state = generateRandomString(16); // protège contre les retours qui ne viennent pas de nous
  setItem(PKCE_PREFIX + state, JSON.stringify({ verifier, createdAt: Date.now() }));

  const url = new URL(AUTHORIZE_URL);
  url.search = new URLSearchParams({
    response_type: 'code',
    client_id: SPOTIFY_CLIENT_ID,
    scope: SPOTIFY_SCOPES.join(' '),
    redirect_uri: getRedirectUri(),
    state,
    code_challenge_method: 'S256',
    code_challenge: await createCodeChallenge(verifier),
  });
  window.location.assign(url);
}

// À appeler au chargement de la page. Si Spotify vient de nous renvoyer l'utilisateur,
// échange le code temporaire contre un jeton d'accès.
// Renvoie : 'none' (rien à faire), 'connected', 'denied' (l'utilisateur a refusé) ou 'error'.
export async function handleRedirect() {
  const params = new URLSearchParams(window.location.search);
  if (!params.has('code') && !params.has('error')) return 'none';

  const code = params.get('code');
  const error = params.get('error');
  const returnedState = params.get('state');

  // On retrouve le code secret grâce au `state` renvoyé par Spotify (même depuis un autre onglet).
  // Il ne sert qu'une fois : on l'efface, et on nettoie l'adresse, quoi qu'il arrive.
  const pending = returnedState ? readPkce(returnedState) : null;
  if (returnedState) removeItem(PKCE_PREFIX + returnedState);
  window.history.replaceState({}, document.title, window.location.pathname);

  if (error) return error === 'access_denied' ? 'denied' : 'error';
  if (!code || !pending) return 'error';
  const verifier = pending.verifier;

  try {
    const response = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: SPOTIFY_CLIENT_ID,
        grant_type: 'authorization_code',
        code,
        redirect_uri: getRedirectUri(),
        code_verifier: verifier,
      }),
    });
    if (!response.ok) return 'error';
    saveTokens(await response.json(), { loginExpiresAt: Date.now() + LOGIN_LIFETIME_MS });
    return 'connected';
  } catch {
    return 'error';
  }
}

function readPkce(state) {
  try {
    const entry = JSON.parse(getItem(PKCE_PREFIX + state));
    if (!entry || !entry.verifier || Date.now() - entry.createdAt > PKCE_MAX_AGE_MS) return null;
    return entry;
  } catch {
    return null;
  }
}

// Efface les connexions commencées il y a longtemps et jamais terminées.
function forgetStalePkce() {
  for (const key of listKeys(PKCE_PREFIX)) {
    if (!readPkce(key.slice(PKCE_PREFIX.length))) removeItem(key);
  }
}

// `loginExpiresAt` : date à laquelle il faudra se reconnecter (7 jours après la connexion). Un renouvellement
// du jeton d'accès ne la repousse pas.
// Spotify ne renvoie pas toujours un nouveau jeton de rafraîchissement quand on en utilise un :
// dans ce cas, on garde l'ancien (qui reste valable).
function saveTokens({ access_token, refresh_token, expires_in }, { refreshToken = null, loginExpiresAt }) {
  setItem(KEY_TOKENS, JSON.stringify({
    accessToken: access_token,
    refreshToken: refresh_token ?? refreshToken,
    expiresAt: Date.now() + expires_in * 1000,
    loginExpiresAt,
  }));
}

function readTokens() {
  let tokens = null;
  try {
    tokens = JSON.parse(getItem(KEY_TOKENS));
  } catch {
    return null;
  }
  if (!tokens) return null;
  // Connexion trop ancienne (ou format inconnu) : on efface, il faut se reconnecter.
  if (!tokens.loginExpiresAt || Date.now() >= tokens.loginExpiresAt) {
    removeItem(KEY_TOKENS);
    return null;
  }
  return tokens;
}

// Efface tout ce que l'appli garde au sujet de la connexion (bouton « Se déconnecter »).
export function logout() {
  removeItem(KEY_TOKENS);
  for (const key of listKeys(PKCE_PREFIX)) removeItem(key);
}

// Appelle `callback()` quand un autre onglet se connecte ou se déconnecte.
export function onConnectionChange(callback) {
  onChange((key) => {
    if (key === null || key === KEY_TOKENS) callback();
  });
}

// Vrai si on est connecté : un jeton d'accès encore valable, ou de quoi en obtenir un nouveau.
export function isLoggedIn() {
  const tokens = readTokens();
  if (!tokens) return false;
  return Boolean((tokens.accessToken && Date.now() < tokens.expiresAt) || tokens.refreshToken);
}

// --- Renouvellement du jeton d'accès ---
// Le jeton d'accès dure 1 heure. Le jeton de rafraîchissement permet d'en obtenir un nouveau
// sans redemander l'accord de l'utilisateur.

const SAFETY_MARGIN_MS = 30 * 1000; // on renouvelle un peu avant l'expiration réelle
let refreshInFlight = null; // évite deux renouvellements en même temps dans cet onglet

// Renvoie { accessToken } ou { reason } avec reason parmi 'expired', 'network', 'error'.
// Entre onglets, un verrou fait attendre le second : Spotify peut remplacer le jeton de rafraîchissement
// à chaque utilisation, et deux onglets qui renouvellent en même temps pourraient se déconnecter l'un l'autre.
function refreshAccessToken(options = {}) {
  if (!refreshInFlight) {
    refreshInFlight = runExclusive('spotify-token-refresh', () => doRefresh(options), { holdMs: REFRESH_LOCK_HOLD_MS }).finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

async function doRefresh({ minLifetimeMs = 0, rejectedToken = null } = {}) {
  const tokens = readTokens();
  if (!tokens || !tokens.refreshToken) {
    removeItem(KEY_TOKENS);
    return { reason: 'expired' };
  }

  // Un autre onglet a peut-être déjà renouvelé le jeton pendant qu'on attendait le verrou.
  const alreadyRenewed = tokens.accessToken && tokens.accessToken !== rejectedToken
    && Date.now() + minLifetimeMs + SAFETY_MARGIN_MS < tokens.expiresAt;
  if (alreadyRenewed) return { accessToken: tokens.accessToken };

  let response;
  try {
    response = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: tokens.refreshToken,
        client_id: SPOTIFY_CLIENT_ID, // avec PKCE : l'identifiant suffit, pas de secret
      }),
    });
  } catch {
    return { reason: 'network' }; // panne passagère : on garde les jetons pour réessayer
  }

  let body = null;
  try {
    body = await response.json();
  } catch {
    // Réponse illisible : traitée plus bas.
  }

  if (response.ok && body && body.access_token) {
    saveTokens(body, { refreshToken: tokens.refreshToken, loginExpiresAt: tokens.loginExpiresAt });
    return { accessToken: body.access_token };
  }

  // 'invalid_grant' : le jeton de rafraîchissement est révoqué ou expiré. Il faut se reconnecter.
  if (body && body.error === 'invalid_grant') {
    removeItem(KEY_TOKENS);
    return { reason: 'expired' };
  }
  return { reason: 'error' };
}

// Renvoie un jeton d'accès valable au moins `minLifetimeMs` de plus, en le renouvelant si besoin.
// Renvoie { accessToken } ou { reason }.
async function getAccessToken(minLifetimeMs = 0) {
  const tokens = readTokens();
  if (!tokens) return { reason: 'expired' };

  const stillGood = tokens.accessToken && Date.now() + minLifetimeMs + SAFETY_MARGIN_MS < tokens.expiresAt;
  if (stillGood) return { accessToken: tokens.accessToken };
  return refreshAccessToken({ minLifetimeMs });
}

// --- Lecture : reprendre et mettre en pause ---

const API_URL = 'https://api.spotify.com/v1';

async function sendApiRequest(method, path, accessToken) {
  try {
    return await fetch(`${API_URL}${path}`, {
      method,
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  } catch {
    return null;
  }
}

// Envoie une requête à l'API Spotify avec un jeton valable, en le renouvelant si besoin.
// `minLifetimeMs` : durée pendant laquelle le jeton doit encore être valable (voir resumePlayback).
// Renvoie { response } ou { reason } avec reason parmi 'expired' ou 'network'.
// Le code de la réponse (200, 204, 403…) n'est pas interprété ici : c'est le travail de l'appelant.
async function callApi(method, path, minLifetimeMs = 0) {
  const auth = await getAccessToken(minLifetimeMs);
  if (!auth.accessToken) return { reason: auth.reason };

  let response = await sendApiRequest(method, path, auth.accessToken);
  if (!response) return { reason: 'network' };

  // Jeton refusé alors qu'on le croyait valable (révoqué, horloge décalée) : un nouvel essai avec un jeton neuf.
  if (response.status === 401) {
    const renewed = await refreshAccessToken({ rejectedToken: auth.accessToken });
    if (!renewed.accessToken) return { reason: renewed.reason };
    response = await sendApiRequest(method, path, renewed.accessToken);
    if (!response) return { reason: 'network' };
    if (response.status === 401) {
      removeItem(KEY_TOKENS);
      return { reason: 'expired' };
    }
  }
  return { response };
}

// Envoie une commande de lecture à Spotify.
// Renvoie { ok: true } ou { ok: false, reason } avec reason parmi :
// 'expired', 'no-device', 'premium', 'forbidden', 'rate-limit', 'network', 'error'.
async function playerCommand(path, minLifetimeMs = 0) {
  const { response, reason } = await callApi('PUT', path, minLifetimeMs);
  if (!response) return { ok: false, reason };
  if (response.ok) return { ok: true }; // Spotify répond 204 : fait, rien à lire
  return { ok: false, reason: await explainFailure(response) };
}

// Lit l'état de la lecture : { ok: true, playing } (true si de la musique joue), ou { ok: false, reason }.
// Spotify répond 204 (sans contenu) quand aucun appareil n'est actif : rien ne joue, donc playing = false.
async function readPlaybackState(minLifetimeMs = 0) {
  const { response, reason } = await callApi('GET', '/me/player', minLifetimeMs);
  if (!response) return { ok: false, reason };
  if (response.status === 204) return { ok: true, playing: false };
  if (!response.ok) return { ok: false, reason: await explainFailure(response) };
  try {
    const state = await response.json();
    return { ok: true, playing: state.is_playing === true };
  } catch {
    return { ok: false, reason: 'error' };
  }
}

async function explainFailure(response) {
  if (response.status === 429) return 'rate-limit';

  let apiReason = '';
  try {
    apiReason = (await response.json()).error?.reason ?? '';
  } catch {
    // Pas de détail lisible : on se fie au code de la réponse.
  }
  if (response.status === 404 || apiReason === 'NO_ACTIVE_DEVICE') return 'no-device';
  if (apiReason === 'PREMIUM_REQUIRED') return 'premium';
  if (response.status === 403) return 'forbidden';
  return 'error';
}

// Reprend la lecture en cours sur l'appareil actif (sans corps : on ne choisit pas de playlist).
// On regarde d'abord l'état : si la musique joue déjà, on n'envoie rien (renvoie alors { ok: true, already: true }).
// Si l'état est illisible, on envoie quand même la commande : c'est elle qui dira la vraie raison d'un échec.
// `sessionMs` : durée prévue de la session. Si le jeton ne tiendra pas jusque-là, on le renouvelle
// tout de suite, pour que la pause de la fin n'ait pas à le faire au dernier moment.
export async function resumePlayback(sessionMs = 0) {
  // Même si on n'envoie rien, le jeton est renouvelé ici si besoin : la pause de la fin en dépendra.
  const state = await readPlaybackState(sessionMs);
  if (state.ok && state.playing) return { ok: true, already: true };
  return playerCommand('/me/player/play', sessionMs);
}

// Met la lecture en pause. Si rien ne joue (pause faite à la main, aucun appareil actif),
// on n'envoie rien : renvoie { ok: true, already: true }, sans fausse erreur.
export async function pausePlayback() {
  const state = await readPlaybackState();
  if (state.ok && !state.playing) return { ok: true, already: true };
  return playerCommand('/me/player/pause');
}
