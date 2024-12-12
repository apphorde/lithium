import { RuntimeInternals } from "./types";

export class PluginDispatcher {
  private hooks: Record<string, any[]>;

  setHooks(hooks: string[]) {
    this.hooks = {};
    for (const next of hooks) {
      this.hooks[next] = [];
    }
  }

  use(plugin: object) {
    const hooks = Object.keys(this.hooks);

    for (const next of hooks) {
      if (plugin[next]) {
        this.hooks[next].push(plugin);
      }
    }
  }

  apply(hook: string, args: any[] = []) {
    const plugins = this.hooks[hook];
    for (const plugin of plugins) {
      plugin[hook](...args);
    }
  }
}

const plugins = new PluginDispatcher();
plugins.setHooks(["setup", "createDom", "applyAttribute", "init", "destroy"]);

export default plugins;
