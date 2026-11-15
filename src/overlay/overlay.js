const $=(id)=>document.getElementById(id);
let expanded=true;
function render(data){
 if(!data||!data.analysis){$("liveLabel").textContent="WAITING";$("liveDot").classList.remove("online");$("hero").textContent="Ожидание игры";$("meta").textContent="Запусти Dota 2";$("action").textContent="Ожидаем данные матча";$("detail").textContent="После подключения Dota 2 здесь появится краткая рекомендация.";return;}
 const a=data.analysis;$("liveLabel").textContent="LIVE";$("liveDot").classList.add("online");
 $("hero").textContent=a.hero;$("meta").textContent="Уровень "+(a.level||"—")+" · "+a.minutes+":"+String(a.gameTime%60).padStart(2,"0");
 $("level").textContent=a.level||"—";$("kills").textContent=a.kills;$("deaths").textContent=a.deaths;$("assists").textContent=a.assists;$("gold").textContent=Number(a.gold||0).toLocaleString("ru-RU");
 $("action").textContent=a.action.title;$("detail").textContent=a.action.detail;$("reason").textContent=a.action.reason;$("priority").textContent=a.action.priority==="high"?"HIGH PRIORITY":"MATCH TIP";$("phase").textContent=a.phase.toUpperCase();
}
$("collapse").addEventListener("click",()=>{expanded=!expanded;$("overlay").classList.toggle("collapsed",!expanded);$("collapse").textContent=expanded?"⌃":"⌄";window.dotaAI.setOverlayExpanded(expanded);});
$("hide").addEventListener("click",()=>window.dotaAI.hideOverlay());
$("endSession").addEventListener("click",()=>window.dotaAI.endSession());
window.dotaAI.onMatchUpdate(render);
window.dotaAI.onSessionState((state)=>{if(!state.active)window.close();});
window.dotaAI.getLatestMatch().then(render);
