# WisperFlow Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a CLI-first voice dictation tool with a Base44 web dashboard for history, settings, and analytics.

**Architecture:** Two packages — (1) `wisperflow` CLI (Node.js, npm global install) handles hotkey → record → STT → format → paste, and syncs to Base44. (2) Base44 web app (Vite + React + Tailwind + shadcn/ui) provides history, settings, and analytics UI. Backend functions on Base44 handle STT proxying and smart formatting.

**Tech Stack:**
- CLI: Node.js, `node-global-key-listener` (hotkey), `node-record-lpcm16` (mic), `clipboardy` (clipboard), `robotjs` or AppleScript (paste simulation), `@base44/sdk`
- Web: Vite + React + TailwindCSS + shadcn/ui (via `backend-and-client` template)
- Backend: Base44 functions (Deno), OpenAI Whisper API, Google Gemini API
- Data: Base44 entities (Transcription, UserSettings)

---

## Task 1: Initialize Base44 Project

**Files:**
- Create: `wisperflow-web/` (full Base44 project via CLI template)

**Step 1: Create Base44 project with backend-and-client template**

```bash
cd /Users/oferbl/Desktop/Dev/wisperbase
npx base44 create wisperflow-web -p ./wisperflow-web -t backend-and-client
```

**Step 2: Verify project structure**

```bash
ls wisperflow-web/base44/
```

Expected: `config.jsonc`, `entities/`, `functions/`, `.app.jsonc`

**Step 3: Install dependencies and verify dev server works**

```bash
cd wisperflow-web
npm install
npm run dev
```

Expected: Vite dev server starts on localhost

**Step 4: Commit**

```bash
cd /Users/oferbl/Desktop/Dev/wisperbase
git init
git add wisperflow-web/
git commit -m "feat: initialize Base44 project with backend-and-client template"
```

---

## Task 2: Define Base44 Entities

**Files:**
- Create: `wisperflow-web/base44/entities/transcription.jsonc`
- Create: `wisperflow-web/base44/entities/user-settings.jsonc`

**Step 1: Create Transcription entity schema**

Create `wisperflow-web/base44/entities/transcription.jsonc`:

```jsonc
{
  "name": "Transcription",
  "type": "object",
  "properties": {
    "raw_text": {
      "type": "string",
      "description": "Raw transcript from STT before formatting"
    },
    "formatted_text": {
      "type": "string",
      "description": "Text after smart formatting/cleanup"
    },
    "language": {
      "type": "string",
      "description": "Detected language code (e.g. en, he)"
    },
    "duration_ms": {
      "type": "number",
      "description": "Duration of audio recording in milliseconds"
    },
    "word_count": {
      "type": "number",
      "description": "Number of words in formatted text"
    },
    "destination": {
      "type": "string",
      "enum": ["clipboard", "cursor"],
      "default": "clipboard",
      "description": "Where the text was pasted"
    },
    "stt_provider": {
      "type": "string",
      "enum": ["whisper", "gemini"],
      "description": "Which STT provider was used"
    },
    "context_type": {
      "type": "string",
      "enum": ["general", "code", "email", "chat", "command"],
      "default": "general",
      "description": "Detected context type for smart formatting"
    }
  },
  "required": ["raw_text", "formatted_text"],
  "rls": {
    "create": true,
    "read": { "created_by": "{{user.email}}" },
    "update": { "created_by": "{{user.email}}" },
    "delete": { "created_by": "{{user.email}}" }
  }
}
```

**Step 2: Create UserSettings entity schema**

Create `wisperflow-web/base44/entities/user-settings.jsonc`:

```jsonc
{
  "name": "UserSettings",
  "type": "object",
  "properties": {
    "hotkey": {
      "type": "string",
      "default": "RightAlt",
      "description": "Key to hold for recording"
    },
    "language": {
      "type": "string",
      "default": "auto",
      "description": "Preferred language for transcription (auto = auto-detect)"
    },
    "stt_provider": {
      "type": "string",
      "enum": ["whisper", "gemini"],
      "default": "whisper",
      "description": "Preferred STT API provider"
    },
    "api_key_whisper": {
      "type": "string",
      "description": "OpenAI API key for Whisper"
    },
    "api_key_gemini": {
      "type": "string",
      "description": "Google Gemini API key"
    },
    "default_destination": {
      "type": "string",
      "enum": ["clipboard", "cursor"],
      "default": "cursor",
      "description": "Default output destination"
    },
    "formatting_mode": {
      "type": "string",
      "enum": ["raw", "clean", "smart"],
      "default": "smart",
      "description": "Level of AI post-processing on transcripts"
    }
  },
  "required": [],
  "rls": {
    "create": true,
    "read": { "created_by": "{{user.email}}" },
    "update": { "created_by": "{{user.email}}" },
    "delete": { "created_by": "{{user.email}}" }
  }
}
```

