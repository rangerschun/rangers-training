import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFileSync} from 'node:fs';
import {isTeamAveragePlayer,TEAM_AVERAGE_SCOPE} from '../docs/team-averages.mjs';
import {applyGameChangerExposure} from '../docs/gamechanger-data-adapter.mjs';
import {gcComparisons} from '../docs/gamechanger-metrics.mjs';
test('personal-use names are excluded, including case/spacing/full names; team members remain',()=>{
 for(const name of ['Marcus','Dominic','Demo',' marcus Smith ','DOMINIC Brown','Demo Account'])assert.equal(isTeamAveragePlayer(name),false);
 for(const name of ['Aidan','Ambrose','Andre','Demond','Marcusson'])assert.equal(isTeamAveragePlayer(name),true);
});
const person=(name,ab,h,ip,so,bb)=>({name,batting:{GP:1,PA:ab,AB:ab,H:h,TB:h,BB:0,HBP:0,SF:0,SO:0,SB:0,CS:0},pitching:{IP:ip,SO:so,BB:bb,H:1},fielding:{TC:1,PO:1,A:0}});
test('GameChanger weights team rates by eligible AB and IP while preserving personal rows',()=>{
 const players=[person('Aidan',10,5,1.1,4,1),person('Ambrose',30,3,2.2,2,2),...['Marcus','Dominic','Demo'].map(name=>person(name,1000,1000,100,1000,1))];
 const personal=JSON.stringify(players.map(p=>p.batting));const season={players,benchmarks:{batting:{AVG:{value:.9}},pitching:{MPHFB:{value:99}},fielding:{}}};
 applyGameChangerExposure(season);assert.equal(season.players.length,5);assert.equal(JSON.stringify(players.map(p=>p.batting)),personal);
 assert.equal(season.benchmarks.batting.AVG.value,.2);assert.equal(season.benchmarks.pitching['SO/BB'].value,2);assert.equal(season.benchmarks.pitching.SO.unit_rate,1.5);assert.equal(season.benchmarks.pitching.WHIP.value,1.25);assert.equal(season.benchmarks.pitching.MPHFB.value,null);
 assert.equal(players[2].pitching['SO/BB'],1000);
});
test('all personal-use or empty rosters give no finite team rate',()=>{
 for(const players of [[],[person('Demo',10,10,1,3,1)]]){const s=applyGameChangerExposure({players});assert.equal(s.benchmarks.pitching['SO/BB'].value,null);assert.equal(s.benchmarks.batting['K%'].value,null);}
});
test('raw CSV comparison filters both numerator and denominator, preserves personal stats',()=>{
 const row=(name,ab,h,ip)=>{const r=Array(174).fill('0');r[2]=name;r[3]='1';r[4]=r[5]=String(ab);r[10]=String(h);r[43]=String(h);r[54]=ip;return r;};
 const rows=[row('Aidan',10,5,'1.1'),row('Ambrose',30,3,'2.2'),row('Marcus',1000,1000,'100.0')],season={rows,totals:row('Totals',1040,1008,'104.0'),era_innings:7};
 const avg=gcComparisons(season,rows[2],'batting').find(m=>m.id==='avg');assert.equal(avg.player,1);assert.equal(avg.team,.2);
});
test('Google team summary excludes personal-use entries but permits those players to read it',()=>{
 const grid=(player,duration)=>({player,source_template_id:'concentration-grid-100',completion_status:'completed',completion_confirmed:true,duration_minutes:duration});
 const records=[grid('Aidan',1),grid('Ambrose',2),...['Marcus','Dominic','Demo'].map(n=>grid(n,60)),{...grid('Aidan',10),completion_status:'partial'}];
 const before=JSON.stringify(records);let reads=0;const sheet={getRange:()=>({getValues:()=>[['event_id']]}),getLastRow:()=>1};
 const context=vm.createContext({authenticatePlayerSession_:r=>{if(r.token!=='valid')throw Error('Sign in required');},PropertiesService:{getScriptProperties:()=>({getProperty:()=>JSON.stringify(['Aidan','Ambrose','Marcus','Dominic','Demo'])})},SpreadsheetApp:{openById:()=>{reads++;return {getSheetByName:()=>sheet};}},TRAINING_SHEET_ID:'test-copy',ENTRY_HEADERS:['event_id'],workoutsFromJournal:()=>records});
 vm.runInContext(readFileSync(new URL('../backend/vision-summary.gs',import.meta.url),'utf8'),context);
 assert.throws(()=>context.getConcentrationSummary({player:'Demo',token:'bad'}),/Sign in/);assert.equal(reads,0);
 const result=JSON.parse(context.getConcentrationSummary(JSON.stringify({player:'Demo',token:'valid'})));assert.equal(result.session_count,2);assert.equal(result.average_ms,90000);assert.equal(result.team_scope,TEAM_AVERAGE_SCOPE);assert.equal(JSON.stringify(records),before);
});
test('the actual published runtime uses the same exclusion rule and preserves personal stats',()=>{
 const bundle=readFileSync(new URL('../docs/app-provelocity-b79892551b14.mjs',import.meta.url),'utf8'),prefix=bundle.slice(0,bundle.indexOf('// Exact 32-inch program')),start=bundle.indexOf('const gcRate='),end=bundle.indexOf('\nconst ROSTER=',start);
 const context=vm.createContext({gcNumber:v=>v===null||v===undefined||v===''?null:Number(v),gcOuts:v=>{const m=String(v??'').match(/^(\d+)(?:\.([012]))?$/);return m?Number(m[1])*3+Number(m[2]??0):null;}});
 vm.runInContext(prefix+bundle.slice(start,end).replaceAll('export ','')+';globalThis.api={applyGameChangerExposure,isTeamAveragePlayer}',context);
 const players=[person('Aidan',10,5,1,3,1),person('Marcus',100,100,100,100,1),person('Dominic',100,100,100,100,1),person('Demo',100,100,100,100,1)],season=context.api.applyGameChangerExposure({players});
 assert.equal(season.benchmarks.batting.AVG.value,.5);assert.equal(season.benchmarks.pitching['SO/BB'].value,3);assert.equal(season.players[3].pitching['SO/BB'],100);assert.equal(season.players.length,4);
});
