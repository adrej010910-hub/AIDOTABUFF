const { app, BrowserWindow, Tray, Menu, nativeImage, globalShortcut, ipcMain, shell, safeStorage } = require("electron");
const path = require("node:path");
const { createGsiServer } = require("../integrations/gsi-server");
const { findDotaInstall, installGsiConfig } = require("../integrations/dota-setup");
const { analyzeMatch } = require("../core/rules-engine");
const { loadSettings, saveSettings } = require("../core/settings");

const APP_ID = "com.dotaai.desktop";
const PORT = 3000;
const WINDOW_WIDTH = 1240;
const WINDOW_HEIGHT = 860;
let mainWindow;
let tray;
let gsiServer;
let latestState = null;
let settings;
let miniMode = false;
let bubbleMode = false;

app.setAppUserModelId(APP_ID);
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) app.quit();

function publicSettings() {
  const { apiKey, ...visible } = settings;
  return { ...visible, apiKeyConfigured: Boolean(apiKey), version: app.getVersion() };
}

function persistSettings() {
  const stored = { ...settings };
  delete stored.apiKey;
  if (settings.apiKey && safeStorage.isEncryptionAvailable()) {
    stored.apiKeyEncrypted = safeStorage.encryptString(settings.apiKey).toString("base64");
  }
  saveSettings(stored);
}

function makeWindow() {
  const appIcon = path.join(__dirname, "../../build/dota2.ico");
  mainWindow = new BrowserWindow({
    width: WINDOW_WIDTH,
    height: WINDOW_HEIGHT,
    minWidth: 760,
    minHeight: 600,
    useContentSize: true,
    show: false,
    frame: false,
    transparent: true,
    alwaysOnTop: settings.alwaysOnTop !== false,
    resizable: true,
    maximizable: true,
    fullscreenable: false,
    minimizable: true,
    skipTaskbar: false,
    icon: appIcon,
    backgroundColor: "#00000000",
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  mainWindow.setAlwaysOnTop(settings.alwaysOnTop !== false, "screen-saver");
  if (typeof settings.opacity === "number" && mainWindow.setOpacity) mainWindow.setOpacity(Math.min(1, Math.max(0.7, settings.opacity / 100)));
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

function setMiniMode(mode) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const bounds = mainWindow.getBounds();
  const target = mode === "bubble" ? "bubble" : mode ? "compact" : "full";
  const nextWidth = target === "bubble" ? 76 : target === "compact" ? 360 : WINDOW_WIDTH;
  const nextHeight = target === "bubble" ? 76 : target === "compact" ? 88 : WINDOW_HEIGHT;
  mainWindow.setMinimumSize(target === "full" ? 760 : nextWidth, target === "full" ? 600 : nextHeight);
  mainWindow.setMaximumSize(target === "full" ? 10000 : nextWidth, target === "full" ? 10000 : nextHeight);
  mainWindow.setSize(nextWidth, nextHeight);
  // Keep the window near its previous position and clamp it to the visible work area.
  const { screen } = require("electron");
  const display = screen.getDisplayMatching(bounds);
  const area = display.workArea;
  const x = Math.max(area.x, Math.min(bounds.x + bounds.width - nextWidth, area.x + area.width - nextWidth));
  const y = Math.max(area.y, Math.min(bounds.y, area.y + area.height - nextHeight));
  mainWindow.setPosition(x, y);
  miniMode = target !== "full";
  bubbleMode = target === "bubble";
  send("window:mini-state", { mini: miniMode, bubble: bubbleMode });
}

function createTray() {
  const iconPath = path.join(__dirname, "../../build/dota2.ico");
  const icon = nativeImage.createFromPath(iconPath);
  tray = new Tray(icon.isEmpty() ? nativeImage.createEmpty() : icon);
  tray.setToolTip("DOTA AI");
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: "Открыть DOTA AI", click: showOverlay },
    { label: "Показать компактное окно", click: () => { showOverlay(); setMiniMode(true); } },
    { type: "separator" },
    { label: "Настройки", click: () => { showOverlay(); send("navigate", "settings"); } },
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

function apiEndpoint() {
  const base = String(settings.apiBaseUrl || "https://api.openai.com/v1").trim().replace(/\/+$/, "");
  let parsed;
  try { parsed = new URL(base); } catch { throw new Error("Некорректный API Base URL."); }
  if (parsed.protocol !== "https:" && !["localhost", "127.0.0.1"].includes(parsed.hostname)) {
    throw new Error("Для внешнего API требуется защищённое HTTPS-подключение.");
  }
  return base.endsWith("/chat/completions") ? base : base + "/chat/completions";
}

async function requestAI(messages, mode = "chat") {
  if (!settings.apiKey) throw new Error("Сначала добавь API key в разделе Настройки.");
  const endpoint = apiEndpoint();
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer " + settings.apiKey
    },
    body: JSON.stringify({
      model: settings.aiModel || "gpt-4o-mini",
      temperature: 0.4,
      messages: [
        { role: "system", content: mode === "quick" ? "Ты DOTA AI Quick Coach — аналитик Dota 2. Отвечай на русском языке, по делу и с чёткими приоритетами. Анализируй драфт, синергию и контрпики, рекомендуй пик по позиции, следующие предметы с объяснением, прокачку, фарм-маршрут, перемещения, атаки, командные бои, Рошана, башни и защиту базы. Учитывай только переданные данные матча и известный контекст. Не выдумывай состояние здоровья, кулдауны, вижен, позиции врагов или текущие характеристики патча, если их нет во входных данных. Для рекомендаций по Рошану и объектам указывай условия безопасности и готовности команды. Если данных мало — перечисли, чего не хватает. Не управляй игрой и не предлагай автоматизацию игрового процесса." : "Ты DOTA AI — помощник по Dota 2. Отвечай на русском языке, структурированно и кратко. Помогай с выбором героев, предметами, способностями, ролями, стратегиями и анализом игровой ситуации. Не утверждай, что видишь данные матча, если они не переданы в сообщении. Уточняй патч и контекст, если они важны. Не управляй игрой и не предлагай автоматизацию игрового процесса." },
        ...messages
      ]
    }),
    signal: AbortSignal.timeout(35000)
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = payload?.error?.message || ("HTTP " + response.status);
    throw new Error("Ошибка AI API: " + detail);
  }
  const reply = payload?.choices?.[0]?.message?.content;
  if (typeof reply !== "string" || !reply.trim()) throw new Error("Провайдер вернул пустой ответ.");
  return { reply: reply.trim(), model: payload.model || settings.aiModel };
}

