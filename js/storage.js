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

// Exécute `task` en exclusivité sur tous les onglets (API Web Locks), pour que deux onglets ne fassent
// pas la même chose en même temps. Si le navigateur ne la propose pas, on exécute simplement la tâche.
export function runExclusive(name, task) {
  if (typeof navigator !== 'undefined' && navigator.locks && navigator.locks.request) {
    return navigator.locks.request(name, task);
  }
  return Promise.resolve().then(task);
}
