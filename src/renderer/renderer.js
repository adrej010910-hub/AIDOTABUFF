const $ = (id) => document.getElementById(id);
function navigate(page) {
  document.querySelectorAll(".page").forEach((el) => el.classList.toggle("hidden", el.id !== page));
  document.querySelectorAll("[data-page]").forEach((el) => el.classList.toggle("active", el.dataset.page === page));
  const titles = {dashboard:["Обзор","Центр управления игровой сессией"],coach:["AI Coach","Тактические рекомендации"],heroes:["Герои","Подготовка и игровые заметки"],analytics:["Аналитика","Показатели текущего матча"],settings:["Настройки","Параметры приложения и подключения"]};
  if (titles[page]) { $("pageTitle").textContent=titles[page][0]; $("pageSubtitle").textContent=titles[page][1]; }
}
document.querySelectorAll("[data-page]").forEach((btn)=>btn.addEventListener("click",()=>navigate(btn.dataset.page)));
function setConnection(connected) {
  $("connectionPill").innerHTML = '<i id="connectionDot"></i>' + (connected ? "ИГРА ПОДКЛЮЧЕНА" : "ОЖИДАНИЕ ИГРЫ");
  $("connectionPill").classList.toggle("online",Boolean(connected));
  $("connectionDot").classList.toggle("online",Boolean(connected));
}
function renderMatch(data) {
  if (!data || !data.analysis) {
    setConnection(false);
    $("matchHero").textContent="Ожидаем Dota 2";
    $("matchMeta").textContent="Запусти игру — данные появятся автоматически";
    $("recommendationTitle").textContent="Матч ещё не начался";
    $("recommendationText").textContent="Начни игровую сессию, а DOTA AI будет ждать данные от Dota 2.";
    ["kills","deaths","assists","gold","level"].forEach((id)=>$(id).textContent="—");
    $("analyticsHero").textContent="—"; $("analyticsKda").textContent="—"; $("analyticsGold").textContent="—"; $("analyticsPhase").textContent="—";
    return;
  }
  const a=data.analysis; setConnection(true);
  $("matchHero").textContent=a.hero; $("matchMeta").textContent="Уровень "+(a.level||"—")+" · "+a.minutes+":"+String(a.gameTime%60).padStart(2,"0")+" · "+a.phase;
  $("recommendationTitle").textContent=a.action.title; $("recommendationText").textContent=a.action.detail; $("recommendationReason").textContent=a.action.reason;
  $("kills").textContent=a.kills; $("deaths").textContent=a.deaths; $("assists").textContent=a.assists;
  $("gold").textContent=Number(a.gold||0).toLocaleString("ru-RU"); $("level").textContent=a.level||"—";
  $("analyticsHero").textContent=a.hero; $("analyticsKda").textContent=a.kills+" / "+a.deaths+" / "+a.assists;
  $("analyticsGold").textContent=Number(a.gold||0).toLocaleString("ru-RU"); $("analyticsPhase").textContent=a.phase;
  $("coachAdvice").textContent=a.action.detail;
}
function setSession(active,message) {
  $("sessionButton").textContent=active?"ЗАВЕРШИТЬ СЕССИЮ":"НАЧАТЬ ИГРОВУЮ СЕССИЮ";
  $("sessionButton").classList.toggle("danger",Boolean(active));
  $("sessionStatus").textContent=active?"Плашка DOTA AI активна поверх окон":"Игровая плашка выключена";
  $("sessionIndicator").classList.toggle("online",Boolean(active));
  $("overlayState").textContent=active?"Активна · поверх окон":"Не активна";
  if(message) $("sessionMessage").textContent=message;
}
$("sessionButton").addEventListener("click",async()=>{
  const active=(await window.dotaAI.getSession()).active;
  if(active){await window.dotaAI.endSession();setSession(false,"Игровая сессия завершена.");}
  else{const result=await window.dotaAI.startSession();setSession(true,result.message);}
});
$("showOverlayButton").addEventListener("click",async()=>{const active=(await window.dotaAI.getSession()).active;if(active)window.dotaAI.showOverlay();else{const result=await window.dotaAI.startSession();setSession(true,result.message);}});
$("retrySetup").addEventListener("click",async()=>{
  $("setupText").textContent="Проверяем установку Dota 2 и настраиваем подключение…";
  const result=await window.dotaAI.setupDota(); $("setupText").textContent=result.message;
});
$("minimizeApp").addEventListener("click",()=>window.dotaAI.minimizeWindow());
window.dotaAI.onMatchUpdate(renderMatch);
window.dotaAI.onSessionState((data)=>setSession(data.active));
window.dotaAI.onSetupStatus((data)=>$("setupText").textContent=data.message);
window.dotaAI.onConnectionState((data)=>setConnection(data.connected));
async function init(){
 const [status,settings,match,session]=await Promise.all([window.dotaAI.getStatus(),window.dotaAI.getSettings(),window.dotaAI.getLatestMatch(),window.dotaAI.getSession()]);
 $("version").textContent=status.version; $("versionFooter").textContent=status.version;
 $("startup").checked=settings.launchAtLogin; $("showLaunch").checked=settings.showOnLaunch; $("voice").checked=settings.voiceEnabled;
 $("setupText").textContent=status.dotaFound?"Dota 2 найдена. Game State Integration будет настроена автоматически.":"Dota 2 пока не найдена. Установи игру через Steam и повтори поиск.";
 setConnection(status.connected); setSession(session.active); renderMatch(match);
}
async function saveSettings(){await window.dotaAI.saveSettings({launchAtLogin:$("startup").checked,showOnLaunch:$("showLaunch").checked,voiceEnabled:$("voice").checked});}
["startup","showLaunch","voice"].forEach((id)=>$(id).addEventListener("change",saveSettings));
init().catch((error)=>{$("setupText").textContent="Ошибка инициализации: "+error.message;});
