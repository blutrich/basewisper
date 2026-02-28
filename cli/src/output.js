import clipboard from "clipboardy";
import { exec } from "child_process";
import { promisify } from "util";
import { platform } from "os";
import config from "./config.js";

const execAsync = promisify(exec);

export async function outputText(text) {
  const destination = config.get("destination");

  await clipboard.write(text);

  if (destination === "cursor") {
    if (platform() !== "darwin") {
      console.error("[wisperflow] Paste-to-cursor is only supported on macOS. Text copied to clipboard instead.");
    } else {
      await execAsync(
        `osascript -e 'tell application "System Events" to keystroke "v" using command down'`
      );
    }
  }
}
