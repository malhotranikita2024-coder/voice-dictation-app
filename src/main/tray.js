const { app, Tray, Menu, nativeImage } = require('electron');
const path = require('node:path');

let tray = null;
let idleIcon = null;
let activeIcon = null;

// app.getAppPath() (not __dirname) so icon paths still resolve correctly
// once this is packaged into an .exe later.
function iconPath(filename) {
  return path.join(app.getAppPath(), 'assets', filename);
}

function createTray({ onOpenSettings, onOpenAbout, onQuit }) {
  idleIcon = nativeImage.createFromPath(iconPath('tray-icon.png'));
  activeIcon = nativeImage.createFromPath(iconPath('tray-icon-active.png'));

  tray = new Tray(idleIcon);
  tray.setToolTip('Voice Dictation');

  const contextMenu = Menu.buildFromTemplate([
    { label: 'Settings', click: () => onOpenSettings() },
    { label: 'About', click: () => onOpenAbout() },
    { type: 'separator' },
    { label: 'Quit', click: () => onQuit() },
  ]);
  tray.setContextMenu(contextMenu);

  tray.on('click', () => onOpenSettings());

  return tray;
}

function setTrayRecordingState(isRecording) {
  if (!tray) return;
  tray.setImage(isRecording ? activeIcon : idleIcon);
}

module.exports = { createTray, setTrayRecordingState };
