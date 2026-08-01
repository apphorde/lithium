(function (d, ns, c, u) {
  const url = u + ns;
  let map = d.querySelector('script[type="importmap"]');

  if (map) {
    throw new Error(`A previous import map was found. Add a line with "${ns}": "${url}" to the existing map.`)
  }

  map = d.createElement("script");
  map.type = "importmap";
  map.innerHTML = JSON.stringify({ imports: { [ns]: url } });

  const li3 = d.createElement("script");
  li3.type = "module";
  li3.async = true;
  li3.textContent = `import "${ns}web"`;

  const p = c.parentNode;
  p.insertBefore(map, c);
  p.insertBefore(li3, c);
})(document, "@li3/", document.currentScript, "https://cdn.li3.dev/");
