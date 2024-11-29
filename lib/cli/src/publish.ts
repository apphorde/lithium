import { getComponentCode } from "@lithium/sfc";
import { readFileSync } from "node:fs";
import type { Args } from "./parse-args.js";

const publishUrl = process.env.PUBLISH_REGISTRY;
const publishToken = process.env.PUBLISH_TOKEN;
const types = ['component', 'library'];

export default async function publish(args: Args) {
  const [inputFile = "-"] = args.args;
  const { scope, name, version = "0.0.0", type = '' } = args.options;

  if (types.includes(String(type)) === false) {
    throw new Error('Invalid type! Must be one of: ' + types.join(', '));
  }

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

  const sfc = JSON.parse(source);
  const code = getComponentCode(name, sfc);

  const req = await fetch(new URL(`${type}/${scope}/${name}@${version}`, publishUrl), {
    body: code,
    method: "POST",
    headers: { Authorization: publishToken },
  });

  if (!req.ok) {
    throw new Error('Failed to publish ' + name + ': ' + req.statusText);
  }
}
