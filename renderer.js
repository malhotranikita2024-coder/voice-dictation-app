const recordButton = document.getElementById('recordButton');
const statusEl = document.getElementById('status');

let mediaStream;
let audioContext;
let workletNode;
let sourceNode;
let silentGainNode;
let isRecording = false;

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
  statusEl.textContent = 'Recording... speak now (release Ctrl+Shift, or click the button, when done)';
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

recordButton.addEventListener('click', async () => {
  if (isRecording) {
    stopRecording();
    return;
  }

  await startRecording().catch((err) => {
    statusEl.textContent = `Mic error: ${err.message}`;
    recordButton.disabled = false;
  });
});

window.api.onRecordingStart(() => {
  if (isRecording) return;
  startRecording().catch((err) => {
    statusEl.textContent = `Mic error: ${err.message}`;
  });
});

window.api.onRecordingStop(() => {
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
