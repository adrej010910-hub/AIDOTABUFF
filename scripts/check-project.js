const fs = require("node:fs");
const required = [
  "src/main/index.js", "src/preload/index.js",
  "src/integrations/gsi-server.js", "src/integrations/dota-setup.js",
  "src/core/rules-engine.js", "src/core/settings.js",
  "src/renderer/index.html", "src/renderer/style.css", "src/renderer/renderer.js",
  "src/overlay/index.html", "src/overlay/style.css", "src/overlay/overlay.js"
];
const missing = required.filter(file => !fs.existsSync(file));
if (missing.length) {
  console.error("Missing project files:", missing.join(", "));
  process.exit(1);
}
for (const file of required) {
  if (fs.statSync(file).size === 0) {
    console.error("Empty project file:", file);
    process.exit(1);
  }
}
console.log("DOTA AI project structure: OK (" + required.length + " files checked)");
