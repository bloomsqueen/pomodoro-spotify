// Tout ce qui parle à Spotify : connexion (OAuth PKCE), reprise et pause de la lecture.

import { SPOTIFY_CLIENT_ID, SPOTIFY_SCOPES } from './config.js';

const AUTHORIZE_URL = 'https://accounts.spotify.com/authorize';
const TOKEN_URL = 'https://accounts.spotify.com/api/token';

// sessionStorage : les valeurs survivent au rechargement de la page dans cet onglet,
// et disparaissent quand on le ferme. Rien n'est jamais écrit dans un fichier du dépôt.
const KEY_VERIFIER = 'spotify_code_verifier';
const KEY_STATE = 'spotify_state';
const KEY_TOKENS = 'spotify_tokens';

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
  const verifier = generateRandomString(64);
  const state = generateRandomString(16); // protège contre les retours qui ne viennent pas de nous
  sessionStorage.setItem(KEY_VERIFIER, verifier);
  sessionStorage.setItem(KEY_STATE, state);

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
  const expectedState = sessionStorage.getItem(KEY_STATE);
  const verifier = sessionStorage.getItem(KEY_VERIFIER);

  // Ces valeurs ne servent qu'une fois : on les efface, et on nettoie l'adresse, quoi qu'il arrive.
  sessionStorage.removeItem(KEY_STATE);
  sessionStorage.removeItem(KEY_VERIFIER);
  window.history.replaceState({}, document.title, window.location.pathname);

  if (error) return error === 'access_denied' ? 'denied' : 'error';
  if (!code || !verifier || !returnedState || returnedState !== expectedState) return 'error';

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
    saveTokens(await response.json());
    return 'connected';
  } catch {
    return 'error';
  }
}

// Spotify ne renvoie pas toujours un nouveau jeton de rafraîchissement quand on en utilise un :
// dans ce cas, on garde l'ancien (qui reste valable).
function saveTokens({ access_token, refresh_token, expires_in }, previousRefreshToken = null) {
  sessionStorage.setItem(KEY_TOKENS, JSON.stringify({
    accessToken: access_token,
    refreshToken: refresh_token ?? previousRefreshToken,
    expiresAt: Date.now() + expires_in * 1000,
  }));
}

function readTokens() {
  try {
    return JSON.parse(sessionStorage.getItem(KEY_TOKENS));
  } catch {
    return null;
  }
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
let refreshInFlight = null; // évite deux renouvellements en même temps

// Renvoie { accessToken } ou { reason } avec reason parmi 'expired', 'network', 'error'.
function refreshAccessToken() {
  if (!refreshInFlight) {
    refreshInFlight = doRefresh().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

async function doRefresh() {
  const tokens = readTokens();
  if (!tokens || !tokens.refreshToken) {
    sessionStorage.removeItem(KEY_TOKENS);
    return { reason: 'expired' };
  }

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
    saveTokens(body, tokens.refreshToken);
    return { accessToken: body.access_token };
  }

  // 'invalid_grant' : le jeton de rafraîchissement est révoqué ou expiré. Il faut se reconnecter.
  if (body && body.error === 'invalid_grant') {
    sessionStorage.removeItem(KEY_TOKENS);
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
  return refreshAccessToken();
}

// --- Lecture : reprendre et mettre en pause ---

const API_URL = 'https://api.spotify.com/v1';

async function sendPlayerCommand(path, accessToken) {
  try {
    return await fetch(`${API_URL}${path}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  } catch {
    return null;
  }
}

// Envoie une commande de lecture à Spotify.
// `minLifetimeMs` : durée pendant laquelle le jeton doit encore être valable (voir resumePlayback).
// Renvoie { ok: true } ou { ok: false, reason } avec reason parmi :
// 'expired', 'no-device', 'premium', 'forbidden', 'rate-limit', 'network', 'error'.
async function playerCommand(path, minLifetimeMs = 0) {
  const auth = await getAccessToken(minLifetimeMs);
  if (!auth.accessToken) return { ok: false, reason: auth.reason };

  let response = await sendPlayerCommand(path, auth.accessToken);
  if (!response) return { ok: false, reason: 'network' };

  // Jeton refusé alors qu'on le croyait valable (révoqué, horloge décalée) : un nouvel essai avec un jeton neuf.
  if (response.status === 401) {
    const renewed = await refreshAccessToken();
    if (!renewed.accessToken) return { ok: false, reason: renewed.reason };
    response = await sendPlayerCommand(path, renewed.accessToken);
    if (!response) return { ok: false, reason: 'network' };
    if (response.status === 401) {
      sessionStorage.removeItem(KEY_TOKENS);
      return { ok: false, reason: 'expired' };
    }
  }

  if (response.ok) return { ok: true }; // Spotify répond 204 : fait, rien à lire
  return { ok: false, reason: await explainFailure(response) };
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
// `sessionMs` : durée prévue de la session. Si le jeton ne tiendra pas jusque-là, on le renouvelle
// tout de suite, pour que la pause de la fin n'ait pas à le faire au dernier moment.
export function resumePlayback(sessionMs = 0) {
  return playerCommand('/me/player/play', sessionMs);
}

export function pausePlayback() {
  return playerCommand('/me/player/pause');
}
