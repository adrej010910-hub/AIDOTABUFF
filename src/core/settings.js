const fs = require("node:fs");
const path = require("node:path");
const { app } = require("electron");

const file = () => path.join(app.getPath("userData"), "settings.json");
const defaults = { launchAtLogin: true, showOnLaunch: false, voiceEnabled: false, aiMode: "hybrid" };

function loadSettings() {
  try { return { ...defaults, ...JSON.parse(fs.readFileSync(file(), "utf8")) }; }
  catch { return { ...defaults }; }
}
function saveSettings(settings) {
  fs.mkdirSync(path.dirname(file()), { recursive: true });
  fs.writeFileSync(file(), JSON.stringify(settings, null, 2), "utf8");
}
module.exports = { loadSettings, saveSettings };