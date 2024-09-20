import { parseArgs } from "./src/parse-args.js";
import compile from "./src/compile.js";
import publish from "./src/publish.js";

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
