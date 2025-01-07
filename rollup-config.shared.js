const typescript = require("@rollup/plugin-typescript");
const resolve = require("@rollup/plugin-node-resolve");
const json = require("@rollup/plugin-json");
const terser = require("@rollup/plugin-terser");
const { join } = require("path");

module.exports = (projectRoot) => ({
  input: join(projectRoot, "src", "index.ts"),
  external: [/@li3\/.*/],
  output: {
    dir: projectRoot,
    format: "esm",
  },
  plugins: [
    resolve(),
    typescript({
      tsconfig: join(projectRoot, "tsconfig.json"),
      exclude: ["**/*.spec.ts"],
      noEmit: false,
      declaration: true,
    }),
    json(),
    terser({
      compress: true,
      ecma: 2020,
      module: true,
    }),
  ],
});
