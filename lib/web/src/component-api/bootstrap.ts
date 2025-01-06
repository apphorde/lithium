import { domReady, tpl } from "../internal-api/dom.js";
import { mount } from "../component-api/mount.js";

async function loadInitializer(init) {
  if (init.charAt(0) === "{" || init.charAt(0) === "[") {
    return () => JSON.parse(init);
  }

  if (window[init] && typeof window[init] === "function") {
    return window[init];
  }

  try {
    const mod = await import(new URL(init, location.href).toString());
    const setup = mod.setup || mod.default;

    if (typeof setup !== "function") {
      return () => {
        throw new Error("Invalid setup module at " + init);
      };
    }

    return setup;
  } catch {}

  return () => ({});
}

export async function bootstrap(node) {
  const init = node.getAttribute("lit-app");
  const setup = await loadInitializer(init);
  const template = node.querySelector("template") || tpl(node.innerHTML);

  return mount(node, {
    template,
    setup: () => setup(),
  });
}

domReady(function () {
  document.querySelectorAll("[lit-app]").forEach(bootstrap);
});
