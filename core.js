(function(root,factory){
  var api=factory();
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
  root.DawamiCore=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(){
  "use strict";
  var DAY=86400000;
  var REST_TYPES=["off","annual","sick","emergency","comp","unpaid","leave"];
  var WORK_TYPES=["work","day","night","overtime","training"];

  function pad(n){return String(n).padStart(2,"0")}
  function toDay(k){var p=String(k).slice(0,10).split("-").map(Number);return Math.floor(Date.UTC(p[0],p[1]-1,p[2])/DAY)}
  function fromDay(n){var d=new Date(n*DAY);return d.getUTCFullYear()+"-"+pad(d.getUTCMonth()+1)+"-"+pad(d.getUTCDate())}
  function addDays(k,n){return fromDay(toDay(k)+n)}
  function diffDays(a,b){return toDay(b)-toDay(a)}
  function mod(n,m){return((n%m)+m)%m}
  function range(a,b){var out=[];for(var n=toDay(a),e=toDay(b);n<=e;n++)out.push(fromDay(n));return out}
  function daysInMonth(y,m){return new Date(Date.UTC(y,m,0)).getUTCDate()}
  function monthKeyParts(k){var p=k.split("-").map(Number);return{year:p[0],month:p[1],day:p[2]}}

  function presets(){
    return{
      "14-14":{name:"14 دوام / 14 راحة",cycle:repeat({type:"day",label:"نهاري",start:"07:00",end:"19:00"},14).concat(repeat({type:"off",label:"راحة"},14))},
      "28-14":{name:"28 دوام / 14 راحة",cycle:repeat({type:"day",label:"نهاري",start:"07:00",end:"19:00"},28).concat(repeat({type:"off",label:"راحة"},14))},
      "7-7":{name:"7 دوام / 7 راحة",cycle:repeat({type:"day",label:"نهاري",start:"07:00",end:"19:00"},7).concat(repeat({type:"off",label:"راحة"},7))},
      "4-4":{name:"4 دوام / 4 راحة",cycle:repeat({type:"day",label:"نهاري",start:"07:00",end:"19:00"},4).concat(repeat({type:"off",label:"راحة"},4))},
      "2d2n4":{name:"2 نهاري / 2 ليلي / 4 راحة",cycle:repeat({type:"day",label:"نهاري",start:"07:00",end:"19:00"},2).concat(repeat({type:"night",label:"ليلي",start:"19:00",end:"07:00"},2),repeat({type:"off",label:"راحة"},4))},
      "5-2":{name:"5 دوام / يومان راحة",cycle:repeat({type:"day",label:"نهاري",start:"08:00",end:"16:00"},5).concat(repeat({type:"off",label:"راحة"},2))}
    }
  }
  function clone(v){return JSON.parse(JSON.stringify(v))}
  function repeat(v,n){var a=[];for(var i=0;i<n;i++)a.push(clone(v));return a}
  function normalizeEvent(e){
    if(!e)return{type:"off",label:"راحة"};
    if(typeof e==="string")e={type:e};
    var type=e.type||"off";
    var labels={work:"دوام",day:"نهاري",night:"ليلي",off:"راحة",annual:"سنوية",sick:"مرضية",emergency:"طارئة",comp:"تعويضية",unpaid:"بدون راتب",training:"تدريب",overtime:"إضافي",leave:"إجازة"};
    return Object.assign({type:type,label:e.label||labels[type]||"وردية",start:e.start||((type==="night")?"19:00":"07:00"),end:e.end||((type==="night")?"07:00":"19:00"),note:"",location:"",job:""},e)
  }
  function isWork(e){return !!e&&WORK_TYPES.indexOf(e.type)>=0}
  function isRest(e){return !e||REST_TYPES.indexOf(e.type)>=0}
  function leaveOn(data,k){
    var list=(data&&data.leaves)||[];
    for(var i=list.length-1;i>=0;i--){var l=list[i];if(k>=l.start&&k<=l.end)return l}
    return null
  }
  function baseEvents(data,k){
    data=data||{};var cycle=data.cycle||[];if(!cycle.length)return[normalizeEvent("off")];
    var pos=mod(diffDays(data.anchor||k,k),cycle.length),slot=cycle[pos];
    return(Array.isArray(slot)?slot:[slot]).map(normalizeEvent)
  }
  function eventsForDate(data,k){
    var leave=leaveOn(data,k);
    if(leave){
      var le=normalizeEvent({type:leave.type||"annual",label:leave.name||leave.label,half:!!leave.half,note:leave.reason||""});
      if(leave.half)return[le].concat(baseEvents(data,k).filter(isWork));
      return[le]
    }
    var over=data&&data.overrides&&data.overrides[k];
    if(over!==undefined&&over!==null)return(Array.isArray(over)?over:[over]).map(normalizeEvent);
    return baseEvents(data,k)
  }
  function primaryEvent(data,k){
    var ev=eventsForDate(data,k);
    return ev.find(function(x){return isWork(x)})||ev[0]||normalizeEvent("off")
  }
  function zonedParts(ms,tz){
    var parts=new Intl.DateTimeFormat("en-CA",{timeZone:tz||"Asia/Muscat",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",second:"2-digit",hourCycle:"h23"}).formatToParts(new Date(ms)),o={};
    parts.forEach(function(p){if(p.type!=="literal")o[p.type]=Number(p.value)});
    return{year:o.year,month:o.month,day:o.day,hour:o.hour,minute:o.minute,second:o.second}
  }
  function dateKeyAt(ms,tz){var p=zonedParts(ms,tz);return p.year+"-"+pad(p.month)+"-"+pad(p.day)}
  function zonedEpoch(k,time,tz){
    var p=k.split("-").map(Number),t=(time||"00:00").split(":").map(Number),target=Date.UTC(p[0],p[1]-1,p[2],t[0]||0,t[1]||0,0),guess=target;
    for(var i=0;i<4;i++){var z=zonedParts(guess,tz),shown=Date.UTC(z.year,z.month-1,z.day,z.hour,z.minute,z.second),delta=target-shown;guess+=delta;if(!delta)break}
    return guess
  }
  function interval(k,e,tz){
    e=normalizeEvent(e);if(!isWork(e))return null;
    var start=zonedEpoch(k,e.start,tz),end=zonedEpoch(k,e.end,tz);
    if(end<=start)end=zonedEpoch(addDays(k,1),e.end,tz);
    return{start:start,end:end,event:e,date:k}
  }
  function nextShift(data,now,tz,limit){
    var today=dateKeyAt(now,tz),best=null;
    for(var i=-1;i<(limit||740);i++){
      var k=addDays(today,i),ev=eventsForDate(data,k);
      for(var j=0;j<ev.length;j++){var it=interval(k,ev[j],tz);if(it&&it.end>now&&(!best||it.start<best.start))best=it}
      if(best&&best.start>now&&i>3)break
    }
    return best
  }
  function nowStatus(data,now,tz){
    now=now||Date.now();tz=tz||"Asia/Muscat";var today=dateKeyAt(now,tz),active=null;
    [addDays(today,-1),today].forEach(function(k){eventsForDate(data,k).forEach(function(e){var it=interval(k,e,tz);if(it&&it.start<=now&&it.end>now)active=it})});
    var next=nextShift(data,now,tz);
    if(active)return{kind:"work",label:"أنت في الدوام الآن",event:active.event,until:active.end,nextShift:next,date:today};
    var ev=primaryEvent(data,today),leave=leaveOn(data,today);
    if(leave)return{kind:"leave",label:"أنت في إجازة الآن",event:ev,until:next?next.start:null,nextShift:next,date:today};
    if(isRest(ev))return{kind:"off",label:"أنت في يوم راحة",event:ev,until:next?next.start:null,nextShift:next,date:today};
    if(next&&next.start>now)return{kind:"upcoming",label:"ورديتك تبدأ بعد…",event:next.event,until:next.start,nextShift:next,date:today};
    return{kind:"off",label:"لا توجد وردية الآن",event:ev,until:next?next.start:null,nextShift:next,date:today}
  }
  function restBlock(data,from,includeCurrent,limit){
    var start=null,k=from,max=limit||740;
    if(includeCurrent&&isRest(primaryEvent(data,k)))start=k;
    for(var i=0;i<max&&!start;i++){var x=addDays(k,i);if(isRest(primaryEvent(data,x)))start=x}
    if(!start)return null;
    var end=start;
    for(var j=1;j<max;j++){var n=addDays(start,j);if(!isRest(primaryEvent(data,n)))break;end=n}
    var ret=addDays(end,1),first=eventsForDate(data,ret).find(isWork)||primaryEvent(data,ret);
    return{start:start,end:end,returnDate:ret,length:diffDays(start,end)+1,firstShift:first}
  }
  function workDaysBetween(data,a,b){
    var n=0;for(var d=toDay(a),e=toDay(b);d<e;d++)if(eventsForDate(data,fromDay(d)).some(isWork))n++;return n
  }
  function monthStats(data,y,m,hours){
    var total=daysInMonth(y,m),out={workDays:0,offDays:0,leaveDays:0,night:0,day:0,overtime:0,hours:0};
    for(var d=1;d<=total;d++){var k=y+"-"+pad(m)+"-"+pad(d),ev=eventsForDate(data,k),worked=ev.some(isWork),leave=leaveOn(data,k);if(worked)out.workDays++;else out.offDays++;if(leave)out.leaveDays+=(leave.half?.5:1);ev.forEach(function(e){if(e.type==="night")out.night++;if(e.type==="day"||e.type==="work")out.day++;if(e.type==="overtime")out.overtime++;if(isWork(e)){var sh=Number(e.hours);out.hours+=isFinite(sh)&&sh>0?sh:(hours||12)}})}
    return out
  }
  function annualLeaveUsed(data,year,deductRest){
    var used=0;(data.leaves||[]).filter(function(l){return(l.type||"annual")==="annual"}).forEach(function(l){range(l.start,l.end).forEach(function(k){if(Number(k.slice(0,4))!==year)return;if(l.half){used+=.5;return}if(deductRest||baseEvents(data,k).some(isWork))used++})});return used
  }
  function bestLeave(data,from,horizon,maxLeave){
    var candidates=[],seen={},days=horizon||240,max=maxLeave||3,startDay=toDay(from);
    for(var s=-7;s<days;s++){
      for(var len=5;len<=16;len++){
        var a=fromDay(startDay+s),b=fromDay(startDay+s+len-1),work=[];
        for(var d=toDay(a);d<=toDay(b);d++){var k=fromDay(d);if(eventsForDate(data,k).some(isWork))work.push(k)}
        if(work.length<1||work.length>max)continue;
        var left=primaryEvent(data,addDays(a,-1)),right=primaryEvent(data,addDays(b,1));
        if(!isWork(left)&&!isWork(right)&&!seen[work.join("|")]){
          seen[work.join("|")]=1;candidates.push({start:work[0],end:work[work.length-1],leaveDays:work.length,totalBreak:len,blockStart:a,blockEnd:b,score:len*10-work.length})
        }
      }
    }
    return candidates.sort(function(a,b){return b.score-a.score||a.start.localeCompare(b.start)}).slice(0,5)
  }
  function longestStreak(data,from,days,predicate){
    var best=0,current=0,bestStart=from,start=from;
    for(var i=0;i<days;i++){var k=addDays(from,i),ok=predicate(eventsForDate(data,k),k);if(ok){if(!current)start=k;current++;if(current>best){best=current;bestStart=start}}else current=0}
    return{length:best,start:bestStart,end:addDays(bestStart,Math.max(0,best-1))}
  }
  return{DAY:DAY,presets:presets,clone:clone,repeat:repeat,toDay:toDay,fromDay:fromDay,addDays:addDays,diffDays:diffDays,range:range,daysInMonth:daysInMonth,monthKeyParts:monthKeyParts,normalizeEvent:normalizeEvent,isWork:isWork,isRest:isRest,leaveOn:leaveOn,baseEvents:baseEvents,eventsForDate:eventsForDate,primaryEvent:primaryEvent,zonedParts:zonedParts,dateKeyAt:dateKeyAt,zonedEpoch:zonedEpoch,interval:interval,nextShift:nextShift,nowStatus:nowStatus,restBlock:restBlock,workDaysBetween:workDaysBetween,monthStats:monthStats,annualLeaveUsed:annualLeaveUsed,bestLeave:bestLeave,longestStreak:longestStreak};
});