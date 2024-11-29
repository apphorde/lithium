const typescript = require("@rollup/plugin-typescript");
const resolve = require("@rollup/plugin-node-resolve");
const json = require("@rollup/plugin-json");
const terser = require("@rollup/plugin-terser");
const { join } = require("path");

module.exports = (projectRoot) => ({
  input: join(projectRoot, "index.ts"),
  external: [/@lithium\/.*/],
  output: {
    dir: projectRoot,
    format: "esm",
  },
  plugins: [
    typescript({
      tsconfig: join(projectRoot, "tsconfig.json"),
      exclude: ["**/*.spec.ts"],
    }),
    json(),
    resolve(),
    terser({
      compress: true,
      ecma: 2020,
      module: true,
    }),
  ],
});
