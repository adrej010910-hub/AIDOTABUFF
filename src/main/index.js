const { app, BrowserWindow, Tray, Menu, nativeImage, globalShortcut, ipcMain, shell } = require("electron");
const path = require("node:path");
const { createGsiServer } = require("../integrations/gsi-server");
const { findDotaInstall, installGsiConfig } = require("../integrations/dota-setup");
const { analyzeMatch } = require("../core/rules-engine");
const { loadSettings, saveSettings } = require("../core/settings");

const APP_ID = "com.dotaai.desktop";
const PORT = 3000;
const WINDOW_WIDTH = 460;
const WINDOW_HEIGHT = 780;
let mainWindow;
let tray;
let gsiServer;
let latestState = null;
let settings;

app.setAppUserModelId(APP_ID);
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) app.quit();

function makeWindow() {
  mainWindow = new BrowserWindow({
    width: WINDOW_WIDTH,
    height: WINDOW_HEIGHT,
    minWidth: WINDOW_WIDTH,
    maxWidth: WINDOW_WIDTH,
    minHeight: WINDOW_HEIGHT,
    maxHeight: WINDOW_HEIGHT,
    useContentSize: true,
    show: false,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    maximizable: false,
    fullscreenable: false,
    minimizable: true,
    skipTaskbar: true,
    backgroundColor: "#00000000",
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  mainWindow.setAlwaysOnTop(true, "screen-saver");
  mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
  mainWindow.on("closed", () => { mainWindow = null; });
  if (!process.argv.includes("--hidden") && settings.showOnLaunch) {
    mainWindow.once("ready-to-show", () => mainWindow.show());
  }
}

function send(channel, payload) {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send(channel, payload);
}

function showOverlay() {
  if (!mainWindow) makeWindow();
  mainWindow.show();
  mainWindow.focus();
}

function createTray() {
  const iconPath = path.join(__dirname, "../../build/dota2-mark.svg");
  const icon = nativeImage.createFromPath(iconPath);
  tray = new Tray(icon.isEmpty() ? nativeImage.createEmpty() : icon);
  tray.setToolTip("DOTA AI");
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: "Открыть DOTA AI", click: showOverlay },
    { label: "Показать демо", click: () => send("demo:show") },
    { type: "separator" },
    { label: "Настройки подключения", click: () => send("navigate", "settings") },
    { label: "Выход", click: () => app.quit() }
  ]));
  tray.on("double-click", showOverlay);
}

async function setupDotaIntegration() {
  const install = findDotaInstall();
  if (!install) {
    send("setup:status", { ok: false, message: "Dota 2 не найдена. Укажи папку игры в настройках." });
    return;
  }
  const result = installGsiConfig(install);
  send("setup:status", { ok: result.ok, message: result.message, installPath: install });
}

function registerShortcuts() {
  globalShortcut.register("CommandOrControl+Shift+Space", () => {
    if (!mainWindow) return showOverlay();
    if (mainWindow.isVisible()) mainWindow.hide(); else showOverlay();
  });
}

app.whenReady().then(async () => {
  settings = loadSettings();
  makeWindow();
  createTray();
  registerShortcuts();
  gsiServer = createGsiServer(PORT, (state) => {
    latestState = state;
    const analysis = analyzeMatch(state);
    send("match:update", { state, analysis, receivedAt: Date.now() });
  });
  gsiServer.on("listening", setupDotaIntegration);
  app.setLoginItemSettings({ openAtLogin: settings.launchAtLogin, enabled: true });
});

app.on("second-instance", () => showOverlay());
app.on("activate", () => showOverlay());
app.on("will-quit", () => {
  globalShortcut.unregisterAll();
  gsiServer?.close();
});

ipcMain.handle("app:get-status", () => ({
  version: app.getVersion(),
  connected: Boolean(latestState),
  settings,
  dotaFound: Boolean(findDotaInstall())
}));
ipcMain.handle("match:get-latest", () => latestState ? { state: latestState, analysis: analyzeMatch(latestState) } : null);
ipcMain.handle("settings:get", () => settings);
ipcMain.handle("settings:save", (_event, next) => {
  settings = { ...settings, ...next };
  saveSettings(settings);
  app.setLoginItemSettings({ openAtLogin: settings.launchAtLogin, enabled: true });
  return settings;
});
ipcMain.handle("dota:setup", async (_event, folder) => {
  const target = folder || findDotaInstall();
  if (!target) return { ok: false, message: "Dota 2 не найдена. Установи игру через Steam или укажи путь вручную в следующей версии." };
  return installGsiConfig(target);
});
ipcMain.handle("shell:open-path", (_event, target) => shell.openPath(target));
ipcMain.on("overlay:hide", () => mainWindow?.hide());
ipcMain.on("overlay:show", showOverlay);
