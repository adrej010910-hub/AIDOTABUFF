const { app, BrowserWindow, screen, globalShortcut, ipcMain, Tray, Menu, nativeImage, desktopCapturer, dialog } = require("electron");
const path = require("node:path");
const { createGsiServer } = require("../integrations/gsi-server");
const { findDotaInstall, installGsiConfig } = require("../integrations/dota-setup");
const { analyzeMatch } = require("../core/rules-engine");
const { loadSettings, saveSettings } = require("../core/settings");

const APP_ID = "com.dotaai.desktop";
const PORT = 3000;
let mainWindow = null, overlayWindow = null, gsiServer = null, latestState = null, settings = null, sessionActive = false, tray = null, isQuitting = false;
app.setAppUserModelId(APP_ID);
if (!app.requestSingleInstanceLock()) app.quit();

function sendTo(win, channel, payload) {
  if (win && !win.isDestroyed()) win.webContents.send(channel, payload);
}
function broadcast(channel, payload) {
  sendTo(mainWindow, channel, payload);
  sendTo(overlayWindow, channel, payload);
}
function currentMatch() {
  return latestState ? { state: latestState, analysis: analyzeMatch(latestState), receivedAt: Date.now() } : null;
}
function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1040, height: 650, minWidth: 760, minHeight: 520,
    show: false, frame: true, autoHideMenuBar: true,
    backgroundColor: "#0b0d14", title: "DOTA AI",
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js"),
      contextIsolation: true, nodeIntegration: false, sandbox: true
    }
  });
  mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
  mainWindow.once("ready-to-show", () => {
    if (settings.showOnLaunch || !app.getLoginItemSettings().wasOpenedAtLogin) mainWindow.show();
  });
  mainWindow.on("close", (event) => {
    if (!isQuitting) { event.preventDefault(); mainWindow.hide(); }
  });
  mainWindow.on("closed", () => { mainWindow = null; });
}
function createOverlayWindow() {
  if (overlayWindow && !overlayWindow.isDestroyed()) return overlayWindow;
  const area = screen.getPrimaryDisplay().workArea;
  overlayWindow = new BrowserWindow({
    width: 760, height: 76, minWidth: 650, minHeight: 76, maxWidth: 900, maxHeight: 360,
    x: Math.max(area.x + 12, area.x + Math.floor((area.width - 760) / 2)), y: area.y + 90,
    show: false, frame: false, transparent: true, resizable: true, movable: true,
    skipTaskbar: true, alwaysOnTop: true, hasShadow: true, backgroundColor: "#00000000",
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js"),
      contextIsolation: true, nodeIntegration: false, sandbox: true
    }
  });
  overlayWindow.setAlwaysOnTop(true, "screen-saver");
  overlayWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  overlayWindow.loadFile(path.join(__dirname, "../overlay/index.html"));
  overlayWindow.on("closed", () => {
    overlayWindow = null;
    if (sessionActive) { sessionActive = false; broadcast("session:state", { active: false }); }
  });
  overlayWindow.webContents.once("did-finish-load", () => {
    sendTo(overlayWindow, "match:update", currentMatch());
    sendTo(overlayWindow, "session:state", { active: sessionActive });
  });
  return overlayWindow;
}

function createTray() {
  const iconData = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAATUlEQVR4nGNgGAWjAA0ctrP6T0s86oBRB5DtgP/vXxOFRx0w4A4g5BiqOYAYdaMOGHXAqANo6oABLwcGbUk4fB1ALTzqgMHvgFEw4gAAsGHdHsEIzQ0AAAAASUVORK5CYII=";
  tray = new Tray(nativeImage.createFromDataURL(iconData));
  tray.setToolTip("DOTA AI");
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: "Открыть DOTA AI", click: () => { mainWindow?.show(); mainWindow?.focus(); } },
    { label: "Начать игровую сессию", click: startSession },
    { label: "Завершить игровую сессию", click: endSession },
    { type: "separator" },
    { label: "Выход", click: () => app.quit() }
  ]));
  tray.on("double-click", () => { mainWindow?.show(); mainWindow?.focus(); });
}

