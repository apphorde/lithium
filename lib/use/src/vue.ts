import { TemplateFor, use } from "@li3/web";

export function useVue() {
  class VueTemplateFor extends TemplateFor {
    match(_node, name) {
      return name === "v-for";
    }

    exec(node, _name, value, context) {
      const t = document.createElement("template");
      t.setAttribute("for", value);
      node.replaceWith(t);
      t.content.append(node);

      super.exec(t, "for", value, context);
    }
  }

  use(new VueTemplateFor());
}
