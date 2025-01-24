import { load, highlight } from "https://highlight.jsfn.run/index.mjs";
import { defineProps, defineQuery, onInit } from "@li3/web";

load();

export default function codeBlock({ element }) {
  const props = defineProps(["language"]);
  const pre = defineQuery("pre");
  const template = defineQuery("template");
  const source = (pre.one || template.one || element).innerHTML.trim() || "";
  const slot = defineQuery("slot");
  const lines = source.split("\n");
  const padding = lines
    .filter((line) => line && line.startsWith(" "))
    .reduce(
      (prev, line) => Math.min(prev, line.indexOf(line.trim())),
      lines[0].length
    );
  const toReplace = " ".repeat(padding);
  const trimmedSource = lines
    .map((line) => line.replace(toReplace, ""))
    .join("\n");

  onInit(async () => {
    slot.one.innerHTML = await highlight(trimmedSource, {
      language: props.language || "html",
    });
  });
}
