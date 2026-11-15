const { contextBridge, ipcRenderer } = require("electron");
const subscribe = (channel, callback) => {
  if (typeof callback !== "function") return;
  const listener = (_event, payload) => callback(payload);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
};
contextBridge.exposeInMainWorld("dotaAI", {
  getStatus: () => ipcRenderer.invoke("app:get-status"),
  getLatestMatch: () => ipcRenderer.invoke("match:get-latest"),
  getSettings: () => ipcRenderer.invoke("settings:get"),
  saveSettings: (settings) => ipcRenderer.invoke("settings:save", settings),
  setupDota: () => ipcRenderer.invoke("dota:setup"),
  startSession: () => ipcRenderer.invoke("session:start"),
  endSession: () => ipcRenderer.invoke("session:end"),
  getSession: () => ipcRenderer.invoke("session:get"),
  hideOverlay: () => ipcRenderer.send("overlay:hide"),
  showOverlay: () => ipcRenderer.send("overlay:show"),
  setOverlayExpanded: (expanded) => ipcRenderer.send("overlay:expand", expanded),
  minimizeWindow: () => ipcRenderer.send("window:minimize"),
  onMatchUpdate: (fn) => subscribe("match:update", fn),
  onSetupStatus: (fn) => subscribe("setup:status", fn),
  onSessionState: (fn) => subscribe("session:state", fn),
  onConnectionState: (fn) => subscribe("connection:state", fn)
});