**Step 3: Push entities to Base44**

```bash
cd wisperflow-web
npx base44 entities push
```

Expected: Both entities created successfully.

**Step 4: Commit**

```bash
cd /Users/oferbl/Desktop/Dev/wisperbase
git add wisperflow-web/base44/entities/
git commit -m "feat: add Transcription and UserSettings entity schemas"
```

---

## Task 3: Create Backend Functions — Transcribe & Format

**Files:**
- Create: `wisperflow-web/base44/functions/transcribe-audio/function.jsonc`
- Create: `wisperflow-web/base44/functions/transcribe-audio/index.ts`
- Create: `wisperflow-web/base44/functions/format-text/function.jsonc`
- Create: `wisperflow-web/base44/functions/format-text/index.ts`

**Step 1: Create transcribe-audio function config**

Create `wisperflow-web/base44/functions/transcribe-audio/function.jsonc`:

```jsonc
{
  "name": "transcribe-audio",
  "entry": "index.ts"
}
```

**Step 2: Create transcribe-audio function implementation**

Create `wisperflow-web/base44/functions/transcribe-audio/index.ts`:

```typescript
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
```

**Step 3: Create format-text function config**

Create `wisperflow-web/base44/functions/format-text/function.jsonc`:

```jsonc
{
  "name": "format-text",
  "entry": "index.ts"
}
```

**Step 4: Create format-text function implementation**

Create `wisperflow-web/base44/functions/format-text/index.ts`:

```typescript
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
```

**Step 5: Deploy functions to Base44**

```bash
cd wisperflow-web
npx base44 functions deploy
```

Expected: Both functions deployed successfully.

**Step 6: Commit**

```bash
cd /Users/oferbl/Desktop/Dev/wisperbase
git add wisperflow-web/base44/functions/
git commit -m "feat: add transcribe-audio and format-text backend functions"
```

---

## Task 4: Build Web UI — Layout & Navigation

**Files:**
- Modify: `wisperflow-web/src/App.jsx` (or create if template differs)
- Create: `wisperflow-web/src/pages/HistoryPage.jsx`
- Create: `wisperflow-web/src/pages/SettingsPage.jsx`
- Create: `wisperflow-web/src/pages/AnalyticsPage.jsx`
- Create: `wisperflow-web/src/components/Layout.jsx`

**Step 1: Check existing template structure**

```bash
ls wisperflow-web/src/
cat wisperflow-web/src/App.jsx
```

Understand the template's routing and layout patterns before modifying.

**Step 2: Create Layout component with sidebar navigation**

Create `wisperflow-web/src/components/Layout.jsx`:

```jsx
import { Link, useLocation } from "react-router-dom";
import { History, Settings, BarChart3, Mic } from "lucide-react";

const navItems = [
  { path: "/", label: "History", icon: History },
  { path: "/analytics", label: "Analytics", icon: BarChart3 },
  { path: "/settings", label: "Settings", icon: Settings },
];

export default function Layout({ children }) {
  const location = useLocation();

  return (
    <div className="min-h-screen bg-background flex">
      <aside className="w-56 border-r bg-muted/30 p-4 flex flex-col gap-1">
        <div className="flex items-center gap-2 px-3 py-2 mb-4">
          <Mic className="w-5 h-5 text-primary" />
          <span className="font-semibold text-lg">WisperFlow</span>
        </div>
        {navItems.map(({ path, label, icon: Icon }) => (
          <Link
            key={path}
            to={path}
            className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
              location.pathname === path
                ? "bg-primary text-primary-foreground"
                : "hover:bg-muted"
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </Link>
        ))}
      </aside>
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
```

