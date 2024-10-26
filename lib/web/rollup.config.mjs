import base from "../../rollup-config.shared.mjs";
import mod from "./package.json" assert { type: "json" };

export default {
  ...base,
  external: Object.keys(mod.dependencies),
};
