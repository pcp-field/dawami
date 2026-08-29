import fs from "node:fs";
import assert from "node:assert/strict";

const html=fs.readFileSync("index.html","utf8");
const app=fs.readFileSync("dawami-v9-1.js","utf8");
const core=fs.readFileSync("core.js","utf8");
const sw=fs.readFileSync("sw.js","utf8");

for(const file of ["dawami-v9-1.css","manifest.webmanifest","sw.js","icon.svg"])assert.ok(fs.existsSync(file),file+" is missing");
assert.doesNotThrow(()=>new Function(core),"core.js must parse");
assert.doesNotThrow(()=>new Function(app),"dawami-v9-1.js must parse");
assert.ok(app.indexOf("var DEFAULT_COLORS=")<app.indexOf("var data=loadData()"),"color defaults must exist before loading saved data");
assert.doesNotThrow(()=>new Function(sw),"sw.js must parse");

const ids=new Set([...html.matchAll(/id="([^"]+)"/g)].map(m=>m[1]));
const refs=[...app.matchAll(/\$\("#([A-Za-z][A-Za-z0-9_-]*)"\)/g)].map(m=>m[1]);
assert.deepEqual([...new Set(refs.filter(id=>!ids.has(id)))],[]);
assert.equal(html.includes("وردية"),false);
assert.equal(app.includes("وردية"),false);
assert.equal(html.includes('class="bottom-nav"'),false);
assert.ok(html.includes('data-open-page="calendar"'));
assert.ok(html.includes('class="page active app-panel calendar-panel" id="calendar"'),"calendar must be the visible first screen");
assert.ok(app.includes(':"calendar";showPage(initial'),"calendar must be the default route");
assert.ok(html.includes('class="panel-close calendar-settings"'),"calendar must expose the settings gear");
assert.ok(html.includes('class="today-button status-launch"'),"calendar must open the status popup");
assert.ok(html.includes('class="dashboard-sheet"'),"status summary must be a bottom sheet");
assert.ok(html.includes('data-open-page="settings"'));
assert.ok(html.includes('calendar-panel" id="calendar"'));
assert.ok(html.includes('class="settings-card color-studio"'));
assert.equal((html.match(/data-color-key=/g)||[]).length,8);
assert.equal((html.match(/data-palette=/g)||[]).length,5);
assert.ok(app.includes("DEFAULT_COLORS"));
assert.ok(app.includes('version:4'));
assert.ok(app.includes('"dawami-cycle-prefs"'));
assert.ok(app.includes('"dawami-github-schedule"'));
assert.ok(html.includes("dawami-v9-1.css?v=9.1"));
assert.ok(html.includes("dawami-v9-1.js?v=9.1"));

const manifest=JSON.parse(fs.readFileSync("manifest.webmanifest","utf8"));
assert.equal(manifest.dir,"rtl");
console.log("Dawami v9 rebuild: all tests passed");