**Step 3: Create stub pages**

Create `wisperflow-web/src/pages/HistoryPage.jsx`:

```jsx
export default function HistoryPage() {
  return <div><h1 className="text-2xl font-bold">Transcription History</h1></div>;
}
```

Create `wisperflow-web/src/pages/SettingsPage.jsx`:

```jsx
export default function SettingsPage() {
  return <div><h1 className="text-2xl font-bold">Settings</h1></div>;
}
```

Create `wisperflow-web/src/pages/AnalyticsPage.jsx`:

```jsx
export default function AnalyticsPage() {
  return <div><h1 className="text-2xl font-bold">Analytics</h1></div>;
}
```

**Step 4: Wire up routing in App.jsx**

Update `App.jsx` to use React Router with the Layout and three pages. Wrap routes in auth protection using `base44.auth.me()`.

**Step 5: Verify dev server renders correctly**

```bash
cd wisperflow-web && npm run dev
```

Expected: App loads with sidebar, three pages navigate correctly.

**Step 6: Commit**

```bash
cd /Users/oferbl/Desktop/Dev/wisperbase
git add wisperflow-web/src/
git commit -m "feat: add layout with sidebar navigation and stub pages"
```

---

## Task 5: Build Web UI — History Page

**Files:**
- Modify: `wisperflow-web/src/pages/HistoryPage.jsx`

**Step 1: Implement History page with transcription list**

Update `wisperflow-web/src/pages/HistoryPage.jsx`:

```jsx
import { useState, useEffect } from "react";
import base44 from "../api/base44Client";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Search, Copy, Trash2 } from "lucide-react";

export default function HistoryPage() {
  const [transcriptions, setTranscriptions] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTranscriptions();
  }, []);

  async function loadTranscriptions() {
    setLoading(true);
    const data = await base44.entities.Transcription.list("-created_date", 50);
    setTranscriptions(data);
    setLoading(false);
  }

  const filtered = transcriptions.filter(
    (t) =>
      t.formatted_text?.toLowerCase().includes(search.toLowerCase()) ||
      t.raw_text?.toLowerCase().includes(search.toLowerCase())
  );

  async function copyText(text) {
    await navigator.clipboard.writeText(text);
  }

  async function deleteTranscription(id) {
    await base44.entities.Transcription.delete(id);
    setTranscriptions((prev) => prev.filter((t) => t.id !== id));
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Transcription History</h1>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search transcriptions..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>
      {loading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : filtered.length === 0 ? (
        <p className="text-muted-foreground">No transcriptions yet. Start dictating with the CLI!</p>
      ) : (
        <div className="space-y-3">
          {filtered.map((t) => (
            <div key={t.id} className="border rounded-lg p-4 space-y-2">
              <div className="flex items-start justify-between gap-4">
                <p className="flex-1">{t.formatted_text}</p>
                <div className="flex gap-1 shrink-0">
                  <Button size="icon" variant="ghost" onClick={() => copyText(t.formatted_text)}>
                    <Copy className="w-4 h-4" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => deleteTranscription(t.id)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              <div className="flex gap-2 text-xs text-muted-foreground">
                <Badge variant="secondary">{t.context_type || "general"}</Badge>
                <Badge variant="outline">{t.stt_provider || "whisper"}</Badge>
                <span>{t.word_count || 0} words</span>
                <span>{t.duration_ms ? `${(t.duration_ms / 1000).toFixed(1)}s` : ""}</span>
                <span>{new Date(t.created_date).toLocaleString()}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

**Step 2: Verify page renders with empty state**

Open browser, navigate to History page. Should show "No transcriptions yet" message.

**Step 3: Commit**

```bash
git add wisperflow-web/src/pages/HistoryPage.jsx
git commit -m "feat: implement History page with search, copy, and delete"
```

---

## Task 6: Build Web UI — Settings Page

**Files:**
- Modify: `wisperflow-web/src/pages/SettingsPage.jsx`

**Step 1: Implement Settings page**

Update `wisperflow-web/src/pages/SettingsPage.jsx`:

```jsx
import { useState, useEffect } from "react";
import base44 from "../api/base44Client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Save } from "lucide-react";

