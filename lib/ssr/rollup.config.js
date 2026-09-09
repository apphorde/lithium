const base = require('../../rollup-config.shared.js');
const config = base(__dirname);

// jsdom is a runtime dependency of this package — never bundle it.
config.external = [/@li3\/.*/, 'jsdom'];

module.exports = config;