function startSession() {
  sessionActive = true;
  const win = createOverlayWindow();
  win.show();
  win.setAlwaysOnTop(true, "screen-saver");
  sendTo(win, "match:update", currentMatch());
  broadcast("session:state", { active: true });
  return { active: true, message: latestState ? "Игровая сессия активна. Получаем данные матча." : "Плашка активна. Ожидаем подключение Dota 2." };
}
function endSession() {
  sessionActive = false;
  if (overlayWindow && !overlayWindow.isDestroyed()) overlayWindow.close();
  broadcast("session:state", { active: false });
  return { active: false };
}
function setupDotaIntegration() {
  const install = findDotaInstall();
  if (!install) {
    broadcast("setup:status", { ok: false, message: "Dota 2 не найдена автоматически. Проверь библиотеку Steam." });
    return;
  }
  broadcast("setup:status", { ...installGsiConfig(install), installPath: install });
}
app.whenReady().then(() => {
  settings = loadSettings();
  createMainWindow();
  createTray();
  gsiServer = createGsiServer(PORT, (state) => {
    latestState = state;
    broadcast("match:update", currentMatch());
    broadcast("connection:state", { connected: true });
  });
  gsiServer.on("listening", setupDotaIntegration);
  app.setLoginItemSettings({
    openAtLogin: Boolean(settings.launchAtLogin), openAsHidden: !settings.showOnLaunch,
    path: process.execPath, args: ["--hidden"]
  });
  globalShortcut.register("CommandOrControl+Shift+Space", () => {
    if (!sessionActive || !overlayWindow || overlayWindow.isDestroyed()) return;
    if (overlayWindow.isVisible()) overlayWindow.hide();
    else { overlayWindow.show(); overlayWindow.setAlwaysOnTop(true, "screen-saver"); }
  });
});
app.on("second-instance", () => { if (!mainWindow) createMainWindow(); mainWindow?.show(); mainWindow?.focus(); });
app.on("activate", () => { if (!mainWindow) createMainWindow(); mainWindow?.show(); });
app.on("before-quit", () => { isQuitting = true; });
app.on("will-quit", () => { globalShortcut.unregisterAll(); gsiServer?.close(); tray?.destroy(); });
app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });

ipcMain.handle("app:get-status", () => ({
  version: app.getVersion(), connected: Boolean(latestState), sessionActive,
  dotaFound: Boolean(findDotaInstall()), settings
}));
ipcMain.handle("match:get-latest", () => currentMatch());
ipcMain.handle("settings:get", () => settings);
ipcMain.handle("settings:save", (_event, next) => {
  settings = { ...settings, ...next };
  saveSettings(settings);
  app.setLoginItemSettings({
    openAtLogin: Boolean(settings.launchAtLogin), openAsHidden: !settings.showOnLaunch,
    path: process.execPath, args: ["--hidden"]
  });
  return settings;
});
ipcMain.handle("dota:setup", () => {
  const target = findDotaInstall();
  if (!target) return { ok: false, message: "Dota 2 не найдена. Установи игру через Steam и повтори поиск." };
  return installGsiConfig(target);
});
ipcMain.handle("session:start", () => startSession());
ipcMain.handle("session:end", () => endSession());
ipcMain.handle("session:get", () => ({ active: sessionActive }));
ipcMain.on("overlay:hide", () => overlayWindow?.hide());
ipcMain.on("overlay:show", () => {
  if (!sessionActive) return;
  const win = createOverlayWindow(); win.show(); win.setAlwaysOnTop(true, "screen-saver");
});
ipcMain.on("overlay:expand", (_event, expanded) => {
  if (overlayWindow && !overlayWindow.isDestroyed()) overlayWindow.setSize(760, expanded ? 300 : 76);
});
ipcMain.on("app:open-main", () => { if (!mainWindow) createMainWindow(); mainWindow.show(); mainWindow.focus(); });
ipcMain.on("app:quit", () => app.quit());
ipcMain.handle("screen:capture", async () => {
  const display = screen.getPrimaryDisplay();
  const sources = await desktopCapturer.getSources({ types: ["screen"], thumbnailSize: { width: display.size.width, height: display.size.height } });
  const source = sources.find(item => item.display_id === String(display.id)) || sources[0];
  if (!source) throw new Error("Экран не найден");
  const result = await dialog.showSaveDialog(mainWindow || overlayWindow, { defaultPath: "DOTA-AI-screenshot.png", filters: [{ name: "PNG image", extensions: ["png"] }] });
  if (result.canceled || !result.filePath) return { canceled: true };
  require("node:fs").writeFileSync(result.filePath, source.thumbnail.toPNG());
  return { canceled: false, filePath: result.filePath };
});
ipcMain.on("window:minimize", () => mainWindow?.minimize());
