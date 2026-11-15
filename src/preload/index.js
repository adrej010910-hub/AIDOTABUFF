const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("dotaAI", {
  getStatus: () => ipcRenderer.invoke("app:get-status"),
  getLatestMatch: () => ipcRenderer.invoke("match:get-latest"),
  getSettings: () => ipcRenderer.invoke("settings:get"),
  saveSettings: (settings) => ipcRenderer.invoke("settings:save", settings),
  sendChat: (content, history) => ipcRenderer.invoke("ai:chat", content, history),
  testAI: () => ipcRenderer.invoke("ai:test"),
  setupDota: (folder) => ipcRenderer.invoke("dota:setup", folder),
  openPath: (target) => ipcRenderer.invoke("shell:open-path", target),
  hide: () => ipcRenderer.send("overlay:hide"),
  show: () => ipcRenderer.send("overlay:show"),
  setMiniMode: (enabled) => ipcRenderer.send("window:set-mini", enabled),
  onMatchUpdate: (fn) => ipcRenderer.on("match:update", (_e, data) => fn(data)),
  onSetupStatus: (fn) => ipcRenderer.on("setup:status", (_e, data) => fn(data)),
  onNavigate: (fn) => ipcRenderer.on("navigate", (_e, page) => fn(page)),
  onDemo: (fn) => ipcRenderer.on("demo:show", fn),
  onMiniState: (fn) => ipcRenderer.on("window:mini-state", (_e, value) => fn(value))
});
