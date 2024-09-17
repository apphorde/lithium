import type { Args } from "./parse-args";
import { readFileSync } from "node:fs";

const publishUrl = process.env.PUBLISH_REGISTRY;
const publishToken = process.env.PUBLISH_TOKEN;

export default async function publish(args: Args) {
  const [inputFile = "-"] = args.args;
  const { scope, name, version = "latest" } = args.options;
  const source = (
    inputFile === "-"
      ? Buffer.concat(await process.stdin.toArray())
      : readFileSync(inputFile)
  ).toString("utf8");

  if (!publishUrl) {
    throw new Error("PUBLISH_REGISTRY is missing in environment");
  }

  if (!publishToken) {
    throw new Error("PUBLISH_TOKEN is missing in environment");
  }

  if (!scope) {
    throw new Error("Scope is missing");
  }

  if (!name) {
    throw new Error("Name is missing");
  }

  if (!source.trim()) {
    throw new Error("Empty source");
  }

  return fetch(new URL(`${scope}/${name}@${version}`, publishUrl), {
    body: source,
    method: "POST",
    headers: { Authorization: publishToken },
  });
}
