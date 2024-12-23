import { getOption, setOption } from "./layer-0/options.js";
import { domReady, tpl } from "./layer-1/dom.js";
import { mount } from "./layer-2/mount.js";

export * from "./layer-0/types.js";
export * from "./layer-0/options.js";
export * from "./layer-0/plugin.js";
export * from "./layer-0/reactive.js";
export * from "./layer-0/stack.js";

export * from "./layer-1/dom.js";
export * from "./layer-1/setup-api.js";
export * from "./layer-1/props.js";
export * from "./layer-1/inject.js";

export * from "./layer-2/custom-elements.js";
export * from "./layer-2/mount.js";

export * from "./layer-3/property-binding.plugin.js";
export * from "./layer-3/event-handler.plugin.js";
export * from "./layer-3/inject-resources.plugin.js";
export * from "./layer-3/set-class.plugin.js";
export * from "./layer-3/set-element-ref.plugin.js";
export * from "./layer-3/set-style.plugin.js";
export * from "./layer-3/template-for.plugin.js";
export * from "./layer-3/template-if.plugin.js";
export * from "./layer-3/text-template.plugin.js";

async function loadInitializer(init) {
  if (init.charAt(0) === "{" || init.charAt(0) === "[") {
    return () => JSON.parse(init);
  }

  if (window[init]) {
    return window[init];
  }

  try {
    const mod = await import(init);
    const setup = mod.setup || mod.default;

    if (typeof setup !== "function") {
      console.warn("Invalid setup module at " + init);
      throw new Error();
    }

    return setup;
  } catch {}

  return () => ({});
}

export async function bootstrap(node: HTMLElement) {
  const init = node.getAttribute("lit-app");
  const setup = await loadInitializer(init);

  mount(node, {
    template: tpl(node.innerHTML),
    setup: () => setup(),
  });
}

domReady(function () {
  document.querySelectorAll("[lit-app]").forEach(bootstrap);
});

window["Lithium"] = {
  setOption,
  getOption,
};
