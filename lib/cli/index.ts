import { parseArgs } from "./parse-args";
import compile from "./compile";

async function main() {
  const args = parseArgs();
  const command = args.args.shift();

  if (command === "compile") {
    compile(args);
    return;
  }
}

main();
