import {createRequire} from "node:module";
import assert from "node:assert/strict";
const require=createRequire(import.meta.url);
const C=require("./core.js");

const schedule=(id,anchor="2026-08-04")=>({anchor,patternId:id,cycle:C.clone(C.presets()[id].cycle),overrides:{},leaves:[]});
const base=schedule("14-14");

assert.equal(C.daysInMonth(2028,2),29,"leap year");
assert.equal(C.daysInMonth(2027,2),28);
assert.equal(C.primaryEvent(base,"2026-08-04").type,"day");
assert.equal(C.primaryEvent(base,"2026-08-17").type,"day");
assert.equal(C.primaryEvent(base,"2026-08-18").type,"off");
assert.equal(C.primaryEvent(base,"2026-08-31").type,"off");
assert.equal(C.primaryEvent(base,"2026-09-01").type,"day");
assert.equal(C.primaryEvent(base,"2026-07-21").type,"off");

const muscat="Asia/Muscat";
const overnight={type:"night",start:"19:00",end:"07:00"};
const overnightInterval=C.interval("2026-08-28",overnight,muscat);
assert.equal((overnightInterval.end-overnightInterval.start)/3600000,12,"overnight crosses midnight");
assert.equal(C.eventHours(overnight),12);
assert.equal(C.eventHours({type:"overtime",start:"08:00",end:"12:00"}),4);

const mixed=schedule("2d2n4","2026-08-01");
assert.equal(C.primaryEvent(mixed,"2026-08-03").type,"night");
assert.equal(C.primaryEvent(mixed,"2026-08-05").type,"off");
mixed.overrides["2026-08-05"]=[
 {type:"off",label:"راحة"},
 {type:"overtime",start:"08:00",end:"12:00",note:"تغطية"}
];
assert.equal(C.eventsForDate(mixed,"2026-08-05").length,2,"multiple events");
assert.equal(C.eventsForDate(mixed,"2026-08-05")[1].note,"تغطية");
assert.equal(C.monthStats(mixed,2026,8,12).overtimeHours,4);
delete mixed.overrides["2026-08-05"];
assert.equal(C.primaryEvent(mixed,"2026-08-05").type,"off","single-day reset");

const custom={anchor:"2026-01-01",patternId:"custom",cycle:[
 {type:"day",start:"07:00",end:"19:00"},
 {type:"day",start:"07:00",end:"19:00"},
 {type:"night",start:"19:00",end:"07:00"},
 {type:"night",start:"19:00",end:"07:00"},
 {type:"off"},{type:"off"},{type:"off"},{type:"off"}
],overrides:{},leaves:[]};
assert.deepEqual(["2026-01-01","2026-01-03","2026-01-05","2026-01-09"].map(k=>C.primaryEvent(custom,k).type),["day","night","off","day"]);

mixed.leaves=[{id:"a",type:"annual",start:"2026-12-30",end:"2027-01-03",half:false}];
assert.equal(C.primaryEvent(mixed,"2027-01-01").type,"annual","leave crosses year");
assert.ok(C.annualLeaveUsed(mixed,2026,false)>=0);
mixed.leaves.push({id:"b",type:"annual",start:"2026-08-10",end:"2026-08-10",half:true});
assert.equal(C.annualLeaveUsed(mixed,2026,true)%0.5,0,"half-day precision");

const block=C.restBlock(base,"2026-08-10",false);
assert.deepEqual(
 {start:block.start,end:block.end,returnDate:block.returnDate,length:block.length},
 {start:"2026-08-18",end:"2026-08-31",returnDate:"2026-09-01",length:14}
);
assert.equal(C.workDaysBetween(base,"2026-08-10",block.start),8,"rest days excluded from remaining work");
const stats=C.monthStats(base,2026,8,12);
assert.deepEqual({work:stats.workDays,off:stats.offDays,hours:stats.hours},{work:14,off:17,hours:168});

const start=C.zonedEpoch("2026-08-04","08:00",muscat);
const status=C.nowStatus(base,start,muscat);
assert.equal(status.kind,"work");
assert.equal(status.label,"أنت في الدوام الآن");
assert.ok(Array.isArray(C.bestLeave(base,"2026-08-01",180,3)));
assert.ok(C.longestStreak(base,"2026-08-01",60,events=>events.some(C.isWork)).length>=14);

console.log("Dawami 10 core: all tests passed");
