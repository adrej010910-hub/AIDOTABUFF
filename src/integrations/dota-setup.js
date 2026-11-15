const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");

const CFG_NAME = "gamestate_integration_dota_ai.cfg";

function parseSteamLibraries(vdfText) {
  const results = [];
  const regex = /"path"\s+"([^"]+)"/g;
  let match;
  while ((match = regex.exec(vdfText))) results.push(match[1].replace(/\\\\/g, "\\"));
  return results;
}

function findDotaInstall() {
  const candidates = [];
  const pf86 = process.env["PROGRAMFILES(X86)"] || "C:\\Program Files (x86)";
  const pf = process.env.PROGRAMFILES || "C:\\Program Files";
  candidates.push(path.join(pf86, "Steam", "steamapps", "common", "dota 2 beta"));
  candidates.push(path.join(pf, "Steam", "steamapps", "common", "dota 2 beta"));
  const steamRoots = [
    path.join(pf86, "Steam"),
    path.join(pf, "Steam"),
    path.join(os.homedir(), ".steam", "steam")
  ];
  for (const root of steamRoots) {
    const vdf = path.join(root, "steamapps", "libraryfolders.vdf");
    try {
      for (const library of parseSteamLibraries(fs.readFileSync(vdf, "utf8"))) {
        candidates.push(path.join(library, "steamapps", "common", "dota 2 beta"));
      }
    } catch {}
  }
  return candidates.find(p => fs.existsSync(path.join(p, "game", "dota"))) || null;
}

function installGsiConfig(dotaPath) {
  try {
    if (!dotaPath || !fs.existsSync(path.join(dotaPath, "game", "dota"))) {
      return { ok: false, message: "Папка Dota 2 не найдена или указана неверно." };
    }
    const targetDir = path.join(dotaPath, "game", "dota", "cfg", "gamestate_integration");
    fs.mkdirSync(targetDir, { recursive: true });
    const target = path.join(targetDir, CFG_NAME);
    if (fs.existsSync(target)) {
      const backup = target + ".backup-" + Date.now();
      fs.copyFileSync(target, backup);
    }
    const config = `"DOTA AI"
{
  "uri" "http://127.0.0.1:3000/"
  "timeout" "5.0"
  "buffer" "0.1"
  "throttle" "0.1"
  "heartbeat" "30.0"
  "data"
  {
    "provider" "1"
    "map" "1"
    "player" "1"
    "hero" "1"
    "abilities" "1"
    "items" "1"
    "draft" "1"
  }
}`;
    fs.writeFileSync(target, config, "utf8");
    return { ok: true, message: "Интеграция GSI настроена. Перезапусти Dota 2, если она уже была запущена.", configPath: target };
  } catch (error) {
    return { ok: false, message: "Не удалось записать GSI-файл: " + error.message };
  }
}

module.exports = { findDotaInstall, installGsiConfig, parseSteamLibraries };