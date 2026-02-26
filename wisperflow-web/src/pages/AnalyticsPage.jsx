import { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Mic, Clock, Type, Globe } from "lucide-react";

const Transcription = base44.entities.Transcription;

export default function AnalyticsPage() {
  const [transcriptions, setTranscriptions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const data = await Transcription.list("-created_date", 500);
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
