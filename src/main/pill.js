const { app, BrowserWindow, screen } = require('electron');
const path = require('node:path');

let pillWindow = null;

const PILL_WIDTH = 200;
const PILL_HEIGHT = 40;
const BOTTOM_PADDING = 20;

// Created once and only shown/hidden after that (recreating on every
// recording would be slow and flicker). Position is computed once here
// from the primary display's workArea, not bounds — bounds includes the
// taskbar, which would put the pill partially behind it. This does mean
// the pill won't re-center itself if the display config changes after
// launch (resolution change, taskbar toggle, monitor swap) — acceptable
// for a single-display-focused v2 feature; would need a
// 'display-metrics-changed' listener to fix properly.
function createPillWindow() {
  pillWindow = new BrowserWindow({
    width: PILL_WIDTH,
    height: PILL_HEIGHT,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    alwaysOnTop: true,
    resizable: false,
    movable: false,
    skipTaskbar: true,
    focusable: false, // must never steal keyboard focus from the app being dictated into
    hasShadow: false,
    show: false,
    webPreferences: {
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const { workArea } = screen.getPrimaryDisplay();
  pillWindow.setBounds({
    x: Math.round(workArea.x + (workArea.width - PILL_WIDTH) / 2),
    y: Math.round(workArea.y + workArea.height - PILL_HEIGHT - BOTTOM_PADDING),
    width: PILL_WIDTH,
    height: PILL_HEIGHT,
  });

  // app.getAppPath() (not __dirname) so this still resolves correctly once
  // the app is packaged into an .exe later — same reasoning as tray.js.
  pillWindow.loadFile(path.join(app.getAppPath(), 'pill.html'));
}

function showPill() {
  // showInactive() shows the window without requesting focus/activation —
  // the explicit documented way to do this, used alongside focusable:false
  // rather than relying on that flag alone.
  pillWindow?.showInactive();
}

function hidePill() {
  pillWindow?.hide();
}

module.exports = { createPillWindow, showPill, hidePill };
