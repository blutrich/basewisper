import config from "./config.js";
import fs from "fs";
import path from "path";
import os from "os";

export async function transcribe(audioBuffer) {
  const provider = config.get("sttProvider");

  if (provider === "whisper") {
    return transcribeWhisper(audioBuffer);
  } else {
    return transcribeGemini(audioBuffer);
  }
}

async function transcribeWhisper(audioBuffer) {
  const apiKey = config.get("apiKeyWhisper");
  if (!apiKey) throw new Error("OpenAI API key not configured. Run: wisperflow setup");

  const tmpPath = path.join(os.tmpdir(), `wisperflow-${Date.now()}.wav`);
  fs.writeFileSync(tmpPath, audioBuffer);

  const formData = new FormData();
  formData.append("file", new Blob([fs.readFileSync(tmpPath)]), "audio.wav");
  formData.append("model", "whisper-1");

  const language = config.get("language");
  if (language !== "auto") {
    formData.append("language", language);
  }

  const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: formData,
  });

  fs.unlinkSync(tmpPath);

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Whisper API: ${err}`);
  }

  const result = await response.json();
  return result.text;
}

async function transcribeGemini(audioBuffer) {
  const apiKey = config.get("apiKeyGemini");
  if (!apiKey) throw new Error("Gemini API key not configured. Run: wisperflow setup");

  const base64Audio = audioBuffer.toString("base64");

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{
          parts: [
            { inline_data: { mime_type: "audio/wav", data: base64Audio } },
            { text: "Transcribe this audio exactly as spoken. Return only the transcription, nothing else." },
          ],
        }],
      }),
    }
  );

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Gemini API: ${err}`);
  }

  const result = await response.json();
  return result.candidates?.[0]?.content?.parts?.[0]?.text || "";
}
