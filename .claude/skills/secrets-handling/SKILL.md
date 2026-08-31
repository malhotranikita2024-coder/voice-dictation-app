---
name: secrets-handling
description: Tells Claude how to safely handle API keys, credentials, and other sensitive information in this project. Read before touching `.env`, `.env.example`, `src/main/settings.js`, any Deepgram/Groq/Mongo client construction, or any `console.log`/error handler near a key — and before every `git commit` or `git push`.
---

# Secrets handling for this project

Three external services (Deepgram, Groq, MongoDB Atlas), each gated by a credential.
None of those credentials may ever reach source control, the renderer process, or a log
line. `coding-patterns`'s "Security" section is the one-paragraph summary; this is the
full checklist.

## Where secrets live

- Local dev values: `.env` at repo root, loaded via `dotenv` in `main.js`.
- Runtime values: `electron-store`, owned entirely by `src/main/settings.js`
  (`deepgramKey`, `groqKey`, `mongoUri`, read via `loadSettings()`).
- `migrateFromEnv()` copies `.env` into the store once, only into empty fields — never
  make it an unconditional overwrite (would let a stale `.env` clobber a rotated key).
- `hasRequiredKeys()` is the single source of truth for "are we configured" — reuse it
  instead of checking key truthiness inline elsewhere.
- The store is plain JSON, **not encrypted**. Known/accepted limitation — don't
  "fix" it with a new encryption dependency inside an unrelated task.

## Main process only

- Keys are constructed into clients only in `main.js` (Groq client, Deepgram WebSocket
  auth header), re-reading `loadSettings()` per call rather than caching at module
  scope, so an edited key takes effect without a restart.
- Sole exception: `settings:load`/`settings:save` IPC pass plaintext keys so the
  Settings/Onboarding forms can display/edit them. That's narrow and intentional — not
  precedent for any IPC call that *uses* a key (transcription, chat, DB) to touch it.
- Renderer files only ever treat key names as form-field names round-tripped through
  `settings.load()`/`settings.save()`. Never add a `fetch`/`XMLHttpRequest`/SDK call to
  Deepgram/Groq/Mongo from renderer code — extend a main.js IPC handler instead.
- `pill.html`/`src/main/pill.js`/`index.html`/`preload.js` have zero key references —
  keep it that way (`pill.html` is CSS-only, `script-src 'none'`).

## `.env` / `.env.example`

- `.env` is gitignored and untracked — verify with `git status` before every commit.
- `.env.example` is tracked and must stay a blank template (`KEY=` with empty values,
  explanatory comments, no real or example-looking secrets). Add new keys the same way.
- Only edit `.env.example` for a new variable — never touch the user's real `.env`.

## What must never happen

- No hardcoded key literals anywhere — including "temporary" debug code, comments, or
  test fixtures.
- No key crossing into a renderer file, HTML attribute, URL query string, or any
  `src/main/` file besides `settings.js` (storage) and `main.js` (consumption).
- No key sent to a service other than its own (e.g. Groq key in a Deepgram request).

**Wrong:** a renderer file hardcoding `DEEPGRAM_API_KEY` and calling
`fetch("https://api.deepgram.com/...")` directly — ships the key in the packaged app
and git history, and bypasses main entirely.
**Correct:** `.env` → `loadSettings()` → main.js's WebSocket setup; renderer only sends
raw audio over the existing `audio:chunk` channel and gets transcripts back.

## Logging

- Never `console.log`/`console.error` a key, token, or connection string — including in
  `catch` blocks or "temporary" debug scaffolding.
- Existing error logs in `main.js` print only status codes/messages from Deepgram/Groq
  failures, never headers or the key — match that shape for new error handling.
- Never log a full `mongoUri` (embeds user+password) — log only host/db, or redact.

## Git / commit safety

- No automated secret-scanning exists (no pre-commit hook, no gitleaks) — checking
  before commit/push is a manual step Claude must do explicitly.
- Before committing: `git status` to confirm `.env` isn't staged, and scan
  `git diff --staged` for key-shaped strings (long tokens, `mongodb+srv://` with a
  non-empty password, vars named `*Key`/`*Secret`/`*Token`/`*Uri`) outside
  `.env.example`'s blank template.
- If a real key is found staged or committed, stop and flag it to the user — don't
  silently rewrite history; rotating the credential is their call.
- `scripts/test-db-connection.js` has its own dotenv call for local testing — same rule
  applies, it must never log the full connection string.

## Where to look for more

`coding-patterns` SKILL.md's "Security" section for the short summary; `PROJECT_NOTES.md`
§5/§6 for why keys live in main-process/electron-store at all.
