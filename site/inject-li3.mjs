import { JSX } from 'typedoc';

export function load(app) {
  app.renderer.hooks.on('body.end', () => {
    return JSX.createElement('div', {}, [
      JSX.createElement('script', { type: 'importmap' }, [
        { tag: JSX.Raw, props: { html: `{ "imports": { "@li3/": "https://cdn.li3.dev/@li3/" } }` } },
      ]),
      JSX.createElement('script', { type: 'module', src: 'https://cdn.li3.dev/@li3/web' }),
    ]);
  });
}
