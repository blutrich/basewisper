import Conf from "conf";

const config = new Conf({
  projectName: "wisperflow",
  schema: {
    base44Token: { type: "string", default: "" },
    base44AppId: { type: "string", default: "" },
    hotkey: { type: "string", default: "RIGHT ALT" },
    sttProvider: { type: "string", default: "whisper" },
    apiKeyWhisper: { type: "string", default: "" },
    apiKeyGemini: { type: "string", default: "" },
    language: { type: "string", default: "auto" },
    destination: { type: "string", default: "cursor" },
    formattingMode: { type: "string", default: "smart" },
  },
});

export default config;
