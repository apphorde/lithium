import { parseArgs } from "./parse-args";
import compile from "./compile";
import publish from "./publish";

async function main() {
  const args = parseArgs();
  const command = args.args.shift();

  if (command === "compile") {
    compile(args);
    return;
  }

  if (command === "publish") {
    publish(args);
    return;
  }
}

main();
