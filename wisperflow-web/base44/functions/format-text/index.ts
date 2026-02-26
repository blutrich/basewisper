import { createClientFromRequest } from "npm:@base44/sdk";

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { raw_text, mode } = await req.json();

    if (!raw_text) {
      return Response.json(
        { error: "raw_text is required" },
        { status: 400 }
      );
    }

    if (mode === "raw") {
      return Response.json({
        formatted_text: raw_text,
        context_type: "general",
      });
    }

    const prompt =
      mode === "clean"
        ? `Clean up this dictated text. Remove filler words (um, uh, like, you know), fix punctuation and capitalization. Keep the meaning identical. Return ONLY the cleaned text:\n\n${raw_text}`
        : `You are a smart text formatter for voice dictation. Clean up and format this dictated text:
1. Remove filler words (um, uh, eh, like, you know, so, basically)
2. Fix punctuation, capitalization, and grammar
3. Detect the context and format appropriately:
   - If it sounds like code/programming: format as a code comment or technical description
   - If it sounds like an email: format with proper greeting/closing
   - If it sounds like a chat message: keep it casual but clean
   - If it sounds like a command/instruction: format as clear imperative
   - Otherwise: format as general text
4. Return a JSON object with two fields:
   - "text": the formatted text
   - "context": one of "code", "email", "chat", "command", "general"

Dictated text: ${raw_text}`;

    const response = await base44.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema:
        mode === "smart"
          ? {
              type: "object",
              properties: {
                text: { type: "string" },
                context: {
                  type: "string",
                  enum: ["code", "email", "chat", "command", "general"],
                },
              },
            }
          : undefined,
    });

    if (mode === "smart" && typeof response === "object") {
      return Response.json({
        formatted_text: response.text,
        context_type: response.context,
      });
    }

    return Response.json({
      formatted_text: typeof response === "string" ? response : raw_text,
      context_type: "general",
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
