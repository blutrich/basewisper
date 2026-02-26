import record from "node-record-lpcm16";

let recording = null;
let audioChunks = [];

export function startRecording() {
  audioChunks = [];

  recording = record.record({
    sampleRate: 16000,
    channels: 1,
    audioType: "wav",
    recorder: "sox",
  });

  recording.stream().on("data", (chunk) => {
    audioChunks.push(chunk);
  });

  recording.stream().on("error", (err) => {
    console.error("Recording error:", err.message);
  });
}

export function stopRecording() {
  if (recording) {
    recording.stop();
    recording = null;
  }
  return Buffer.concat(audioChunks);
}
