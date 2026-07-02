(function (d, ns) {
  let script = d.querySelector('script[type="importmap"]');
  let map;

  if (!script) {
    script = d.createElement("script");
    script.type = "importmap";
    map = { imports: {} };
  } else {
    map = JSON.parse(script.textContent || '{}');
  }

  map.imports ||= {};

  if (map.imports[ns]) return;

  map.imports[ns] = "https://cdn.li3.dev/" + ns;

  script.innerHTML = JSON.stringify(map);

  const li3 = d.createElement("script");
  li3.type = "module";
  li3.async = true;
  li3.textContent = `import "${ns}web"`;

  d.head.insertBefore(script, d.currentScript);
  d.head.insertBefore(li3, d.currentScript);
})(document, "@li3/");
