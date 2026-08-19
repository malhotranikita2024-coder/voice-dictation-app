const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  sendAudioChunk: (chunk) => ipcRenderer.send('audio:chunk', chunk),
  onTranscript: (callback) => ipcRenderer.on('transcript', (_event, payload) => callback(payload)),
});

console.log('preload loaded');
