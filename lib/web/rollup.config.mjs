import base from "../../rollup-config.shared.mjs";

export default {
  ...base,
  external: ["@lithium/reactive", "@lithium/html-parser"],
};
