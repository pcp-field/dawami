(function(){
"use strict";
var C=window.DawamiCore,DATA_KEY="dawami-data-v3",BACKUP_KEY="dawami-v3-legacy-backup",MIGRATION_KEY="dawami-v3-migrated";
var appData=loadData(),S=appData.schedule,nowTarget=null,currentView="dashboard",calendarMode="month",calendarFocus=C.dateKeyAt(Date.now(),appData.settings.timezone),heatYear=Number(calendarFocus.slice(0,4)),selectedDate=null,selectedDays=new Set(),selectionMode=false,clipboard=null,undoStack=[],dayDraftExtras=[],leaveFilter="upcoming",onboardStep=1,onboardPattern="14-14",patternChoice=null,deferredInstall=null,reminderTimers=[];
var monthNames=["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"],dayNames=["الأحد","الاثنين","الثلاثاء","الأربعاء","الخميس","الجمعة","السبت"];

function parseJSON(k){try{var x=localStorage.getItem(k);return x?JSON.parse(x):null}catch(e){return null}}
function copy(x){return JSON.parse(JSON.stringify(x))}
function defaultData(){
 return{version:3,onboarded:false,migratedFrom:[],profile:{name:""},settings:{timezone:"Asia/Muscat",dayStart:"07:00",dayEnd:"19:00",nightStart:"19:00",nightEnd:"07:00",theme:"dark",workHours:12,payRate:0,payDay:25,annualBalance:30,carriedBalance:0,deductRest:false,scheduleLocked:false,notificationEnabled:false,reminderBefore:60,remindNightBefore:false,remindReturn:true,remindNightShift:false},schedule:{anchor:C.dateKeyAt(Date.now(),"Asia/Muscat"),patternId:"14-14",patternName:C.presets()["14-14"].name,cycle:copy(C.presets()["14-14"].cycle),overrides:{},leaves:[]}}
}
function flexibleLegacyEvents(raw,out){
 if(!raw)return;var list=Array.isArray(raw)?raw:(raw.shifts||raw.entries||raw.days||raw.schedule||raw);
 if(!Array.isArray(list)&&typeof list==="object")list=Object.keys(list).map(function(k){var v=list[k];return typeof v==="object"?Object.assign({date:k},v):{date:k,type:v}});
 if(!Array.isArray(list))return;
 list.forEach(function(x){if(!x)return;var k=x.date||x.day||x.dateKey||x.startDate;if(!/^\d{4}-\d{2}-\d{2}/.test(k||""))return;k=k.slice(0,10);var type=mapType(x.type||x.shift||x.status||x.name);out[k]={type:type,label:x.label||x.name,start:x.start||x.startTime,end:x.end||x.endTime,note:x.note||"",location:x.location||"",job:x.job||x.hoist||""}})
}
function loadData(){
 var existing=parseJSON(DATA_KEY);if(existing&&existing.version===3&&existing.schedule){normalizeData(existing);return existing}
 var d=defaultData(),sources=[],oldGP=parseJSON("dawami-github-prefs"),oldGS=parseJSON("dawami-github-schedule"),cycleP=parseJSON("dawami-cycle-prefs"),cycleO=parseJSON("dawami-cycle-overrides");
 if(oldGP||oldGS||cycleP||cycleO){
   if(!localStorage.getItem(BACKUP_KEY))try{localStorage.setItem(BACKUP_KEY,JSON.stringify({createdAt:new Date().toISOString(),githubPrefs:oldGP,githubSchedule:oldGS,cyclePrefs:cycleP,cycleOverrides:cycleO}))}catch(e){}
   var p=cycleP||oldGP||{},on=Number(p.onDays||p.workDays||14),off=Number(p.offDays||p.restDays||14),work={type:"day",label:"نهاري",start:p.shiftStart||"07:00",end:p.shiftEnd||"19:00"};
   d.schedule.anchor=p.anchor||p.startDate||d.schedule.anchor;d.schedule.cycle=C.repeat(work,on).concat(C.repeat({type:"off",label:"راحة"},off));if(p.anchorPhase==="off")d.schedule.cycle=C.repeat({type:"off",label:"راحة"},off).concat(C.repeat(work,on));
   d.schedule.patternId=on+"-"+off;d.schedule.patternName=on+" يوم دوام / "+off+" يوم راحة";
   d.settings.theme=p.theme||d.settings.theme;d.settings.workHours=Number(p.workHours||d.settings.workHours);d.settings.payRate=Number(p.payRate||d.settings.payRate);d.settings.timezone=p.timezone||d.settings.timezone;d.settings.dayStart=work.start;d.settings.dayEnd=work.end;d.settings.annualBalance=Number(p.annualBalance||p.leaveBalance||d.settings.annualBalance);d.profile.name=p.name||p.userName||"";
   if(cycleP)sources.push("dawami-cycle-prefs");if(cycleO){sources.push("dawami-cycle-overrides");Object.keys(cycleO).forEach(function(k){d.schedule.overrides[k]=legacyOverride(cycleO[k],work)})}
   if(oldGP)sources.push("dawami-github-prefs");if(oldGS){sources.push("dawami-github-schedule");flexibleLegacyEvents(oldGS,d.schedule.overrides);if(Array.isArray(oldGS.leaves))d.schedule.leaves=copy(oldGS.leaves)}
   d.onboarded=true;d.migratedFrom=sources;try{localStorage.setItem(MIGRATION_KEY,new Date().toISOString())}catch(e){}
 }
 normalizeData(d);try{localStorage.setItem(DATA_KEY,JSON.stringify(d))}catch(e){}return d
}
function legacyOverride(v,work){if(v==="work")return copy(work);if(v==="off")return{type:"off",label:"راحة"};if(Array.isArray(v))return v.map(function(e){return typeof e==="string"?legacyOverride(e,work):e});return v}
function normalizeData(d){
 d.version=3;d.profile=d.profile||{name:""};d.settings=Object.assign(defaultData().settings,d.settings||{});d.schedule=d.schedule||defaultData().schedule;d.schedule.cycle=(d.schedule.cycle&&d.schedule.cycle.length)?d.schedule.cycle:copy(C.presets()["14-14"].cycle);d.schedule.overrides=d.schedule.overrides||{};d.schedule.leaves=d.schedule.leaves||[];d.schedule.anchor=d.schedule.anchor||C.dateKeyAt(Date.now(),d.settings.timezone);d.migratedFrom=d.migratedFrom||[]
}
function save(message){try{localStorage.setItem(DATA_KEY,JSON.stringify(appData));if(message)toast(message)}catch(e){toast("تعذر الحفظ: مساحة المتصفح ممتلئة")}}
function mapType(x){x=String(x||"").toLowerCase();if(/night|ليل/.test(x))return"night";if(/off|rest|راح|اجاز|إجاز/.test(x))return"off";if(/overtime|extra|إضاف/.test(x))return"overtime";if(/train|تدريب/.test(x))return"training";if(/sick|مرض/.test(x))return"sick";return"day"}
function parseCustom(text){
 var a=String(text||"").split(/[,،\n]+/).map(function(x){return x.trim()}).filter(Boolean);if(!a.length)return null;
 return a.map(function(x){var t=mapType(x),e={type:t,label:x};if(t==="day"){e.label="نهاري";e.start="07:00";e.end="19:00"}if(t==="night"){e.label="ليلي";e.start="19:00";e.end="07:00"}if(t==="off")e.label="راحة";return e})
}
function applyTimes(cycle,dayStart,dayEnd,nightStart,nightEnd){return cycle.map(function(e){e=copy(e);if(e.type==="day"||e.type==="work"){e.start=dayStart||"07:00";e.end=dayEnd||"19:00"}if(e.type==="night"){e.start=nightStart||"19:00";e.end=nightEnd||"07:00"}return e})}
function keyDate(k){return new Date(k+"T12:00:00Z")}
function fmtKey(k,opt){if(!k)return"—";return new Intl.DateTimeFormat("ar-OM",Object.assign({timeZone:"UTC",day:"numeric",month:"short"},opt||{})).format(keyDate(k))}
function fmtEpoch(ms,opt){if(!ms)return"—";return new Intl.DateTimeFormat("ar-OM",Object.assign({timeZone:appData.settings.timezone,weekday:"long",day:"numeric",month:"long",hour:"numeric",minute:"2-digit"},opt||{})).format(new Date(ms))}
function pad2(n){return String(Math.max(0,n)).padStart(2,"0")}
function duration(ms){ms=Math.max(0,ms);var mins=Math.floor(ms/60000),days=Math.floor(mins/1440),hours=Math.floor((mins%1440)/60),m=mins%60;return pad2(days)+" يوم : "+pad2(hours)+" ساعة : "+pad2(m)+" دقيقة"}
function eventName(e){return(e&&e.label)||({day:"نهاري",night:"ليلي",off:"راحة",annual:"إجازة سنوية",sick:"مرضية",emergency:"طارئة",comp:"تعويضية",unpaid:"بدون راتب",training:"تدريب",overtime:"إضافي"})[e&&e.type]||"راحة"}
function isLeaveType(t){return["annual","sick","emergency","comp","unpaid","leave"].indexOf(t)>=0}
function toast(msg){var e=$("#toast");e.textContent=msg;e.classList.add("show");clearTimeout(e._t);e._t=setTimeout(function(){e.classList.remove("show")},2200)}
function $(q,root){return(root||document).querySelector(q)}function $$(q,root){return Array.prototype.slice.call((root||document).querySelectorAll(q))}
function setText(id,v){var e=$("#"+id);if(e)e.textContent=v}
function toggle(id,on){var e=$("#"+id);if(e)e.classList.toggle("on",!!on)}
function openModal(id){$("#"+id).classList.add("open")}function closeModal(id){$("#"+id).classList.remove("open")}
function pushUndo(){undoStack.push(copy(S));if(undoStack.length>20)undoStack.shift();$("#undoBtn").disabled=false}
function commitSchedule(msg){save();renderAll();if(msg)toast(msg)}
function lastShiftBefore(k){
 for(var i=1;i<370;i++){var d=C.addDays(k,-i),ev=C.eventsForDate(S,d).filter(C.isWork);if(ev.length){var e=ev[ev.length-1],it=C.interval(d,e,appData.settings.timezone);return{date:d,event:e,interval:it}}}return null
}
function exactBreak(Sblock){
 if(!Sblock)return null;var before=lastShiftBefore(Sblock.start),first=C.nextShift(S,C.zonedEpoch(Sblock.start,"00:00",appData.settings.timezone),appData.settings.timezone);
 return{start:before&&before.interval?before.interval.end:C.zonedEpoch(Sblock.start,"00:00",appData.settings.timezone),end:first?first.start:C.zonedEpoch(C.addDays(Sblock.end,1),"00:00",appData.settings.timezone),first:first}
}

function renderAll(){S=appData.schedule;document.documentElement.dataset.theme=appData.settings.theme;renderHeader();renderDashboard();renderCalendar();renderLeaves();renderInsights();renderReports();renderSettings()}
function renderHeader(){
 var now=Date.now(),today=C.dateKeyAt(now,appData.settings.timezone);setText("todayText",fmtKey(today,{weekday:"long",day:"numeric",month:"long",year:"numeric"}));$("#themeButton").textContent=appData.settings.theme==="dark"?"☀":"☾";$("#profileButton").textContent=(appData.profile.name||"د").trim().charAt(0)||"د";
 var titles={dashboard:(appData.profile.name?"مرحبًا، "+appData.profile.name:"مرحبًا بك في دوامي"),calendar:"التقويم الذكي",leaves:"الإجازات",insights:"رؤى دوامي",reports:"التقارير",settings:"الإعدادات"};setText("pageTitle",titles[currentView])
}
function renderDashboard(){
 var now=Date.now(),tz=appData.settings.timezone,today=C.dateKeyAt(now,tz),st=C.nowStatus(S,now,tz),ev=st.event||{},block=C.restBlock(S,today,st.kind==="off"||st.kind==="leave"),exact=exactBreak(block),target;
 var card=$("#nowCard");card.className="now-card state-"+st.kind;setText("nowState",st.label);
 if(st.kind==="work"){target=st.until;setText("countdownLabel","باقي على نهاية الوردية");setText("nowDetail",eventName(ev)+" • "+(ev.start||"")+" — "+(ev.end||""))}
 else if(st.kind==="leave"||st.kind==="off"){target=st.nextShift&&st.nextShift.start;setText("countdownLabel","باقي على الرجوع للدوام");setText("nowDetail",st.kind==="leave"?"إجازتك مستمرة الآن":"استمتع براحتك، سنعرض موعد رجوعك بدقة")}
 else{target=st.until;setText("countdownLabel","باقي على بداية الوردية");setText("nowDetail",eventName(ev)+" • "+(ev.start||""))}
 nowTarget=target;updateCountdown();
 var cycPos=((C.diffDays(S.anchor,today)%S.cycle.length)+S.cycle.length)%S.cycle.length+1;setText("orbitValue",cycPos);setText("orbitLabel","من "+S.cycle.length+" يوم");$("#shiftOrbit").style.setProperty("--progress",(cycPos/S.cycle.length*100)+"%");
 var workLeft=block?C.workDaysBetween(S,today,block.start):0;setText("workDaysLeft",workLeft);setText("breakTitle",st.kind==="off"||st.kind==="leave"?"فترة الراحة الحالية":"إجازتك القادمة");
 setText("breakStart",exact?fmtEpoch(exact.start):"—");setText("breakEnd",exact?fmtEpoch(exact.end):block?fmtKey(block.end,{weekday:"long",day:"numeric",month:"long"}):"—");setText("returnDate",exact&&exact.first?fmtEpoch(exact.first.start):block?fmtKey(block.returnDate):"—");setText("returnShift",exact&&exact.first?eventName(exact.first.event)+" "+exact.first.event.start:"—");$("#breakProgress").style.width=Math.max(5,Math.min(100,100-workLeft/Math.max(1,S.cycle.length)*100))+"%";
 var p=C.monthKeyParts(today),stats=C.monthStats(S,p.year,p.month,appData.settings.workHours),next=st.nextShift,balance=leaveBalance(p.year);
 setText("statNextShift",next?eventName(next.event):"لا توجد");setText("statNextTime",next?fmtEpoch(next.start,{weekday:"short",day:"numeric",month:"short",hour:"numeric",minute:"2-digit"}):"—");setText("statWorkDays",stats.workDays);setText("statOffDays",stats.offDays);setText("statHours",Math.round(stats.hours));setText("statOvertime",Math.round(stats.overtimeHours)+" س");setText("statBalance",balance.remaining);
 var strip=$("#weekStrip");strip.innerHTML="";for(var i=0;i<7;i++){var k=C.addDays(today,i),e=C.primaryEvent(S,k),b=document.createElement("button");b.className="week-day "+e.type+(i===0?" today":"");b.innerHTML="<small>"+fmtKey(k,{weekday:"short"})+"</small><b>"+Number(k.slice(8))+"</b><span>"+eventName(e)+"</span>";b.onclick=(function(x){return function(){calendarFocus=x;setView("calendar");openDay(x)}})(k);strip.appendChild(b)}
 var insights=makeInsights().slice(0,3),peek=$("#insightPeek");peek.innerHTML=insights.map(function(x){return'<div class="peek-item">'+x.title+"</div>"}).join("")
}
function updateCountdown(){var txt=nowTarget?duration(nowTarget-Date.now()):"لا يوجد موعد قادم";setText("liveCountdown",txt);setText("railTimer",txt);var s=C.nowStatus(S,Date.now(),appData.settings.timezone);setText("railState",s.label);if(nowTarget&&Date.now()>nowTarget){renderDashboard();scheduleReminder()}}
function calendarStart(){
 if(calendarMode==="month"){var p=C.monthKeyParts(calendarFocus),first=p.year+"-"+String(p.month).padStart(2,"0")+"-01",offset=(keyDate(first).getUTCDay()+6)%7;return C.addDays(first,-offset)}
 var day=keyDate(calendarFocus).getUTCDay(),off=(day+6)%7;return C.addDays(calendarFocus,-off)
}
function renderCalendar(){
 var p=C.monthKeyParts(calendarFocus);setText("calendarLabel",calendarMode==="month"?monthNames[p.month-1]+" "+p.year:"أسبوع "+fmtKey(calendarStart(),{day:"numeric",month:"short"}));$$("[data-mode]").forEach(function(b){b.classList.toggle("active",b.dataset.mode===calendarMode)});$("#monthView").hidden=calendarMode!=="month";$("#weekView").hidden=calendarMode!=="week";$("#listView").hidden=calendarMode!=="list";toggle("lockBtn",appData.settings.scheduleLocked);$("#lockBtn").textContent=appData.settings.scheduleLocked?"🔒":"🔓";renderMonth();renderWeekView();renderListView();$("#batchBar").hidden=!selectionMode;setText("selectedCount",selectedDays.size+" أيام محددة")
}
function dayButton(k,outside){
 var e=C.primaryEvent(S,k),all=C.eventsForDate(S,k),b=document.createElement("button"),today=C.dateKeyAt(Date.now(),appData.settings.timezone),manual=S.overrides[k]!==undefined;
 b.className="cal-day type-"+e.type+(outside?" outside":"")+(k===today?" today":"")+(selectedDays.has(k)?" selected":"")+(manual?" manual":"");b.dataset.date=k;b.innerHTML='<span class="num">'+Number(k.slice(8))+'</span><span class="shift-pill">'+eventName(e)+(e.start&&C.isWork(e)?" • "+e.start:"")+"</span>"+(all.length>1?'<span class="multi">+'+(all.length-1)+" وردية</span>":"");
 var timer;b.addEventListener("pointerdown",function(){timer=setTimeout(function(){if(!selectionMode)openDay(k)},550)});["pointerup","pointerleave","pointercancel"].forEach(function(n){b.addEventListener(n,function(){clearTimeout(timer)})});b.onclick=function(){clearTimeout(timer);if(selectionMode){selectedDays.has(k)?selectedDays.delete(k):selectedDays.add(k);renderCalendar()}else openDay(k)};return b
}
function renderMonth(){var grid=$("#monthGrid");grid.innerHTML="";var start=calendarStart(),month=C.monthKeyParts(calendarFocus).month;for(var i=0;i<42;i++){var k=C.addDays(start,i);grid.appendChild(dayButton(k,C.monthKeyParts(k).month!==month))}}
function renderWeekView(){var box=$("#weekView");box.innerHTML="";var start=calendarStart(),today=C.dateKeyAt(Date.now(),appData.settings.timezone);for(var i=0;i<7;i++){var k=C.addDays(start,i),col=document.createElement("div"),events=C.eventsForDate(S,k);col.className="week-column"+(k===today?" today":"");col.innerHTML="<header><small>"+fmtKey(k,{weekday:"long"})+"</small><b>"+Number(k.slice(8))+"</b></header>"+events.map(function(e){return'<div class="week-event '+e.type+'"><b>'+eventName(e)+'</b><span>'+(C.isWork(e)?(e.start+" — "+e.end):"طوال اليوم")+"</span></div>"}).join("");col.onclick=(function(x){return function(){openDay(x)}})(k);box.appendChild(col)}}
function renderListView(){var box=$("#listView");box.innerHTML="";for(var i=0;i<35;i++){var k=C.addDays(calendarFocus,i),e=C.primaryEvent(S,k),row=document.createElement("button");row.className="list-day";row.innerHTML='<span class="list-date"><b>'+Number(k.slice(8))+"</b><small>"+fmtKey(k,{month:"short"})+'</small></span><span class="list-info"><b>'+eventName(e)+'</b><small>'+(C.isWork(e)?e.start+" — "+e.end:"لا توجد وردية")+'</small></span><span class="list-badge">'+fmtKey(k,{weekday:"long"})+"</span>";row.onclick=(function(x){return function(){openDay(x)}})(k);box.appendChild(row)}}
function shiftCalendar(delta){calendarFocus=calendarMode==="month"?monthShift(calendarFocus,delta):C.addDays(calendarFocus,delta*(calendarMode==="week"?7:30));renderCalendar()}
function monthShift(k,n){var p=C.monthKeyParts(k),d=new Date(Date.UTC(p.year,p.month-1+n,1));return d.getUTCFullYear()+"-"+String(d.getUTCMonth()+1).padStart(2,"0")+"-01"}
function openDay(k){
 if(appData.settings.scheduleLocked){toast("الجدول مقفل؛ افتح القفل من التقويم أو الإعدادات");return}selectedDate=k;dayDraftExtras=[];var ev=C.eventsForDate(S,k),e=copy(ev[0]);setText("sheetDate",fmtKey(k,{weekday:"long",day:"numeric",month:"long",year:"numeric"}));$("#dayExisting").innerHTML="<b>الحالة الحالية:</b> "+ev.map(function(x){return eventName(x)+(C.isWork(x)?" "+x.start+"–"+x.end:"")}).join("، ");fillDayForm(e);openModal("daySheet")
}
function fillDayForm(e){e=C.normalizeEvent(e);$("#dayType").value=["day","night","off","overtime","training","sick"].indexOf(e.type)>=0?e.type:"day";$("#dayLabel").value=e.label||eventName(e);$("#dayStart").value=e.start||"07:00";$("#dayEnd").value=e.end||"19:00";$("#dayLocation").value=e.location||"";$("#dayJob").value=e.job||"";$("#dayNote").value=e.note||""}
function readDayForm(){var type=$("#dayType").value;return{type:type,label:$("#dayLabel").value.trim()||eventName({type:type}),start:$("#dayStart").value||"07:00",end:$("#dayEnd").value||"19:00",location:$("#dayLocation").value.trim(),job:$("#dayJob").value.trim(),note:$("#dayNote").value.trim()}}
function renderLeaves(){
 var today=C.dateKeyAt(Date.now(),appData.settings.timezone),year=Number(today.slice(0,4)),bal=leaveBalance(year);setText("leaveRemaining",bal.remaining);setText("leaveTotal",bal.total);$("#balanceRing").style.opacity=Math.max(.2,bal.remaining/Math.max(1,bal.total));
 var upcoming=S.leaves.filter(function(l){return l.end>=today}).sort(function(a,b){return a.start.localeCompare(b.start)})[0],tl=$("#leaveTimeline");
 if(upcoming){setText("registeredLeaveName",upcoming.name||eventName({type:upcoming.type}));var before=lastShiftBefore(upcoming.start),after=C.nextShift(S,C.zonedEpoch(C.addDays(upcoming.end,1),"00:00",appData.settings.timezone),appData.settings.timezone);tl.classList.remove("empty");tl.innerHTML=timeline("آخر وردية",before?fmtKey(before.date,{day:"numeric",month:"short"}):"—")+timeline("تبدأ",fmtKey(upcoming.start,{weekday:"short",day:"numeric",month:"short"}))+timeline("تنتهي",fmtKey(upcoming.end,{weekday:"short",day:"numeric",month:"short"}))+timeline("أول عودة",after?fmtEpoch(after.start,{weekday:"short",day:"numeric",month:"short",hour:"numeric",minute:"2-digit"}):"—")}
 else{setText("registeredLeaveName","لا توجد إجازة قادمة");tl.className="leave-timeline empty";tl.textContent="أضف إجازتك الأولى لرؤية الخط الزمني."}
 renderOpportunities();renderLeaveList()
}
function timeline(a,b){return'<div class="timeline-point"><small>'+a+"</small><b>"+b+"</b></div>"}
function leaveBalance(year){var total=Number(appData.settings.annualBalance)+Number(appData.settings.carriedBalance),used=C.annualLeaveUsed(S,year,appData.settings.deductRest);return{total:total,used:used,remaining:Math.max(0,total-used)}}
function renderOpportunities(){
 var today=C.dateKeyAt(Date.now(),appData.settings.timezone),max=Number($("#opportunityDays").value||3),ops=C.bestLeave(S,today,240,max),box=$("#opportunities");
 if(!ops.length){box.innerHTML='<div class="muted-note">لا توجد فرصة واضحة ضمن الأشهر الثمانية القادمة بهذا الحد.</div>';return}
 box.innerHTML=ops.slice(0,3).map(function(o,i){return'<div class="opportunity"><b>خذ '+o.leaveDays+" "+(o.leaveDays===1?"يوم":"أيام")+" لتحصل على "+o.totalBreak+' أيام راحة متصلة</b><small>من '+fmtKey(o.blockStart,{day:"numeric",month:"long"})+" إلى "+fmtKey(o.blockEnd,{day:"numeric",month:"long"})+'</small><button data-op="'+i+'">استخدام هذا الاقتراح</button></div>'}).join("");$$("[data-op]",box).forEach(function(b){b.onclick=function(){var o=ops[Number(b.dataset.op)];openLeave(o.start,o.end,"فرصة إجازة ذكية")}})
}
function renderLeaveList(){
 var today=C.dateKeyAt(Date.now(),appData.settings.timezone),list=S.leaves.slice().sort(function(a,b){return b.start.localeCompare(a.start)}).filter(function(l){return leaveFilter==="all"||(leaveFilter==="upcoming"?l.end>=today:l.end<today)}),box=$("#leaveList");
 if(!list.length){box.innerHTML='<div class="muted-note">لا توجد إجازات في هذا القسم.</div>';return}
 box.innerHTML=list.map(function(l){var days=C.diffDays(l.start,l.end)+1;return'<div class="leave-item"><span class="leave-type">⌁</span><span><b>'+(l.name||eventName({type:l.type}))+'</b><small>'+fmtKey(l.start,{day:"numeric",month:"short"})+" — "+fmtKey(l.end,{day:"numeric",month:"short"})+" • "+(l.half?".5":days)+' يوم</small></span><button data-delete-leave="'+l.id+'" title="حذف">×</button></div>'}).join("");$$("[data-delete-leave]",box).forEach(function(b){b.onclick=function(){if(confirm("حذف هذه الإجازة؟")){pushUndo();S.leaves=S.leaves.filter(function(l){return String(l.id)!==b.dataset.deleteLeave});commitSchedule("تم حذف الإجازة")}}})
}
function makeInsights(){
 var today=C.dateKeyAt(Date.now(),appData.settings.timezone),p=C.monthKeyParts(today),cur=C.monthStats(S,p.year,p.month,appData.settings.workHours),prevKey=monthShift(today,-1),pp=C.monthKeyParts(prevKey),prev=C.monthStats(S,pp.year,pp.month,appData.settings.workHours),nextKey=monthShift(today,1),np=C.monthKeyParts(nextKey),next=C.monthStats(S,np.year,np.month,appData.settings.workHours),block=C.restBlock(S,today,false),workLeft=block?C.workDaysBetween(S,today,block.start):0,rest=C.longestStreak(S,today,120,function(ev){return!ev.some(C.isWork)}),work=C.longestStreak(S,p.year+"-"+String(p.month).padStart(2,"0")+"-01",C.daysInMonth(p.year,p.month),function(ev){return ev.some(C.isWork)}),night=C.longestStreak(S,today,60,function(ev){return ev.some(function(e){return e.type==="night"})}),appoint=C.restBlock(S,today,false,120),payKey=p.year+"-"+String(p.month).padStart(2,"0")+"-"+String(Math.min(appData.settings.payDay,C.daysInMonth(p.year,p.month))).padStart(2,"0"),payEv=C.primaryEvent(S,payKey);
 if(payKey<today){var payMonth=monthShift(today,1),pm=C.monthKeyParts(payMonth);payKey=pm.year+"-"+String(pm.month).padStart(2,"0")+"-"+String(Math.min(appData.settings.payDay,C.daysInMonth(pm.year,pm.month))).padStart(2,"0");payEv=C.primaryEvent(S,payKey)}
 return[
  {icon:"⌛",title:"أمامك "+workLeft+" "+(workLeft===1?"وردية":"ورديات")+" فقط قبل الراحة",text:block?"تبدأ "+fmtKey(block.start,{weekday:"long",day:"numeric",month:"long"}):"لا توجد فترة راحة قريبة",featured:true},
  {icon:"☾",title:"أطول راحة قادمة "+rest.length+" أيام",text:"من "+fmtKey(rest.start,{day:"numeric",month:"long"})+" إلى "+fmtKey(rest.end,{day:"numeric",month:"long"})},
  {icon:"◷",title:"هذا الشهر "+(cur.hours>=prev.hours?"أعلى بـ ":"أخف بـ ")+Math.abs(Math.round(cur.hours-prev.hours))+" ساعة",text:"المقارنة مع "+monthNames[pp.month-1]},
  {icon:"☀",title:"أطول فترة دوام متصلة "+work.length+" أيام",text:"خلال "+monthNames[p.month-1]},
  {icon:"🌙",title:night.length>1?"لديك "+night.length+" ورديات ليلية متتالية":"لا يوجد ضغط ليلي متتالٍ",text:night.length?"تبدأ "+fmtKey(night.start,{day:"numeric",month:"short"}):"ضمن 60 يومًا"},
  {icon:"📅",title:appoint?"أفضل موعد شخصي: "+fmtKey(appoint.start,{weekday:"long",day:"numeric",month:"long"}):"لا توجد راحة قريبة",text:"أول يوم في فترة راحة متصلة"},
  {icon:"↘",title:"الشهر القادم "+(next.hours<cur.hours?"أخف":"أثقل أو مماثل")+" من هذا الشهر",text:Math.abs(Math.round(next.hours-cur.hours))+" ساعة فرق"},
  {icon:"◈",title:"يوم راتبك يوافق "+eventName(payEv),text:fmtKey(payKey,{weekday:"long",day:"numeric",month:"long"})}
 ]
}
function renderInsights(){
 var items=makeInsights(),grid=$("#insightsGrid");grid.innerHTML=items.map(function(x){return'<article class="insight-card card'+(x.featured?" featured":"")+'"><span class="insight-icon">'+x.icon+"</span><h3>"+x.title+"</h3><p>"+x.text+"</p></article>"}).join("");setText("heatYearTitle","خريطة "+heatYear);setText("yearValue",heatYear);var heat=$("#yearHeatmap");heat.innerHTML="";
 for(var m=1;m<=12;m++){var box=document.createElement("div");box.className="heat-month";box.innerHTML="<h4>"+monthNames[m-1]+"</h4>";var g=document.createElement("div");g.className="heat-grid";var first=heatYear+"-"+String(m).padStart(2,"0")+"-01",offset=(keyDate(first).getUTCDay()+6)%7;for(var z=0;z<offset;z++){var blank=document.createElement("i");blank.className="heat-day";g.appendChild(blank)}for(var d=1;d<=C.daysInMonth(heatYear,m);d++){var k=heatYear+"-"+String(m).padStart(2,"0")+"-"+String(d).padStart(2,"0"),e=C.primaryEvent(S,k),dot=document.createElement("i");dot.className="heat-day "+e.type;dot.title=fmtKey(k,{day:"numeric",month:"long"})+" — "+eventName(e);g.appendChild(dot)}box.appendChild(g);heat.appendChild(box)}
}
function renderReports(){
 var today=C.dateKeyAt(Date.now(),appData.settings.timezone),p=C.monthKeyParts(today),st=C.monthStats(S,p.year,p.month,appData.settings.workHours),prev=monthShift(today,-1),pp=C.monthKeyParts(prev),old=C.monthStats(S,pp.year,pp.month,appData.settings.workHours),pay=st.hours*Number(appData.settings.payRate||0);
 setText("reportHours",Math.round(st.hours)+" ساعة");setText("reportCompare",(st.hours>=old.hours?"أكثر ":"أقل ")+Math.abs(Math.round(st.hours-old.hours))+" ساعة من الشهر الماضي");setText("reportPay",pay.toFixed(3)+" ر.ع");setText("reportNight",st.night+" وردية");setText("reportExtra",Math.round(st.overtimeHours)+" ساعة");setText("reportMonthName",monthNames[p.month-1]+" "+p.year);
 $("#reportRows").innerHTML=row("أيام الدوام",st.workDays+" يوم")+row("أيام الراحة",st.offDays+" يوم")+row("أيام الإجازات المسجلة",st.leaveDays+" يوم")+row("الورديات النهارية",st.day)+row("الورديات الليلية",st.night)+row("ساعات العمل الإضافي",Math.round(st.overtimeHours)+" ساعة")+row("ساعات العمل",Math.round(st.hours)+" ساعة")+row("الأجر التقديري",pay.toFixed(3)+" ر.ع")
}
function row(a,b){return'<div class="data-row"><span>'+a+"</span><b>"+b+"</b></div>"}
function renderSettings(){
 $("#settingName").value=appData.profile.name||"";$("#settingTimezone").value=appData.settings.timezone;$("#settingHours").value=appData.settings.workHours;$("#settingRate").value=appData.settings.payRate;$("#settingPayDay").value=appData.settings.payDay;$("#settingBalance").value=appData.settings.annualBalance;$("#settingCarried").value=appData.settings.carriedBalance;$("#reminderBefore").value=appData.settings.reminderBefore;
 toggle("settingLock",appData.settings.scheduleLocked);toggle("settingTheme",appData.settings.theme==="dark");toggle("deductRest",appData.settings.deductRest);toggle("remindNightBefore",appData.settings.remindNightBefore);toggle("remindReturn",appData.settings.remindReturn);toggle("remindNightShift",appData.settings.remindNightShift);
 setText("settingsPatternName",S.patternName||"نمط مخصص");setText("cycleDescription","تبدأ الدورة في "+fmtKey(S.anchor,{day:"numeric",month:"long",year:"numeric"})+" وتتكرر كل "+S.cycle.length+" يومًا. الاستثناءات والإجازات محفوظة فوق هذا النمط.");var prev=$("#cyclePreview");prev.innerHTML=S.cycle.map(function(e){return'<i class="'+C.normalizeEvent(e).type+'"></i>'}).join("");
 var badge=$("#notificationBadge");badge.classList.toggle("on",!!appData.settings.notificationEnabled);badge.textContent=appData.settings.notificationEnabled?"مفعلة بأفضل جهد":"غير مفعلة";setText("migrationStatus",appData.migratedFrom.length?"تم ترحيل البيانات بأمان من: "+appData.migratedFrom.join("، ")+"، مع إبقاء النسخة القديمة دون حذف.":"يستخدم دوامي مخزن البيانات الآمن بالإصدار 3.")
}
function setView(v){currentView=v;$$(".view").forEach(function(x){x.classList.toggle("active",x.id===v)});$$("[data-view]").forEach(function(x){x.classList.toggle("active",x.dataset.view===v)});renderHeader();if(v==="calendar")renderCalendar();if(v==="leaves")renderLeaves();if(v==="insights")renderInsights();if(v==="reports")renderReports();if(v==="settings")renderSettings();window.scrollTo({top:0,behavior:"smooth"})}
function buildPatternPickers(){
 var ps=C.presets(),defs=Object.keys(ps).map(function(id){return{id:id,name:ps[id].name,len:ps[id].cycle.length}});defs.push({id:"custom",name:"نمط مخصص",len:"اكتب دورتك"});
 ["obPatterns","settingsPatterns"].forEach(function(id){var box=$("#"+id);box.innerHTML=defs.map(function(x){return'<button class="pattern-option" data-pattern="'+x.id+'"><b>'+x.name+"</b><small>"+(typeof x.len==="number"?"دورة من "+x.len+" يوم":x.len)+"</small></button>"}).join("");$$("[data-pattern]",box).forEach(function(b){b.onclick=function(){choosePattern(b.dataset.pattern,id)}})})
}
function choosePattern(id,source){if(source==="obPatterns"){onboardPattern=id;$$("[data-pattern]",$("#obPatterns")).forEach(function(b){b.classList.toggle("active",b.dataset.pattern===id)});$("#customCycleBox").hidden=id!=="custom"}else{patternChoice=id;$$("[data-pattern]",$("#settingsPatterns")).forEach(function(b){b.classList.toggle("active",b.dataset.pattern===id)});$("#settingsCustomBox").hidden=id!=="custom"}}
function onboardingCycle(){
 var cyc=onboardPattern==="custom"?parseCustom($("#obCustomCycle").value):copy(C.presets()[onboardPattern].cycle);if(!cyc)return null;return applyTimes(cyc,$("#obDayStart").value,$("#obDayEnd").value,$("#obNightStart").value,$("#obNightEnd").value)
}
function showOnboardStep(n){
 onboardStep=n;$$(".onboard-step").forEach(function(x){x.classList.toggle("active",Number(x.dataset.step)===n)});setText("onboardStepText",n+" من 7");$("#onboardProgress").style.width=(n/7*100)+"%";$("#obBack").hidden=n===1;$("#obNext").textContent=n===7?"حفظ وبدء استخدام دوامي":"التالي";if(n===7)renderOnboardPreview()
}
function validateOnboard(){
 if(onboardStep===1&&!$("#obName").value.trim()){toast("اكتب اسمك للمتابعة");return false}if(onboardStep===3&&!onboardingCycle()){toast("اكتب دورة صحيحة مفصولة بفواصل");return false}if(onboardStep===4&&!$("#obAnchor").value){toast("اختر أول يوم في الدورة");return false}return true
}
function renderOnboardPreview(){
 var cycle=onboardingCycle(),anchor=$("#obAnchor").value,temp={anchor:anchor,cycle:cycle,overrides:{},leaves:[]},box=$("#obPreview");$("#obSummary").innerHTML="<b>"+$("#obName").value.trim()+"</b> • "+(C.presets()[onboardPattern]?C.presets()[onboardPattern].name:"نمط مخصص")+" • "+cycle.length+" يوم في الدورة";box.innerHTML="";for(var i=0;i<60;i++){var e=C.primaryEvent(temp,C.addDays(anchor,i)),x=document.createElement("i");x.className="preview-day "+e.type;x.title=C.addDays(anchor,i)+" — "+eventName(e);box.appendChild(x)}
}
function finishOnboarding(){
 var cycle=onboardingCycle();appData.profile.name=$("#obName").value.trim();appData.settings.timezone=$("#obTimezone").value;appData.settings.annualBalance=Math.max(0,Number($("#obBalance").value)||0);S.anchor=$("#obAnchor").value;S.patternId=onboardPattern;S.patternName=C.presets()[onboardPattern]?C.presets()[onboardPattern].name:"نمط مخصص";S.cycle=cycle;appData.settings.dayStart=$("#obDayStart").value;appData.settings.dayEnd=$("#obDayEnd").value;appData.settings.nightStart=$("#obNightStart").value;appData.settings.nightEnd=$("#obNightEnd").value;appData.onboarded=true;save();closeModal("onboarding");calendarFocus=C.dateKeyAt(Date.now(),appData.settings.timezone);renderAll();toast("أصبح جدولك جاهزًا ويتكرر تلقائيًا")
}
function openLeave(start,end,name){$("#leaveStart").value=start||C.dateKeyAt(Date.now(),appData.settings.timezone);$("#leaveEnd").value=end||$("#leaveStart").value;$("#leaveName").value=name||"";$("#leaveType").value="annual";$("#leaveReason").value="";$("#leaveHalf").checked=false;openModal("leaveModal")}
function openPattern(){
 patternChoice=S.patternId&&C.presets()[S.patternId]?S.patternId:"custom";$("#patternAnchor").value=S.anchor;$("#settingsCustomCycle").value=S.cycle.map(eventName).join("، ");choosePattern(patternChoice,"settingsPatterns");openModal("patternModal")
}
async function enableNotifications(){
 if(!("Notification"in window)||!("serviceWorker"in navigator)){toast("هذا المتصفح لا يدعم تنبيهات PWA");return}
 var permission=Notification.permission;if(permission==="default")permission=await Notification.requestPermission();
 if(permission!=="granted"){appData.settings.notificationEnabled=false;save();renderSettings();toast("لم يتم منح إذن التنبيهات");return}
 appData.settings.notificationEnabled=true;save();renderSettings();scheduleReminder();toast("فُعّلت تنبيهات الجلسة؛ الخلفية تعتمد على قيود نظام هاتفك")
}
async function notify(title,body){try{var reg=await navigator.serviceWorker.ready;reg.showNotification(title,{body:body,icon:"icon.svg",badge:"icon.svg",tag:"dawami-reminder"})}catch(e){}}
function scheduleReminder(){
 reminderTimers.forEach(clearTimeout);reminderTimers=[];if(!("Notification"in window)||!appData.settings.notificationEnabled||Notification.permission!=="granted")return;
 var now=Date.now(),tz=appData.settings.timezone,next=C.nextShift(S,now,tz),status=C.nowStatus(S,now,tz),before=Number(appData.settings.reminderBefore||60)*60000;
 function queue(at,title,body){var delay=at-now;if(delay>0&&delay<2147483647)reminderTimers.push(setTimeout(function(){notify(title,body);scheduleReminder()},delay))}
 if(next){
   queue(next.start-before,"وردية "+eventName(next.event),"تبدأ "+fmtEpoch(next.start));
   if(appData.settings.remindNightShift&&next.event.type==="night")queue(next.start-120*60000,"وردية ليلية قادمة","وردية "+eventName(next.event)+" تبدأ "+fmtEpoch(next.start));
   if(appData.settings.remindNightBefore){var eve=C.addDays(next.date,-1),nightAt=C.zonedEpoch(eve,"20:00",tz);queue(nightAt,"غدًا بداية دوامك","أول وردية تبدأ "+fmtEpoch(next.start))}
   if(appData.settings.remindReturn&&(status.kind==="off"||status.kind==="leave"))queue(next.start-24*3600000,"باقي 24 ساعة على الرجوع","أول وردية بعد الراحة: "+eventName(next.event)+"، "+fmtEpoch(next.start))
 }
 var today=C.dateKeyAt(now,tz),year=Number(today.slice(0,4)),yearAlert=C.zonedEpoch(year+"-12-01","09:00",tz),bal=leaveBalance(year);
 queue(yearAlert,"راجع رصيد إجازتك","متبقي "+bal.remaining+" يوم قبل نهاية سنة الإجازة");
 if(bal.remaining<=3&&localStorage.getItem("dawami-low-balance-alert")!==String(year)){localStorage.setItem("dawami-low-balance-alert",String(year));queue(now+2000,"رصيد الإجازة منخفض","متبقي لديك "+bal.remaining+" يوم فقط")}
}
function download(name,text,type){var b=new Blob([text],{type:type||"application/octet-stream"}),u=URL.createObjectURL(b),a=document.createElement("a");a.href=u;a.download=name;a.click();setTimeout(function(){URL.revokeObjectURL(u)},1000)}
function exportCSV(){
 var y=Number(C.dateKeyAt(Date.now(),appData.settings.timezone).slice(0,4)),rows=[["التاريخ","النوع","الوردية","البداية","النهاية","الموقع","Job-Hoist","ملاحظة"]];
 for(var i=0;i<(C.daysInMonth(y,2)===29?366:365);i++){var k=C.addDays(y+"-01-01",i);C.eventsForDate(S,k).forEach(function(e){rows.push([k,e.type,eventName(e),e.start||"",e.end||"",e.location||"",e.job||"",e.note||""])})}
 download("dawami-"+y+".csv","\uFEFF"+rows.map(function(r){return r.map(function(x){return'"'+String(x).replace(/"/g,'""')+'"'}).join(",")}).join("\n"),"text/csv;charset=utf-8")
}

function bind(){
 $$("[data-view]").forEach(function(b){b.onclick=function(){setView(b.dataset.view)}});$$("[data-go]").forEach(function(b){b.onclick=function(){setView(b.dataset.go)}});$$("[data-close]").forEach(function(b){b.onclick=function(){closeModal(b.dataset.close)}});$$(".modal:not(.onboarding)").forEach(function(m){m.addEventListener("click",function(e){if(e.target===m)closeModal(m.id)})});
 $("#themeButton").onclick=function(){appData.settings.theme=appData.settings.theme==="dark"?"light":"dark";save();renderAll()};$("#profileButton").onclick=function(){setView("settings")};
 $$("#calendarModes button").forEach(function(b){b.onclick=function(){calendarMode=b.dataset.mode;renderCalendar()}});$("#calNext").onclick=function(){shiftCalendar(1)};$("#calPrev").onclick=function(){shiftCalendar(-1)};$("#calToday").onclick=function(){calendarFocus=C.dateKeyAt(Date.now(),appData.settings.timezone);renderCalendar()};$("#addShiftBtn").onclick=function(){openDay(calendarFocus)};
 $("#undoBtn").onclick=function(){if(undoStack.length){appData.schedule=undoStack.pop();S=appData.schedule;save("تم التراجع عن آخر تعديل");renderAll();$("#undoBtn").disabled=!undoStack.length}};$("#selectBtn").onclick=function(){if(appData.settings.scheduleLocked){toast("افتح قفل الجدول أولًا");return}selectionMode=!selectionMode;selectedDays.clear();renderCalendar()};$("#cancelSelect").onclick=function(){selectionMode=false;selectedDays.clear();renderCalendar()};
 $$("[data-batch]").forEach(function(b){b.onclick=function(){if(!selectedDays.size){toast("حدد يومًا واحدًا على الأقل");return}pushUndo();selectedDays.forEach(function(k){var t=b.dataset.batch;S.overrides[k]={type:t,label:eventName({type:t}),start:t==="night"?appData.settings.nightStart:appData.settings.dayStart,end:t==="night"?appData.settings.nightEnd:appData.settings.dayEnd}});selectionMode=false;selectedDays.clear();commitSchedule("تم تعديل الأيام المحددة")}});$("#pasteBtn").onclick=function(){if(!clipboard){toast("انسخ وردية أولًا");return}if(!selectedDays.size){toast("حدد أيام اللصق");return}pushUndo();selectedDays.forEach(function(k){S.overrides[k]=copy(clipboard)});selectionMode=false;selectedDays.clear();commitSchedule("تم لصق الوردية")};
 $("#lockBtn").onclick=function(){appData.settings.scheduleLocked=!appData.settings.scheduleLocked;save();renderAll();toast(appData.settings.scheduleLocked?"تم قفل الجدول":"تم فتح الجدول")};$("#findRestBtn").onclick=function(){var b=C.restBlock(S,C.dateKeyAt(Date.now(),appData.settings.timezone),false);if(b){calendarFocus=b.start;calendarMode="month";renderCalendar();toast("أول راحة تبدأ "+fmtKey(b.start,{weekday:"long",day:"numeric",month:"long"}))}};
 var touchX=0;$("#monthGrid").addEventListener("touchstart",function(e){touchX=e.changedTouches[0].clientX},{passive:true});$("#monthGrid").addEventListener("touchend",function(e){var dx=e.changedTouches[0].clientX-touchX;if(Math.abs(dx)>55)shiftCalendar(dx>0?1:-1)},{passive:true});
 $("#dayType").onchange=function(){var t=this.value;$("#dayLabel").value=eventName({type:t});if(t==="night"){$("#dayStart").value=appData.settings.nightStart;$("#dayEnd").value=appData.settings.nightEnd}else if(t!=="off"){$("#dayStart").value=appData.settings.dayStart;$("#dayEnd").value=appData.settings.dayEnd}};
 $("#addSecondShift").onclick=function(){dayDraftExtras.push(readDayForm());fillDayForm({type:"overtime",label:"وردية إضافية",start:"19:00",end:"23:00"});toast("أضف بيانات الوردية الثانية ثم احفظ")};$("#saveDay").onclick=function(){pushUndo();var arr=dayDraftExtras.concat([readDayForm()]);S.overrides[selectedDate]=arr.length===1?arr[0]:arr;closeModal("daySheet");commitSchedule("تم حفظ اليوم")};$("#resetDay").onclick=function(){pushUndo();delete S.overrides[selectedDate];closeModal("daySheet");commitSchedule("عاد اليوم إلى النمط التلقائي")};$("#copyDay").onclick=function(){clipboard=copy(C.eventsForDate(S,selectedDate));toast("تم نسخ وردية اليوم؛ استخدم التحديد للصقها")};
 $("#newLeaveBtn").onclick=function(){openLeave()};$("#saveLeave").onclick=function(){var a=$("#leaveStart").value,b=$("#leaveEnd").value;if(!a||!b||b<a){toast("تحقق من تاريخ البداية والنهاية");return}if($("#leaveHalf").checked)b=a;pushUndo();S.leaves.push({id:"l"+Date.now(),name:$("#leaveName").value.trim(),type:$("#leaveType").value,start:a,end:b,half:$("#leaveHalf").checked,reason:$("#leaveReason").value.trim()});closeModal("leaveModal");commitSchedule("تمت إضافة الإجازة")};$("#opportunityDays").onchange=renderOpportunities;$$("[data-leave-filter]").forEach(function(b){b.onclick=function(){leaveFilter=b.dataset.leaveFilter;$$("[data-leave-filter]").forEach(function(x){x.classList.toggle("active",x===b)});renderLeaveList()}});
 $("#refreshInsights").onclick=function(){renderInsights();toast("تم تحديث الرؤى من جدولك")};$("#yearNext").onclick=function(){heatYear++;renderInsights()};$("#yearPrev").onclick=function(){heatYear--;renderInsights()};$("#exportCsv").onclick=exportCSV;
 $("#saveProfile").onclick=function(){appData.profile.name=$("#settingName").value.trim();appData.settings.timezone=$("#settingTimezone").value;appData.settings.workHours=Math.max(1,Number($("#settingHours").value)||12);appData.settings.payRate=Math.max(0,Number($("#settingRate").value)||0);appData.settings.payDay=Math.min(31,Math.max(1,Number($("#settingPayDay").value)||25));calendarFocus=C.dateKeyAt(Date.now(),appData.settings.timezone);save("تم حفظ بياناتك");renderAll()};
 $("#settingLock").onclick=$("#lockBtn").onclick;$("#settingTheme").onclick=$("#themeButton").onclick;$("#deductRest").onclick=function(){appData.settings.deductRest=!appData.settings.deductRest;save();renderAll()};$("#saveLeaveSettings").onclick=function(){appData.settings.annualBalance=Math.max(0,Number($("#settingBalance").value)||0);appData.settings.carriedBalance=Math.max(0,Number($("#settingCarried").value)||0);save("تم حفظ رصيد الإجازة");renderAll()};
 $("#remindNightBefore").onclick=function(){appData.settings.remindNightBefore=!appData.settings.remindNightBefore;save();renderSettings()};$("#remindReturn").onclick=function(){appData.settings.remindReturn=!appData.settings.remindReturn;save();renderSettings()};$("#remindNightShift").onclick=function(){appData.settings.remindNightShift=!appData.settings.remindNightShift;save();renderSettings()};$("#reminderBefore").onchange=function(){appData.settings.reminderBefore=Number(this.value);save();scheduleReminder()};$("#enableNotifications").onclick=enableNotifications;
 $("#editPatternBtn").onclick=openPattern;$("#savePattern").onclick=function(){var cyc=patternChoice==="custom"?parseCustom($("#settingsCustomCycle").value):copy(C.presets()[patternChoice].cycle);if(!cyc||!$("#patternAnchor").value){toast("أكمل بيانات النمط");return}pushUndo();S.anchor=$("#patternAnchor").value;S.cycle=applyTimes(cyc,appData.settings.dayStart,appData.settings.dayEnd,appData.settings.nightStart,appData.settings.nightEnd);S.patternId=patternChoice;S.patternName=C.presets()[patternChoice]?C.presets()[patternChoice].name:"نمط مخصص";closeModal("patternModal");commitSchedule("تم تطبيق الدورة دون حذف الاستثناءات")};
 $("#exportJson").onclick=function(){download("dawami-backup-"+new Date().toISOString().slice(0,10)+".json",JSON.stringify(appData,null,2),"application/json")};$("#importJson").onchange=function(){var f=this.files[0];if(!f)return;var r=new FileReader();r.onload=function(){try{var d=JSON.parse(r.result);if(!d.schedule||!confirm("استبدال البيانات الحالية بالنسخة المختارة؟"))return;normalizeData(d);appData=d;S=d.schedule;save();renderAll();toast("تم استيراد النسخة بنجاح")}catch(e){toast("ملف النسخة غير صالح")}};r.readAsText(f)};
 $("#rerunOnboarding").onclick=function(){prepareOnboarding(true);openModal("onboarding")};$("#obBack").onclick=function(){showOnboardStep(Math.max(1,onboardStep-1))};$("#obNext").onclick=function(){if(!validateOnboard())return;if(onboardStep<7)showOnboardStep(onboardStep+1);else finishOnboarding()};
 $("#installApp").onclick=$("#installTop").onclick=function(){if(deferredInstall){deferredInstall.prompt();deferredInstall.userChoice.finally(function(){deferredInstall=null;$("#installTop").hidden=true})}else toast("استخدم «إضافة إلى الشاشة الرئيسية» من قائمة المتصفح إذا لم يظهر زر التثبيت")};
 window.addEventListener("beforeinstallprompt",function(e){e.preventDefault();deferredInstall=e;$("#installTop").hidden=false});window.addEventListener("hashchange",function(){var v=location.hash.slice(1);if($("#"+v))setView(v)});
}
function prepareOnboarding(revisit){
 $("#obName").value=appData.profile.name||"";$("#obTimezone").value=appData.settings.timezone||"Asia/Muscat";$("#obAnchor").value=S.anchor||C.dateKeyAt(Date.now(),appData.settings.timezone);$("#obBalance").value=appData.settings.annualBalance;onboardPattern=S.patternId&&C.presets()[S.patternId]?S.patternId:"14-14";$("#obCustomCycle").value=S.cycle.map(eventName).join("، ");choosePattern(onboardPattern,"obPatterns");showOnboardStep(1)
}
function init(){
 buildPatternPickers();bind();renderAll();setInterval(updateCountdown,1000);
 if("serviceWorker"in navigator)navigator.serviceWorker.register("sw.js").catch(function(){});scheduleReminder();
 if(!appData.onboarded){prepareOnboarding(false);openModal("onboarding")}
 var hash=location.hash.slice(1);if(hash&&$("#"+hash))setView(hash)
}
init();
})();