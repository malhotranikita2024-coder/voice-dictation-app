---
name: coding-patterns
description: Use before writing or modifying any code in this Electron voice-dictation app (main.js, preload.js, src/main/*, renderer/settings/pill HTML+JS). Explains the two-process architecture, IPC channel naming, and file placement rules so new code reuses existing patterns instead of inventing new ones. Read before adding an IPC channel, a new file/module, a dependency, or touching main/renderer/preload boundaries.
---

# Coding patterns for this project

This project has established architecture decisions. Check them before writing code so a
diff only contains what the task required, and stays reviewable by a second developer.
This file is the fast pre-flight checklist. `PROJECT_NOTES.md` is the deeper "why."

## Architecture at a glance

Two processes — not three "places to put logic":

- **Main** — `main.js` (entry point, all IPC handlers, hotkey state machine, Deepgram/Groq
  calls) plus `src/main/*.js`: single-responsibility modules —
  `db.js` (MongoDB persistence), `inject.js` (clipboard + paste), `pill.js` (pill window),
  `settings.js` (electron-store wrapper), `tray.js` (tray icon).
- **Renderer** — `index.html` / `renderer.js` (hidden, audio capture only, never shown),
  `settings.html` / `settings-renderer.js` / `settings-styles.css` (settings window),
  `pill.html` / `pill-styles.css` (CSS-only, `script-src 'none'`, no JS/IPC — shown/hidden
  entirely by main).
- **Preload** — `preload.js` is a narrow bridge, not a third place for logic. Exactly two
  `contextBridge` namespaces exist: `window.api` and `window.settings`.

For the *why* behind these choices, read `PROJECT_NOTES.md` §5 (Architecture) and §10
(Decision log) — this file only states the *what*.

## File/module placement rules

- Main-process logic with one clear responsibility → new file in `src/main/`, matching the
  existing five-module pattern.
- Cross-cutting orchestration / IPC wiring / state machine → stays in `main.js`; don't split
  it out prematurely.
- Renderer UI logic → the matching root-level `*-renderer.js` / `.html` / `.css` triplet. No
  bundler or component framework exists here — don't introduce one.
- No folders exist besides `src/main/`. Don't create `src/renderer/`, `src/shared/`, etc. —
  `PROJECT_NOTES.md` §8 sketches a layout that doesn't match the repo; trust the real file
  listing over that section.

## IPC rules

| Channel | Direction | Pattern | Used for |
|---|---|---|---|
| `settings:load` | renderer → main | invoke/handle | read settings |
| `settings:save` | renderer → main | invoke/handle | write settings |
| `recording:start` | renderer → main | send/on | start dictation |
| `recording:stop` | renderer → main | send/on | stop dictation |
| `audio:chunk` | renderer → main | send/on | streamed audio data |
| `status` | main → renderer | webContents.send | status text push (exception to namespacing) |
| `hotkey:start-recording` | main → renderer | push only | hotkey-triggered start event |
| `hotkey:stop-recording` | main → renderer | push only | hotkey-triggered stop event |

Naming convention: `namespace:action`, colon-separated. **Before adding a channel, check
this table and the two `contextBridge.exposeInMainWorld` blocks in `preload.js` first** —
most new behavior belongs inside an existing handler, not a new channel.

**Worked example** (from `main.js`'s `recording:start` handler): when the floating pill was
added, it was wired into the *same* handler right next to the existing
`setTrayRecordingState(true)` call, instead of adding a `pill:show` channel. Rule of thumb:
"whenever recording starts" behavior belongs as one more line in the existing
`recording:start` handler, not a new round-trip.

**Anti-pattern**: don't add a separate `pill:show`-style channel triggered independently by
the renderer when an existing handler already fires at the right moment. Two signal paths
for one event is what to avoid.

## Security rules

- API keys (Deepgram, Groq, Mongo URI) live only in main-process code: `main.js`,
  `src/main/settings.js`, `src/main/db.js`.
- Renderer code never reads `process.env` or electron-store directly — key values only pass
  *through* IPC when the user types them into the Settings UI.
- `preload.js` exposes only the specific methods needed — never a generic `ipcRenderer`
  passthrough.

## Before creating X, check Y

- **New file** → check `src/main/`'s five modules and the root file list — does one already
  own this responsibility?
- **New IPC channel** → check the table above and both `contextBridge` blocks — can an
  existing handler be extended instead?
- **New dependency** → check `package.json`'s existing deps (dotenv, electron,
  electron-store, get-windows, groq-sdk, keysender, mongodb, uiohook-napi, ws). This project
  deliberately dropped `@deepgram/sdk` for raw `ws`, and shipped `keysender` instead of the
  originally-planned `@nut-tree/nut-js` — check actual `require()`s and `PROJECT_NOTES.md`
  §10 over doc prose, since the doc can lag reality.
- **New pattern in general** → grep for a similar existing case (another `ipcMain.on`
  handler, another `src/main/` module) and match its shape.

## Keep changes minimal

- Don't refactor unrelated code while implementing a feature.
- Don't silently reverse a documented decision (`PROJECT_NOTES.md` §10) — if one genuinely
  needs revisiting, say so explicitly and update the decision log.
- Prefer editing an existing file/function over creating a new one when it already owns that
  responsibility.
- `electron-store` is pinned at `^8.2.0` deliberately (v9+ is ESM-only, breaks `require()` in
  this CJS project) — don't bump it.

## Where to look for more

`PROJECT_NOTES.md` §5 (Architecture), §6 (Tech stack decisions), §10 (Decision log).
