const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  startRecording: () => ipcRenderer.send('recording:start'),
  sendAudioChunk: (chunk) => ipcRenderer.send('audio:chunk', chunk),
  stopRecording: () => ipcRenderer.send('recording:stop'),
  onStatus: (callback) => ipcRenderer.on('status', (_event, text) => callback(text)),
});

console.log('preload loaded');
