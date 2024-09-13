import { parseSFC } from "@lithium/sfc";
import { readFileSync, writeFileSync } from "node:fs";
import type { Args } from "./parse-args.js";

export default async function (args: Args) {
  const [inputFile = "-", outputFile = "-"] = args.args;
  const source = inputFile === "-" ? Buffer.concat(await process.stdin.toArray()) : readFileSync(inputFile);
  const json = JSON.stringify(parseSFC(source.toString("utf8")));

  if (outputFile === "-") {
    return console.log(json);
  }

  writeFileSync(outputFile, json, "utf-8");
}
