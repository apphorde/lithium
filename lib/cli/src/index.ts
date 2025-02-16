import { parseArgs } from './parse-args.js';
import compile from './compile.js';
import publish from './publish.js';

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

  throw new Error('Invalid command: ' + command);
}

main();
