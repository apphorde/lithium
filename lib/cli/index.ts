import { parseArgs } from "./src/parse-args.js";
import compile from "./src/compile.js";
import publish from "./src/publish.js";

const commands = {
  compile,
  publish,
};

async function main() {
  const args = parseArgs();
  const command = args.args.shift();
  const executor = commands[command];

  if (executor) {
    try {
      await executor(args);
    } catch (error) {
      console.error(String(error));
      process.exit(1);
    }
    return;
  }

  throw new Error("Invalid command: " + command);
}

main();
