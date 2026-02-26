#!/usr/bin/env node
import { Command } from "commander";
import chalk from "chalk";
import config from "./config.js";

const program = new Command();

program
  .name("wisperflow")
  .description("Voice dictation CLI -- hold a key, speak, text appears")
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

program.parse();
