import config from "./config.js";

export async function formatText(rawText) {
  const mode = config.get("formattingMode");

  if (mode === "raw") {
    return { formatted_text: rawText, context_type: "general" };
  }

  const provider = config.get("sttProvider");

  if (provider === "whisper") {
    return formatWithOpenAI(rawText, mode);
  } else {
    return formatWithGemini(rawText, mode);
  }
}

async function formatWithOpenAI(rawText, mode) {
  const apiKey = config.get("apiKeyWhisper");
  const prompt = buildPrompt(rawText, mode);

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      response_format: mode === "smart" ? { type: "json_object" } : undefined,
    }),
  });

  if (!response.ok) {
    return { formatted_text: rawText, context_type: "general" };
  }

  const result = await response.json();
  const content = result.choices?.[0]?.message?.content || rawText;

  if (mode === "smart") {
    try {
      const parsed = JSON.parse(content);
      return {
        formatted_text: parsed.text || rawText,
        context_type: parsed.context || "general",
      };
    } catch {
      return { formatted_text: content, context_type: "general" };
    }
  }

  return { formatted_text: content, context_type: "general" };
}

async function formatWithGemini(rawText, mode) {
  const apiKey = config.get("apiKeyGemini");
  const prompt = buildPrompt(rawText, mode);

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig:
          mode === "smart"
            ? { responseMimeType: "application/json" }
            : undefined,
      }),
    }
  );

  if (!response.ok) {
    return { formatted_text: rawText, context_type: "general" };
  }

  const result = await response.json();
  const content = result.candidates?.[0]?.content?.parts?.[0]?.text || rawText;

  if (mode === "smart") {
    try {
      const parsed = JSON.parse(content);
      return {
        formatted_text: parsed.text || rawText,
        context_type: parsed.context || "general",
      };
    } catch {
      return { formatted_text: content, context_type: "general" };
    }
  }

  return { formatted_text: content, context_type: "general" };
}

function buildPrompt(rawText, mode) {
  if (mode === "clean") {
    return `Clean up this dictated text. Remove filler words (um, uh, like, you know), fix punctuation and capitalization. Return ONLY the cleaned text:\n\n${rawText}`;
  }

  return `You are a smart text formatter for voice dictation. Clean up and format this dictated text:
1. Remove filler words (um, uh, eh, like, you know, so, basically)
2. Fix punctuation, capitalization, and grammar
3. Detect the context:
   - code: programming-related
   - email: email-like content
   - chat: casual message
   - command: instruction or directive
   - general: everything else
4. Return JSON: {"text": "formatted text", "context": "code|email|chat|command|general"}

Dictated text: ${rawText}`;
}
