import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
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

const UserSettings = base44.entities.UserSettings;

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
    const data = await UserSettings.list("-created_date", 1);
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
      await UserSettings.update(settingsId, payload);
    } else {
      const created = await UserSettings.create(payload);
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
