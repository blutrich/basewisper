import { createClient } from "@base44/sdk";
import config from "./config.js";

let client = null;

function getClient() {
  if (!client) {
    const appId = config.get("base44AppId");
    const token = config.get("base44Token");
    if (!appId || !token) return null;

    client = createClient({ appId });
    client.auth.setToken(token, false);
  }
  return client;
}

export async function syncTranscription({
  raw_text,
  formatted_text,
  language,
  duration_ms,
  word_count,
  destination,
  stt_provider,
  context_type,
}) {
  const base44 = getClient();
  if (!base44) return;

  try {
    await base44.entities.Transcription.create({
      raw_text,
      formatted_text,
      language,
      duration_ms,
      word_count,
      destination,
      stt_provider,
      context_type,
    });
  } catch (err) {
    console.error(`Sync error: ${err.message}`);
  }
}
