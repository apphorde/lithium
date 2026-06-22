(function (d, ns) {
  const script =
    d.querySelector('script[type="importmap"]') || d.createElement("script");

  const map = JSON.parse(script.textContent || '{"imports":{}}');
  map.imports ||= {};

  if (map.imports[ns]) return;

  map.imports[ns] = "https://cdn.li3.dev/" + ns;

  const li3 = d.createElement("script");
  li3.type = "module";
  li3.async = true;
  li3.textContent = `import "${ns}web"`;

  d.head.insertBefore(d.currentScript, li3);
})(document, "@li3/");
