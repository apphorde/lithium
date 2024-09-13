import { parseArgs } from "./parse-args.js";
import compile from "./compile.js";

async function main() {
  const args = parseArgs();
  const command = args.args.shift();

  if (command === "compile") {
    compile(args);
    return;
  }
}

main();
