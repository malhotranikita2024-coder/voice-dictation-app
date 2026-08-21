require('dotenv').config();

const { app, BrowserWindow, ipcMain, clipboard, dialog } = require('electron');
const path = require('node:path');
const WebSocket = require('ws');
const Groq = require('groq-sdk');
const { uIOhook, UiohookKey } = require('uiohook-napi');
const { pasteText } = require('./src/main/inject');
const { loadSettings, saveSettings, migrateFromEnv, hasRequiredKeys } = require('./src/main/settings');
const { createTray, setTrayRecordingState } = require('./src/main/tray');

const CLEANUP_SYSTEM_PROMPT = `You are a transcript cleanup assistant. The input is a raw speech-to-text transcript that may contain mistakes from the transcription itself — do not try to fix those. You may ONLY do the following:
1. Fix punctuation and capitalization.
2. Remove filler words ('um', 'uh', 'like') when used purely as verbal filler.
3. Remove false starts (when the speaker clearly restarted or repeated a phrase).
4. Resolve explicit verbal self-corrections: when the speaker flags that they're correcting themselves — cues like "no wait", "actually", "I mean", "oh sorry", "no no", "not X, it's Y" — keep only the corrected/final version of that phrase and drop both the retracted part and the correction cue words. Example: "send this to Tina, oh sorry, no, not Tina, it's Priya" becomes "send this to Priya".
Rule 4 applies ONLY to retractions the speaker explicitly flags in speech this way. Outside of a flagged retraction, do NOT substitute, replace, or rephrase any word for another word, even if it seems unusual, awkward, or grammatically odd — leave it exactly as given. Do not add or remove any information or change word choice beyond what rules 1-4 allow. Return ONLY the cleaned text, no explanation or preamble.`;

async function cleanupTranscript(rawText) {
  const groq = new Groq({ apiKey: loadSettings().groqKey });
  const completion = await groq.chat.completions.create({
    model: 'openai/gpt-oss-20b',
    messages: [
      { role: 'system', content: CLEANUP_SYSTEM_PROMPT },
      { role: 'user', content: rawText },
    ],
  });

  return completion.choices[0]?.message?.content?.trim() ?? rawText;
}

let mainWindow;
let settingsWindow;
let isQuitting = false;

function createMainWindow() {
  // This window is never shown. Audio capture (getUserMedia + AudioWorklet)
  // only works inside a renderer process, so it still needs to exist and
  // run index.html/renderer.js — it just no longer has a visible UI role
  // now that the app lives in the tray. The floating recording pill
  // (a later session) is the real replacement for this window's UI.
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    show: false,
    skipTaskbar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile('index.html');
}

function createSettingsWindow() {
  if (settingsWindow) {
    settingsWindow.show();
    settingsWindow.focus();
    return;
  }

  settingsWindow = new BrowserWindow({
    width: 500,
    height: 450,
    resizable: false,
    minimizable: false,
    maximizable: false,
    alwaysOnTop: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  settingsWindow.setMenuBarVisibility(false);
  settingsWindow.loadFile('settings.html');

  // Closing via the X should hide the window, not quit the app. Only the
  // tray's "Quit" sets isQuitting first, which lets this close for real.
  settingsWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      settingsWindow.hide();
    }
  });

  settingsWindow.on('closed', () => {
    settingsWindow = null;
  });
}

function showAboutDialog() {
  dialog.showMessageBox({
    type: 'info',
    title: 'About Voice Dictation',
    message: 'Voice Dictation App',
    detail: `Version ${app.getVersion()}\nHold your configured hotkey anywhere to dictate.`,
  });
}

function sendStatus(text) {
  mainWindow?.webContents.send('status', text);
}

// --- Generic hotkey combo engine -------------------------------------
//
// A hotkey is stored as a string like "Ctrl+Shift" or "Alt+Space": a
// "+"-joined list of canonical key names. Canonical names come straight
// from uiohook-napi's UiohookKey, except that left/right modifier variants
// (Ctrl/CtrlRight, Shift/ShiftRight, ...) collapse to one shared name, so
// "either Ctrl key" counts. preload.js's hotkey-capture UI builds combo
// strings using this exact same vocabulary.

const MODIFIER_CODE_TO_NAME = {
  [UiohookKey.Ctrl]: 'Ctrl',
  [UiohookKey.CtrlRight]: 'Ctrl',
  [UiohookKey.Shift]: 'Shift',
  [UiohookKey.ShiftRight]: 'Shift',
  [UiohookKey.Alt]: 'Alt',
  [UiohookKey.AltRight]: 'Alt',
  [UiohookKey.Meta]: 'Meta',
  [UiohookKey.MetaRight]: 'Meta',
};

const KEYCODE_TO_CANONICAL = { ...MODIFIER_CODE_TO_NAME };
for (const [name, code] of Object.entries(UiohookKey)) {
  if (!(code in KEYCODE_TO_CANONICAL)) KEYCODE_TO_CANONICAL[code] = name;
}

function parseHotkey(hotkeyString) {
  return new Set(
    hotkeyString
      .split('+')
      .map((part) => part.trim())
      .filter(Boolean)
  );
}

