const recordButton = document.getElementById('recordButton');
const statusEl = document.getElementById('status');

const RECORDING_SECONDS = 15;

let mediaStream;
let audioContext;
let workletNode;
let sourceNode;
let silentGainNode;
let isRecording = false;

function countdown(seconds) {
  return new Promise((resolve) => {
    let remaining = seconds;
    statusEl.textContent = `Starting in ${remaining}... Alt+Tab to your target app now`;
    const timer = setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        clearInterval(timer);
        resolve();
      } else {
        statusEl.textContent = `Starting in ${remaining}... Alt+Tab to your target app now`;
      }
    }, 1000);
  });
}

async function startRecording() {
  window.api.startRecording();

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
  statusEl.textContent = `Recording... speak now (auto-stops in ${RECORDING_SECONDS}s)`;

  let remaining = RECORDING_SECONDS;
  const recordTimer = setInterval(() => {
    remaining -= 1;
    if (remaining > 0) {
      statusEl.textContent = `Recording... speak now (auto-stops in ${remaining}s)`;
    }
  }, 1000);

  setTimeout(() => {
    clearInterval(recordTimer);
    stopRecording();
  }, RECORDING_SECONDS * 1000);
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
}

recordButton.addEventListener('click', async () => {
  if (isRecording) return;

  recordButton.disabled = true;
  await countdown(2);
  await startRecording().catch((err) => {
    statusEl.textContent = `Mic error: ${err.message}`;
    recordButton.disabled = false;
  });
});

window.api.onStatus((text) => {
  statusEl.textContent = text;
  if (text.startsWith('Done') || text.startsWith('Error') || text === 'No speech detected') {
    recordButton.disabled = false;
  }
});

console.log('renderer loaded');
