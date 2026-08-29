import fs from "node:fs";
import assert from "node:assert/strict";

const html=fs.readFileSync("index.html","utf8");
const sw=fs.readFileSync("sw.js","utf8");
const manifest=JSON.parse(fs.readFileSync("manifest.webmanifest","utf8"));
for(const file of ["manifest.webmanifest","sw.js","icon.svg","holidays-om.json"])assert.ok(fs.existsSync(file),file+" is missing");
assert.doesNotThrow(()=>new Function(sw),"service worker must parse");
assert.ok(html.includes('data-build="10.0"'));
assert.ok(html.includes("maximum-scale=1,user-scalable=no"),"mobile zoom disabled");
assert.equal(html.includes('class="bottom-nav"'),false,"calendar-first UI has no persistent nav");

const style=html.match(/<style data-inline="dawami-v10">([\s\S]*?)<\/style>/);
assert.ok(style&&style[1].length>30000,"complete mobile design must be inlined");
for(const token of ["view-week","view-list","selection-bar","touchSheetIn","prefers-reduced-motion","safe-area-inset-bottom"])assert.ok(style[1].includes(token),token+" CSS missing");

const scripts=[...html.matchAll(/<script data-inline="[^"]+">([\s\S]*?)<\/script>/g)].map(m=>m[1]);
assert.equal(scripts.length,2);
scripts.forEach((code,i)=>assert.doesNotThrow(()=>new Function(code),"inline script "+i+" must parse"));
const [core,app]=scripts;

const ids=new Set([...html.replace(/<script[\s\S]*?<\/script>/g,"").matchAll(/id="([^"]+)"/g)].map(m=>m[1]));
const refs=[...app.matchAll(/\$\("#([A-Za-z][A-Za-z0-9_-]*)"/g)].map(m=>m[1]);
assert.deepEqual([...new Set(refs.filter(id=>!ids.has(id)))],[],"all referenced IDs exist");

for(const token of [
 "function normalize(","dawami-github-schedule","dawami-github-prefs","version:5",
 "function renderCalendar(","view-week","view-list","selectedDates","function undoLastChange",
 "function renderLeaves(","function saveLeaveRecord","function renderInsights","function renderPay",
 "function exportICS","function exportCSV","function shareScheduleImage","function compareDataFile",
 "function scheduleNotify","function buildSetup","function renderSetupPreview","function parseCycle",
 "function installTouchUX","function bindDaySheet"
])assert.ok(app.includes(token),token+" missing");

for(const id of [
 "calendar","calendarGrid","calendarToolsModal","selectionBar","leavesModal","insightsModal","shareModal",
 "setupModal","setupPreview","annualBalance","payBasic","exportICS","exportCSV","installApp","resetApp"
])assert.ok(ids.has(id),id+" UI missing");

const markup=html.replace(/<script[\s\S]*?<\/script>/g,"");
assert.equal(markup.includes("وردية"),false,"use plain دوام wording");
assert.equal(app.includes("وردية"),false);
assert.equal(core.includes("وردية"),false);
assert.ok(html.includes('class="page active app-panel calendar-panel" id="calendar"'));
assert.ok(html.includes('class="today-button status-launch"'),"status stays an optional bottom sheet");
assert.equal((html.match(/data-calendar-view=/g)||[]).length,3);
assert.equal((html.match(/data-color-key=/g)||[]).length,8);
assert.ok((html.match(/data-palette=/g)||[]).length>=5);
assert.ok(sw.includes('CACHE="dawami-v10-0"'));
assert.equal(manifest.dir,"rtl");
assert.equal(manifest.display,"standalone");
assert.equal(manifest.start_url,"./#calendar");
console.log("Dawami 10 smoke: all tests passed");
