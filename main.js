require('dotenv').config();

const { app, BrowserWindow, ipcMain, clipboard, dialog, Notification } = require('electron');
const path = require('node:path');
const WebSocket = require('ws');
const Groq = require('groq-sdk');
const { uIOhook, UiohookKey } = require('uiohook-napi');
const { pasteText } = require('./src/main/inject');
const {
  loadSettings,
  saveSettings,
  migrateFromEnv,
  hasRequiredKeys,
  hasSeenHandsFreeNudge,
  markHandsFreeNudgeSeen,
} = require('./src/main/settings');
const { createTray, setTrayRecordingState } = require('./src/main/tray');
const { createPillWindow, showPill, hidePill } = require('./src/main/pill');
const { connectDb, saveDictation, saveApiUsage, closeDb } = require('./src/main/db');
const { activeWindow } = require('get-windows');

// Without this, Windows identifies a dev-mode ("electron .") run under the
// shared default Electron identity, which is why the taskbar/title bar can
// show the generic Electron logo even when a window's own `icon` option is
// set correctly.
app.setAppUserModelId('com.voicedictation.app');

// This app has no visible window even on a successful launch — it only
// shows a tray icon — so without this lock, a second double-click (or an
// accidental relaunch) silently starts a whole separate instance with its
// own tray icon, hotkey listener, and audio pipeline, all competing with
// the first one. requestSingleInstanceLock() must be called as early as
// possible, before any window/tray/listener setup below.
const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
}

const CLEANUP_SYSTEM_PROMPT = `You are a transcript cleanup assistant. The input is a raw speech-to-text transcript that may contain mistakes from the transcription itself — do not try to fix those. You may ONLY do the following:
1. Fix punctuation and capitalization. The input comes from a live speech-to-text engine that inserts a period and capitalizes the next word at every brief pause the speaker takes, not only at real sentence ends. So a period followed by a word that grammatically continues the previous clause (e.g. starts with "and", "but", "so", "because", "to", "on", "with", "which", or similar) is usually a pause artifact, not an intentional sentence break — replace that period with a comma (or remove it) and lowercase the following word so it reads as one natural sentence. Only keep a period where what follows is genuinely a new, independent sentence.
2. Remove filler words ('um', 'uh', 'like') when used purely as verbal filler.
3. Remove false starts (when the speaker clearly restarted or repeated a phrase).
4. Resolve explicit verbal self-corrections: when the speaker flags that they're correcting themselves — cues like "no wait", "actually", "I mean", "oh sorry", "no no", "not X, it's Y" — keep only the corrected/final version of that phrase and drop both the retracted part and the correction cue words. Example: "send this to Tina, oh sorry, no, not Tina, it's Priya" becomes "send this to Priya".
Rule 4 applies ONLY to retractions the speaker explicitly flags in speech this way. Outside of a flagged retraction, do NOT substitute, replace, or rephrase any word for another word, even if it seems unusual, awkward, or grammatically odd — leave it exactly as given. Do not add or remove any information or change word choice beyond what rules 1-4 allow. Return ONLY the cleaned text, no explanation or preamble.`;

async function cleanupTranscript(rawText) {
  const groq = new Groq({ apiKey: loadSettings().groqKey });
  const model = 'openai/gpt-oss-20b';
  const startedAt = Date.now();
  const completion = await groq.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: CLEANUP_SYSTEM_PROMPT },
      { role: 'user', content: rawText },
    ],
  });
  const latencyMs = Date.now() - startedAt;

  return {
    text: completion.choices[0]?.message?.content?.trim() ?? rawText,
    usage: completion.usage,
    model,
    latencyMs,
  };
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
    icon: path.join(app.getAppPath(), 'assets/tray-icon-source.png'),
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
    height: 490,
    resizable: false,
    minimizable: false,
    maximizable: false,
    alwaysOnTop: false,
    icon: path.join(app.getAppPath(), 'assets/tray-icon-source.png'),
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

