// Tout ce qui parle à Spotify : connexion (OAuth PKCE), reprise et pause de la lecture.
// Étape en cours : la connexion. La lecture et la pause viennent à l'étape suivante.

import { SPOTIFY_CLIENT_ID, SPOTIFY_REDIRECT_URI, SPOTIFY_SCOPES } from './config.js';

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
    redirect_uri: SPOTIFY_REDIRECT_URI,
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
        redirect_uri: SPOTIFY_REDIRECT_URI,
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

function saveTokens({ access_token, refresh_token, expires_in }) {
  sessionStorage.setItem(KEY_TOKENS, JSON.stringify({
    accessToken: access_token,
    refreshToken: refresh_token ?? null,
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

// Vrai si on a un jeton d'accès encore valable.
export function isLoggedIn() {
  const tokens = readTokens();
  return Boolean(tokens && tokens.accessToken && Date.now() < tokens.expiresAt);
}

// --- Lecture (étape suivante) ---

export async function resumePlayback() {
  // TODO : PUT /v1/me/player/play (sans corps = reprend la lecture en cours)
}

export async function pausePlayback() {
  // TODO : PUT /v1/me/player/pause
}
