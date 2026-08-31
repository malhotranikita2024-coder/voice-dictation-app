---
name: coding-patterns
description: Use before writing or modifying any code in this Electron voice-dictation app (main.js, preload.js, src/main/*, renderer/settings/pill HTML+JS). Explains the two-process architecture, IPC channel naming, and file placement rules so new code reuses existing patterns instead of inventing new ones. Read before adding an IPC channel, a new file/module, a dependency, or touching main/renderer/preload boundaries.
---

# Coding patterns for this project

Check established patterns before writing code, so diffs stay minimal and reviewable.
This is the fast checklist; `PROJECT_NOTES.md` §5/§6/§10 has the deeper "why."

## Architecture

Two processes, not three "places to put logic":

- **Main** — `main.js` (entry point, all IPC handlers, hotkey state machine,
  Deepgram/Groq calls) + `src/main/*.js`: one file per responsibility — `db.js`
  (Mongo), `inject.js` (clipboard/paste), `pill.js` (pill window), `settings.js`
  (electron-store), `tray.js` (tray icon).
- **Renderer** — root-level HTML/CSS/JS triplets: `index.html`/`renderer.js` (hidden
  audio capture), `settings.html`/`settings-renderer.js`/`settings-styles.css`,
  `pill.html`/`pill-styles.css` (CSS-only, `script-src 'none'`, no JS/IPC).
- **Preload** — `preload.js` is a narrow bridge only, exposing exactly two
  `contextBridge` namespaces: `window.api` and `window.settings`.

## File placement

- Main-process logic with one clear responsibility → new file in `src/main/`.
- Cross-cutting orchestration / IPC wiring / state machine → stays in `main.js`.
- Renderer UI logic → matching root-level `*-renderer.js`/`.html`/`.css` triplet — no
  bundler or component framework.
- No folders besides `src/main/` — don't add `src/renderer/`, `src/shared/`, etc.

## IPC

| Channel | Direction | Pattern | Used for |
|---|---|---|---|
| `settings:load` | renderer → main | invoke/handle | read settings |
| `settings:save` | renderer → main | invoke/handle | write settings |
| `recording:start` | renderer → main | send/on | start dictation |
| `recording:stop` | renderer → main | send/on | stop dictation |
| `audio:chunk` | renderer → main | send/on | streamed audio data |
| `status` | main → renderer | webContents.send | status text push (exception to namespacing) |
| `hotkey:start-recording` | main → renderer | push only | hotkey-triggered start |
| `hotkey:stop-recording` | main → renderer | push only | hotkey-triggered stop |

`namespace:action`. Before adding a channel, check this table and the two
`contextBridge.exposeInMainWorld` blocks in `preload.js` — most new behavior extends an
existing handler rather than needing a new channel (e.g. the pill was wired into the
existing `recording:start` handler, not a new `pill:show` channel).

## Security

- API keys (Deepgram, Groq, Mongo URI) live only in main-process code (`main.js`,
  `src/main/settings.js`, `src/main/db.js`) — renderer never reads `process.env` or
  electron-store directly; key values only pass *through* IPC from the Settings UI.
- `preload.js` exposes specific methods only, never a generic `ipcRenderer` passthrough.
- Full rules on `.env`, logging, commit safety → `secrets-handling` skill.

## Before creating something, check first

- **New file** → `src/main/`'s five modules + root file list — does one already own this?
- **New IPC channel** → table above + both `contextBridge` blocks.
- **New dependency** → `package.json`'s existing deps; this project deliberately uses
  raw `ws` (not `@deepgram/sdk`) and `keysender` (not `@nut-tree/nut-js`) — trust actual
  `require()`s over doc prose.
- **New pattern generally** → grep for a similar existing case and match its shape.

## Keep changes minimal

Don't refactor unrelated code, don't silently reverse a documented decision
(`PROJECT_NOTES.md` §10 — flag it explicitly if one needs revisiting), prefer editing
an existing file/function over adding a new one. `electron-store` is pinned at `^8.2.0`
deliberately (v9+ is ESM-only) — don't bump it.