// --- Interaction-mode state -------------------------------------------
// comboHeld        – are the physical target keys down right now (purely
//                     physical state, distinct from whether we're recording).
// recording        – is a recording session currently active.
// handsFree        – true once a completed double-tap has locked recording
//                     on; while true, the *next* full press+release toggles
//                     it back off.
// pendingHandsFree – true only for the physical duration of tap 2 itself
//                     (between its keydown and its keyup). Needed so tap
//                     2's own release isn't mistaken for the "turn off"
//                     tap — handsFree only flips on at tap 2's keyup, once
//                     the double-tap gesture is actually complete.
let comboHeld = false;
let recording = false;
let handsFree = false;
let pendingHandsFree = false;

let comboDownAt = 0;
let lastTapUpAt = null;
let longHoldNudgeTimer = null;

const TAP_MAX_HOLD_MS = 300;
const DOUBLE_TAP_MAX_GAP_MS = 450;
const HANDS_FREE_NUDGE_HOLD_MS = 15000;

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

function clearNudgeTimer() {
  if (longHoldNudgeTimer) {
    clearTimeout(longHoldNudgeTimer);
    longHoldNudgeTimer = null;
  }
}

function fireLongHoldNudge() {
  longHoldNudgeTimer = null;
  if (hasSeenHandsFreeNudge()) return;
  markHandsFreeNudgeSeen();
  if (!Notification.isSupported()) return;
  new Notification({
    title: 'Hands-free tip',
    body: 'Next time, double-tap the hotkey instead of holding it — recording stays on until you tap once more.',
    silent: true,
  }).show();
}

// Passive OS-level listener — it observes key events but doesn't consume
// them, so normal shortcuts in whatever app is focused keep working.
uIOhook.on('keydown', (e) => {
  const name = KEYCODE_TO_CANONICAL[e.keycode];
  if (name) heldKeys.add(name);

  // Only fire on the transition into "combo fully held", so keys already
  // down when the app starts don't immediately trigger a recording.
  if (!isTargetCombo() || comboHeld) return;
  comboHeld = true;

  if (handsFree) {
    // Already locked on — this press is the start of the "turn it off"
    // tap. React on its matching keyup instead.
    return;
  }

  const now = Date.now();
  const gapSinceLastTap = lastTapUpAt !== null ? now - lastTapUpAt : null;
  const isDoubleTap = gapSinceLastTap !== null && gapSinceLastTap <= DOUBLE_TAP_MAX_GAP_MS;
  console.log(
    `[hotkey] down (gapSinceLastTap=${gapSinceLastTap}ms, doubleTapWindow=${DOUBLE_TAP_MAX_GAP_MS}ms, isDoubleTap=${isDoubleTap})`
  );
  lastTapUpAt = null;
  comboDownAt = now;

  if (isDoubleTap) {
    // Tap 2. Tap 1's own keyup already ran a real (near-instant) start+stop
    // of its own — see the recording:stop snapshot fix below for why that's
    // safe — so start again here, this time to stay on.
    console.log('[hotkey] double-tap recognized -> entering hands-free on next keyup');
    pendingHandsFree = true;
    recording = true;
    mainWindow?.webContents.send('hotkey:start-recording');
    return;
  }

  recording = true;
  mainWindow?.webContents.send('hotkey:start-recording');
  clearNudgeTimer();
  longHoldNudgeTimer = setTimeout(fireLongHoldNudge, HANDS_FREE_NUDGE_HOLD_MS);
});

uIOhook.on('keyup', (e) => {
  const name = KEYCODE_TO_CANONICAL[e.keycode];
  if (name) heldKeys.delete(name);

  if (!comboHeld || isTargetCombo()) return;
  comboHeld = false;
  clearNudgeTimer();

  if (pendingHandsFree) {
    // Tap 2's own release — completes the double-tap gesture. Recording
    // stays on; hands-free is now armed, so the *next* press+release turns
    // it off.
    console.log('[hotkey] hands-free ON (double-tap gesture completed)');
    pendingHandsFree = false;
    handsFree = true;
    return;
  }

  if (handsFree) {
    console.log('[hotkey] hands-free OFF (off-tap released)');
    handsFree = false;
    recording = false;
    lastTapUpAt = null;
    mainWindow?.webContents.send('hotkey:stop-recording');
    return;
  }

  const heldDuration = Date.now() - comboDownAt;
  const willArmTap = heldDuration <= TAP_MAX_HOLD_MS;
  console.log(
    `[hotkey] up after ${heldDuration}ms (tapThreshold=${TAP_MAX_HOLD_MS}ms, armingDoubleTapWindow=${willArmTap})`
  );
  recording = false;
  mainWindow?.webContents.send('hotkey:stop-recording');
  // Only remember this release as "tap 1 of a potential double-tap" if it
  // was quick — a real (even short) dictation shouldn't accidentally arm
  // double-tap detection for the next unrelated hold.
  lastTapUpAt = heldDuration <= TAP_MAX_HOLD_MS ? Date.now() : null;
});

