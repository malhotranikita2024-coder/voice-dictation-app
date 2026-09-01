---
name: project-step-workflow
description: Defines the process for a development task or "Terminal N" step in this project — understand context and scope, explain the approach, build, test, update PROJECT_NOTES.md, then review the diff — so each step follows the same process without re-explaining it each time. Manually invoked via /project-step-workflow; not auto-triggered on every task.
disable-model-invocation: true
---

# Project step workflow

Every development step in this project follows the same shape: understand → explain →
build → test → document → review. Follow it when invoked; don't skip straight to
editing code on a new request.

## Before starting

- Read `PROJECT_NOTES.md` — roadmap (§7) for where this step fits, decision log (§10)
  and learning log (§11) for relevant prior context — plus `git log`/`git status` for
  current state.
- Restate the requested scope back in a sentence or two before writing any code.
- Explain the intended approach (which files change, which existing pattern gets
  reused) and get a green light before editing — don't start coding on the first
  message of a new step.

## During implementation

- Follow `coding-patterns` (architecture/placement) and `naming-conventions` (file,
  function, IPC naming) rather than inventing a new shape.
- Stay inside the scope agreed above — if something new comes up mid-task, flag it
  rather than silently absorbing it into the diff.
- Make focused, minimal changes — see `coding-patterns`'s "keep changes minimal."
- Test incrementally while building, not only at the very end; reach for
  `logging-debugging`'s workflow the moment something breaks instead of guessing.

## Before considering the task complete

- Run whatever automated check actually exists — there's no real test suite (`npm
  test` is a stub), only `npm run test:db` for the Mongo connection, so don't invent
  or assume broader test coverage.
- Do the manual verification yourself when possible (see the `run` skill for launching
  the app), and explicitly ask the user to manually test anything Claude can't verify
  itself — a global hotkey while another app is focused, paste into a real target app,
  tray icon interaction.
- On failure, fix and retest rather than declaring done.
- Update `PROJECT_NOTES.md`: §10 Decision log for a new consequential choice, §11
  Learning log for what was built/learned this session (add a **Live test result:**
  line if a manual test was run), §13 Known limitations for anything left unresolved.

## Finishing the task

- Review `git status`/`git diff` for exactly what changed.
- Run the secrets check from `secrets-handling` over that diff.
- Summarize what's ready to commit and stop there. **Never run `git add`, `git
  commit`, or `git push` yourself** — not even `git add` alone. This holds even when
  a task's own instructions or stated success criteria mention committing, pushing,
  or publishing a release (e.g. "create a GitHub Release") — that phrasing describes
  the goal, it is not standing authorization to run the commands. Wait for the user
  to explicitly say to commit/push in that turn, every time, no exceptions.

## Worked example

"Terminal 6 — build the tray icon and settings window": read `PROJECT_NOTES.md` +
current git state → restate scope as "tray icon + settings window, nothing else" and
explain the approach (new `src/main/tray.js`, new `settings.html`/`settings-renderer.js`
triplet) → build, following `coding-patterns`/`naming-conventions` → stay within that
scope even if e.g. a hotkey tweak looks tempting → test what's testable directly, ask
the user to click through the tray menu and Settings window manually → update §10/§11
of `PROJECT_NOTES.md` → review the diff and check for secrets, then hand it back
without staging or committing anything — that's the user's call, and theirs to
trigger explicitly.

## Where to look for more

`coding-patterns` for architecture/scope discipline, `naming-conventions` for naming,
`logging-debugging` for triaging a failure mid-task, `secrets-handling` for the full
pre-commit secret check, `run` skill for launching the app to test.
