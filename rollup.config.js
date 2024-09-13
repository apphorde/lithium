import typescript from "@rollup/plugin-typescript";
import resolve from "@rollup/plugin-node-resolve";
import json from "@rollup/plugin-json";
import terser from "@rollup/plugin-terser";

export default {
  input: "index.ts",
  external: [],
  output: {
    dir: ".",
    format: "es",
  },
  plugins: [
    json(),
    typescript({ module: "esnext", exclude: ["**/*.spec.ts"] }),
    resolve(),
    terser({
      compress: true,
      ecma: 2020,
      module: true,
    }),
  ],
};