// Guarded by the lock above: if this process lost the race to be the one
// true instance, app.quit() was already called, but that doesn't stop the
// rest of this script from running synchronously — without this guard, a
// second launch would still stand up its own tray icon, pill window, and
// (worst of all) its own uIOhook.start(), fighting the first instance for
// the same hotkey.
if (gotSingleInstanceLock) {
  app.whenReady().then(() => {
    migrateFromEnv();
    connectDb(); // not awaited — DB must never delay app startup or the pipeline

    createMainWindow();
    createPillWindow();

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
}

// Tray apps stay alive even if every window is hidden/closed — only the
// tray's Quit item (or the OS) should end the process.
app.on('window-all-closed', () => {});

app.on('before-quit', () => {
  isQuitting = true;
});

app.on('will-quit', () => {
  uIOhook.stop();
  closeDb();
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
let recordingStartedAt = null;
let deepgramMetadata = null;

ipcMain.on('recording:start', () => {
  if (dgSocket) {
    // A previous recording's socket can still be mid-connect/mid-close if
    // the hotkey gets held again before that session's async cleanup
    // finishes. Detaching its listeners stops a late 'open' event from
    // setting dgSocketOpen = true for a socket that isn't the current one,
    // which previously caused "WebSocket is not open: readyState 0
    // (CONNECTING)" errors on the new recording's Finalize send.
    dgSocket.removeAllListeners();
    dgSocket.terminate();
  }

  finalTranscriptParts = [];
  deepgramMetadata = null;
  recordingStartedAt = Date.now();
  dgSocketOpen = false;
  setTrayRecordingState(true);
  showPill();

  const socket = new WebSocket(DEEPGRAM_LIVE_URL, {
    headers: { Authorization: `Token ${loadSettings().deepgramKey}` },
  });
  dgSocket = socket;

  // Every listener below checks `dgSocket === socket` before touching
  // shared state, so a late event from a socket that's since been replaced
  // (e.g. a recording:stop still asleep in its Finalize wait when a new
  // recording:start fires — see the identity guard there too) can't
  // clobber the currently-active session's state.
  socket.on('open', () => {
    if (dgSocket === socket) dgSocketOpen = true;
  });

  socket.on('message', (data) => {
    if (dgSocket !== socket) return;
    const msg = JSON.parse(data.toString());
    if (msg.type === 'Results' && msg.is_final) {
      const transcript = msg.channel?.alternatives?.[0]?.transcript ?? '';
      if (transcript) {
        finalTranscriptParts.push(transcript);
      }
    } else if (msg.type === 'Metadata') {
      // Deepgram sends this once, after CloseStream, summarizing the whole
      // session (request_id, duration, sha256, models). recording:stop
      // polls for this to land before reading it — see the wait loop after
      // CloseStream there. _receivedAt is used only to compute
      // deepgram.latencyMs in recording:stop; it's not persisted.
      deepgramMetadata = { ...msg, _receivedAt: Date.now() };
    }
  });

  socket.on('unexpected-response', (req, res) => {
    console.error('Deepgram rejected the connection, status:', res.statusCode);
    sendStatus(`Error: Deepgram connection rejected (${res.statusCode})`);
  });

  socket.on('error', (err) => {
    console.error('Deepgram socket error (may auto-reconnect):', err.message);
  });

  socket.on('close', () => {
    if (dgSocket === socket) dgSocketOpen = false;
  });

  sendStatus('Listening...');
});

ipcMain.on('audio:chunk', (event, audioBuffer) => {
  if (dgSocket && dgSocketOpen) {
    dgSocket.send(Buffer.from(audioBuffer));
  }
});

ipcMain.on('recording:stop', async () => {
  // Snapshot this session's socket/transcript/open-flag before the first
  // await below. Without this, a fast enough new recording:start (e.g. the
  // tap-1-then-tap-2 gap in double-tap hands-free, comfortably under the
  // 1s Finalize wait) can reassign the shared dgSocket/finalTranscriptParts
  // out from under this handler while it's asleep, so it ends up closing
  // the NEW session's socket and reading the NEW session's empty transcript
  // instead of its own.
  const socket = dgSocket;
  const transcriptParts = finalTranscriptParts;
  const wasOpen = dgSocketOpen;
  const sessionStartedAt = recordingStartedAt;

  try {
    setTrayRecordingState(false);
    hidePill();

    if (!socket) return;

    sendStatus('Finishing up...');

    let closeStreamAt = null;
    if (wasOpen && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: 'Finalize' }));
      await new Promise((resolve) => setTimeout(resolve, 1000));
      closeStreamAt = Date.now();
      socket.send(JSON.stringify({ type: 'CloseStream' }));

      // Deepgram sends the Metadata message AFTER CloseStream. Poll for it
      // to land (capped at 1.5s) instead of a fixed sleep, so we return
      // early once it arrives. Also break early if dgSocket has been
      // reassigned by a new recording — this session's metadata is lost
      // in that race, but the guard prevents hanging on a stale socket.
      for (let waited = 0; waited < 1500; waited += 50) {
        if (dgSocket !== socket || deepgramMetadata) break;
        await new Promise((resolve) => setTimeout(resolve, 50));
      }

      socket.close();
    }

    const rawTranscript = transcriptParts.join(' ').trim();
    // Read right after the wait above, same as rawTranscript — the earliest
    // point Metadata should have arrived, and before the identity check
    // below, in case a new recording:start already reset the shared state.
    const metadata = dgSocket === socket ? deepgramMetadata : null;
    if (dgSocket === socket) {
      dgSocket = null;
      dgSocketOpen = false;
    }

    if (!rawTranscript) {
      sendStatus('No speech detected');
      return;
    }

    console.log('[transcript] raw (from Deepgram):', rawTranscript);

    sendStatus('Cleaning up...');
    const cleanupResult = await cleanupTranscript(rawTranscript);
    const cleaned = cleanupResult.text;
    console.log('[transcript] cleaned (from Groq):', cleaned);

    // Capture the currently focused app right before paste, so the recorded
    // value reflects the app that actually received the text (handles the
    // edge case where the user releases the hotkey and switches windows
    // before the paste lands). Silent-fail: null if the query errors.
    let focusedApp = null;
    try {
      const win = await activeWindow();
      focusedApp = win?.owner?.name ?? null;
    } catch (winErr) {
      console.warn('[focused-app] capture failed:', winErr.message);
    }

    sendStatus('Pasting...');
    await pasteText(clipboard, cleaned);

    sendStatus(`Done — pasted: "${cleaned}"`);

    // DB write happens after the paste already succeeded, in its own
    // try/catch, so a Mongo failure can never turn a successful dictation
    // into a red error status.
    try {
      const dictationId = await saveDictation({
        text: cleaned,
        rawText: rawTranscript,
        hotkey: loadSettings().hotkey,
        durationMs: Date.now() - sessionStartedAt,
        startedAt: new Date(sessionStartedAt),
        focusedApp,
      });
      if (dictationId) {
        await saveApiUsage({
          dictationId,
          deepgram: {
            requestId: metadata?.request_id ?? null,
            audioDurationSec: metadata?.duration ?? null,
            model: metadata?.models?.[0] ?? 'nova-2',
            sha256: metadata?.sha256 ?? null,
            latencyMs: (metadata?._receivedAt && closeStreamAt)
              ? metadata._receivedAt - closeStreamAt
              : null,
          },
          groq: {
            model: cleanupResult.model,
            promptTokens: cleanupResult.usage?.prompt_tokens ?? null,
            completionTokens: cleanupResult.usage?.completion_tokens ?? null,
            totalTokens: cleanupResult.usage?.total_tokens ?? null,
            latencyMs: cleanupResult.latencyMs,
          },
        });
      }
    } catch (dbErr) {
      console.error('[db] post-paste save failed:', dbErr.message);
    }
  } catch (err) {
    console.error('recording:stop pipeline failed:', err, err.cause ? `\ncause: ${err.cause}` : '');
    sendStatus(`Error: ${err.message}${err.cause ? ` (${err.cause})` : ''}`);
  }
});
