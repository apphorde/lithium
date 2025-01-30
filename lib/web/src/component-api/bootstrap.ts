import { domReady } from "../internal-api/dom.js";
import { mount } from "../component-api/mount.js";
import { createInlineComponent, getComponentFromTemplate } from "./custom-elements";

export async function bootstrap(template: HTMLTemplateElement, spec) {
  const div = document.createElement('div');
  template.parentNode.insertBefore(div, template);

  return mount(div, spec);
}

domReady(function () {
  const inline: HTMLTemplateElement[] = Array.from(
    document.querySelectorAll("template[component]")
  );

  const apps: HTMLTemplateElement[] = Array.from(
    document.querySelectorAll("template[app]")
  );

  for (const template of inline) {
    createInlineComponent(template);
  }


  for (const template of apps) {
    getComponentFromTemplate(template).then((spec) => bootstrap(template, spec));
  }
});
