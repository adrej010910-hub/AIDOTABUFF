const $=id=>document.getElementById(id);let active=false,match=null,popupOpen=false;
function resize(){window.dotaAI.setOverlayExpanded(popupOpen);}
function render(data){match=data;if(!data?.analysis)return;$("adviceTitle").textContent=data.analysis.action.title;$("adviceText").textContent=data.analysis.action.detail;}
$("start").onclick=async()=>{if(active){await window.dotaAI.endSession();return;}const r=await window.dotaAI.startSession();active=true;$("start").textContent="■ Завершить сессию";};
$("ai").onclick=()=>{popupOpen=!popupOpen;$("aiPanel").classList.toggle("hidden",!popupOpen);$("menuPanel").classList.add("hidden");if(match)render(match);resize();};
$("shot").onclick=async()=>{try{await window.dotaAI.captureScreenshot();}catch(e){$("adviceTitle").textContent="Не удалось сохранить скриншот";$("adviceText").textContent=e.message;$("aiPanel").classList.remove("hidden");popupOpen=true;resize();}};
$("menu").onclick=()=>{popupOpen=!popupOpen;$("menuPanel").classList.toggle("hidden",!popupOpen);$("aiPanel").classList.add("hidden");resize();};
document.querySelectorAll("[data-close]").forEach(b=>b.onclick=()=>{$(b.dataset.close).classList.add("hidden");popupOpen=false;resize();});
$("openApp").onclick=()=>window.dotaAI.openMain();$("history").onclick=()=>window.dotaAI.openMain();$("hide").onclick=()=>window.dotaAI.hideOverlay();$("end").onclick=()=>window.dotaAI.endSession();
window.dotaAI.onMatchUpdate(render);window.dotaAI.onSessionState(s=>{active=s.active;$("start").textContent=active?"■ Завершить сессию":"▶ Начать сессию";});window.dotaAI.getLatestMatch().then(render);window.dotaAI.getSession().then(s=>{active=s.active;$("start").textContent=active?"■ Завершить сессию":"▶ Начать сессию";});