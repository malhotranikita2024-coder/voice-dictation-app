# Voice Dictation App — Project Notes

**Status:** Planning
**Last updated:** 2026-08-20
**Owner:** Nikita Malhotra

---

## Table of contents

1. [The task](#1-the-task)
2. [What this document is](#2-what-this-document-is)
3. [What we're building](#3-what-were-building)
4. [Wispr Flow — study notes](#4-wispr-flow--study-notes)
5. [Architecture](#5-architecture)
6. [Tech stack decisions](#6-tech-stack-decisions)
7. [Roadmap: v0 → v3](#7-roadmap-v0--v3)
8. [Repository structure](#8-repository-structure)
9. [Local development setup](#9-local-development-setup)
10. [Decision log](#10-decision-log)
11. [Learning log](#11-learning-log)
12. [v4 planned features](#12-v4-planned-features)
13. [Known limitations](#13-known-limitations)

---

## 1. The task

Verbatim from the assignment:

> The idea is to learn basic infra for tech and get comfortable with using Claude Code.
>
> - Download and use Wispr Flow to understand the product.
> - Replicate it as a desktop app (whatever system you have — either Windows or Mac): system-wide voice dictation that transcribes speech in real-time using Deepgram's API, cleans up the output (punctuation, formatting, filler-word removal), and injects text directly into whatever app/field the user is focused on. Figure out the rest — hotkey trigger, permissions flow, UI, tech stack — by studying how Wispr Flow does it and building an equivalent.
> - Push your code to a new GitHub repo.
> - Host your app on a simple webpage with a simple download link that downloads the app.

Two things worth noting from the task text:

- **"Figure out the rest by studying how Wispr Flow does it"** — Wispr Flow is the reference. My job is to observe it and rebuild the equivalent, not to invent something new.
- **"Simple webpage with a simple download link"** — literally a webpage with a download button. Not a marketing site.

---

## 2. What this document is

A living planning + learning document that grows as we build. Every non-obvious choice (library picked, approach taken, trade-off accepted) gets written down here with the reasoning, so I can:

- Explain any decision when asked
- Reference back to alternatives I considered
- Show the thinking, not just the finished code

**The rule**: if I can't explain a choice in my own words, I don't yet understand it — and we go back and re-learn it before continuing.

Claude Code drafts sections here, but I rewrite in my own words. The rewriting *is* the understanding check.

---

## 3. What we're building

Two deliverables, shipped together:

**A Windows desktop app** — runs quietly in the background. When I hold a chosen hotkey, it captures my voice, transcribes it live via Deepgram, cleans up the result with an LLM (punctuation, filler removal, formatting), and pastes the cleaned text into whatever app window is currently focused (Slack, Gmail, VS Code, Word — anywhere text can be typed).

**A simple webpage** — one page, hosted on GitHub Pages, with a download button that points at the installer file.

Target OS: **Windows 11**. Chosen because it's the machine I have. Not building a Mac version.

---

## 4. Wispr Flow — study notes

Website: [wisprflow.ai](https://wisprflow.ai)

The task says to figure out hotkey, permissions, UI, and tech stack by studying Wispr Flow. This section captures what I observed from actually using it (screenshots on file, 2026-08-17).

### Hotkey pattern

- **Suggested default: `Ctrl + Shift`** (hold both simultaneously). Recommended in the onboarding as "the keys at the bottom left of the keyboard."
- **Not a fixed choice — fully configurable.** Just like Wispr Flow: they suggest Ctrl+Shift as the default but users can rebind the shortcut both during onboarding (the "Test keyboard shortcut" screen has an "Edit shortcut" button) and later from the settings window. Same for our clone.
- **Interaction**: hold-to-record, release-to-transcribe-and-paste. Not tap-to-toggle.
- **Visual confirmation during onboarding**: buttons turn **purple** while the keys are pressed, so the user knows the app is detecting them correctly. Same visual pattern Wispr uses.

### Recording indicator (the "pill")

- **Position**: small dark elliptical pill at the **bottom-center of the screen**. Fixed position — does NOT follow the cursor.
- **Idle state**: minimal — just the pill with a subtle dashes/dots pattern.
- **Active recording state**: contains ~3 elements: a language chip (globe icon), a mic icon, and a small options menu.
- **Instruction chips**: while recording, a small chip appears near the pill showing the currently-configured hotkey.

### Onboarding flow (Wispr's full list, then what we keep)

Wispr Flow's onboarding is 5 top-level steps across ~15 sub-screens. Here's every screen I observed from actually going through it:

**Sign Up**
1. **"Where did you hear about us?"** — attribution options (Friend/Family, Product Hunt, Newsletter, YouTube, Podcast, Steven Bartlett, etc.)
2. **"Tell us about yourself"** — role selection (Student, Consultant, Founder/CEO, Developer, Writer, Sales, etc.) with social proof ("Trusted by 1,000,000+ people like you!") and a testimonial from Rahul Vohra, CEO of Superhuman

**Permissions**
3. **"You control your data"** — data policy toggle (Help improve Flow vs. Privacy Mode)
4. **"Test your microphone"** — visual audio-level bars; also triggers the OS microphone permission prompt the first time

**Set Up**
5. **"Set all the languages you speak"** — language selection (multiple languages supported)
6. **"Test the keyboard shortcut"** — recommends Ctrl+Shift with visual purple key highlight when pressed; includes an **"Edit shortcut"** button so users can rebind

**Learn**
7. **"Use Flow to send a message"** — Slack mockup teaching the interaction: "Hold down Ctrl Shift, say something, then release"
8. **"Click into the text field here"** — follow-up prompting the user to place their cursor

**Personalize**
9. **"Where do you spend time typing?"** — use-case selection (Chatting with AI, Coding with AI, Sending messages, Drafting emails, Writing documents, Taking notes, Writing posts or comments, Something else)
10. **"With Flow you could save 23 hours a week!"** — typing time/day slider (ROI pitch)
11. **"Test your typing speed"** — actual typing test with the option "Don't believe us?"
12. **"Nice job! You just spoke 2.2× faster"** — result screen comparing dictation speed vs. typing speed
13. **"Give the magic of Flow. Get a month of Pro."** — referral link with a Flow Pro card
14. **"How would you like to use Flow first?"** — final destination selection (Chat with AI, Take a note, Write a message, Draft an email, Write a post or comment, Write a document, Prompt Cursor or Windsurf)

**Post-onboarding**
15. **"You're ready to Flow everywhere"** — dismissible confirmation popup

### What's included now, and what to consider for later

**Included in v0-v3:**

- **Paste API keys** — BYOK setup, since users provide their own keys
- **Test microphone** (Wispr screen 4) — triggers Windows mic permission + visually confirms it works
- **Test keyboard shortcut** (Wispr screen 6) — confirms hotkey detection, lets user rebind

**To consider for future versions** (ordered roughly by how applicable to our project — most relevant on top, most Wispr-specific at the bottom):

- **Slack learn screen** (screen 7) — teaching moment for the hold-and-speak interaction
- **"Click into the text field here" follow-up** (screen 8) — completes the Slack teaching
- **"How would you like to use Flow first?"** (screen 14) — steering nudge to help users try it in a real app first
- **Language selection** (screen 5) — becomes relevant if multi-language support is added
- **Data policy toggle** (screen 3) — becomes relevant if we ever start collecting any data
- **Role selection + social proof** (screen 2) — Wispr uses for personalization and credibility
- **Attribution "Where did you hear about us?"** (screen 1) — marketing/attribution
- **Typing speed comparison flow** (screens 10–12) — Wispr uses to demonstrate value vs. typing
- **Referral link** (screen 13) — Wispr uses to promote their Pro tier
- **"Ready to Flow everywhere" wrap-up popup** (screen 15) — marketing confirmation

**Result: 3 screens for our onboarding in v0-v3** — Paste API keys → Test microphone → Test hotkey.

### What each of our 3 screens does (in detail)

1. **Paste API keys** (Deepgram + Groq) — the BYOK step. Since we don't run a backend, users provide their own keys.
2. **Test microphone** — visual audio-level bars (same "purple bars" concept Wispr uses). This screen also **triggers the Windows microphone permission prompt** the first time. User speaks → sees the bars move → confirms it works.
3. **Test hotkey** — user holds Ctrl+Shift → the app visually confirms detection (keys "light up" in the UI, same as Wispr's purple key highlight). **Users can rebind the shortcut here** (matches Wispr's "Edit shortcut" pattern).

After these three, the tray icon appears and the user can start dictating anywhere.

### Main app UI (home dashboard)

Wispr Flow's home dashboard has a left sidebar with **8 features**: Dictation, Notetaker, Insights, Dictionary, Snippets, Style, Transforms, Scratchpad.

**We only build one feature: Dictation.** No sidebar, no stats, no history list in v1/v2.

### Landing page

Wispr's actual landing page (wisprflow.ai) is a full marketing site: dark hero with a big serif-italic headline ("Don't type, *just speak.*"), stats card, integration logos, long feature scroll, testimonials, FAQ, extensive footer.

**Not replicating any of that.** Our landing page is one screen with a headline and a download button, per the task spec.

**Borrowing the aesthetic, not the content**: dark background, big typographic headline, minimal chrome.

### Wispr features outside v0–v3 scope

**Planned for v4** (see Section 12 for the full spec):
- Notetaker
- Insights / stats
- Dictionary (custom vocabulary via Deepgram `keywords`)
- Snippets (reusable phrases)
- Style feature (4 categories × 3–4 styles)
- Transforms (rewrite as bullets, notes, LinkedIn posts)
- Voice Profile stats
- Multi-language support
- In-app dictation history

**Not currently planned** (Wispr business/marketing surface — not needed for our clone):
- Scratchpad
- Referral system
- Pro tier upsell
- Typing speed comparison
- "Next step → open ChatGPT" workflow prompts
- Slack learning demo + personalization
- Social proof / testimonial screens
- Data collection consent screen (moot — we don't collect any data)

### Permissions flow (what the task calls out)

The task specifically calls out "permissions flow" as one of the things to figure out. Here's how our clone handles it.

**Windows permissions actually required for our app:**
- **Microphone access** — required. Windows shows a system-level permission popup the first time we call `getUserMedia`. We trigger this deliberately during the "test microphone" step of onboarding (screen 2 above), so it's not surprising later when the user first tries to dictate.
- **Nothing else needs an OS permission on Windows.** Global keyboard listener, clipboard read/write, text injection into other apps, and running in the background via tray — all work without explicit prompts as long as we avoid keys that need admin rights (which is why we chose Ctrl+Shift, not the Fn key or system-reserved combos).

**How we handle mic-permission denial:**
If the user denies mic access, the app cannot function. Show a clear error explaining how to re-enable it in Windows Settings (Settings → Privacy & security → Microphone → allow the app) with a "Try again" button that re-attempts the mic test.

**What Wispr's Permissions step includes that we skip:**
- **Data policy choice** ("Help improve Flow" — allowing them to collect audio + transcripts for training — or "Privacy Mode" — opting out). We don't collect any data. Audio and text go directly from the user's machine to Deepgram/Groq using the user's own API keys. Nothing for us to ask about.

**Contrast with macOS (not our target, useful background):**
On Mac, apps like this need three separate system prompts: **Microphone + Accessibility (needed for global keyboard hooks) + Input Monitoring (needed for reading keyboard events)**. Wispr's Mac onboarding has extra screens for each. Windows only needs the mic prompt, which is why our onboarding is short.

---

## 5. Architecture

### High-level flow

```
┌─────────────────────── MY LAPTOP ───────────────────────────┐
│                                                              │
│  [Tray icon]  [Settings window]  [Floating "recording" pill] │
│         │              │                    ▲                │
│         └──────────┬───┴────────────────────┘                │
│                    ▼                                          │
│  ┌─── Electron app (main process + renderer) ─────────────┐ │
│  │                                                          │ │
│  │  1. Hotkey listener (main, uiohook-napi)                 │ │
│  │           ▼                                              │ │
│  │  2. Audio capture (renderer, Web Audio API)              │ │
│  │           │ audio chunks sent to main via IPC            │ │
│  │           ▼                                              │ │
│  │  3. Deepgram client (main) ──audio stream──▶ Deepgram   │ │
│  │           ◀─────────── raw text ────────── servers       │ │
│  │           ▼                                              │ │
│  │  4. Groq client (main) ─────raw text─────▶  Groq         │ │
│  │           ◀────────── cleaned text ─────── servers       │ │
│  │           ▼                                              │ │
│  │  5. Clipboard (main, Electron built-in) + Ctrl+V paste  │ │
│  │     via nut-js into focused external app                 │ │
│  │                                                          │ │
│  │  API keys (Deepgram + Groq) LIVE ONLY IN MAIN.           │ │
│  │  Renderer never sees or handles them.                    │ │
│  │                                                          │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                              │
└──────────────────────────────────────────────────────────────┘

Landing page (separate deliverable):

   [Any browser] ────▶ [GitHub Pages: index.html]
                              │
                       click Download
                              │
                              ▼
                     [GitHub Releases: app.exe]
```

### Electron's two-process model (short version)

Electron apps have two kinds of JavaScript running at once:

- **Main process** — runs Node.js. Has access to the OS: files, tray icon, native modules (hotkey listener, text injection). One per app.
- **Renderer process** — runs a Chromium browser tab. Draws the UI (settings window, floating pill). Has access to browser APIs (Web Audio, DOM). One per window.

They talk to each other over **IPC** (inter-process communication) — a message-passing system built into Electron.

**In our app:**
- **Main process**: hotkey listener, tray icon, config file read/write, **Deepgram WebSocket, Groq API call**, clipboard + paste simulation. **Holds all API keys.**
- **Renderer process**: audio capture (Web Audio API) — sends chunks to main via IPC — plus the UI (settings window, floating pill). **Never touches API keys.**

### Frontend / backend split

| Layer | What it is | Who runs it |
|---|---|---|
| Desktop app UI (renderer) | Tray icon window, settings window, floating pill | User's machine |
| Desktop app "backend" (main) | Hotkey listener, API calls, paste, config storage | User's machine (Node process) |
| Website frontend | One static HTML page | GitHub Pages |
| Third-party backends called | Deepgram (STT) + Groq (LLM) | Their servers |

**Implication**: no databases, no server deployment, no user accounts.

**Update (2026-08-22, dev-only, scoped):** when a `MONGODB_URI` is configured, `recording:stop` in `main.js` does one extra thing after the paste already succeeds — it writes the transcript + API usage metadata to MongoDB Atlas via `src/main/db.js`, in its own `try/catch` so a DB failure can never affect the paste. Still a two-process app; this is an optional main-process side effect, not a server. See the decision log (Section 10) for why this is a scoped exception to the "no databases" line above, not a reversal of it.

---

## 6. Tech stack decisions

For each choice: **the job** (what problem it solves), **3–4 options considered** (the one we picked is marked ← with the reasoning attached), and **gotchas** (practical things to know when using it).

### At-a-glance

| Job | Library / tool | Introduced in |
|---|---|---|
| Runtime | **Node.js 20 (LTS) + Electron** | v0 |
| Package manager | **npm** (bundled with Node) | v0 |
| Audio capture | **Web Audio API (getUserMedia)** in renderer | v0 |
| Speech-to-text | **Deepgram** — raw `ws` WebSocket client (not the official SDK — see below) | v0, revised v1 |
| LLM cleanup | **Groq** (llama-3.x) — `groq-sdk` | v1 |
| Global hotkey (hold pattern) | **uiohook-napi** | v0 → v1 |
| Text injection | **@nut-tree/nut-js** + Electron's built-in `clipboard` | v1 |
| Env var loading (dev) | **dotenv** | v0 |
| UI framework | **plain HTML/CSS/JS in Electron BrowserWindow** | v2 |
| Tray icon | **Electron's built-in `Tray` API** | v2 |
| Floating pill | **BrowserWindow with frame:false, transparent:true, alwaysOnTop:true** | v2 |
| Config storage | **electron-store** | v2 |
| Transcript/usage persistence (dev-only, optional) | **MongoDB Atlas** — official `mongodb` driver | dev tooling |
| Bundling to installer | **electron-builder** | v3 |
| Landing page HTML | plain HTML5 | v3 |
| Landing page CSS | **Tailwind CSS (via CDN)** | v3 |
| Landing page fonts | **Google Fonts (via CDN)** | v3 |
| Landing page icons | **Lucide (via CDN)** — optional | v3 |
| Local page preview | **`npx serve`** | v3 |
| Version control | **Git + GitHub** | v0 |
| Static site hosting | **GitHub Pages** | v3 |
| Binary hosting | **GitHub Releases** | v3 |

---

### Detailed reasoning

#### Runtime

**The job**: the engine that turns our source code into a running program with the ability to draw windows, talk to the OS, and eventually be packaged into a downloadable file for Windows users.

**Options considered**:
- **Node.js + Electron** ← chosen. What real modern desktop apps use (VS Code, Slack, Discord, Cursor). Skill transfer is high, UI is HTML/CSS/JS which is broadly known, Node ecosystem covers every piece we need. Trade-off accepted: `.exe` is ~150 MB vs. ~40 MB with Python.
- Python (with PyQt6). Readable, mature libraries, smaller `.exe`. But uncommon for consumer desktop apps, less portfolio-relevant.
- C# / .NET (WPF). Best native Windows integration, fastest desktop apps possible. Steep learning curve if something breaks.
- Rust + Tauri. Smallest binaries (~10 MB), fastest, memory-safe. Rust is brutal for a first project.

**Things to know**:
1. Electron's "two process" architecture (main + renderer) is the first big thing to learn. Everything else builds on it.
2. Native modules (hotkey + text injection) need Windows Build Tools. Node's installer offers this as a checkbox — tick it.
3. Pin the Electron version in `package.json` so surprise updates don't break things.

---

#### Package manager

**The job**: download the libraries our code depends on (Electron, Deepgram SDK, etc.) and pin them to exact versions so builds are reproducible.

**Options considered**:
- **npm** ← chosen. Comes bundled with Node — one less thing to install. Universally understood; every tutorial assumes npm. Speed differences vs. yarn/pnpm don't matter at our project size.
- yarn. Faster installs, better dependency resolution. npm has caught up in recent years so the gap is smaller.
- pnpm. Fastest and most disk-efficient. Slightly less universal — some tools assume npm.

**Things to know**:
1. `npm install` reads `package.json` and writes `package-lock.json`. Commit both.
2. Never commit `node_modules/`. Add it to `.gitignore`.
3. Prefer local installs over global (`-g`) whenever possible.

---

#### Audio capture

**The job**: get live microphone audio in small chunks (~250 ms) that we can stream to Deepgram.

**Options considered**:
- **Web Audio API (getUserMedia)** ← chosen. Already there — no install, no native build, no extra subprocess. Well-documented. Streams chunks in exactly the format Deepgram wants. Only reason to skip would be a CLI-only tool, which we aren't building.
- node-audiorecorder. Runs in the main process; requires installing `sox` separately.
- naudiodon (Node bindings to PortAudio). Real Node-native audio; native module means another install risk.

**Things to know**:
1. You must request microphone permission the first time — Electron shows a system popup.
2. Web Audio gives you `Float32Array` samples; Deepgram wants 16-bit PCM. Small conversion step.
3. Default sample rate is often 48000 Hz; Deepgram works better at 16000 Hz. Set explicitly in `getUserMedia` constraints.

---

#### Speech-to-text

**The job**: turn audio into text, live, over a streaming connection.

**Options considered**:
- **Deepgram** ← chosen. Required by the task. Independently strong: ~300–500 ms latency, accurate, generous free credit for development.
- OpenAI Whisper (cloud). Very accurate but not truly streaming — worse for live dictation.
- AssemblyAI. Deepgram's main competitor. Comparable quality and pricing.
- Google Speech-to-Text. Enterprise-grade; complex setup and billing tied to Google Cloud.

**Things to know**:
1. API keys are secrets — never commit. Load from `.env` locally.
2. Pick a specific model — `nova-2` is Deepgram's current best for streaming English.
3. Deepgram bills by audio minute. Free credit is generous but not infinite.
4. **We talk to Deepgram's live endpoint with the raw `ws` library, not the official `@deepgram/sdk`.** v0's batch transcription used `@deepgram/sdk` fine, but when we moved to live streaming in v1 (Terminal 4), the SDK's `deepgram.listen.v1.connect()` wrapper silently failed to ever open a WebSocket when run inside Electron's main process — no error, no close event, nothing, just a socket stuck unopened forever. Confirmed via isolated tests that the *identical* URL, headers, and API key connect instantly with the plain `ws` package, both in plain Node and inside Electron's main process — so the bug is inside the SDK's connection-setup code specifically, not our network/auth/environment. We removed `@deepgram/sdk` from `package.json` and now build the `wss://api.deepgram.com/v1/listen` URL and `Authorization: Token <key>` header ourselves with `ws` directly. Worth knowing before reaching for the SDK's live client again.

---

#### LLM cleanup

**The job**: take raw transcript ("um so like i was thinking...") and return cleaned text ("So I was thinking..."). Handles punctuation, capitalization, and filler-word removal.

**Options considered**:
- **Groq (llama-3.x)** ← chosen. Custom hardware (LPUs) means 5–10× faster inference than OpenAI/Anthropic. Generous free tier. Latency matters — the difference between "magical" and "laggy."
- OpenAI GPT-4o-mini. Reliable, well-known. Costs per call, slower than Groq.
- Anthropic Claude Haiku. High quality. Costs, slower than Groq.
- Local LLM via Ollama. Free forever, offline, private. Slow without GPU; adds ~2 GB to the app.

**Things to know**:
1. Model choice matters. `llama-3.1-8b-instant` is right for our task — bigger isn't better for simple cleanup.
2. Prompt engineering matters. A bad prompt makes the LLM change your meaning.
3. Free tier has rate limits (~30 req/min). Fine for personal use.

---

#### Global hotkey (hold-to-record)

**The job**: detect when Ctrl+Shift is being held down AND when it's released, anywhere in Windows, even when our app isn't focused.

**Options considered**:
- **uiohook-napi** ← chosen. Only well-maintained option that gives us BOTH keydown and keyup events at the OS level. Modern (still updated in 2025). Needs Windows Build Tools for install.
- Electron's built-in `globalShortcut`. Ships with Electron, no install. Only fires on press, not release — useless for hold-to-record. Fine for tap-to-toggle.
- robotjs. Classic library. Install headaches on modern Windows/Node.
- node-global-key-listener. Pure-Node approach, no native compilation. Slightly less reliable, extra subprocess.

**Things to know**:
1. Native module — needs Windows Build Tools during install.
2. Some antivirus software flags keyboard listeners as suspicious. May need allowlisting.
3. Fallback plan: if uiohook-napi install fails, use Electron's `globalShortcut` with tap-to-toggle instead. Worse UX but zero install risk.

---

#### Text injection

**The job**: put the cleaned text into whatever Windows app has focus — Slack, Gmail, VS Code, anywhere. Uses copy-to-clipboard + simulated Ctrl+V (instant paste, not slow character-by-character typing).

**Options considered**:
- **@nut-tree/nut-js + Electron's built-in clipboard** ← chosen. Best-maintained modern OS-automation library. Actively developed, works on Windows without admin. Electron's clipboard for the copy part (built-in, zero install).
- robotjs. Classic library, does everything (keyboard sim + clipboard). Install pain on modern Windows.
- keysender. Windows-only, lightweight, no admin needed. Solid fallback if nut-js fails to install.

**Things to know**:
1. Save + restore the user's clipboard — they might have something copied they want to keep.
2. Small delay (50–100 ms) needed between "copy" and "simulate paste."
3. Some apps don't handle programmatic paste well (older Java Swing, some games). Same limitation Wispr Flow has.
4. Fallback plan: if nut-js native build fails, swap to keysender.

---

#### Env var loading (dev)

**The job**: keep API keys OUT of source code (never commit them) but still accessible to the running app during development.

**Options considered**:
- **dotenv** ← chosen. Standard. Every Node tutorial uses it. Zero cognitive load.
- envalid. Adds validation (fails at startup if keys are missing). Nice for larger projects.
- Node's built-in `--env-file` flag (Node 20+). No library needed. Newer, less well-known, only works when launching Node with that flag.

**Things to know**:
1. `.env` MUST be in `.gitignore` — critical security rule.
2. Ship a `.env.example` file (safe to commit) so anyone cloning the repo knows what keys to provide.
3. In production (packaged `.exe`), we don't use dotenv — user pastes keys into settings, saved via electron-store.

---

#### UI framework

**The job**: draw the two visible UI pieces — settings window (small form for API keys and hotkey) and floating recording pill.

**Options considered**:
- **Plain HTML/CSS/JS** ← chosen. Our UI is TINY. A framework would be like buying a truck for a shoebox. Zero build step, no learning curve. Can swap to React later in ~half a day if v2 grows.
- React. Component-based, huge ecosystem, matches Dograh's stack. Adds build step and ~150 KB runtime.
- Vue. Gentler than React, similar overhead.
- Svelte. Compiles away, no runtime. Smaller community than React.

**Things to know**:
1. Each window (settings, pill) is a separate HTML file loaded into its own BrowserWindow.
2. Renderer ↔ main process communication happens over IPC (`ipcRenderer` / `ipcMain`). Meet this concept in v0.
3. Use `preload.js` to expose ONLY the specific IPC channels the renderer needs (security best practice).

---

#### Tray icon

**The job**: small icon near the Windows clock with a right-click menu (Settings, About, Quit). Lets the user access the app when no window is open.

**Options considered**:
- **Electron's built-in `Tray` API** ← chosen. No install needed, ships with Electron. Two lines to get started. No serious alternative — any external library would just wrap this.

**Things to know**:
1. Tray icons should be 16×16 or 32×32 pixels, PNG or ICO format.
2. Give the icon TWO states — normal and "recording active" — so the user knows what's happening.
3. On some Windows setups, tray icons are hidden by default (users click the chevron). Mention in README.

---

#### Floating pill

**The job**: small floating overlay at the bottom-center of the screen during recording. Frameless, transparent, always-on-top, doesn't show in the taskbar.

**Options considered**:
- **Electron BrowserWindow** with `frame:false, transparent:true, alwaysOnTop:true, skipTaskbar:true, focusable:false` ← chosen. Built into Electron. Content is HTML/CSS. This is exactly what BrowserWindow is for; no serious alternative.

**Things to know**:
1. `focusable: false` is CRITICAL. Without it, clicking the pill would steal focus from Slack (or wherever) and break the paste.
2. Position via `screen.getPrimaryDisplay().workArea` for correct multi-monitor / taskbar handling.
3. Show/hide the window based on recording state — don't create/destroy it every time (slower, causes flicker).

---

#### Config storage

**The job**: save API keys + hotkey preference + other settings to disk so they persist between app launches.

**Options considered**:
- **electron-store** ← chosen. Standard in the Electron world. Handles the "where does the file live on this OS" problem automatically (Windows: `%APPDATA%\<app>\config.json`). Sync API means simple code.
- Plain `fs` + JSON. Write it yourself. Have to figure out file paths and first-run creation.
- lowdb. JSON file with a query-like API. Nice for larger data, overkill here.

**Things to know**:
1. File is JSON in plaintext — API keys are NOT encrypted. Acceptable for personal-use app (the user's machine IS the trust boundary).
2. Config location varies by OS. Good for cleanliness; check the actual path when debugging.

---

#### Transcript/usage persistence (dev-only, optional)

**The job**: save every completed dictation (raw + cleaned text) and the API usage/cost metadata behind it (Deepgram audio-seconds, Groq token counts) somewhere durable, so there's a history to look at later and real cost visibility per session. Foundation for the v4 "in-app dictation history" feature (Section 12).

**Options considered**:
- **MongoDB Atlas, official `mongodb` driver** ← chosen. Free tier (M0) is enough for personal use. Document shape matches our data naturally — a dictation and its API-usage record are just two related JSON-ish documents (collections named `dictations` and `api_usage`, linked by `api_usage.dictationId → dictations._id`), no schema migrations to manage. Official driver over an ODM like Mongoose because we only have two collections — an ODM's validation/modeling layer would be more code than the two `insertOne` calls it replaces.
- SQLite (local file, e.g. `better-sqlite3`). No network dependency, no account needed, simplest possible option. Rejected because it doesn't survive a laptop wipe/reinstall the way a cloud DB does, and doesn't teach the skill of talking to a hosted database — which is part of the point per Section 1's task framing ("basic infra for tech").
- Supabase (Postgres). Also free-tier hosted, relational instead of document. Passed over only because Mongo's document model was a closer match to "one dictation = one JSON blob" with no join-heavy queries planned.

**Things to know**:
1. **This is a scoped departure from Section 5's "no databases" line**, not a reversal — the DB only activates when `MONGODB_URI` is set. See the decision log (Section 10).
2. **Atlas requires an IP allowlist.** A connection attempt from an IP not on the allowlist fails outright — this is a common first-connection gotcha, not a bug in our code.
3. **Never blocks the pipeline.** `connectDb()` is called without `await` in `app.whenReady()`, and every write (`saveDictation`, `saveApiUsage`) is wrapped in try/catch that always resolves rather than throwing. A slow or unreachable Atlas cluster can add startup lag in the background, but can never delay or fail a dictation.
4. The connection string embeds the database name (`mongodb://.../voice-dictation?...`) — the code never hardcodes it, so it just follows whatever's in `.env`.
5. **Use the standard (non-SRV) connection string, not the `mongodb+srv://` form.** SRV URIs require a DNS lookup that fails on machines where Node's DNS resolver is pinned to a stub (common when WSL is installed on Windows and the WSL virtual adapter's proxy hijacks 127.0.0.1). The standard `mongodb://host1,host2,host3/...` form skips that lookup entirely. Non-obvious cost of the SRV form; we hit it during setup.

---

#### Bundling

**The job**: turn our dev folder + node_modules + Chromium + Node into a single Windows `.exe` installer that any stranger can download and run without having Node installed.

**Options considered**:
- **electron-builder** ← chosen. Most configurable of the popular options. Produces both NSIS installers ("Next → Next → Install" wizard) AND portable `.exe` from the same config. Great auto-update support if we ever add it. Most widely-used in production Electron apps → any problem is answered on Stack Overflow.
- electron-forge. Electron team's official all-in-one tool. More integrated, easier to start; less configurable for edge cases.
- electron-packager. Lower-level tool that electron-forge builds on. Maximum control, most manual work.

**Things to know**:
1. Config lives in `package.json` under a `"build"` key — no separate config file needed.
2. First build takes ~5 minutes (downloads Electron binaries). Subsequent builds ~1 minute.
3. Without a code-signing certificate (~$200/year), Windows will show a "protected your PC" warning. Normal for unsigned open-source apps. Mention in README.
4. Output goes to `dist/` — add to `.gitignore`.
5. Set `productName` if you want the installer to say "Voice Dictation" instead of "voice-dictation-app."

---

#### Landing page HTML

**The job**: the actual webpage structure — headline, download button, footer.

**Options considered**:
- **Plain HTML5** ← chosen. It's ONE page. Any framework would be like a truck for a shoebox.
- React (via Next.js). Component-based, huge ecosystem, matches Dograh's stack. Adds build step + npm complexity for one page.
- Static site generator (Astro / Eleventy). Great for content sites with multiple pages. Overkill for one page.

**Things to know**: none really. Just remember `<!DOCTYPE html>` and a `<meta viewport>` for mobile.

---

#### Landing page CSS

**The job**: make the page look good — dark background, big centered headline, styled button, generous spacing.

**Options considered**:
- **Tailwind CSS via CDN** ← chosen. Fastest way to a modern-looking page. Claude Code writes it fluently. CDN = no build step. Trade-off: CDN version is ~500 KB even for unused classes.
- Plain CSS. No dependencies, full control. More code to write for the same look.
- Bootstrap. Pre-built components. Pages tend to look like every other Bootstrap site.

**Things to know**:
1. Tailwind CDN is officially "for prototyping." For our one-page site, fine.
2. Set colors explicitly, not via browser dark-mode preferences.

---

#### Landing page fonts

**The job**: give the page a modern typographic feel. System defaults (Times, Arial) look dated.

**Options considered**:
- **Google Fonts via CDN** ← chosen. Massive selection, free, one `<link>` tag. Often already cached in the user's browser from other sites.
- System fonts (`-apple-system, "Segoe UI", ...`). Zero download, instant. Looks like every OS's default.
- Self-hosted font files. No external dependency; extra files to manage.

**Things to know**:
1. Use `font-display: swap` to avoid invisible text while loading. Google's default `<link>` handles this.
2. Each weight is a separate download. Pick 2 (400 and 700), not all 9.

---

#### Landing page icons

**The job**: a small icon on the download button (e.g., a download-arrow). Optional.

**Options considered**:
- **Lucide via CDN** ← chosen. Clean modern look, easy to use. Successor to Feather Icons.
- Heroicons. Made by the Tailwind team, similar quality.
- Inline SVG. No library needed at all — paste the SVG for one icon directly in HTML. Defensible if we truly only need one icon.

**Things to know**:
1. If we only use one icon, inline SVG is genuinely fine — skip the library.

---

#### Local preview server

**The job**: serve the landing page at `http://localhost:something` so we can preview it like a real website while editing.

**Options considered**:
- **`npx serve`** ← chosen. No install, uses tools we already have (npx comes with Node), one command.
- VS Code / Cursor Live Server extension. Auto-refreshes on save. Use this if Cursor has the extension.
- `http-server` (npm package). Older, reliable. `npm install -g http-server`.

**Things to know**:
1. Default port is 3000; picks next free port if taken.
2. Ctrl+C in terminal stops the server.
3. Hard refresh (Ctrl+Shift+R) if changes don't show due to browser caching.

---

#### Version control

**The job**: track code changes over time, back up somewhere other than the laptop, share with reviewers.

**Options considered**:
- **Git + GitHub** ← chosen. Required by the task. Universal in tech; daily reviews mean the Dograh team will look at diffs and commits.
- Git + GitLab. Same idea, different company. Free CI/CD included.
- Git + Bitbucket. Same idea, owned by Atlassian, integrates with Jira.

**Things to know**:
1. `.gitignore` matters a lot. Never commit `node_modules/`, `.env`, `dist/`, or IDE folders.
2. Commit messages should be short and descriptive.
3. Push after each meaningful chunk — never let a day's work sit on just your laptop.
4. If you accidentally commit a secret, rotate the key immediately — it's in Git history forever.

---

#### Static site hosting

**The job**: put the landing page on the internet at a free URL.

**Options considered**:
- **GitHub Pages** ← chosen. Free, no separate account/dashboard, deploys from the same repo. One-click enable in Settings.
- Netlify. More features (forms, redirects, preview deployments). Free tier generous. Separate account.
- Vercel. Best-in-class for Next.js/React. Separate account.

**Things to know**:
1. First deploy takes a few minutes to propagate.
2. URL format is `https://<username>.github.io/<repo>/` — links within the page should account for the repo-name prefix.
3. Only serves static files (no server-side code). Fine for our use.

---

#### Binary hosting

**The job**: host the compiled `.exe` (~150 MB) somewhere with a stable URL. Can't commit that to Git — bloats the repo forever.

**Options considered**:
- **GitHub Releases** ← chosen. Free, up to 2 GB per file, versioned (v0.1, v0.2, v1.0 all downloadable), integrated with the repo. Users trust GitHub URLs.
- AWS S3 / Cloudflare R2 / DigitalOcean Spaces. Cloud file storage. Cheap but needs setup and a credit card.
- Google Drive / Dropbox share links. Works but download experience is awkward (goes through a file-sharing UI first).

**Things to know**:
1. Each release has a URL with the version tag. Either update the landing page every release OR use GitHub's `/releases/latest/download/<filename>` pattern (auto-redirects to latest).
2. Per-file limit is 2 GB — we're way under.
3. Can mark releases as pre-release / draft for testing before making public.

---

## 7. Roadmap: v0 → v3

Four versions. Each is a **shippable milestone** — a version I could point at and say "this works now." Each breaks into sub-steps that fit in **separate Cursor / Claude Code terminal sessions**, so context stays clean and I can back out of a mistake without scrolling through a mega-chat.

### v0 — "Does the pipe work?"

**Goal**: prove end-to-end that an Electron app can go from a button click → mic → Deepgram → text on screen.

**Deliverable**: minimal Electron app with one window and one "Record 10–20 seconds" button. Click button, speak, transcript appears in the window.

No cleanup. No injection. No hotkey. No UI polish. Just proving the raw pipe.

**Estimate**: 1 day.
**Terminals**: 1.

**Sub-steps**:
1. Install Node.js 20 LTS (with the "Automatically install the necessary tools" checkbox for native module builds).
2. `npm init -y` and install: `electron`, `@deepgram/sdk`, `dotenv`.
3. Create the minimal Electron shell: `main.js` (main process), `index.html` (renderer UI), `preload.js` (safe IPC bridge).
4. Wire up: renderer captures audio via `getUserMedia` → sends audio chunks to main via IPC → main calls Deepgram (using API key from `.env`) → main sends transcript back to renderer via IPC → renderer displays it.

**Libraries introduced**: `electron`, `@deepgram/sdk`, `dotenv`.

**Understanding checkpoint**: I can explain the difference between Electron's main and renderer processes, what `preload.js` is for (security bridge), and why we don't hardcode the API key.

---

### v1 — "Does it feel like Wispr Flow?"

**Goal**: the actual Wispr mechanic. Hold `Ctrl+Shift` → speak → release → cleaned text appears in whatever app was focused.

**Deliverable**: still just the minimal window (no polish), but functionally the app already works — global hotkey, streaming Deepgram, Groq cleanup, paste into focused app.

**Estimate**: 2–2.5 days.
**Terminals**: 3 — one per sub-step, fresh chat each time.

**Sub-steps**:
1. Add Groq cleanup (in main, via `groq-sdk`) + text injection (Electron `clipboard` + `nut-js`, also in main). Still using the record button. All API calls and keys stay in main; renderer just forwards audio and receives display text.
   - **Risk step**: this is where `nut-js` gets installed. If native build fails, we swap to `keysender`.
2. Switch from "record 10–20 sec on button click" to real-time streaming via Deepgram's live endpoint.
3. Replace the button with global hotkey (hold-to-record via `uiohook-napi`).

**Libraries introduced**: `groq-sdk`, `@nut-tree/nut-js` (or `keysender`), `uiohook-napi`.

**Understanding checkpoint**: I can explain (a) the difference between batch and streaming transcription, (b) why we paste instead of typing, and (c) why the hotkey listener needs a special native module instead of Electron's built-in `globalShortcut`.

---

### v2 — "Does it look and behave like a real product?"

**Goal**: someone else could use it without me watching. Real background app.

**Deliverable**: tray icon, settings window, floating recording pill, error handling, 3-screen first-launch onboarding.

**Estimate**: 2.5 days.
**Terminals**: 3 — one per sub-step.

**Sub-steps**:
1. Tray icon (Electron `Tray`) + settings window (BrowserWindow with HTML form: paste API keys, pick hotkey, save via `electron-store`).
2. Floating recording pill (BrowserWindow with `frame:false, transparent:true, alwaysOnTop:true`, positioned bottom-center of primary display). Shows during recording.
3. Error handling (mic permission denied, no internet, invalid API key, no focused text field) + 3-screen first-launch onboarding covering the permissions flow (paste API keys → test mic with visual bars, which triggers the Windows mic permission prompt → test hotkey with visual key highlight) + visual polish.

**Libraries introduced**: `electron-store`.

**Understanding checkpoint**: I can demo the app to someone unfamiliar with it, and it behaves gracefully in each edge case I've tested.

---

### v3 — "Can strangers download and use it?"

**Goal**: someone on the internet can download the app and run it.

**Deliverable**: `.exe` installer on GitHub Releases + simple landing page live on GitHub Pages with a working download button.

**Estimate**: 1.5 days.
**Terminals**: 2 — one per sub-step.

**Sub-steps**:
1. Configure `electron-builder` in `package.json`. Build the Windows installer. Test on a machine without Node installed. Upload to a GitHub Release.
2. Build the landing page (`index.html` + Tailwind via CDN + Google Fonts). Deploy to GitHub Pages. Wire the download button to the Release URL.

**Libraries introduced**: `electron-builder` (build-time only, not shipped inside the app).

**Understanding checkpoint**: I can explain what electron-builder does under the hood (bundles Chromium + Node + our code into one installer), what GitHub Pages serves vs. where the `.exe` actually lives (Releases), and what happens between clicking Download and getting a file.

---

### Total estimate

**~7–9 working days end to end**.

---

## 8. Repository structure

_(Sketch — refined as we build.)_

```
voice-dictation-app/
├── README.md               # user-facing: what it is, install, usage
├── PROJECT_NOTES.md        # this file
├── package.json            # Node dependencies + electron-builder config + scripts
├── package-lock.json       # exact versions (auto-generated, commit this)
├── .gitignore              # ignores .env, node_modules/, dist/, out/
├── .env.example            # template showing required env vars (safe to commit)
├── main.js                 # Electron main process entry point
├── preload.js              # secure bridge between main and renderer
├── src/
│   ├── main/
│   │   ├── hotkey.js       # uiohook-napi hold-pattern listener
│   │   ├── inject.js       # clipboard + nut-js paste
│   │   ├── tray.js         # tray icon setup
│   │   └── settings.js     # electron-store read/write
│   └── renderer/
│       ├── index.html      # main/settings window
│       ├── pill.html       # floating recording pill window
│       ├── renderer.js     # UI logic: audio capture, Deepgram, Groq
│       └── styles.css
├── assets/
│   ├── icon.ico            # app icon
│   ├── tray-icon.png
│   └── tray-icon-active.png
└── landing/                # or separate repo — decide in v3
    └── index.html
```

---

## 9. Local development setup

_(Filled in during v0. Placeholder for exact commands.)_

---

## 10. Decision log

Running record of choices and their reasons.

| Date | Decision | Reason |
|---|---|---|
| 2026-08-17 | Target Windows (not Mac) | It's the machine I have |
| 2026-08-17 | *(superseded)* Python as the app language | See below — switched to Electron |
| 2026-08-17 | **Node.js + Electron as the app runtime** | What real desktop apps use (VS Code, Slack, Discord, Cursor). Better skill transfer, HTML/CSS/JS is broadly known, Node ecosystem is mature. Accepted trade-offs: bigger `.exe` (~150 MB), longer setup, native modules for hotkey + text injection |
| 2026-08-17 | Deepgram for STT | Required by the task |
| 2026-08-17 | Groq for LLM cleanup | Fastest inference (matters for latency), free tier |
| 2026-08-17 | Paste-based injection (not typing simulation) | Instant appearance, matches Wispr Flow feel |
| 2026-08-17 | Minimal landing page | Task says "simple webpage" — taken literally |
| 2026-08-17 | Roadmap in v0 → v3 shape | Each version is a shippable milestone; sub-steps fit in separate Cursor terminals |
| 2026-08-17 | Work in separate terminals per sub-step | Fresh Claude Code context each time — prevents one giant chat, easier to back out of mistakes |
| 2026-08-17 | Default hotkey `Ctrl + Shift` | Confirmed from Wispr Flow onboarding screenshots — matches user expectation |
| 2026-08-17 | Recording pill positioned at fixed bottom-center | Matches Wispr Flow. Simpler than tracking cursor |
| 2026-08-17 | v2 onboarding is 3 screens, not 15 | Wispr's onboarding is a full product-marketing funnel. Ours only needs: paste keys → test mic → test hotkey |
| 2026-08-17 | Scope locked to core dictation only | Wispr Flow has 8 sidebar features. We rebuild only Dictation |
| 2026-08-17 | `uiohook-napi` for the hotkey (not Electron `globalShortcut`) | Built-in `globalShortcut` doesn't distinguish keydown from keyup, so it can't do hold-to-record |
| 2026-08-17 | `@nut-tree/nut-js` for text injection (with `keysender` as fallback) | Best-maintained modern option. `keysender` reserved as fallback if native build fails |
| 2026-08-17 | Plain HTML/CSS/JS for app UI (not React yet) | Our UI is tiny — a framework adds tooling for little value. Can swap to React later if we want |
| 2026-08-17 | `electron-builder` for bundling | More configurable than `electron-forge`, better installer output, better auto-update support later |
| 2026-08-17 | **API key architecture: keys and all API calls (Deepgram, Groq) live in main process** | Follows Electron security best practice — keys never touch the Chromium renderer. Renderer only captures audio (via Web Audio API) and forwards chunks to main via IPC. Slightly more IPC code, but defensible in review and teaches proper Electron patterns. |
| 2026-08-20 | Switched from `@deepgram/sdk`'s live client to the raw `ws` library for streaming, and removed the SDK dependency entirely | `deepgram.listen.v1.connect()` never opened a working WebSocket inside Electron's main process (no error, no data, nothing) — confirmed via isolated tests that the identical URL/headers/key work instantly with plain `ws`, both in bare Node and inside Electron. Root cause inside the SDK itself was never fully pinned down; bypassing it was faster and more reliable than continuing to reverse-engineer a third-party bug. See Section 6 and Section 11 (v1 learning log) for the full story. |
| 2026-08-20 | Tightened the Groq cleanup prompt to forbid word substitution, with a narrow exception for resolving explicitly-flagged verbal self-corrections | Testing showed Groq would occasionally "fix" a Deepgram mishearing by swapping in a different word, silently changing meaning. Logging the raw pre-Groq transcript proved most perceived "Groq errors" were actually Deepgram mishearings that Groq was smoothing over. See Section 11 and Section 13. |
| 2026-08-22 | Added optional, dev-only MongoDB Atlas persistence for transcripts + API usage, gated on `MONGODB_URI` being set | Section 5 states "no databases, no server deployment, no user accounts" (originally logged 2026-08-17, above) — this is a **scoped exception**, not a reversal of that call: the DB module (`src/main/db.js`) is a no-op with zero behavior change when no URI is configured, so the shipped `.exe` still has no database for any end user who doesn't opt in. Nikita uses it in dev for cost visibility and as the data foundation for the v4 dictation-history feature (Section 12). DB writes happen after paste, in their own try/catch — a Mongo failure can never block or fail a dictation. |

---

## 11. Learning log

One entry per version. Fill in *after* the version is done.

### v0 — "Does the pipe work?"

_(Draft )_

We proved the full loop: click a button in the Electron window, speak, and see the transcribed text appear back in that same window. The key idea is that the app is really two separate programs talking to each other over a message channel (IPC), not one program. The renderer (the part that's just a webpage — HTML/CSS/JS running in a Chromium tab) is the only piece allowed to touch the microphone, because `getUserMedia` and `MediaRecorder` are browser APIs. It records audio, and when I click stop, it packages everything recorded so far into one audio blob and hands it off. The main process (a plain Node.js program with full OS access) is the only piece allowed to hold the Deepgram API key, because anything sent to the renderer is inspectable in DevTools — a secret living there would leak. So preload.js exists purely as a narrow, deliberate doorway between the two: it exposes exactly two functions (`sendAudioChunk` and `onTranscript`) on `window.api` and nothing else, so the renderer can hand off audio and receive text back without ever being able to reach into main's process or vice versa. When main receives the audio buffer, it calls Deepgram's batch transcription endpoint (send the whole recording at once, wait for the full response back) — not the real-time streaming endpoint, since that's deliberately deferred to a later terminal. Once Deepgram returns the transcript, main pushes it back to the renderer via `webContents.send`, and the renderer's listener updates the page. One thing that tripped us up: the page's Content-Security-Policy (`default-src 'self'`) blocks *any* inline code, including inline `<style>` tags, not just inline `<script>` tags — so both the styling and the interactive logic had to live in separate files (`styles.css`, `renderer.js`) referenced by `<link>`/`<script src>` rather than typed directly into the HTML.

### v1 — "Does it feel like Wispr Flow?"

Terminal 4's job was closing the gap between "it works" and "it feels instant." Going into this session, v0/Terminal 3 already recorded the whole clip with `MediaRecorder`, waited for the mic to stop, shipped the entire compressed `webm/opus` blob to Deepgram's batch endpoint, and waited for one full response back — that round trip was the 2-4 second pause after every recording. The fix was to stop treating "record" and "transcribe" as two sequential steps and start streaming audio to Deepgram *while the user is still talking*, so that by the time they stop, almost the whole transcript is already sitting in memory and all that's left is a short flush.

Two things had to change together for that to work. First, the renderer couldn't keep using `MediaRecorder`, because it only hands you a finished file after you call `.stop()` — there's no way to get audio out of it mid-recording. We switched to the `Web Audio API` with a custom `AudioWorkletProcessor` (`pcm-worklet-processor.js`), which runs on the audio thread, converts the raw `Float32` mic samples to 16-bit PCM (the exact format Deepgram's live endpoint wants), batches them into ~250ms chunks, and posts each chunk back to the renderer's main thread the moment it's ready — so audio starts flowing out over IPC within a quarter-second of speaking, not at the end. One non-obvious gotcha: a worklet with no path to the audio destination often never gets its `process()` called by Chromium's audio graph at all, so we route it through a silent (zero-gain) node to the speakers rather than leaving it dangling.

Second, `main.js` had to hold a live connection open instead of making one-shot calls. This is where the real surprise of the session happened: the official `@deepgram/sdk`'s live-streaming wrapper (`deepgram.listen.v1.connect()`) simply never worked inside Electron's main process — it returned what looked like a valid socket object, but no `open`, `error`, or `close` event ever fired, audio chunks were silently dropped, and Deepgram's own dashboard showed zero requests received. No exception, no crash, nothing to grep for. Tracking it down took building a chain of isolated tests outside the SDK: the exact same URL, headers, and API key connected *instantly* using the plain `ws` library — both in a bare Node script and inside Electron's own main process via `app.whenReady()`. That proved the network, the key, and Electron itself were all fine, and narrowed the failure down to something inside the SDK's own connection-setup code that we never fully root-caused (best guess: an unhandled rejection somewhere in its internal reconnect-and-retry promise chain, since we could never get it to even construct the underlying WebSocket instance). Rather than keep reverse-engineering a third-party bug, we removed `@deepgram/sdk` entirely and talk to `wss://api.deepgram.com/v1/listen` directly with `ws`, sending raw PCM as binary frames and `{"type": "Finalize"}` / `{"type": "CloseStream"}` as JSON control messages on stop. The lesson: when a library's abstraction behaves inexplicably, testing the same thing one layer down (the raw protocol/library it wraps) is often faster than reading its source top-to-bottom.

The other real finding this session was that "the transcript changed" during testing was almost never Groq's fault. The Groq cleanup prompt was originally loose ("preserve meaning and tone exactly"), and testing turned up cases where it would quietly swap a word it found grammatically odd for a more natural-sounding one (Deepgram mis-transcribed "bump the pool size" as "pump the pool size"; Groq "fixed" that to "increase the pool size" — a real, silent content change). We logged the raw Deepgram transcript right before it goes to Groq specifically to settle this, and it turned out the overwhelming majority of "wrong" output was Deepgram itself mishearing words (numbers, uncommon names, and words that sound alike), which Groq was then confidently smoothing into fluent-sounding wrong sentences. Tightening the prompt to explicitly forbid substituting any word — only punctuation, capitalization, filler removal, and (as a scoped fourth rule) collapsing explicitly-flagged verbal self-corrections like "no wait, actually X" down to just the corrected version — fixed the Groq-side drift entirely and made the remaining Deepgram accuracy limits visible instead of masked. Those accuracy limits (uncommon proper nouns, stacked rapid-fire corrections, the 15s recording cap) are real and are logged in Section 13 rather than chased further this session, each mapped to the future feature that actually addresses it.

Net result: release-to-paste now feels close to instant instead of laggy, and the cleanup step is honest about what it changes.

### v1 Session 3 — global hotkey

_(Draft)_

Terminal 5's job was replacing the last piece of scaffolding from v0: the Record button, its 2-second Alt+Tab countdown, and the 15-second auto-stop. All three existed only because we didn't have a way to detect a keypress *outside* our own window yet. `uiohook-napi` fixes that — it installs a system-level keyboard hook that reports every keydown/keyup on the whole machine, not just events aimed at our BrowserWindow, and (importantly) it's a *passive* listener rather than one that intercepts and can swallow input. That distinction is what let us stop worrying about breaking other apps' shortcuts: Ctrl+Shift+T still reopens a closed tab in the browser exactly as before, because our hook only ever observes the event, never consumes it — Windows still delivers it to the focused app normally.

The actual detection logic is a small state machine, not a single "is Ctrl+Shift pressed" check: two booleans (`ctrlDown`, `shiftDown`) track each modifier independently, and a third flag (`hotkeyActive`) tracks whether we've already told the renderer to start recording for the current hold. We only fire the start signal on the specific transition from "not both down" to "both down," which is what makes the flagged edge case safe — if the user is already holding Ctrl+Shift for some unrelated reason when the app launches, `uiohook-napi` never emits a keydown for keys that were already down before it started listening, so `hotkeyActive` never flips and nothing fires. We confirmed this behavior directly: simulating raw OS-level key-down events with `keybd_event` (via a small PowerShell/P-Invoke script, since there's no way to physically hold a key from a terminal) while the app was already running showed a clean start-then-stop pair in the console for a normal press, and *silence* — correctly — when the same simulated hold was already in effect before the app's listener started.

The other change worth noting is what got deleted, not added. Once the hotkey drives `startRecording()`/`stopRecording()` directly, the `RECORDING_SECONDS` timer, the countdown-and-Alt+Tab UI text, and the whole "click first, then switch windows" sequence stopped making sense — they were never the real design, just a stand-in for not having a global listener yet. The Record button stays as a manual fallback (click to start, click again to stop) so the app can still be exercised without the hotkey, e.g. for debugging.

Compared to the old flow, the qualitative difference is that the app now disappears. Click → wait 2 seconds → switch windows → talk fast before the clock runs out was a workflow that kept reminding you a program was involved. Hold-to-record while already looking at Notepad or Slack removes every one of those seams — nothing to click, nothing to switch to, no clock. That's the whole reason Wispr Flow chose this interaction in the first place, and it's the first time this project has actually felt like using it rather than testing it.

**Live test result:** confirmed working in Notepad — hold Ctrl+Shift without ever clicking into the app window, speak, release, cleaned text pastes. Rated 8/10 for this session. A dictation-quality issue surfaced during testing (separate from the hotkey mechanism itself, which fired correctly every time); parked for a future session rather than investigated here, since this session's scope was the trigger mechanism, not transcription/cleanup accuracy.

### v2 — "Does it look and behave like a real product?"

**Session 1 — tray icon + Settings window + electron-store.**

Terminal 6's job was the switch from "an app that opens a window" to "an app that lives in the tray." That sounds like a UI change, but the interesting part was how much of it was actually about *state* — where the API keys and hotkey preference live, and how the app behaves when nothing is visible.

The biggest structural question was what happens to the window that v0-v1 used to show. Audio capture (`getUserMedia` + the `AudioWorkletNode` from v1 Session 2) only works inside a renderer process — it can't run headlessly in `main.js`. Rather than invent a new hidden host process, the existing `index.html`/`renderer.js` window just gets created with `show: false` and is never shown. It still runs the whole v1 pipeline exactly as before; it simply has no visible role anymore. That's a deliberate stopgap — the floating recording pill (next session) is the real long-term replacement for "what the user sees while dictating," this session just needed the app to stop flashing an empty window on launch.

The second structural question was making the hotkey configurable instead of hardcoded. v1's listener only ever checked "is Ctrl and Shift down." Supporting an arbitrary combo (the session's test case was `Alt+Space`, though it ended up tested as `Ctrl+Space`) meant replacing two booleans with a small generic engine: a hotkey is stored as a string like `"Ctrl+Shift"`, `main.js` builds a reverse lookup table from `uiohook-napi`'s key codes to canonical names (collapsing left/right modifier variants — `CtrlRight` and `Ctrl` both mean "Ctrl"), and fires start/stop on the same held-then-released transition logic v1 already proved out, just generalized to "are all the keys in the target set currently down" instead of two hardcoded checks. The settings window's "Change" button captures a new combo entirely with normal DOM `keydown`/`keyup` listeners inside `preload.js` — no global hook needed there, since the settings window already has OS keyboard focus when the user clicks the button. Both sides just need to agree on the same key-naming vocabulary, which turned out to be the only thing that actually had to be kept in sync by hand.

**The one real landmine: `electron-store`'s newest version doesn't `require()`.** The library switched to being a pure ES module at some point, but this project is CommonJS throughout. `npm install electron-store` (no version pin) would have installed something that crashes the moment `main.js` tries to `require()` it. Checking `npm view electron-store versions` before installing showed the CommonJS/ESM split happened at version 9 — so the fix was pinning `electron-store@8.2.0` specifically. Small thing, but the kind of thing that would've been a confusing crash with no obvious cause if skipped.

**The tray icon turned into its own mini debugging story.** With no image editor available, the first pass was a from-scratch PNG encoder (writing IHDR/IDAT/IEND chunks by hand, since Node has no built-in image support) drawing a simple mic glyph in code — technically valid, but ugly at 32×32, blocky with no anti-aliasing. Swapping in a real icon the user provided should have been simple — resize it down — except Electron's own `nativeImage.resize()` gave back implausible pixel values (a spot that should have been deep in a dark background sampled as near-white and fully opaque). Rather than trust it blind, sampling a few known pixels first (center of the mic, mid-background, near a corner) and comparing against what the source image should contain caught the problem before it produced a bad icon. Writing a hand-rolled PNG decoder to double-check gave the *same* "wrong" values, which was the actual tell: the values weren't wrong, the assumption was — the source PNG has no real alpha channel at all (it's a plain opaque RGB image with a light-gray background), and what looked like "transparency" in every preview was just the image viewer's own checkerboard-behind-any-PNG convention, not evidence of an actual alpha channel in the file. Once that was clear, the real fix was a proper background removal step: flood-fill from the four corners (Pillow's `ImageDraw.floodfill`, installed as a one-off local tool since Node has nothing built-in for this) to key out the connected light background, which safely leaves the white mic glyph alone since it's not colour-adjacent to the background *through* the dark square — flood fill follows connectivity, not just color similarity, so it can't leak across the icon's dark fill. Lesson: when a library's output doesn't match what a two-second sanity check predicts, believe the sanity check before the library, and check it with real sample pixels rather than eyeballing a render.

**How the app's feel actually changed**: no window flashes open on launch anymore — the first sign the app exists is the tray icon. Settings persist in `%APPDATA%\voice-dictation-app\config.json` instead of `.env`, confirmed by deleting `.env` entirely after a save and relaunching with dictation still working. Changing the hotkey from `Ctrl+Shift` to `Ctrl+Space` mid-session, live-tested in Notepad, took effect without an app restart, since keys and the active hotkey target are re-read from the store rather than cached at startup. That's the first session where the app stopped feeling like a script you run and started feeling like a small persistent background program.

**Session 2 — floating recording pill.**

Terminal 7's job was giving recording an actual visual signal — up to this point the only feedback was a 16×16 tray icon swap, easy to miss entirely. The interesting part of this session wasn't the pill's look, it was realizing there was almost no new plumbing to build: `main.js` already had exactly two IPC handlers (`recording:start`, `recording:stop`) that bracket every recording session regardless of whether it was triggered by the hotkey or the manual fallback button, and both already did `setTrayRecordingState(...)` as their first line. The pill just hooks into those same two lines (`showPill()` / `hidePill()` right alongside the tray calls) instead of adding a third signal path. That's also what made the "don't show the pill before recording actually starts" requirement easy to satisfy correctly without extra timing code — showing it at the very top of `recording:start`, the same tick the tray icon flips, means it can't ever lag noticeably behind the tray, and both fire before the Deepgram socket or the AudioWorklet pipeline finish spinning up (a few hundred ms lead is imperceptible; a few-second lead — which we didn't have — would have looked janky).

The one setting the whole feature lives or dies on is `focusable: false`. Losing keyboard focus for even a moment would mean the trailing Ctrl+V paste lands wherever the OS decided focus went instead of the app the user was actually dictating into — a silent, confusing failure with no error to grep for. We didn't rely on that flag alone: Electron's `win.show()` is documented to request activation even for a window created with `focusable: false`, so the pill calls `showInactive()` instead, which is the explicit "make visible without asking for focus" API. Belt-and-suspenders rather than trusting one flag to carry the whole guarantee.

Positioning turned out to have one non-obvious trap: `screen.getPrimaryDisplay().bounds` includes the taskbar's screen real estate, so centering off `bounds` would tuck part of the pill behind the taskbar on a standard bottom-taskbar layout. `workArea` excludes whatever the taskbar occupies on any edge, so the same centering formula works regardless of where the user has docked their taskbar, with no OS-specific-position branching needed. Position is computed once at window creation, not recalculated on every `showPill()` — cheap, but it does mean a resolution change or monitor swap mid-session would leave the pill stale until restart. Documented as a known limitation rather than fixed, since this session was explicitly scoped to the primary display only.

The other thing worth naming precisely: this session's "gotcha" was mostly preempted rather than debugged. Transparent `BrowserWindow`s are known to flicker or render solid black on some Windows GPU driver combinations, so the CSS was structured from the start with a single `background: transparent` line (documented inline) that flips to a solid `var(--pill-bg)` if that surfaces on real hardware, paired with the one-line `transparent: true → false` swap in `pill.js`. The trade-off if that fallback is ever needed: an opaque `BrowserWindow` is a hard rectangle at the OS level, so CSS `border-radius` stops rounding real window edges — worth knowing in advance rather than reverse-engineering the first time a rounded pill turns into a rounded rectangle floating inside an invisible square.

**How this changes the feel of recording**: before this session, "is it actually listening?" required looking at a tray icon in the notification area corner — not something you glance at mid-sentence. Now there's a real answer to that question sitting right where your eyes already are (bottom-center, where Wispr Flow puts it too), and it disappears the instant the hotkey releases rather than lingering through the cleanup/paste pipeline. That's the difference between an app you have to trust is working and one that shows you it's working.

### v3 — "Can strangers download and use it?"
_(Empty.)_

---

## 12. v4 planned features

Features planned for v4, built on top of the shipped v0–v3 clone. Captured with enough detail to design and implement later.

Wispr Flow-inspired features that we could layer on later:
- **In-app dictation history** — list of past dictations you can replay, copy, or re-run.
- **Notetaker** — a note-taking surface backed by dictation.
- **Snippets** — reusable phrases you can trigger with a keyword.
- **Style feature (v4 target)** — matches Wispr Flow's Style onboarding pattern: **4 categories × 3 styles**.
  - **Categories**: Personal messages (WhatsApp, Telegram, Discord, Instagram) / Work messages (Slack, Teams, LinkedIn) / Emails (Gmail, Outlook, Superhuman, Apple Mail) / Other apps (Linear, ChatGPT, Notes)
  - **Styles**: Formal (Caps + Punctuation) / Casual (Caps + Less punctuation) / Very casual (No caps + less punctuation) / Excited! (More exclamations — for work / email / other only)
  - **Mechanic**: `active-win` detects target app at paste time → app-to-category lookup table → user's chosen style for that category → matching Groq prompt variant → cleaned text pastes with that style
  - **UI**: 4-screen onboarding style picker with sample messages per style (matches Wispr's visual pattern) + settings screen to change picks later
  - **Storage**: preferences saved in electron-store as `{ personal: "very_casual", work: "casual", email: "formal", other: "casual" }`
  - **Estimated effort**: ~2 solid days (12–15 hrs) — biggest chunk is the 4-screen onboarding UI
- **Always-visible pill mode ("Show pill at all times" toggle)** — matches Wispr Flow's "Show Flow Bar at all times" setting.
  - **Default (v2 Terminal 7):** pill hidden when not recording; appears while recording. This is Wispr's default too.
  - **v4 addition:** user-toggleable "keep pill always visible" preference in settings. When ON, pill stays visible at bottom-center in a minimal idle state (small dot or dashes), and expands/animates during recording.
  - **Recording state visual:** waveform animation — either real audio-driven (mic level bars) or a purely decorative animated waveform. Wispr uses a subtle wave.
  - **Transitions:** smooth animation between idle → recording states (not just show/hide).
  - **Storage:** preference saved in electron-store alongside other user settings.
  - **Estimated effort:** ~½–1 day.
- **Transforms** — rewrite finished dictations in a specific format (bullet list, meeting notes, LinkedIn post, etc.). Separate from Style; Wispr has this as a sidebar feature.
- **Dictionary / vocabulary** — custom words the transcription should recognize (e.g., domain jargon, names).
- **Voice profile / stats** — words per minute, streak, total words.
- **Multi-language support** — currently English-only; expand beyond English later.
- **Cross-platform** — Mac and Linux support (Electron makes this much easier than Python would have).
- **Auto-updater** — the app checks GitHub Releases for new versions (electron-builder supports this out of the box).

Rule for these: **do not start any of these until v0–v3 are all shipped and working**. Feature creep is the biggest risk to finishing.

---

## 13. Known limitations

Limitations observed during builds, mapped to the future version that addresses each. Prevents wasted time re-investigating structural limits, and keeps v4+ features motivated by real problems.

### Dictation quality issue observed during hotkey testing (unconfirmed cause)
- **Observed during:** v1 (Terminal 5 — global hotkey live testing)
- **Symptom:** Not yet characterized in detail — surfaced during Ctrl+Shift hold-to-record testing in Notepad. The hotkey mechanism itself fired correctly every time; the issue is somewhere downstream (transcription accuracy or cleanup), not the trigger.
- **Cause:** Unknown — deliberately parked rather than investigated this session, since Terminal 5's scope was the hotkey trigger, not transcription/cleanup quality. May turn out to be the same class of issue as the entry below (proper-noun mis-transcription) or something distinct.
- **Real fix:** TBD — needs reproduction with a specific example transcript before it can be diagnosed and mapped to a fix.

### Uncommon proper-noun mis-transcription
- **Observed during:** v1 (Terminal 4 — streaming + Groq cleanup testing)
- **Symptom:** Deepgram mis-transcribes less-common names. Examples encountered: "Priya" → "Rhea" / "Andrea" / "Karen"; "Rohan" → "Roman"
- **Cause:** Deepgram's general model is trained on English audio and biases toward common English words. Not fixable via Groq prompt tuning — the raw transcript itself is wrong before it reaches cleanup.
- **Real fix:** **v4 Dictionary feature** — pass user's frequent names/jargon as Deepgram `keywords` parameter on each streaming call, boosting recognition. Users manage the vocab list via settings.

### Adversarial stacked self-corrections partially resolve
- **Observed during:** v1 (Terminal 4 — self-correction cleanup testing)
- **Symptom:** Simple 1–2 corrections clean up perfectly ("send to Tina, no wait Priya" → "Send to Priya"). But 3+ rapid corrections stacked back-to-back (e.g., "3PM, actually 4PM, and loop in Rhea, actually Rohan, actually no...") may leave partial mess in the pasted result.
- **Cause:** Inherent limit of doing correction cleanup as a single after-the-fact LLM pass. When the raw transcript itself doesn't clearly separate retracted vs. corrected content, Groq can't reliably untangle it either. Cannot be fixed via more prompt tuning.
- **Real fix:** **v4+ Live editing feature** — types text as user speaks (using Deepgram interim results), then deletes and retypes when corrections are detected. Matches Wispr Flow's approach. Requires architecture rework: interim streaming ON, continuous typing (not paste-once), backspace simulation, cursor tracking. Only makes sense once the hotkey + pill UI are in place.

### 15-second recording auto-stop — FIXED (v1 Terminal 5)
- **Observed during:** v1 (Terminal 3–4 — testing longer dictations)
- **Symptom:** Recording cuts off after 15 seconds even mid-sentence (constant `RECORDING_SECONDS = 15` in `renderer.js`).
- **Cause:** Deliberate placeholder while we're using the Record button flow. Not a bug, just a scaffolding choice.
- **Fix:** Terminal 5 replaced the button-driven flow with a global `Ctrl+Shift` hold-to-record hotkey (`uiohook-napi`, wired through new `hotkey:start-recording`/`hotkey:stop-recording` IPC channels). Recording now runs until the hotkey is released — the `RECORDING_SECONDS` constant, its countdown, and the 2-second Alt+Tab dance were removed entirely. See Section 11 learning log for the transition-based detection logic.
