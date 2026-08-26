const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  startRecording: () => ipcRenderer.send('recording:start'),
  sendAudioChunk: (chunk) => ipcRenderer.send('audio:chunk', chunk),
  stopRecording: (reason) => ipcRenderer.send('recording:stop', reason),
  onStatus: (callback) => ipcRenderer.on('status', (_event, text) => callback(text)),
  onRecordingStart: (callback) => ipcRenderer.on('hotkey:start-recording', () => callback()),
  onRecordingStop: (callback) => ipcRenderer.on('hotkey:stop-recording', () => callback()),
});

// Maps a DOM KeyboardEvent.code to the same canonical key names main.js
// uses (built from uiohook-napi's UiohookKey), so a hotkey captured here
// can be parsed back into uiohook key codes without a second lookup table.
function domCodeToCanonical(code) {
  if (code.startsWith('Control')) return 'Ctrl';
  if (code.startsWith('Shift')) return 'Shift';
  if (code.startsWith('Alt')) return 'Alt';
  if (code.startsWith('Meta') || code.startsWith('OS')) return 'Meta';
  if (code.startsWith('Key')) return code.slice(3); // KeyA -> A
  if (code.startsWith('Digit')) return code.slice(5); // Digit1 -> 1
  if (code === 'Space') return 'Space';
  if (/^F\d{1,2}$/.test(code)) return code; // F1..F24
  return code; // best-effort fallback for anything else (Comma, Semicolon, ...)
}

const MODIFIER_ORDER = ['Ctrl', 'Alt', 'Shift', 'Meta'];

function comboString(keys) {
  const set = Array.from(keys);
  const modifiers = MODIFIER_ORDER.filter((m) => set.includes(m));
  const rest = set.filter((k) => !MODIFIER_ORDER.includes(k)).sort();
  return [...modifiers, ...rest].join('+');
}

// Shared key-tracking engine behind both `recordHotkey` (resolve once, on
// full release) and `testHotkey` (call back continuously, caller decides
// when it's done) — same domCodeToCanonical/comboString vocabulary either
// way, so a combo captured by one reads back correctly via the other.
function trackHeldKeys({ onChange, onDone }) {
  const pressed = new Set();
  const everPressed = new Set();
  let done = false;

  function finish(result) {
    if (done) return;
    done = true;
    window.removeEventListener('keydown', onKeydown, true);
    window.removeEventListener('keyup', onKeyup, true);
    onDone?.(result);
  }

  function onKeydown(event) {
    event.preventDefault();
    if (event.code === 'Escape') {
      finish(null);
      return;
    }
    const name = domCodeToCanonical(event.code);
    pressed.add(name);
    everPressed.add(name);
    onChange?.(new Set(pressed));
  }

  function onKeyup(event) {
    event.preventDefault();
    const name = domCodeToCanonical(event.code);
    pressed.delete(name);
    onChange?.(new Set(pressed));
    // recordHotkey's one-shot "resolve on full release" only applies when an
    // onDone callback was actually given. testHotkey passes no onDone — it
    // wants to keep listening across many press/release cycles, stopping
    // only on Escape or via the cleanup function it returns. Without this
    // guard, the very first full release tore down both listeners for
    // testHotkey too, so a second hold produced no events at all.
    if (onDone && pressed.size === 0 && everPressed.size > 0) {
      finish(comboString(everPressed));
    }
  }

  window.addEventListener('keydown', onKeydown, true);
  window.addEventListener('keyup', onKeyup, true);

  return () => finish(null);
}

contextBridge.exposeInMainWorld('settings', {
  load: () => ipcRenderer.invoke('settings:load'),
  save: (newSettings) => ipcRenderer.invoke('settings:save', newSettings),
  completeOnboarding: () => ipcRenderer.invoke('settings:complete-onboarding'),
  openMicSettings: () => ipcRenderer.invoke('settings:open-mic-settings'),

  // Captures the next key combo the user presses in this window. Resolves
  // via `callback(comboStringOrNull)` — null means the user cancelled
  // (Escape) without changing anything.
  recordHotkey: (callback) => {
    trackHeldKeys({ onDone: callback });
  },

  // Onboarding's hotkey-test screen: fires `callback(pressedKeysSet)` on
  // every keydown/keyup so the UI can live-highlight matching key chips.
  // Never auto-resolves (there's no "release to finish" semantics here —
  // the screen itself decides when the combo has been demonstrated) but
  // still stops listening on Escape. Returns a cleanup function so the
  // caller can stop listening when the screen is left early.
  testHotkey: (callback) => trackHeldKeys({ onChange: callback }),
});

console.log('preload loaded');
