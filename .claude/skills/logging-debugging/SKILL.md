---
name: logging-debugging
description: Use when investigating a bug, error, or "X isn't working" report in this Electron voice-dictation app, before adding new logging, or before changing pipeline code (main.js, src/main/inject.js, src/main/db.js, renderer.js) in response to a failure. Explains how to trace a failure to the correct pipeline stage before editing code, and how to log without exposing secrets.
---

# Logging and debugging for this project

Find the failing stage before changing code. This project's pipeline has several
independent stages — most reported bugs live in one specific stage, not everywhere, and
guessing (e.g. jumping straight to Deepgram code for any transcription complaint) wastes
edits and risks breaking a stage that was already working.

## Logging conventions

Existing logs use a `[scope] message` bracket-tag prefix: `[hotkey]`, `[transcript]`,
`[db]`, `[focused-app]` — e.g. `console.log('[transcript] raw (from Deepgram):', ...)`.
Match an existing tag when logging in that area; add a new short lowercase tag for a
new area. Use `console.log` for expected events, `console.error`/`console.warn` for
failures, and log `err.message` (not the raw `err` object) for new error logs. Separate
from all of this: `sendStatus(text)` in `main.js` pushes short human-readable strings
to the renderer over the `status` IPC channel (`'Listening...'`, `'Cleaning up...'`,
`'Pasting...'`) — that's the user-facing progress channel, not a debug log.

## What to log

One line per meaningful stage transition, not per statement: a stage's key
input/output (`[transcript] raw (from Deepgram):`, `[transcript] cleaned (from Groq):`)
or a stage's failure (`[db] saveDictation failed:`, `[focused-app] capture failed:`).
If you can't tell which stage broke from the current logs, that's a real gap — add one
tagged line at that boundary rather than sprinkling logs through stage internals.

## What NOT to log

Never log API keys, tokens, or `mongoUri` — see the `secrets-handling` skill for the
full rule. Don't log full audio buffers, full transcript text inside a loop, or
per-`audio:chunk` events — those fire continuously and flood the log without helping
diagnose anything.

## Debugging workflow

1. Reproduce the problem first — don't fix from a description alone.
2. Check existing tagged logs and `sendStatus` output to see how far the pipeline got.
3. Walk the pipeline checkpoints below to find the exact stage that's failing.
4. Form a root-cause hypothesis for *that stage* before touching code.
5. Make the smallest fix that addresses the root cause.
6. Re-run the repro and confirm the fix.
7. Spot-check neighboring stages still work — a fix in one stage shouldn't regress
   another (see `coding-patterns`'s "keep changes minimal").

## Dictation pipeline checkpoints

| Stage | Where | Confirms it worked |
|---|---|---|
| Mic/Renderer | `renderer.js` captures audio | `'renderer loaded'` logged, mic permission granted |
| Preload/IPC | `window.api` bridge sends `audio:chunk` | chunks reach `ipcMain.on('audio:chunk', ...)` in `main.js` |
| Main → Deepgram | `recording:start`/`recording:stop` handlers in `main.js` | `[transcript] raw (from Deepgram):` logs non-empty text |
| Deepgram → Groq | `cleanupTranscript()` in `main.js` | `[transcript] cleaned (from Groq):` logs the cleaned text |
| Clipboard/keysender | `pasteText()` in `src/main/inject.js` | clipboard is written, `Ctrl+V` sent via `keysender` |
| Target app focus | `activeWindow()` check + `SHELL_SURFACE_NAMES` in `main.js` | correct app is focused (not a shell surface) before paste |
| DB (side channel) | `saveDictation`/`saveApiUsage` in `src/main/db.js` | `[db] connected` / no `[db] ... failed` — never blocks paste |

**Worked example** (text not reaching Notepad): don't start by changing Deepgram code.
Instead check, in order — is `[transcript] raw` logged (Deepgram got audio and
returned text)? Is `[transcript] cleaned` logged (Groq returned text)? Did
`activeWindow()` see Notepad focused, or did the no-focus-target branch fire (text
left on clipboard instead)? Did `pasteText()` run without error? Only the first stage
that's missing its expected log/status line is the one to change.

## Verify the fix

Re-run the actual repro, not just a read-through of the diff. Confirm the
previously-missing log/status line for the broken stage now appears, and spot-check the
stages right before and after it (e.g. a Deepgram fix didn't break the no-focus-target
short-circuit, a paste fix didn't break the DB side-channel).

## Where to look for more

`coding-patterns` skill for the IPC table and architecture; `secrets-handling` skill
for the full rules on what must never appear in a log line.
