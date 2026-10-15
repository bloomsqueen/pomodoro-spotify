// Le stockage du navigateur, partagé entre tous les onglets du site (localStorage).
//
// Pourquoi pas sessionStorage : il est propre à chaque onglet. Si le navigateur ouvre la page de
// connexion de Spotify dans une autre fenêtre, ou recharge un onglet endormi, tout serait perdu.
//
// Si le navigateur refuse le stockage (mode privé strict, stockage bloqué), on garde les valeurs en
// mémoire : l'appli marche alors dans cet onglet seulement, et ne retient rien ensuite.

const memory = new Map();

function storageWorks() {
  try {
    localStorage.setItem('__test__', '1');
    localStorage.removeItem('__test__');
    return true;
  } catch {
    return false;
  }
}

const persistent = storageWorks();

export function getItem(key) {
  if (!persistent) return memory.has(key) ? memory.get(key) : null;
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function setItem(key, value) {
  if (!persistent) {
    memory.set(key, String(value));
    return;
  }
  try {
    localStorage.setItem(key, value);
  } catch {
    // Stockage plein ou refusé : cette valeur ne sera pas retenue.
  }
}

export function removeItem(key) {
  if (!persistent) {
    memory.delete(key);
    return;
  }
  try {
    localStorage.removeItem(key);
  } catch {
    // Rien à faire.
  }
}

// Toutes les clés qui commencent par `prefix`.
export function listKeys(prefix) {
  if (!persistent) return [...memory.keys()].filter((key) => key.startsWith(prefix));
  const keys = [];
  try {
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (key && key.startsWith(prefix)) keys.push(key);
    }
  } catch {
    // Rien à faire.
  }
  return keys;
}

// Appelle `callback(clé)` quand un AUTRE onglet modifie le stockage (la clé vaut null si tout est effacé).
export function onChange(callback) {
  window.addEventListener('storage', (event) => callback(event.key));
}

// --- Verrous entre onglets (API Web Locks) ---
//
// Un verrou fait passer les onglets un par un, mais il ne suffit pas : mesuré dans Chromium, un onglet
// qui relit le stockage juste après l'écriture d'un autre peut encore voir l'ancienne valeur (jusqu'à
// quelques dizaines de millisecondes plus tard). On garde donc le verrou `holdMs` après la fin de la tâche :
// le résultat est rendu tout de suite, mais l'onglet suivant n'entre qu'une fois le stockage à jour.
// Si le navigateur n'a pas cette API, on exécute simplement la tâche (sans protection entre onglets).

const hasLocks = () => typeof navigator !== 'undefined' && navigator.locks && navigator.locks.request;
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Exécute `task` en exclusivité : les autres onglets qui demandent le même verrou attendent leur tour.
export function runExclusive(name, task, { holdMs = 0 } = {}) {
  if (!hasLocks()) return Promise.resolve().then(task);
  return new Promise((resolve, reject) => {
    navigator.locks.request(name, async () => {
      try {
        resolve(await task());
      } catch (error) {
        reject(error);
      }
      if (holdMs > 0) await wait(holdMs);
    });
  });
}

// Comme runExclusive, mais si le verrou est déjà pris, on n'attend pas : on renvoie null sans rien faire.
export function runIfAvailable(name, task, { holdMs = 0 } = {}) {
  if (!hasLocks()) return Promise.resolve().then(task);
  return new Promise((resolve, reject) => {
    navigator.locks.request(name, { ifAvailable: true }, async (lock) => {
      if (!lock) {
        resolve(null);
        return;
      }
      try {
        resolve(await task());
      } catch (error) {
        reject(error);
      }
      if (holdMs > 0) await wait(holdMs);
    });
  });
}
