import { GlobalKeyboardListener } from "node-global-key-listener";
import chalk from "chalk";
import ora from "ora";
import config from "./config.js";
import { startRecording, stopRecording } from "./recorder.js";
import { transcribe } from "./transcribe.js";
import { formatText } from "./format.js";
import { outputText } from "./output.js";
import { syncTranscription } from "./sync.js";

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
  } catch (err) {
    spinner.fail(chalk.red(`Error: ${err.message}`));
  }
}
