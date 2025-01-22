import {
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

function autoTableOfContent() {
  const links = ref([]);

  function navigateTo(id) {
    document.getElementById(id).scrollIntoView({ behavior: "smooth" });
  }

  onInit(function () {
    links.value = [...document.querySelectorAll("section[id]")].map(
      (section) => {
        const text = section.querySelector("h2").textContent.trim();
        return { id: section.id, text };
      }
    );
  });

  return { navigateTo, links };
}

createComponent("code-block", {
  template: `<div class="bg-white rounded-lg px-4 py-6 my-6 shadow-lg w-full border">
  <div class="text-gray-800 font-mono whitespace-pre overflow-x-auto"><slot></slot></div>
  </div>`,
  setup: codeBlock,
});

createComponent("auto-toc", {
  template: `<div class="flex items-center justify-stretch p-1 border rounded-lg text-sm shadow-sm mt-2 whitespace-nowrap bg-white">
    <template for="link of links">
    <a class="w-full text-center p-2 text-blue-500 font-medium" bind-href="'#' + link.id" on-click.prevent="navigateTo(link.id)">{{link.text}}</a>
    </template>
  </div>`,
  setup: autoTableOfContent,
});

createComponent("feature-card", {
  template: `<div class="p-8 rounded-xl bg-white shadow-lg hover:shadow-xl transition-shadow border">
        <div class="text-4xl mb-4"><slot name="icon"></slot></div>
        <h3 class="text-xl font-bold text-gray-800 mb-4"><slot name="title"></slot></h3>
        <p class="text-gray-600"><slot></slot></p>
      </div>`,
});
