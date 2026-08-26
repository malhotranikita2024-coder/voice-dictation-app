const recordButton = document.getElementById('recordButton');
const statusEl = document.getElementById('status');

let mediaStream;
let audioContext;
let workletNode;
let sourceNode;
let silentGainNode;
let isRecording = false;
let isStarting = false;
let stopRequestedWhileStarting = false;

async function startRecording() {
  // getUserMedia + AudioWorklet setup below is async, so a fast enough tap
  // (double-tap hands-free makes quick taps a normal thing, not a rare
  // edge case) can release the hotkey before isRecording ever flips true.
  // Without this guard, onRecordingStop's `if (!isRecording) return`
  // silently drops that stop — recording:stop never reaches main.js, the
  // pill/tray never revert, and the mic keeps running: looks exactly like
  // an accidental hands-free lock even though main.js's hands-free state
  // machine never engaged.
  if (isStarting || isRecording) return;
  isStarting = true;
  stopRequestedWhileStarting = false;
  window.api.startRecording();

  try {
    mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    audioContext = new AudioContext({ sampleRate: 16000 });
    await audioContext.audioWorklet.addModule('pcm-worklet-processor.js');

    sourceNode = audioContext.createMediaStreamSource(mediaStream);
    workletNode = new AudioWorkletNode(audioContext, 'pcm-processor');
    workletNode.port.onmessage = (event) => {
      window.api.sendAudioChunk(event.data);
    };

    // A worklet with no path to the destination often never gets process()
    // called, so route through a silent gain node instead of leaving it
    // dangling (and to avoid the mic feeding back out the speakers).
    silentGainNode = audioContext.createGain();
    silentGainNode.gain.value = 0;
    sourceNode.connect(workletNode);
    workletNode.connect(silentGainNode);
    silentGainNode.connect(audioContext.destination);

    isRecording = true;
    statusEl.textContent = 'Recording... speak now (release Ctrl+Shift, or click the button, when done)';
  } finally {
    isStarting = false;
  }

  if (stopRequestedWhileStarting) {
    stopRequestedWhileStarting = false;
    stopRecording();
  }
}

function stopRecording() {
  sourceNode.disconnect();
  workletNode.disconnect();
  silentGainNode.disconnect();
  workletNode.port.onmessage = null;
  mediaStream.getTracks().forEach((track) => track.stop());
  audioContext.close();

  window.api.stopRecording();
  isRecording = false;
  // Disable until main finishes the Deepgram/Groq/paste pipeline (onStatus
  // re-enables on Done/Error/No speech) so a new recording can't interrupt it.
  recordButton.disabled = true;
}

// startRecording() already told main.js recording:start fired (opened the
// Deepgram socket, showed the pill, set the tray icon) before getUserMedia
// can fail — so a failure here has to tell main.js to unwind that state via
// recording:stop, not just update local UI text, or the pill/tray/socket
// are left stuck in "recording" until an unrelated stop happens to clear them.
function handleStartFailure(err) {
  statusEl.textContent = `Mic error: ${err.message}`;
  recordButton.disabled = false;
  const reason = err.name === 'NotAllowedError' ? 'mic-denied' : `mic-error:${err.message}`;
  window.api.stopRecording(reason);
}

recordButton.addEventListener('click', async () => {
  if (isRecording) {
    stopRecording();
    return;
  }

  await startRecording().catch(handleStartFailure);
});

window.api.onRecordingStart(() => {
  startRecording().catch(handleStartFailure);
});

window.api.onRecordingStop(() => {
  if (isStarting) {
    // Setup (getUserMedia/AudioWorklet) is still in flight — startRecording
    // will replay this stop itself the moment isRecording flips true.
    stopRequestedWhileStarting = true;
    return;
  }
  if (!isRecording) return;
  stopRecording();
});

window.api.onStatus((text) => {
  statusEl.textContent = text;
  if (text.startsWith('Done') || text.startsWith('Error') || text === 'No speech detected') {
    recordButton.disabled = false;
  }
});

console.log('renderer loaded');
