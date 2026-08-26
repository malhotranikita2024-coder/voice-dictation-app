# Voice Dictation App

A Windows desktop app (Electron) that clones the core Wispr Flow experience: hold a hotkey (default `Ctrl+Shift`), speak, release, and the cleaned-up transcript is pasted directly into whatever app you're focused on.

- **Speech-to-text**: [Deepgram](https://deepgram.com) (live streaming)
- **Text cleanup**: [Groq](https://groq.com) (punctuation, filler-word removal)
- **Runs from**: the system tray, with a floating recording pill shown while you talk

## Requirements

- [Node.js 20 LTS](https://nodejs.org/) (installer's "native module build tools" checkbox should be checked)
- A [Deepgram API key](https://console.deepgram.com/) (free tier works)
- A [Groq API key](https://console.groq.com/) (free tier works)
- Windows 11 (the only OS this app currently targets)

## Setup

1. Clone the repo and install dependencies:
   ```
   npm install
   ```
2. Add your API keys. Copy `.env.example` to `.env` and fill in the values:
   ```
   DEEPGRAM_API_KEY=your_key_here
   GROQ_API_KEY=your_key_here
   ```
   (`MONGODB_URI` in `.env.example` is optional dev-only history logging — leave it blank, the app works fine without it.)
3. Start the app:
   ```
   npm start
   ```

On first launch, grant the microphone permission prompt when Windows asks for it.

## Using it

Hold `Ctrl+Shift`, speak, release — the cleaned transcript is pasted into whatever text field currently has focus. The hotkey and API keys can also be changed later from the tray icon's Settings window.

To quit, right-click the tray icon and choose **Quit** — this runs the app's proper shutdown and releases everything cleanly. Avoid closing the app by hitting Ctrl+C in the terminal it was started from; see [Troubleshooting](#troubleshooting) if you've already done this and the app won't start again.

## Troubleshooting

### App won't start / cache errors in the terminal

**Symptom:** `npm start` prints errors like these and the app never fully opens:

```
[ERROR:net\disk_cache\cache_util_win.cc] Unable to move the cache: Access is denied. (0x5)
[ERROR:net\disk_cache\disk_cache.cc] Unable to create cache
[ERROR:gpu\ipc\host\gpu_disk_cache.cc] Gpu Cache Creation failed: -2
```

**Cause:** a previous run was stopped with Ctrl+C (or by closing the terminal window) instead of the tray's **Quit**. Electron's helper processes (GPU, utility, renderer) can survive that and keep the app's cache folder locked, so the next launch can't get access to it. This is more likely if the app was started from a WSL terminal, since Ctrl+C there doesn't always propagate to the underlying Windows process the way it does in PowerShell.

**Fix:** find and close any leftover `electron.exe` processes belonging to this project (safe to run even if other Electron apps — Cursor, Slack, VS Code — are open, since this only targets processes launched from this project's folder):

```powershell
Get-CimInstance Win32_Process -Filter "Name = 'electron.exe'" |
  Where-Object { $_.ExecutablePath -like '*voice-dictation-app*' } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
```

Run it once, wait a couple of seconds, and run it again to catch any child process that respawned in between. Once it reports nothing left to kill, `npm start` should work normally.

**Prevention:** always quit via the tray icon's **Quit** item rather than Ctrl+C.
