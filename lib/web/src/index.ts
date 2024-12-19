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

domReady(function () {
  document.querySelectorAll("[lit-app]").forEach((node) => {
    mount(node, {
      template: tpl(node.outerHTML),
      setup() {
        const init = node.getAttribute("lit-app");
        return init ? JSON.parse(init) : {};
      },
    });
  });
});

window["Lithium"] = {
  setOption,
  getOption,
};
