import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Search, Copy, Trash2 } from "lucide-react";

const Transcription = base44.entities.Transcription;

export default function HistoryPage() {
  const [transcriptions, setTranscriptions] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTranscriptions();
  }, []);

  async function loadTranscriptions() {
    setLoading(true);
    const data = await Transcription.list("-created_date", 50);
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
    await Transcription.delete(id);
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
