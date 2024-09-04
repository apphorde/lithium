import typescript from "@rollup/plugin-typescript";
import resolve from "@rollup/plugin-node-resolve";
import json from "@rollup/plugin-json";

export default {
  input: "./index.ts",
  external: ["@lithium/*"],
  output: {
    dir: ".",
    format: "es",
  },
  plugins: [json(), typescript({ module: "esnext" }), resolve()],
};
