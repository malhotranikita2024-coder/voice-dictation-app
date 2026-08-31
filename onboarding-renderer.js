const TOTAL_STEPS = 3;

const stepEls = document.querySelectorAll('.step');
const stepDots = document.querySelectorAll('.step-dot');
const backButton = document.getElementById('backButton');
const nextButton = document.getElementById('nextButton');
const finishButton = document.getElementById('finishButton');

const deepgramKeyInput = document.getElementById('deepgramKey');
const groqKeyInput = document.getElementById('groqKey');
const deepgramKeyError = document.getElementById('deepgramKeyError');
const groqKeyError = document.getElementById('groqKeyError');

const testMicButton = document.getElementById('testMicButton');
const levelBars = document.querySelectorAll('#levelBars span');
const micHint = document.getElementById('micHint');
const openMicSettingsButton = document.getElementById('openMicSettingsButton');

const hotkeyChipsEl = document.getElementById('hotkeyChips');
const hotkeyHint = document.getElementById('hotkeyHint');

let currentStep = 1;
let loadedSettings = { deepgramKey: '', groqKey: '', hotkey: 'Ctrl+Shift', mongoUri: '' };
let stopHotkeyTracking = null;

function showStep(step) {
  currentStep = step;
  stepEls.forEach((el) => {
    el.hidden = Number(el.dataset.step) !== step;
  });
  stepDots.forEach((dot) => {
    const dotStep = Number(dot.dataset.stepDot);
    dot.classList.toggle('active', dotStep === step);
    dot.classList.toggle('done', dotStep < step);
  });

  backButton.hidden = step === 1;
  nextButton.hidden = step === TOTAL_STEPS;
  finishButton.hidden = step !== TOTAL_STEPS;

  if (step === 3) {
    startHotkeyTest();
  } else if (stopHotkeyTracking) {
    stopHotkeyTracking();
    stopHotkeyTracking = null;
  }
}

