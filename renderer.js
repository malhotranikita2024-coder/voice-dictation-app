const recordButton = document.getElementById('recordButton');
const statusEl = document.getElementById('status');
const transcriptEl = document.getElementById('transcript');

let mediaRecorder;
let audioChunks = [];
let isRecording = false;

async function startRecording() {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  audioChunks = [];
  mediaRecorder = new MediaRecorder(stream);

  mediaRecorder.ondataavailable = (event) => {
    if (event.data.size > 0) {
      audioChunks.push(event.data);
    }
  };

  mediaRecorder.onstop = async () => {
    stream.getTracks().forEach((track) => track.stop());

    const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
    const arrayBuffer = await audioBlob.arrayBuffer();

    statusEl.textContent = 'Transcribing...';
    window.api.sendAudioChunk(arrayBuffer);
  };

  mediaRecorder.start();
  isRecording = true;
  recordButton.textContent = 'Stop Recording';
  statusEl.textContent = 'Recording... speak now';
}

function stopRecording() {
  mediaRecorder.stop();
  isRecording = false;
  recordButton.textContent = 'Record 10-20 seconds';
}

recordButton.addEventListener('click', () => {
  if (!isRecording) {
    startRecording().catch((err) => {
      statusEl.textContent = `Mic error: ${err.message}`;
    });
  } else {
    stopRecording();
  }
});

window.api.onTranscript((payload) => {
  statusEl.textContent = payload.ok ? 'Done' : 'Error';
  transcriptEl.textContent = payload.text;
});

console.log('renderer loaded');
