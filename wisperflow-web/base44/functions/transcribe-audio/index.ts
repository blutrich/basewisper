import { createClientFromRequest } from "npm:@base44/sdk";

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await req.formData();
    const audioFile = formData.get("audio") as File;
    const provider = formData.get("provider") as string || "whisper";
    const apiKey = formData.get("api_key") as string;
    const language = formData.get("language") as string || "auto";

    if (!audioFile || !apiKey) {
      return Response.json(
        { error: "audio file and api_key are required" },
        { status: 400 }
      );
    }

    let transcript = "";

    if (provider === "whisper") {
      const whisperForm = new FormData();
      whisperForm.append("file", audioFile);
      whisperForm.append("model", "whisper-1");
      if (language !== "auto") {
        whisperForm.append("language", language);
      }

      const response = await fetch(
        "https://api.openai.com/v1/audio/transcriptions",
        {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}` },
          body: whisperForm,
        }
      );

      if (!response.ok) {
        const err = await response.text();
        return Response.json(
          { error: `Whisper API error: ${err}` },
          { status: response.status }
        );
      }

      const result = await response.json();
      transcript = result.text;
    } else if (provider === "gemini") {
      const audioBytes = await audioFile.arrayBuffer();
      const base64Audio = btoa(
        String.fromCharCode(...new Uint8Array(audioBytes))
      );

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    inline_data: {
                      mime_type: audioFile.type || "audio/webm",
                      data: base64Audio,
                    },
                  },
                  {
                    text: "Transcribe this audio exactly as spoken. Return only the transcription text, nothing else.",
                  },
                ],
              },
            ],
          }),
        }
      );

      if (!response.ok) {
        const err = await response.text();
        return Response.json(
          { error: `Gemini API error: ${err}` },
          { status: response.status }
        );
      }

      const result = await response.json();
      transcript =
        result.candidates?.[0]?.content?.parts?.[0]?.text || "";
    }

    return Response.json({ transcript, provider });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
