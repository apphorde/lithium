import { TemplateFor, TemplateIf, SetProperty, AddEventListener, use } from '@li3/web';

export function useVue() {
  const vFor = 'v-for';
  const vIf = 'v-if';

  class VueTemplateFor extends TemplateFor {
    match(_node, name) {
      return name === vFor;
    }

    exec(node, _name, value, context) {
      const t = document.createElement('template');
      node.replaceWith(t);
      node.removeAttribute(vFor);
      t.content.append(node);

      super.exec(t, 'for', value, context);
    }
  }

  class VueTemplateIf extends TemplateIf {
    match(_node, name) {
      return name === vIf;
    }

    exec(node, _name, value, context) {
      const t = document.createElement('template');
      node.replaceWith(t);
      node.removeAttribute(vFor);
      t.content.append(node);

      super.exec(t, 'if', value, context);
    }
  }

  class VueSetProperty extends SetProperty {
    match(_node, name) {
      return name.at(0) === ':';
    }

    exec(node, name, value, context) {
      return super.exec(node, 'bind-' + name.slice(1), value, context);
    }
  }

  class VueEventListener extends AddEventListener {
    match(_node, name) {
      return name.at(0) === '@';
    }

    exec(node, name, value, context) {
      return super.exec(node, 'on-' + name.slice(1), value, context);
    }
  }

  use(new VueSetProperty());
  use(new VueTemplateFor());
  use(new VueTemplateIf());
  use(new VueEventListener());
}
