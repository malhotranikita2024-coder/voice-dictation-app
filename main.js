require('dotenv').config();

const { app, BrowserWindow, ipcMain, clipboard } = require('electron');
const path = require('node:path');
const WebSocket = require('ws');
const Groq = require('groq-sdk');
const { uIOhook, UiohookKey } = require('uiohook-napi');
const { pasteText } = require('./src/main/inject');

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const CLEANUP_SYSTEM_PROMPT = `You are a transcript cleanup assistant. The input is a raw speech-to-text transcript that may contain mistakes from the transcription itself — do not try to fix those. You may ONLY do the following:
1. Fix punctuation and capitalization.
2. Remove filler words ('um', 'uh', 'like') when used purely as verbal filler.
3. Remove false starts (when the speaker clearly restarted or repeated a phrase).
4. Resolve explicit verbal self-corrections: when the speaker flags that they're correcting themselves — cues like "no wait", "actually", "I mean", "oh sorry", "no no", "not X, it's Y" — keep only the corrected/final version of that phrase and drop both the retracted part and the correction cue words. Example: "send this to Tina, oh sorry, no, not Tina, it's Priya" becomes "send this to Priya".
Rule 4 applies ONLY to retractions the speaker explicitly flags in speech this way. Outside of a flagged retraction, do NOT substitute, replace, or rephrase any word for another word, even if it seems unusual, awkward, or grammatically odd — leave it exactly as given. Do not add or remove any information or change word choice beyond what rules 1-4 allow. Return ONLY the cleaned text, no explanation or preamble.`;

async function cleanupTranscript(rawText) {
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

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile('index.html');
}

app.whenReady().then(() => {
  createWindow();
  uIOhook.start();
});

app.on('window-all-closed', () => {
  app.quit();
});

app.on('will-quit', () => {
  uIOhook.stop();
});

function sendStatus(text) {
  mainWindow.webContents.send('status', text);
}

// Global hotkey: hold Ctrl+Shift anywhere in Windows to record.
// uiohook-napi is a passive OS-level listener (it observes key events, it
// doesn't consume them), so normal shortcuts like Ctrl+Shift+T still work
// in whatever app is focused — we just also see the events.
let ctrlDown = false;
let shiftDown = false;
let hotkeyActive = false;

const isCtrlKey = (code) => code === UiohookKey.Ctrl || code === UiohookKey.CtrlRight;
const isShiftKey = (code) => code === UiohookKey.Shift || code === UiohookKey.ShiftRight;

uIOhook.on('keydown', (e) => {
  if (isCtrlKey(e.keycode)) ctrlDown = true;
  else if (isShiftKey(e.keycode)) shiftDown = true;

  // Only fire on the up -> down transition, so keys already held when the
  // app starts don't immediately trigger a recording.
  if (ctrlDown && shiftDown && !hotkeyActive) {
    hotkeyActive = true;
    mainWindow?.webContents.send('hotkey:start-recording');
  }
});

uIOhook.on('keyup', (e) => {
  if (isCtrlKey(e.keycode)) ctrlDown = false;
  else if (isShiftKey(e.keycode)) shiftDown = false;

  if (hotkeyActive && !(ctrlDown && shiftDown)) {
    hotkeyActive = false;
    mainWindow?.webContents.send('hotkey:stop-recording');
  }
});

const DEEPGRAM_LIVE_URL =
  'wss://api.deepgram.com/v1/listen?model=nova-2&encoding=linear16&sample_rate=16000&channels=1&smart_format=true&interim_results=false';

let dgSocket = null;
let dgSocketOpen = false;
let finalTranscriptParts = [];

ipcMain.on('recording:start', () => {
  finalTranscriptParts = [];
  dgSocketOpen = false;

  dgSocket = new WebSocket(DEEPGRAM_LIVE_URL, {
    headers: { Authorization: `Token ${process.env.DEEPGRAM_API_KEY}` },
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
