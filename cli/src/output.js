import clipboard from "clipboardy";
import { exec } from "child_process";
import { promisify } from "util";
import config from "./config.js";

const execAsync = promisify(exec);

export async function outputText(text) {
  const destination = config.get("destination");

  await clipboard.write(text);

  if (destination === "cursor") {
    await execAsync(
      `osascript -e 'tell application "System Events" to keystroke "v" using command down'`
    );
  }
}
