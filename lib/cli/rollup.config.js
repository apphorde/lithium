const { withNx } = require("@nx/rollup/with-nx");
const c = require("../../rollup-config.shared.js");

module.exports = withNx(
  {
    ...c.withNx,
  },
  {
    ...c.extras,
  }
);
