# @li3/web

Browser APIs used to declare Li3 components

## Feature flags

| Feature              | Description                                             | Default |
| -------------------- | ------------------------------------------------------- | ------- |
| debugEnabled         | Enable debug logs and throw exceptions                  | false   |
| useModuleExpressions | Use URL and import() to create expresions as modules    | false   |
| cachedTemplateFor    | Optimize DOM manipulation of template[for] with a cache | false   |

Set `window.name` to `debug` in any page to enable debugging on spot.
The name persists after a page reload.