app.whenReady().then(async () => {
  const loaded = loadSettings();
  settings = { ...loaded };
  if (loaded.apiKeyEncrypted) {
    try {
      if (safeStorage.isEncryptionAvailable()) settings.apiKey = safeStorage.decryptString(Buffer.from(loaded.apiKeyEncrypted, "base64"));
    } catch { settings.apiKey = ""; }
  }
  delete settings.apiKeyEncrypted;
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
  settings: publicSettings(),
  dotaFound: Boolean(findDotaInstall())
}));
ipcMain.handle("match:get-latest", () => latestState ? { state: latestState, analysis: analyzeMatch(latestState) } : null);
ipcMain.handle("settings:get", () => publicSettings());
ipcMain.handle("settings:save", (_event, next = {}) => {
  const { apiKey, ...plainSettings } = next;
  settings = { ...settings, ...plainSettings };
  if (typeof apiKey === "string" && apiKey.trim()) {
    if (!safeStorage.isEncryptionAvailable()) throw new Error("Windows не предоставил безопасное хранилище. API key не сохранён.");
    settings.apiKey = apiKey.trim();
  }
  persistSettings();
  app.setLoginItemSettings({ openAtLogin: settings.launchAtLogin, enabled: true });
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.setAlwaysOnTop(settings.alwaysOnTop !== false, "screen-saver");
    if (typeof settings.opacity === "number" && mainWindow.setOpacity) mainWindow.setOpacity(Math.min(1, Math.max(0.7, settings.opacity / 100)));
  }
  return publicSettings();
});
ipcMain.handle("ai:chat", async (_event, content, previous = []) => {
  if (typeof content !== "string" || !content.trim() || content.length > 4000) throw new Error("Сообщение пустое или слишком длинное.");
  const safeHistory = Array.isArray(previous) ? previous.slice(-20).filter(m => ["user", "assistant"].includes(m.role) && typeof m.content === "string").map(m => ({ role: m.role, content: m.content.slice(0, 4000) })) : [];
  return requestAI([...safeHistory, { role: "user", content: content.trim() }]);
});
ipcMain.handle("ai:quick-help", async (_event, content) => {
  if (typeof content !== "string" || !content.trim() || content.length > 12000) throw new Error("Запрос пустой или слишком длинный.");
  return requestAI([{ role: "user", content: content.trim() }], "quick");
});
ipcMain.handle("ai:test", async () => {
  const result = await requestAI([{ role: "user", content: "Ответь одним словом: готово." }]);
  return { ok: true, message: "Подключение успешно · " + (result.model || settings.aiModel) };
});
ipcMain.handle("dota:setup", async (_event, folder) => {
  const target = folder || findDotaInstall();
  if (!target) return { ok: false, message: "Dota 2 не найдена. Установи игру через Steam или проверь путь установки." };
  return installGsiConfig(target);
});
ipcMain.handle("shell:open-path", (_event, target) => shell.openPath(target));
ipcMain.on("overlay:hide", () => mainWindow?.hide());
ipcMain.on("overlay:show", showOverlay);
ipcMain.on("window:set-mini", (_event, mode) => setMiniMode(mode));
