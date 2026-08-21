const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  startRecording: () => ipcRenderer.send('recording:start'),
  sendAudioChunk: (chunk) => ipcRenderer.send('audio:chunk', chunk),
  stopRecording: () => ipcRenderer.send('recording:stop'),
  onStatus: (callback) => ipcRenderer.on('status', (_event, text) => callback(text)),
  onRecordingStart: (callback) => ipcRenderer.on('hotkey:start-recording', () => callback()),
  onRecordingStop: (callback) => ipcRenderer.on('hotkey:stop-recording', () => callback()),
});

console.log('preload loaded');
