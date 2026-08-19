require('dotenv').config();

const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('node:path');
const { DeepgramClient } = require('@deepgram/sdk');

const deepgram = new DeepgramClient({ apiKey: process.env.DEEPGRAM_API_KEY });

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

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  app.quit();
});

ipcMain.on('audio:chunk', async (event, audioBuffer) => {
  try {
    const response = await deepgram.listen.v1.media.transcribeFile(Buffer.from(audioBuffer), {
      model: 'nova-2',
      smart_format: true,
    });

    const transcript = response.results?.channels?.[0]?.alternatives?.[0]?.transcript ?? '';
    mainWindow.webContents.send('transcript', {
      ok: true,
      text: transcript || '(no speech detected)',
    });
  } catch (err) {
    mainWindow.webContents.send('transcript', {
      ok: false,
      text: `Error: ${err.message}`,
    });
  }
});
