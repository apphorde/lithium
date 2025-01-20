import {
  onInit,
  ref,
  tpl,
  defineProps,
  defineQuery,
  onInit,
  createComponent,
} from "@li3/web";
import { load, highlight } from "https://highlight.jsfn.run/index.mjs";

load();

function codeBlock({ element }) {
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

const template = tpl`<div class="bg-white rounded-lg px-4 py-2 mt-6 shadow-lg w-full border">
  <div class="text-gray-800 font-mono whitespace-pre overflow-x-auto"><slot></slot></div>
</div>`;

createComponent("code-block", { setup: codeBlock, template });

createComponent("auto-toc", {
  template: `<nav class="flex flex-col w-64 sticky right-0 z-10 bg-white p-4 border rounded-lg">
    <template for="link of links"><a class="w-full p-2 text-blue-500 font-medium" bind-href="'#' + link.id">{{link.text}}</a></template>
  </nav>`,
  setup() {
    const links = ref([]);

    onInit(function () {
      links.value = [...document.querySelectorAll("section[id]")].map(
        (section) => {
          const text = section.querySelector("h2").textContent.trim();
          return { id: section.id, text };
        }
      );
    });

    return { links };
  },
});
