// Metro 0.83+ uses Array.prototype.toReversed (ES2023, Node 20+). Expo SDK 54 expects Node >= 20.19.4;
// this unblocks dev on older Node until you switch (e.g. nvm use / conda install nodejs=20).
if (typeof Array.prototype.toReversed !== "function") {
  Object.defineProperty(Array.prototype, "toReversed", {
    value: function toReversed() {
      return [...this].reverse();
    },
    configurable: true,
    writable: true,
  });
}

const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

config.watchFolders = [monorepoRoot];
// Resolve packages from the app first, then the monorepo root (hoisted deps).
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(monorepoRoot, "node_modules"),
];

module.exports = config;