const DEFAULTS = {
  hotkey: "RightAlt",
  language: "auto",
  stt_provider: "whisper",
  default_destination: "cursor",
  formatting_mode: "smart",
  api_key_whisper: "",
  api_key_gemini: "",
};

export default function SettingsPage() {
  const [settings, setSettings] = useState(DEFAULTS);
  const [settingsId, setSettingsId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    const data = await base44.entities.UserSettings.list("-created_date", 1);
    if (data.length > 0) {
      setSettings({ ...DEFAULTS, ...data[0] });
      setSettingsId(data[0].id);
    }
  }

  async function saveSettings() {
    setSaving(true);
    const payload = { ...settings };
    delete payload.id;
    delete payload.created_date;
    delete payload.updated_date;
    delete payload.created_by;

    if (settingsId) {
      await base44.entities.UserSettings.update(settingsId, payload);
    } else {
      const created = await base44.entities.UserSettings.create(payload);
      setSettingsId(created.id);
    }
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function update(field, value) {
    setSettings((prev) => ({ ...prev, [field]: value }));
  }

  return (
    <div className="space-y-6 max-w-lg">
      <h1 className="text-2xl font-bold">Settings</h1>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Hotkey (hold to record)</Label>
          <Input
            value={settings.hotkey}
            onChange={(e) => update("hotkey", e.target.value)}
            placeholder="e.g. RightAlt, F13, CapsLock"
          />
        </div>

        <div className="space-y-2">
          <Label>Language</Label>
          <Select value={settings.language} onValueChange={(v) => update("language", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="auto">Auto-detect</SelectItem>
              <SelectItem value="en">English</SelectItem>
              <SelectItem value="he">Hebrew</SelectItem>
              <SelectItem value="es">Spanish</SelectItem>
              <SelectItem value="fr">French</SelectItem>
              <SelectItem value="de">German</SelectItem>
              <SelectItem value="ar">Arabic</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>STT Provider</Label>
          <Select value={settings.stt_provider} onValueChange={(v) => update("stt_provider", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="whisper">OpenAI Whisper</SelectItem>
              <SelectItem value="gemini">Google Gemini</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>OpenAI API Key</Label>
          <Input
            type="password"
            value={settings.api_key_whisper}
            onChange={(e) => update("api_key_whisper", e.target.value)}
            placeholder="sk-..."
          />
        </div>

        <div className="space-y-2">
          <Label>Gemini API Key</Label>
          <Input
            type="password"
            value={settings.api_key_gemini}
            onChange={(e) => update("api_key_gemini", e.target.value)}
            placeholder="AI..."
          />
        </div>

        <div className="space-y-2">
          <Label>Default Destination</Label>
          <Select value={settings.default_destination} onValueChange={(v) => update("default_destination", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="cursor">Active cursor (paste)</SelectItem>
              <SelectItem value="clipboard">Clipboard only</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Formatting Mode</Label>
          <Select value={settings.formatting_mode} onValueChange={(v) => update("formatting_mode", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="raw">Raw (no processing)</SelectItem>
              <SelectItem value="clean">Clean (remove fillers, fix punctuation)</SelectItem>
              <SelectItem value="smart">Smart (context-aware formatting)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button onClick={saveSettings} disabled={saving}>
          <Save className="w-4 h-4 mr-2" />
          {saving ? "Saving..." : saved ? "Saved!" : "Save Settings"}
        </Button>
      </div>
    </div>
  );
}
```

**Step 2: Verify Settings page renders and saves**

Open browser, go to Settings, change a value, click Save. Reload page — value should persist.

**Step 3: Commit**

```bash
git add wisperflow-web/src/pages/SettingsPage.jsx
git commit -m "feat: implement Settings page with all configuration options"
```

---

## Task 7: Build Web UI — Analytics Page

**Files:**
- Modify: `wisperflow-web/src/pages/AnalyticsPage.jsx`

**Step 1: Implement Analytics page**

Update `wisperflow-web/src/pages/AnalyticsPage.jsx`:

```jsx
import { useState, useEffect, useMemo } from "react";
import base44 from "../api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Mic, Clock, Type, Globe } from "lucide-react";

export default function AnalyticsPage() {
  const [transcriptions, setTranscriptions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const data = await base44.entities.Transcription.list("-created_date", 500);
      setTranscriptions(data);
      setLoading(false);
    }
    load();
  }, []);

  const stats = useMemo(() => {
    if (!transcriptions.length) return null;

    const totalWords = transcriptions.reduce((sum, t) => sum + (t.word_count || 0), 0);
    const totalDuration = transcriptions.reduce((sum, t) => sum + (t.duration_ms || 0), 0);
    const avgWPM =
      totalDuration > 0
        ? Math.round((totalWords / (totalDuration / 60000)) * 10) / 10
        : 0;

    const byLanguage = {};
    transcriptions.forEach((t) => {
      const lang = t.language || "unknown";
      byLanguage[lang] = (byLanguage[lang] || 0) + 1;
    });

    const byContext = {};
    transcriptions.forEach((t) => {
      const ctx = t.context_type || "general";
      byContext[ctx] = (byContext[ctx] || 0) + 1;
    });

    const byDay = {};
    transcriptions.forEach((t) => {
      const day = new Date(t.created_date).toLocaleDateString();
      byDay[day] = (byDay[day] || 0) + (t.word_count || 0);
    });

    return {
      totalTranscriptions: transcriptions.length,
      totalWords,
      totalDuration,
      avgWPM,
      byLanguage,
      byContext,
      byDay,
    };
  }, [transcriptions]);

  if (loading) return <p className="text-muted-foreground">Loading analytics...</p>;
  if (!stats) return <p className="text-muted-foreground">No data yet. Start dictating!</p>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Analytics</h1>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
              <Mic className="w-4 h-4" /> Total Sessions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{stats.totalTranscriptions}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
              <Type className="w-4 h-4" /> Total Words
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{stats.totalWords.toLocaleString()}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
              <Clock className="w-4 h-4" /> Total Time
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">
              {Math.round(stats.totalDuration / 60000)}m
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
              <Globe className="w-4 h-4" /> Avg WPM
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{stats.avgWPM}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">By Language</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {Object.entries(stats.byLanguage)
                .sort((a, b) => b[1] - a[1])
                .map(([lang, count]) => (
                  <div key={lang} className="flex justify-between text-sm">
                    <span>{lang}</span>
                    <span className="text-muted-foreground">{count}</span>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">By Context</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {Object.entries(stats.byContext)
                .sort((a, b) => b[1] - a[1])
                .map(([ctx, count]) => (
                  <div key={ctx} className="flex justify-between text-sm">
                    <span className="capitalize">{ctx}</span>
                    <span className="text-muted-foreground">{count}</span>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Words Per Day</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            {Object.entries(stats.byDay)
              .sort((a, b) => new Date(b[0]) - new Date(a[0]))
              .slice(0, 14)
              .map(([day, words]) => (
                <div key={day} className="flex justify-between text-sm">
                  <span>{day}</span>
                  <div className="flex items-center gap-2">
                    <div
                      className="h-2 bg-primary rounded"
                      style={{
                        width: `${Math.min(
                          200,
                          (words / Math.max(...Object.values(stats.byDay))) * 200
                        )}px`,
                      }}
                    />
                    <span className="text-muted-foreground w-16 text-right">{words}</span>
                  </div>
                </div>
              ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
```

**Step 2: Verify Analytics page renders**

Open browser, navigate to Analytics. Should show "No data yet" or computed stats.

**Step 3: Commit**

```bash
git add wisperflow-web/src/pages/AnalyticsPage.jsx
git commit -m "feat: implement Analytics page with stats cards and breakdowns"
```

---

## Task 8: Build & Deploy Web UI to Base44

**Files:**
- No new files

**Step 1: Build the web app**

```bash
cd wisperflow-web
npm run build
```

Expected: Build succeeds, output in `dist/`

**Step 2: Deploy everything to Base44**

```bash
npx base44 deploy -y
```

Expected: Entities pushed, functions deployed, site deployed. Returns a live URL.

**Step 3: Verify live app works**

Open the deployed URL. Login, navigate all three pages, verify they render.

**Step 4: Commit**

```bash
cd /Users/oferbl/Desktop/Dev/wisperbase
git add .
git commit -m "feat: build and deploy web UI to Base44 hosting"
```

---

## Task 9: Initialize CLI Package

**Files:**
- Create: `cli/package.json`
- Create: `cli/src/index.js`
- Create: `cli/src/config.js`

**Step 1: Create CLI package structure**

```bash
mkdir -p /Users/oferbl/Desktop/Dev/wisperbase/cli/src
```

**Step 2: Create package.json**

Create `cli/package.json`:

```json
{
  "name": "wisperflow",
  "version": "0.1.0",
  "description": "CLI voice dictation tool — hold a key, speak, release, text appears",
  "type": "module",
  "bin": {
    "wisperflow": "./src/index.js"
  },
  "scripts": {
    "start": "node src/index.js start"
  },
  "dependencies": {
    "@base44/sdk": "latest",
    "clipboardy": "^4.0.0",
    "commander": "^12.0.0",
    "node-global-key-listener": "^0.3.0",
    "node-record-lpcm16": "^1.0.1",
    "conf": "^12.0.0",
    "chalk": "^5.3.0",
    "ora": "^8.0.0"
  }
}
```

**Step 3: Create config module**

Create `cli/src/config.js`:

```javascript
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
```

**Step 4: Create CLI entry point with setup command**

Create `cli/src/index.js`:

```javascript
#!/usr/bin/env node
import { Command } from "commander";
import chalk from "chalk";
import config from "./config.js";

const program = new Command();

program
  .name("wisperflow")
  .description("Voice dictation CLI — hold a key, speak, text appears")
  .version("0.1.0");

program
  .command("setup")
  .description("Configure WisperFlow (API keys, hotkey, preferences)")
  .action(async () => {
    console.log(chalk.bold("\nWisperFlow Setup\n"));

    const readline = await import("readline");
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    const ask = (q) => new Promise((r) => rl.question(q, r));

    const provider = await ask(
      `STT Provider [${config.get("sttProvider")}] (whisper/gemini): `
    );
    if (provider) config.set("sttProvider", provider);

    if (config.get("sttProvider") === "whisper") {
      const key = await ask("OpenAI API Key: ");
      if (key) config.set("apiKeyWhisper", key);
    } else {
      const key = await ask("Gemini API Key: ");
      if (key) config.set("apiKeyGemini", key);
    }

    const hotkey = await ask(
      `Hotkey [${config.get("hotkey")}] (e.g. RIGHT ALT, F13): `
    );
    if (hotkey) config.set("hotkey", hotkey);

    const dest = await ask(
      `Default destination [${config.get("destination")}] (cursor/clipboard): `
    );
    if (dest) config.set("destination", dest);

    rl.close();
    console.log(chalk.green("\nSetup complete! Run `wisperflow start` to begin.\n"));
  });

program
  .command("start")
  .description("Start listening for hotkey to dictate")
  .action(async () => {
    console.log(chalk.bold("\nWisperFlow"));
    console.log(
      chalk.dim(`Hold [${config.get("hotkey")}] to record, release to transcribe\n`)
    );
    console.log(chalk.dim("Press Ctrl+C to quit\n"));

    // Dynamic import to avoid loading native modules at parse time
    const { startListener } = await import("./listener.js");
    startListener();
  });

program
  .command("config")
  .description("Show current configuration")
  .action(() => {
    console.log(chalk.bold("\nCurrent Configuration:\n"));
    console.log(`  Hotkey:       ${config.get("hotkey")}`);
    console.log(`  Provider:     ${config.get("sttProvider")}`);
    console.log(`  Language:     ${config.get("language")}`);
    console.log(`  Destination:  ${config.get("destination")}`);
    console.log(`  Formatting:   ${config.get("formattingMode")}`);
    console.log(
      `  Whisper Key:  ${config.get("apiKeyWhisper") ? "***configured***" : "not set"}`
    );
    console.log(
      `  Gemini Key:   ${config.get("apiKeyGemini") ? "***configured***" : "not set"}`
    );
    console.log();
  });

program.parse();
```

**Step 5: Install CLI dependencies**

```bash
cd /Users/oferbl/Desktop/Dev/wisperbase/cli
npm install
```

**Step 6: Test setup and config commands**

```bash
node src/index.js config
node src/index.js --help
```

Expected: Config shows defaults, help shows all three commands.

**Step 7: Commit**

```bash
cd /Users/oferbl/Desktop/Dev/wisperbase
git add cli/
git commit -m "feat: initialize CLI package with setup and config commands"
```

---

## Task 10: Build CLI — Hotkey Listener & Audio Recording

**Files:**
- Create: `cli/src/listener.js`
- Create: `cli/src/recorder.js`

**Step 1: Create the audio recorder module**

Create `cli/src/recorder.js`:

```javascript
import record from "node-record-lpcm16";

let recording = null;
let audioChunks = [];

export function startRecording() {
  audioChunks = [];

  recording = record.record({
    sampleRate: 16000,
    channels: 1,
    audioType: "wav",
    recorder: "sox", // requires SoX installed: brew install sox
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
```

**Step 2: Create the hotkey listener module**

Create `cli/src/listener.js`:

```javascript
import { GlobalKeyboardListener } from "node-global-key-listener";
import chalk from "chalk";
import ora from "ora";
import config from "./config.js";
import { startRecording, stopRecording } from "./recorder.js";
import { transcribe } from "./transcribe.js";
import { formatText } from "./format.js";
import { outputText } from "./output.js";

export function startListener() {
  const keyboard = new GlobalKeyboardListener();
  const hotkey = config.get("hotkey");
  let isRecording = false;
  let recordStartTime = null;

  keyboard.addListener((event, down) => {
    const keyName = event.name;

    if (keyName === hotkey && event.state === "DOWN" && !isRecording) {
      isRecording = true;
      recordStartTime = Date.now();
      process.stdout.write(chalk.red("  ● Recording..."));
      startRecording();
    }

    if (keyName === hotkey && event.state === "UP" && isRecording) {
      isRecording = false;
      const durationMs = Date.now() - recordStartTime;
      process.stdout.clearLine(0);
      process.stdout.cursorTo(0);

      const spinner = ora("Processing...").start();

      const audioBuffer = stopRecording();
      processAudio(audioBuffer, durationMs, spinner);
    }
  });
}

async function processAudio(audioBuffer, durationMs, spinner) {
  try {
    if (audioBuffer.length < 1000) {
      spinner.warn("Recording too short, skipped.");
      return;
    }

    spinner.text = "Transcribing...";
    const rawText = await transcribe(audioBuffer);

    if (!rawText || rawText.trim().length === 0) {
      spinner.warn("No speech detected.");
      return;
    }

    spinner.text = "Formatting...";
    const { formatted_text, context_type } = await formatText(rawText);

    spinner.text = "Outputting...";
    await outputText(formatted_text);

    spinner.succeed(
      chalk.green(`${formatted_text.slice(0, 60)}${formatted_text.length > 60 ? "..." : ""}`) +
        chalk.dim(` [${context_type}, ${(durationMs / 1000).toFixed(1)}s]`)
    );
  } catch (err) {
    spinner.fail(chalk.red(`Error: ${err.message}`));
  }
}
```

**Step 3: Commit**

```bash
cd /Users/oferbl/Desktop/Dev/wisperbase
git add cli/src/listener.js cli/src/recorder.js
git commit -m "feat: add hotkey listener and audio recording modules"
```

---

## Task 11: Build CLI — Transcription & Formatting & Output

**Files:**
- Create: `cli/src/transcribe.js`
- Create: `cli/src/format.js`
- Create: `cli/src/output.js`

**Step 1: Create transcription module**

Create `cli/src/transcribe.js`:

```javascript
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
```

**Step 2: Create formatting module**

Create `cli/src/format.js`:

```javascript
import config from "./config.js";

export async function formatText(rawText) {
  const mode = config.get("formattingMode");

  if (mode === "raw") {
    return { formatted_text: rawText, context_type: "general" };
  }

  // Use the STT provider's LLM for formatting (avoids extra API key)
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
```

**Step 3: Create output module**

Create `cli/src/output.js`:

```javascript
import clipboard from "clipboardy";
import { exec } from "child_process";
import { promisify } from "util";
import config from "./config.js";

const execAsync = promisify(exec);

export async function outputText(text) {
  const destination = config.get("destination");

  // Always copy to clipboard
  await clipboard.write(text);

  if (destination === "cursor") {
    // Simulate Cmd+V paste on macOS
    await execAsync(
      `osascript -e 'tell application "System Events" to keystroke "v" using command down'`
    );
  }
}
```

**Step 4: Test the full CLI flow**

Ensure SoX is installed:
```bash
brew install sox
```

Then test:
```bash
cd /Users/oferbl/Desktop/Dev/wisperbase/cli
node src/index.js setup
node src/index.js start
```

Hold the configured hotkey, speak, release. Verify text appears.

**Step 5: Commit**

```bash
cd /Users/oferbl/Desktop/Dev/wisperbase
git add cli/src/transcribe.js cli/src/format.js cli/src/output.js
git commit -m "feat: add transcription, formatting, and output modules to CLI"
```

---

## Task 12: CLI — Sync Transcriptions to Base44

**Files:**
- Create: `cli/src/sync.js`
- Modify: `cli/src/listener.js` (add sync call after successful transcription)

**Step 1: Create sync module**

Create `cli/src/sync.js`:

```javascript
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
  if (!base44) return; // Silently skip if not configured

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
    // Don't block CLI flow on sync errors
    console.error(`Sync error: ${err.message}`);
  }
}
```

**Step 2: Update listener.js to call sync after successful transcription**

In `cli/src/listener.js`, add import and sync call inside `processAudio` after `outputText`:

```javascript
// Add import at top
import { syncTranscription } from "./sync.js";

// Add after outputText() call in processAudio:
syncTranscription({
  raw_text: rawText,
  formatted_text,
  language: config.get("language"),
  duration_ms: durationMs,
  word_count: formatted_text.split(/\s+/).length,
  destination: config.get("destination"),
  stt_provider: config.get("sttProvider"),
  context_type,
});
```

**Step 3: Add `login` command to CLI for Base44 auth**

Add to `cli/src/index.js` before `program.parse()`:

```javascript
program
  .command("login")
  .description("Connect to Base44 for history sync")
  .requiredOption("--app-id <id>", "Base44 App ID")
  .requiredOption("--token <token>", "Base44 auth token")
  .action(({ appId, token }) => {
    config.set("base44AppId", appId);
    config.set("base44Token", token);
    console.log(chalk.green("Base44 connected! Transcriptions will sync to dashboard."));
  });
```

**Step 4: Test sync**

```bash
node src/index.js login --app-id YOUR_APP_ID --token YOUR_TOKEN
node src/index.js start
```

Dictate something, then check the Base44 web UI History page for the entry.

**Step 5: Commit**

```bash
cd /Users/oferbl/Desktop/Dev/wisperbase
git add cli/
git commit -m "feat: add Base44 sync for transcription history"
```

---

## Task 13: Final Integration Test & Deploy

**Files:**
- No new files

**Step 1: Rebuild and deploy web UI**

```bash
cd /Users/oferbl/Desktop/Dev/wisperbase/wisperflow-web
npm run build
npx base44 deploy -y
```

**Step 2: Full end-to-end test**

1. Open the deployed web UI, go to Settings, configure API keys
2. Run `wisperflow start` in terminal
3. Hold hotkey, speak, release
4. Verify: text appears at cursor/clipboard
5. Verify: transcription appears in web UI History
6. Verify: Analytics page updates with new data

**Step 3: Link CLI globally for easy access**

```bash
cd /Users/oferbl/Desktop/Dev/wisperbase/cli
npm link
```

Now `wisperflow` is available globally.

**Step 4: Final commit**

```bash
cd /Users/oferbl/Desktop/Dev/wisperbase
git add .
git commit -m "feat: complete WisperFlow v0.1 — CLI + Base44 web dashboard"
```

---

## Summary

| Task | Description | Estimated Steps |
|------|-------------|-----------------|
| 1 | Initialize Base44 project | 4 |
| 2 | Define entities (Transcription, UserSettings) | 4 |
| 3 | Backend functions (transcribe, format) | 6 |
| 4 | Web UI layout & navigation | 6 |
| 5 | History page | 3 |
| 6 | Settings page | 3 |
| 7 | Analytics page | 3 |
| 8 | Build & deploy web UI | 4 |
| 9 | Initialize CLI package | 7 |
| 10 | CLI hotkey listener & audio recording | 3 |
| 11 | CLI transcription, formatting, output | 5 |
| 12 | CLI sync to Base44 | 5 |
| 13 | Integration test & deploy | 4 |
| **Total** | | **57 steps** |
