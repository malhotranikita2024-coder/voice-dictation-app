---
name: naming-conventions
description: Use before naming any new file, folder, variable, function, or IPC channel/event in this Electron voice-dictation app. Documents the naming style already in use so new names match the existing pattern instead of introducing a new one. Read before creating a file, adding an IPC channel, or naming a new function/variable — and whenever unsure what to call something.
---

# Naming conventions for this project

The goal: as the codebase grows, names stay predictable. A developer (or Claude) who
already knows one corner of the naming scheme should be able to guess the name of
something in another corner correctly, without checking. Don't invent a new naming
style for a concept that already has one — find the existing pattern and match it.
This skill only covers naming/organization; see the `coding-patterns` skill for
architecture and IPC wiring.

## Check existing names before creating a new one

Before naming anything, search for how the same *kind* of thing is already named:

- New file → look at the sibling files in the folder you're adding to.
- New IPC channel/event → check the table in `coding-patterns`'s SKILL.md and grep
  `main.js` / `preload.js` for existing channel strings.
- New function → grep for the verb you're about to use (`start`, `create`, `save`,
  `load`, `mark`, `has`, `is`) — one probably already exists for a similar case.
- New variable/concept name → grep for synonyms first (`recording` vs `dictation` vs
  `capture` — this project settled on `recording`/`dictation` per context; don't add a
  third word for the same thing).

If you find a match, reuse its shape exactly. If you find *no* match, pick a name that
reads like it belongs next to the closest existing sibling, then use it consistently
everywhere (file name, function name, IPC channel, log message) — don't let one concept
pick up multiple spellings as it moves between files.

## File naming

Root-level process entry points and renderer bundles are lowercase, hyphen-separated
`<scope>-<role>.js`, each paired with a matching `.html`/`-styles.css`; `src/main/*.js`
modules are a short, single lowercase word naming the responsibility they own.
Example: `settings-renderer.js` / `settings.html` / `settings-styles.css` at root,
`src/main/settings.js` for the main-process side.

## Folder organization

`src/main/` holds single-responsibility main-process modules (one file per noun);
everything renderer-facing stays at the project root — there's no `src/renderer/`, and
no new top-level folders get added for a single file. Example: `src/main/tray.js`
(main-process) vs. root-level `pill.html` / `pill-styles.css` (renderer).

## Variable and function naming

Functions are `camelCase`, verb-first, and follow established verb families —
`create<Thing>` for constructors, `has`/`is<Thing>` for booleans, `mark<Thing>` for
one-way state, `save`/`load<Thing>` for persistence — reused rather than replaced with
synonyms (`make`, `init`, `checkX`, `setX`). Example: `createSettingsWindow`,
`isOnboardingComplete`.

## IPC / event naming

Channels are `namespace:action`, colon-separated, action hyphenated when multi-word;
the full table lives in the `coding-patterns` skill — check it before adding a channel
so an existing one isn't duplicated under a new name. Example: `recording:start`,
`settings:complete-onboarding`.
