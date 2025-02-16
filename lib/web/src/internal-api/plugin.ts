export function createDispatcher(hookNames: string[]) {
  const hooks: Record<string, any[]> = {};

  return {
    reset() {
      for (const next of hookNames) {
        hooks[next] = [];
      }
    },

    use(plugin: object) {
      for (const next of hookNames) {
        if (plugin[next]) {
          hooks[next].push(plugin);
        }
      }
    },

    apply(hook: string, args: any[] = []) {
      const plugins = hooks[hook];
      for (const plugin of plugins) {
        plugin[hook](...args);
      }
    },
  };
}

export const plugins = createDispatcher(['setup', 'dom', 'element', 'attribute', 'init', 'update', 'destroy']);

plugins.reset();
