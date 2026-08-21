const Store = require('electron-store');

const store = new Store({
  defaults: {
    deepgramKey: '',
    groqKey: '',
    hotkey: 'Ctrl+Shift',
  },
});

function loadSettings() {
  return {
    deepgramKey: store.get('deepgramKey'),
    groqKey: store.get('groqKey'),
    hotkey: store.get('hotkey'),
  };
}

function saveSettings(newSettings) {
  store.set(newSettings);
}

// Dev convenience: if the store has never been given a key, fall back to
// whatever is in .env once. Only fills empty fields, so a value the user
// has actually saved in Settings is never overwritten by a stale .env.
function migrateFromEnv() {
  const current = loadSettings();
  if (!current.deepgramKey && process.env.DEEPGRAM_API_KEY) {
    store.set('deepgramKey', process.env.DEEPGRAM_API_KEY);
  }
  if (!current.groqKey && process.env.GROQ_API_KEY) {
    store.set('groqKey', process.env.GROQ_API_KEY);
  }
}

function hasRequiredKeys() {
  const { deepgramKey, groqKey } = loadSettings();
  return Boolean(deepgramKey && groqKey);
}

module.exports = { loadSettings, saveSettings, migrateFromEnv, hasRequiredKeys };
