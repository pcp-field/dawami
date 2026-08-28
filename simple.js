(function(){
"use strict";
var C=window.DawamiCore,KEY="dawami-data-v3",BACKUP="dawami-v3-legacy-backup";
var data=loadData(),S=data.schedule,tz=data.settings.timezone||"Asia/Muscat",today=C.dateKeyAt(Date.now(),tz),month=today.slice(0,7)+"-01",page="home",selectedDay=today,setupPattern="14-14",timerTarget=null,notifyTimer=null;
var months=["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];

function $(q,r){return(r||document).querySelector(q)}
function $$(q,r){return Array.prototype.slice.call((r||document).querySelectorAll(q))}
function copy(x){return JSON.parse(JSON.stringify(x))}
function read(k){try{var v=localStorage.getItem(k);return v?JSON.parse(v):null}catch(e){return null}}
function defaults(){return{version:3,onboarded:false,profile:{name:""},settings:{timezone:"Asia/Muscat",theme:"dark",dayStart:"07:00",dayEnd:"19:00",nightStart:"19:00",nightEnd:"07:00",notificationEnabled:false,reminderBefore:60},schedule:{anchor:C.dateKeyAt(Date.now(),"Asia/Muscat"),patternId:"14-14",patternName:"14 يوم دوام / 14 يوم إجازة",cycle:copy(C.presets()["14-14"].cycle),overrides:{},leaves:[]},migratedFrom:[]}}
function normalize(d){var base=defaults();d.version=3;d.profile=Object.assign(base.profile,d.profile||{});d.settings=Object.assign(base.settings,d.settings||{});d.schedule=Object.assign(base.schedule,d.schedule||{});d.schedule.cycle=d.schedule.cycle&&d.schedule.cycle.length?d.schedule.cycle:base.schedule.cycle;d.schedule.overrides=d.schedule.overrides||{};d.schedule.leaves=d.schedule.leaves||[];d.migratedFrom=d.migratedFrom||[];return d}
function loadData(){
 var current=read(KEY);if(current&&current.schedule)return normalize(current);
 var d=defaults(),oldP=read("dawami-cycle-prefs")||read("dawami-github-prefs"),oldO=read("dawami-cycle-overrides")||{},oldS=read("dawami-github-schedule");
 if(oldP||oldS||Object.keys(oldO).length){
  if(!localStorage.getItem(BACKUP))try{localStorage.setItem(BACKUP,JSON.stringify({savedAt:new Date().toISOString(),prefs:oldP,changes:oldO,schedule:oldS}))}catch(e){}
  var p=oldP||{},on=Number(p.onDays||p.workDays||14),off=Number(p.offDays||p.restDays||14),work={type:"day",label:"دوام",start:p.shiftStart||"07:00",end:p.shiftEnd||"19:00"};
  d.schedule.anchor=p.anchor||p.startDate||d.schedule.anchor;d.schedule.cycle=C.repeat(work,on).concat(C.repeat({type:"off",label:"إجازة"},off));if(p.anchorPhase==="off")d.schedule.cycle=C.repeat({type:"off",label:"إجازة"},off).concat(C.repeat(work,on));
  d.schedule.patternId=on+"-"+off;d.schedule.patternName=on+" يوم دوام / "+off+" يوم إجازة";d.settings.theme=p.theme||"dark";d.settings.dayStart=work.start;d.settings.dayEnd=work.end;d.profile.name=p.name||"";d.onboarded=true;
  Object.keys(oldO).forEach(function(k){var v=oldO[k];d.schedule.overrides[k]=v==="off"?{type:"off",label:"إجازة"}:v==="work"?copy(work):v});
  var list=Array.isArray(oldS)?oldS:(oldS&&(oldS.days||oldS.entries||oldS.schedule));if(Array.isArray(list))list.forEach(function(x){if(x&&x.date)d.schedule.overrides[x.date.slice(0,10)]={type:mapType(x.type||x.status),label:x.label,start:x.start||x.startTime,end:x.end||x.endTime,note:x.note||""}});
  d.migratedFrom=["النسخة السابقة"];
 }
 d=normalize(d);try{localStorage.setItem(KEY,JSON.stringify(d))}catch(e){}return d
}
function save(msg){try{localStorage.setItem(KEY,JSON.stringify(data));if(msg)toast(msg)}catch(e){toast("ما قدرت أحفظ البيانات")}}
function mapType(v){v=String(v||"").toLowerCase();if(/night|ليل/.test(v))return"night";if(/off|rest|راح|إجاز|اجاز/.test(v))return"off";return"day"}
function add(k,n){return C.addDays(k,n)}
function parts(k){return C.monthKeyParts(k)}
function fmtKey(k,o){if(!k)return"—";return new Intl.DateTimeFormat("ar-OM",Object.assign({timeZone:"UTC",day:"numeric",month:"short"},o||{})).format(new Date(k+"T12:00:00Z"))}
function fmtTime(ms,o){if(!ms)return"—";return new Intl.DateTimeFormat("ar-OM",Object.assign({timeZone:tz,weekday:"long",day:"numeric",month:"long",hour:"numeric",minute:"2-digit"},o||{})).format(new Date(ms))}
function pad(n){return String(Math.max(0,n)).padStart(2,"0")}
function remaining(ms){var m=Math.max(0,Math.floor(ms/60000)),d=Math.floor(m/1440),h=Math.floor((m%1440)/60);return pad(d)+" يوم : "+pad(h)+" ساعة : "+pad(m%60)+" دقيقة"}
function textFor(e){if(!e)return"إجازة";var t=e.type;if(t==="night")return"دوام ليلي";if(t==="off")return"إجازة";if(t==="annual"||t==="leave"||t==="comp"||t==="unpaid"||t==="emergency")return"إجازة مسجلة";if(t==="sick")return"إجازة مرضية";if(t==="training")return"تدريب";if(t==="overtime")return"دوام إضافي";return"دوام"}
function classFor(e){if(!e)return"off";if(e.type==="night")return"night";if(e.type==="off")return"off";if(e.type==="sick")return"sick";if(["annual","leave","comp","unpaid","emergency"].indexOf(e.type)>=0)return"leave";return"work"}
function lastWork(k){for(var i=1;i<500;i++){var d=add(k,-i),ev=C.eventsForDate(S,d).filter(C.isWork);if(ev.length){var e=ev[ev.length-1];return C.interval(d,e,tz)}}return null}
function exactBlock(block){if(!block)return null;var before=lastWork(block.start),next=C.nextShift(S,C.zonedEpoch(block.returnDate,"00:00",tz),tz);return{start:before?before.end:C.zonedEpoch(block.start,"00:00",tz),end:next?next.start:C.zonedEpoch(add(block.end,1),"00:00",tz),next:next}}
function toast(msg){var e=$("#toast");e.textContent=msg;e.classList.add("show");clearTimeout(e._t);e._t=setTimeout(function(){e.classList.remove("show")},1800)}
function open(id){$("#"+id).classList.add("open")}
function close(id){$("#"+id).classList.remove("open")}

function renderAll(){S=data.schedule;tz=data.settings.timezone||"Asia/Muscat";today=C.dateKeyAt(Date.now(),tz);document.documentElement.dataset.theme=data.settings.theme;$("#themeBtn").textContent=data.settings.theme==="dark"?"☀":"☾";renderHome();renderCalendar();renderSettings()}
function renderHome(){
 var now=Date.now(),state=C.nowStatus(S,now,tz),currentRest=state.kind==="off"||state.kind==="leave",block=C.restBlock(S,today,currentRest),exact=exactBlock(block),card=$("#statusCard"),cyclePos=((C.diffDays(S.anchor,today)%S.cycle.length)+S.cycle.length)%S.cycle.length+1;
 card.className="status "+(state.kind==="work"?"work":state.kind==="upcoming"?"soon":"off");
 if(state.kind==="work"){$("#statusTitle").textContent="أنت مداوم الحين";$("#statusSub").textContent=textFor(state.event)+" من "+state.event.start+" إلى "+state.event.end;$("#countLabel").textContent="باقي على الإجازة";timerTarget=exact&&exact.start}
 else if(currentRest){$("#statusTitle").textContent="أنت في الإجازة";$("#statusSub").textContent="استمتع بوقتك، بنخبرك متى ترجع الدوام";$("#countLabel").textContent="باقي على الدوام";timerTarget=state.nextShift&&state.nextShift.start}
 else{$("#statusTitle").textContent="دوامك يبدأ بعد…";$("#statusSub").textContent=textFor(state.nextShift&&state.nextShift.event)+" الساعة "+((state.nextShift&&state.nextShift.event.start)||"—");$("#countLabel").textContent="باقي على بداية الدوام";timerTarget=state.nextShift&&state.nextShift.start}
 $("#cycleDay").textContent=cyclePos;$("#cycleLength").textContent="من "+S.cycle.length+" يوم";$("#cycleRing").style.setProperty("--p",(cyclePos/S.cycle.length*100)+"%");
 var workLeft=block?C.workDaysBetween(S,today,block.start):0;$("#daysToLeave").textContent=currentRest?"الحين":workLeft;$("#leaveHint").textContent=currentRest?"أنت في الإجازة":(workLeft===1?"يوم دوام باقي":"أيام دوام باقية");
 $("#leaveStartShort").textContent=block?fmtKey(block.start,{day:"numeric",month:"short"}):"—";$("#leaveStartFull").textContent=exact?fmtTime(exact.start,{weekday:"long",hour:"numeric",minute:"2-digit"}):"—";
 $("#returnShort").textContent=block?fmtKey(block.returnDate,{day:"numeric",month:"short"}):"—";$("#returnFull").textContent=exact&&exact.next?fmtTime(exact.next.start,{weekday:"long",hour:"numeric",minute:"2-digit"}):"—";
 renderCountdown();var strip=$("#nextStrip");strip.innerHTML="";for(var i=0;i<7;i++){var k=add(today,i),e=C.primaryEvent(S,k),b=document.createElement("button");b.className="strip-day "+classFor(e)+(i===0?" today":"");b.innerHTML="<small>"+fmtKey(k,{weekday:"short"})+"</small><b>"+Number(k.slice(8))+"</b><span>"+textFor(e)+"</span>";b.onclick=(function(x){return function(){showDay(x)}})(k);strip.appendChild(b)}
}
function renderCountdown(){var value=timerTarget?remaining(timerTarget-Date.now()):"ما فيه موعد قريب";$("#countdown").textContent=value;if(timerTarget&&Date.now()>timerTarget)renderHome()}
function renderCalendar(){
 var p=parts(month);$("#monthLabel").textContent=months[p.month-1]+" "+p.year;var first=p.year+"-"+String(p.month).padStart(2,"0")+"-01",offset=(new Date(first+"T12:00:00Z").getUTCDay()+6)%7,start=add(first,-offset),grid=$("#calendarGrid");grid.innerHTML="";
 for(var i=0;i<42;i++){var k=add(start,i),e=C.primaryEvent(S,k),b=document.createElement("button"),outside=parts(k).month!==p.month;b.className="day "+classFor(e)+(outside?" out":"")+(k===today?" today":"")+(S.overrides[k]!==undefined?" manual":"");b.innerHTML="<em>"+Number(k.slice(8))+"</em><b>"+textFor(e)+"</b>";b.onclick=(function(x){return function(){showDay(x)}})(k);grid.appendChild(b)}
}
function showDay(k){selectedDay=k;var events=C.eventsForDate(S,k),e=events[0]||{type:"off"};$("#selectedDate").textContent=fmtKey(k,{weekday:"long",day:"numeric",month:"long",year:"numeric"});$("#selectedStatus").textContent=events.map(textFor).join("، ");$("#selectedTime").textContent=C.isWork(e)?("من "+e.start+" إلى "+e.end):(e.note||"ما عندك دوام");$("#dayType").value=["day","night","off"].indexOf(e.type)>=0?e.type:"day";$("#dayStart").value=e.start||data.settings.dayStart;$("#dayEnd").value=e.end||data.settings.dayEnd;$("#dayNote").value=e.note||"";$("#editDay").hidden=true;open("dayModal")}
function moveMonth(n){var p=parts(month),d=new Date(Date.UTC(p.year,p.month-1+n,1));month=d.getUTCFullYear()+"-"+String(d.getUTCMonth()+1).padStart(2,"0")+"-01";renderCalendar()}
function renderSettings(){
 var id=C.presets()[S.patternId]?S.patternId:"14-14";$("#patternSelect").value=id;$("#anchorDate").value=S.anchor;$("#workStart").value=data.settings.dayStart;$("#workEnd").value=data.settings.dayEnd;$("#nightStart").value=data.settings.nightStart;$("#nightEnd").value=data.settings.nightEnd;$("#nightTimes").hidden=id!=="2d2n4";toggleSwitch("darkSwitch",data.settings.theme==="dark");toggleSwitch("notifySwitch",data.settings.notificationEnabled);$("#notifyText").textContent=data.settings.notificationEnabled?"مفعل قبل الدوام بساعة":"غير مفعل";renderCyclePreview()
}
function renderCyclePreview(){var box=$("#cyclePreview");box.innerHTML=S.cycle.map(function(e){return'<i class="'+classFor(C.normalizeEvent(e))+'"></i>'}).join("")}
function toggleSwitch(id,on){$("#"+id).classList.toggle("on",!!on)}
function applyTimes(cycle){return cycle.map(function(e){e=copy(e);if(e.type==="day"||e.type==="work"){e.label="دوام";e.start=data.settings.dayStart;e.end=data.settings.dayEnd}if(e.type==="night"){e.label="دوام ليلي";e.start=data.settings.nightStart;e.end=data.settings.nightEnd}if(e.type==="off")e.label="إجازة";return e})}
function patternName(id){var names={"14-14":"14 يوم دوام / 14 يوم إجازة","28-14":"28 يوم دوام / 14 يوم إجازة","7-7":"7 أيام دوام / 7 أيام إجازة","4-4":"4 أيام دوام / 4 أيام إجازة","2d2n4":"يومان نهاري / يومان ليلي / 4 أيام إجازة"};return names[id]||names["14-14"]}
function savePattern(){
 var id=$("#patternSelect").value,anchor=$("#anchorDate").value;if(!anchor){toast("حدد أول يوم في دورة الدوام");return}data.settings.dayStart=$("#workStart").value||"07:00";data.settings.dayEnd=$("#workEnd").value||"19:00";data.settings.nightStart=$("#nightStart").value||"19:00";data.settings.nightEnd=$("#nightEnd").value||"07:00";S.anchor=anchor;S.patternId=id;S.patternName=patternName(id);S.cycle=applyTimes(copy(C.presets()[id].cycle));save("تم حفظ نمط دوامك");renderAll();showPage("home")
}
function showPage(id){page=id;$$(".page").forEach(function(x){x.classList.toggle("active",x.id===id)});$$("[data-page]").forEach(function(x){x.classList.toggle("active",x.dataset.page===id)});window.scrollTo({top:0,behavior:"smooth"});if(id==="calendar")renderCalendar();if(id==="settings")renderSettings()}
function buildSetup(){
 var ids=["14-14","28-14","7-7","4-4","2d2n4"],box=$("#setupPatterns");box.innerHTML=ids.map(function(id){return'<button class="pattern" data-setup-pattern="'+id+'">'+patternName(id)+"</button>"}).join("");$$("[data-setup-pattern]",box).forEach(function(b){b.onclick=function(){setupPattern=b.dataset.setupPattern;$$("[data-setup-pattern]",box).forEach(function(x){x.classList.toggle("active",x===b)});renderSetupPreview()}});setupPattern=C.presets()[S.patternId]?S.patternId:"14-14";var active=$('[data-setup-pattern="'+setupPattern+'"]',box);if(active)active.classList.add("active");$("#setupName").value=data.profile.name||"";$("#setupAnchor").value=S.anchor||today;$("#setupStart").value=data.settings.dayStart;$("#setupEnd").value=data.settings.dayEnd;renderSetupPreview()
}
function renderSetupPreview(){var cyc=C.presets()[setupPattern].cycle,box=$("#setupPreview");box.innerHTML="";for(var i=0;i<28;i++){var e=C.normalizeEvent(cyc[i%cyc.length]),x=document.createElement("i");x.className=classFor(e);box.appendChild(x)}}
function finishSetup(){var anchor=$("#setupAnchor").value;if(!anchor){toast("حدد أول يوم دوام");return}data.profile.name=$("#setupName").value.trim();data.settings.dayStart=$("#setupStart").value||"07:00";data.settings.dayEnd=$("#setupEnd").value||"19:00";S.anchor=anchor;S.patternId=setupPattern;S.patternName=patternName(setupPattern);S.cycle=applyTimes(copy(C.presets()[setupPattern].cycle));data.onboarded=true;save();close("setupModal");renderAll();toast("تمام، حسبنا دوامك وإجازتك")}
async function toggleNotify(){
 if(data.settings.notificationEnabled){data.settings.notificationEnabled=false;clearTimeout(notifyTimer);save();renderSettings();toast("تم إيقاف التنبيه");return}
 if(!("Notification"in window)||!("serviceWorker"in navigator)){toast("التنبيه غير مدعوم في هذا المتصفح");return}var result=Notification.permission;if(result==="default")result=await Notification.requestPermission();if(result!=="granted"){toast("ما تم السماح بالتنبيه");return}data.settings.notificationEnabled=true;save();renderSettings();scheduleNotify();toast("تم تفعيل التنبيه داخل التطبيق")
}
function scheduleNotify(){clearTimeout(notifyTimer);if(!data.settings.notificationEnabled||!("Notification"in window)||Notification.permission!=="granted")return;var next=C.nextShift(S,Date.now(),tz),at=next&&next.start-3600000-Date.now();if(at>0&&at<2147483647)notifyTimer=setTimeout(async function(){try{var reg=await navigator.serviceWorker.ready;reg.showNotification("دوامك بعد ساعة",{body:textFor(next.event)+" يبدأ "+fmtTime(next.start),icon:"icon.svg",tag:"dawami"})}catch(e){}scheduleNotify()},at)}
function download(){var blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"}),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download="dawami-backup-"+new Date().toISOString().slice(0,10)+".json";a.click();setTimeout(function(){URL.revokeObjectURL(url)},500)}
function bind(){
 $$("[data-page]").forEach(function(b){b.onclick=function(){showPage(b.dataset.page)}});$$("[data-open-page]").forEach(function(b){b.onclick=function(){showPage(b.dataset.openPage)}});$$("[data-close]").forEach(function(b){b.onclick=function(){close(b.dataset.close)}});
 $("#themeBtn").onclick=function(){data.settings.theme=data.settings.theme==="dark"?"light":"dark";save();renderAll()};$("#darkSwitch").onclick=$("#themeBtn").onclick;
 $("#nextMonth").onclick=function(){moveMonth(1)};$("#prevMonth").onclick=function(){moveMonth(-1)};$("#goToday").onclick=function(){month=today.slice(0,7)+"-01";renderCalendar()};
 $("#patternSelect").onchange=function(){$("#nightTimes").hidden=this.value!=="2d2n4";var temp=copy(C.presets()[this.value].cycle);$("#cyclePreview").innerHTML=temp.map(function(e){return'<i class="'+classFor(C.normalizeEvent(e))+'"></i>'}).join("")};$("#saveSettings").onclick=savePattern;$("#notifySwitch").onclick=toggleNotify;
 $("#toggleEditDay").onclick=function(){$("#editDay").hidden=!$("#editDay").hidden};$("#dayType").onchange=function(){if(this.value==="night"){$("#dayStart").value=data.settings.nightStart;$("#dayEnd").value=data.settings.nightEnd}else if(this.value==="day"){$("#dayStart").value=data.settings.dayStart;$("#dayEnd").value=data.settings.dayEnd}};
 $("#saveDay").onclick=function(){var type=$("#dayType").value;S.overrides[selectedDay]={type:type,label:textFor({type:type}),start:$("#dayStart").value,end:$("#dayEnd").value,note:$("#dayNote").value.trim()};save();close("dayModal");renderAll();toast("تم حفظ اليوم")};$("#resetDay").onclick=function(){delete S.overrides[selectedDay];save();close("dayModal");renderAll();toast("رجع اليوم للنمط")};
 $("#showSetup").onclick=function(){buildSetup();open("setupModal")};$("#finishSetup").onclick=finishSetup;$("#exportData").onclick=download;$("#importData").onchange=function(){var f=this.files[0];if(!f)return;var reader=new FileReader();reader.onload=function(){try{var d=JSON.parse(reader.result);if(!d.schedule){toast("الملف غير صحيح");return}data=normalize(d);S=data.schedule;save();renderAll();toast("تمت استعادة بياناتك")}catch(e){toast("الملف غير صحيح")}};reader.readAsText(f)};
 var x=0;$("#calendarGrid").addEventListener("touchstart",function(e){x=e.changedTouches[0].clientX},{passive:true});$("#calendarGrid").addEventListener("touchend",function(e){var diff=e.changedTouches[0].clientX-x;if(Math.abs(diff)>55)moveMonth(diff>0?1:-1)},{passive:true})
}
function init(){bind();renderAll();setInterval(renderCountdown,1000);if("serviceWorker"in navigator)navigator.serviceWorker.register("sw.js?v=4").catch(function(){});scheduleNotify();if(!data.onboarded){buildSetup();open("setupModal")}}
init();
})();