let targetKeys = parseHotkey(loadSettings().hotkey);
const heldKeys = new Set();
let hotkeyActive = false;

function reloadHotkeyTarget() {
  targetKeys = parseHotkey(loadSettings().hotkey);
}

function isTargetCombo() {
  if (targetKeys.size === 0) return false;
  for (const key of targetKeys) {
    if (!heldKeys.has(key)) return false;
  }
  return true;
}

// Passive OS-level listener — it observes key events but doesn't consume
// them, so normal shortcuts in whatever app is focused keep working.
uIOhook.on('keydown', (e) => {
  const name = KEYCODE_TO_CANONICAL[e.keycode];
  if (name) heldKeys.add(name);

  // Only fire on the transition into "combo fully held", so keys already
  // down when the app starts don't immediately trigger a recording.
  if (isTargetCombo() && !hotkeyActive) {
    hotkeyActive = true;
    mainWindow?.webContents.send('hotkey:start-recording');
  }
});

uIOhook.on('keyup', (e) => {
  const name = KEYCODE_TO_CANONICAL[e.keycode];
  if (name) heldKeys.delete(name);

  if (hotkeyActive && !isTargetCombo()) {
    hotkeyActive = false;
    mainWindow?.webContents.send('hotkey:stop-recording');
  }
});

app.whenReady().then(() => {
  migrateFromEnv();

  createMainWindow();

  createTray({
    onOpenSettings: createSettingsWindow,
    onOpenAbout: showAboutDialog,
    onQuit: () => {
      isQuitting = true;
      app.quit();
    },
  });

  uIOhook.start();

  if (!hasRequiredKeys()) {
    createSettingsWindow();
  }
});

// Tray apps stay alive even if every window is hidden/closed — only the
// tray's Quit item (or the OS) should end the process.
app.on('window-all-closed', () => {});

app.on('before-quit', () => {
  isQuitting = true;
});

app.on('will-quit', () => {
  uIOhook.stop();
});

ipcMain.handle('settings:load', () => loadSettings());

ipcMain.handle('settings:save', (_event, newSettings) => {
  saveSettings(newSettings);
  reloadHotkeyTarget();
  return true;
});

const DEEPGRAM_LIVE_URL =
  'wss://api.deepgram.com/v1/listen?model=nova-2&encoding=linear16&sample_rate=16000&channels=1&smart_format=true&interim_results=false';

let dgSocket = null;
let dgSocketOpen = false;
let finalTranscriptParts = [];

ipcMain.on('recording:start', () => {
  finalTranscriptParts = [];
  dgSocketOpen = false;
  setTrayRecordingState(true);

  dgSocket = new WebSocket(DEEPGRAM_LIVE_URL, {
    headers: { Authorization: `Token ${loadSettings().deepgramKey}` },
  });

  dgSocket.on('open', () => {
    dgSocketOpen = true;
  });

  dgSocket.on('message', (data) => {
    const msg = JSON.parse(data.toString());
    if (msg.type === 'Results' && msg.is_final) {
      const transcript = msg.channel?.alternatives?.[0]?.transcript ?? '';
      if (transcript) {
        finalTranscriptParts.push(transcript);
      }
    }
  });

  dgSocket.on('unexpected-response', (req, res) => {
    console.error('Deepgram rejected the connection, status:', res.statusCode);
    sendStatus(`Error: Deepgram connection rejected (${res.statusCode})`);
  });

  dgSocket.on('error', (err) => {
    console.error('Deepgram socket error (may auto-reconnect):', err.message);
  });

  dgSocket.on('close', () => {
    dgSocketOpen = false;
  });

  sendStatus('Listening...');
});

ipcMain.on('audio:chunk', (event, audioBuffer) => {
  if (dgSocket && dgSocketOpen) {
    dgSocket.send(Buffer.from(audioBuffer));
  }
});

ipcMain.on('recording:stop', async () => {
  try {
    setTrayRecordingState(false);

    if (!dgSocket) return;

    sendStatus('Finishing up...');

    if (dgSocketOpen) {
      dgSocket.send(JSON.stringify({ type: 'Finalize' }));
      await new Promise((resolve) => setTimeout(resolve, 1000));
      dgSocket.send(JSON.stringify({ type: 'CloseStream' }));
      dgSocket.close();
    }

    const rawTranscript = finalTranscriptParts.join(' ').trim();
    dgSocket = null;
    dgSocketOpen = false;

    if (!rawTranscript) {
      sendStatus('No speech detected');
      return;
    }

    console.log('[transcript] raw (from Deepgram):', rawTranscript);

    sendStatus('Cleaning up...');
    const cleaned = await cleanupTranscript(rawTranscript);

    sendStatus('Pasting...');
    await pasteText(clipboard, cleaned);

    sendStatus(`Done — pasted: "${cleaned}"`);
  } catch (err) {
    console.error('recording:stop pipeline failed:', err, err.cause ? `\ncause: ${err.cause}` : '');
    sendStatus(`Error: ${err.message}${err.cause ? ` (${err.cause})` : ''}`);
  }
});
