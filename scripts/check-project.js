const fs = require("node:fs");
const required = [
  "src/main/index.js", "src/preload/index.js", "src/integrations/gsi-server.js",
  "src/integrations/dota-setup.js", "src/core/rules-engine.js",
  "src/renderer/index.html", "src/renderer/renderer.js", "src/overlay/index.html", "src/overlay/overlay.js"
];
const missing = required.filter(file => !fs.existsSync(file));
if (missing.length) {
  console.error("Missing files:", missing.join(", "));
  process.exit(1);
}
console.log("DOTA AI project structure: OK");