// Simple open-eye / crossed-eye icon pair (Feather-style, hand-written so no
// icon library or external asset is needed under this window's CSP). Button
// shows the OPEN eye while the field is masked (click to reveal), and the
// CROSSED eye while revealed (click to hide) — the standard convention.
const EYE_OPEN_SVG = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
const EYE_OFF_SVG = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a18.5 18.5 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`;

function setKeyFieldHidden(input, button, hidden) {
  input.type = hidden ? 'password' : 'text';
  button.innerHTML = hidden ? EYE_OPEN_SVG : EYE_OFF_SVG;
  const label = hidden ? 'Show' : 'Hide';
  button.title = label;
  button.setAttribute('aria-label', `${label} key`);
}

document.querySelectorAll('.eye-toggle').forEach((button) => {
  const input = document.getElementById(button.dataset.target);
  setKeyFieldHidden(input, button, true); // masked by default

  button.addEventListener('click', () => {
    setKeyFieldHidden(input, button, input.type === 'text');
  });

  // Pasting a key is usually the last thing done before moving on — default
  // back to masked right after, rather than leaving it visible on screen
  // (matches how most password managers behave, and avoids a pasted key
  // sitting exposed if the field was left in "shown" mode from checking it).
  input.addEventListener('paste', () => {
    setTimeout(() => setKeyFieldHidden(input, button, true), 0);
  });
});

// --- Step 1: keys -------------------------------------------------------

function keysFilled() {
  return deepgramKeyInput.value.trim() && groqKeyInput.value.trim();
}

// Marks whichever key field(s) are empty with a red border + inline "Required"
// message, and keeps the Next button's real `disabled` state (not just the
// click-handler's early-return) in sync — so the button visually looks
// unclickable instead of silently doing nothing when clicked.
function updateKeyValidation() {
  const deepgramEmpty = !deepgramKeyInput.value.trim();
  const groqEmpty = !groqKeyInput.value.trim();

  deepgramKeyInput.classList.toggle('error', deepgramEmpty);
  deepgramKeyError.classList.toggle('visible', deepgramEmpty);

  groqKeyInput.classList.toggle('error', groqEmpty);
  groqKeyError.classList.toggle('visible', groqEmpty);

  nextButton.disabled = deepgramEmpty || groqEmpty;
}

deepgramKeyInput.addEventListener('input', updateKeyValidation);
groqKeyInput.addEventListener('input', updateKeyValidation);

async function saveKeys() {
  await window.settings.save({
    ...loadedSettings,
    deepgramKey: deepgramKeyInput.value.trim(),
    groqKey: groqKeyInput.value.trim(),
  });
}

// --- Step 2: mic test -----------------------------------------------------

let micAudioContext = null;
let micStream = null;
let micRafId = null;
let micTesting = false;

function resetLevelBars() {
  levelBars.forEach((bar) => {
    bar.style.height = '';
  });
}

// The single place responsible for tearing a mic test down — called both
// from the Stop button below and from the Next-button navigation (leaving
// step 2 mid-test). Resetting the button label + level bars here, not at
// each call site, means every caller gets a consistent UI state for free
// instead of having to remember to do it themselves.
function stopMicTest() {
  if (micRafId) cancelAnimationFrame(micRafId);
  micRafId = null;
  micStream?.getTracks().forEach((track) => track.stop());
  micStream = null;
  micAudioContext?.close();
  micAudioContext = null;

  if (micTesting) {
    micTesting = false;
    testMicButton.textContent = 'Test microphone';
    resetLevelBars();
  }
}

testMicButton.addEventListener('click', async () => {
  if (micTesting) {
    stopMicTest();
    micHint.textContent = '';
    micHint.classList.remove('error');
    return;
  }

  micHint.textContent = '';
  micHint.classList.remove('error');
  openMicSettingsButton.hidden = true;

  try {
    micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    micAudioContext = new AudioContext();
    const source = micAudioContext.createMediaStreamSource(micStream);
    const analyser = micAudioContext.createAnalyser();
    analyser.fftSize = 64;
    source.connect(analyser);

    const data = new Uint8Array(analyser.frequencyBinCount);
    micHint.textContent = 'Listening — say something.';
    micTesting = true;
    testMicButton.textContent = 'Stop test';

    function tick() {
      analyser.getByteFrequencyData(data);
      const step = Math.floor(data.length / levelBars.length);
      levelBars.forEach((bar, i) => {
        const value = data[i * step] ?? 0;
        bar.style.height = `${4 + (value / 255) * 20}px`;
      });
      micRafId = requestAnimationFrame(tick);
    }
    tick();
  } catch (err) {
    micHint.classList.add('error');
    if (err.name === 'NotAllowedError') {
      micHint.textContent = 'Microphone access is blocked.';
      openMicSettingsButton.hidden = false;
    } else {
      micHint.textContent = `Mic error: ${err.message}`;
    }
  }
});

openMicSettingsButton.addEventListener('click', () => {
  window.settings.openMicSettings();
});

// --- Step 3: hotkey test ---------------------------------------------------

function renderHotkeyChips(hotkey) {
  hotkeyChipsEl.innerHTML = '';
  hotkey.split('+').forEach((part) => {
    const chip = document.createElement('span');
    chip.className = 'hotkey-chip';
    chip.textContent = part;
    chip.dataset.key = part;
    hotkeyChipsEl.appendChild(chip);
  });
}

function startHotkeyTest() {
  hotkeyHint.textContent = 'Hold your hotkey now to see it light up.';
  const chips = Array.from(hotkeyChipsEl.querySelectorAll('.hotkey-chip'));
  const targetKeys = chips.map((chip) => chip.dataset.key);

  // Both the "matched" styling and the hint text are re-derived live from the
  // current held/released state on every callback, rather than latching once
  // and sticking — so the chips (and message) cleanly return to their resting
  // look the moment the keys are released, ready to be tested again as many
  // times as needed.
  stopHotkeyTracking = window.settings.testHotkey((pressedKeys) => {
    let allHeld = true;
    chips.forEach((chip) => {
      const held = pressedKeys.has(chip.dataset.key);
      chip.classList.toggle('active', held);
      if (!held) allHeld = false;
    });

    const matched = allHeld && targetKeys.length > 0;
    chips.forEach((chip) => chip.classList.toggle('matched', matched));
    hotkeyHint.textContent = matched
      ? 'Nice — that works. Click Finish when you are ready.'
      : 'Hold your hotkey now to see it light up.';
  });
}

// --- Navigation -------------------------------------------------------

backButton.addEventListener('click', () => {
  if (currentStep > 1) showStep(currentStep - 1);
});

nextButton.addEventListener('click', async () => {
  if (currentStep === 1) {
    if (!keysFilled()) return;
    await saveKeys();
  }
  if (currentStep === 2) {
    stopMicTest();
  }
  showStep(currentStep + 1);
});

finishButton.addEventListener('click', async () => {
  stopMicTest();
  if (stopHotkeyTracking) stopHotkeyTracking();
  await window.settings.completeOnboarding();
  window.close();
});

async function init() {
  loadedSettings = await window.settings.load();
  deepgramKeyInput.value = loadedSettings.deepgramKey ?? '';
  groqKeyInput.value = loadedSettings.groqKey ?? '';
  updateKeyValidation();
  renderHotkeyChips(loadedSettings.hotkey ?? 'Ctrl+Shift');
  showStep(1);
}

init();
