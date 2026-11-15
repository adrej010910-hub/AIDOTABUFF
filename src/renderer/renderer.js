const $ = id => document.getElementById(id);
function navigate(page) {
  document.querySelectorAll(".page").forEach(el => el.classList.toggle("hidden", el.id !== page));
  document.querySelectorAll(".nav").forEach(el => el.classList.toggle("active", el.dataset.page === page));
}
document.querySelectorAll(".nav").forEach(btn => btn.addEventListener("click", () => navigate(btn.dataset.page)));
$("close").addEventListener("click", () => window.dotaAI.hide());
$("minimize").addEventListener("click", () => window.dotaAI.hide());

function renderMatch(data) {
  const a = data.analysis;
  $("connection").textContent = "LIVE";
  $("hero").textContent = a.hero;
  $("meta").textContent = `Матч · ${a.minutes}:${String(a.gameTime % 60).padStart(2,"0")}`;
  $("level").textContent = a.level || "—";
  $("kills").textContent = a.kills;
  $("deaths").textContent = a.deaths;
  $("assists").textContent = a.assists;
  $("gold").textContent = a.gold.toLocaleString("ru-RU");
  $("action").textContent = a.action.title;
  $("detail").textContent = a.action.detail;
  $("reason").textContent = a.action.reason;
  $("priority").textContent = a.action.priority === "high" ? "ВЫСОКИЙ ПРИОРИТЕТ" : "ОБЫЧНЫЙ ПРИОРИТЕТ";
  $("phase").textContent = a.phase;
  $("data").textContent = "GSI подключён";
}
window.dotaAI.onMatchUpdate(renderMatch);
window.dotaAI.onSetupStatus(data => {
  $("setupText").textContent = data.message;
});
window.dotaAI.onNavigate(navigate);
window.dotaAI.onDemo(() => {
  $("connection").textContent = "DEMO";
  $("hero").textContent = "Juggernaut";
  $("meta").textContent = "Демонстрационный сценарий";
  $("level").textContent = "14";
  $("kills").textContent = "5"; $("deaths").textContent = "2"; $("assists").textContent = "8"; $("gold").textContent = "2 450";
  $("action").textContent = "Проверь карту и сыграй с командой";
  $("detail").textContent = "Не начинай одиночную драку. Оцени готовность союзников и доступные объекты.";
  $("reason").textContent = "Это демонстрационные данные, не реальный матч.";
  $("phase").textContent = "Середина игры"; $("data").textContent = "Демо";
});
async function init() {
  const status = await window.dotaAI.getStatus();
  $("version").textContent = status.version;
  const settings = await window.dotaAI.getSettings();
  $("startup").checked = settings.launchAtLogin;
  $("showLaunch").checked = settings.showOnLaunch;
  $("voice").checked = settings.voiceEnabled;
  const latest = await window.dotaAI.getLatestMatch();
  if (latest) renderMatch(latest);
  $("setupText").textContent = status.dotaFound ? "Dota 2 обнаружена. Интеграция настраивается автоматически." : "Dota 2 пока не найдена. Можно указать путь позднее.";
}
async function save() {
  await window.dotaAI.saveSettings({
    launchAtLogin: $("startup").checked,
    showOnLaunch: $("showLaunch").checked,
    voiceEnabled: $("voice").checked
  });
}
["startup","showLaunch","voice"].forEach(id => $(id).addEventListener("change", save));
$("retrySetup").addEventListener("click", async () => {
  $("setupText").textContent = "Поиск и настройка...";
  const result = await window.dotaAI.setupDota();
  $("setupText").textContent = result.message;
});
init();