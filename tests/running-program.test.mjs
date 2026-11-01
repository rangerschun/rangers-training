import test from 'node:test';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import {RUNNING_DAYS,runningDay,runningRecord,runningProgress,runningToday,runningNotes} from '../docs/running-program.mjs';
import {validateWorkout} from '../docs/engine.mjs';
import {validateJournalEvent,journalRow} from '../docs/journal.mjs';
const now=new Date('2026-11-01T17:00:00Z'),date='2026-11-01',record=(extra={})=>runningRecord({player:'Demo',week:1,day:1,date,checked:[true,false,false,false],now,...extra});
test('all six-week doses and original demonstrations match Chun-Running; variants start in week 4',()=>{
 const original=RUNNING_DAYS;assert.equal(createHash('sha1').update(JSON.stringify(RUNNING_DAYS)).digest('hex'),'fc5b9b4b18aaa81fbe3870594140ada9b9d2e8ed');
 for(let week=1;week<=6;week++)for(let day=1;day<=4;day++){const plan=runningDay(week,day);assert.equal(plan.rows.length,original[day-1].rows.length);plan.rows.forEach((r,i)=>{const source=original[day-1].rows[i];assert.equal(r.dose,source.dose[week-1].replaceAll('×','x'));assert.equal(r.name,week>=4&&source.late?source.late:source.name);});}
 assert.match(runningDay(4,1).rows[1].name,/Kneeling/);const skater=runningDay(4,3).rows.at(-1);assert.equal(skater.related,true);assert.match(skater.note,/no separate sprint-out demo/);
});
test('partial and complete Running days pass existing workout and Sheet journal validators',()=>{
 for(const r of [record(),record({checked:[true,true,true,true],notes:'Actual day note'})]){validateWorkout(r,['Demo']);const event={event_id:'running-fixture-001',kind:'workout',operation:'save',player:'Demo',record:r};validateJournalEvent(event,['Demo']);const restored=JSON.parse(journalRow(event).slice(-3).join(''));assert.deepEqual(restored,r);}
 assert.equal(record().completion_status,'partial');assert.match(record().notes,/Remaining exercises/);assert.equal(record({checked:[true,true,true,true]}).completion_status,'completed');
});
test('corrections retain identity and creation time; invalid dates, empty completion and wrong-player edits are rejected',()=>{
 const first=record(),corrected=record({previous:first,notes:'Corrected note',checked:[true,true,true,true]});assert.equal(corrected.id,first.id);assert.equal(corrected.created_at,first.created_at);assert.equal(runningNotes(corrected),'Corrected note');
 for(const extra of [{checked:[false,false,false,false]},{date:'2026-11-02'},{date:'2026-02-30'},{previous:{...first,player:'Marcus'}},{notes:'x'.repeat(401)}])assert.throws(()=>record(extra));
});
test('progress counts unique completed days for only the selected player',()=>{
 const own=record({checked:[true,true,true,true]}),other=record({player:'Marcus',week:2,checked:[true,true,true,true]});const p=runningProgress([own,own,other],'Demo');assert.equal(p.completed,1);assert.deepEqual(p.weeks,[1,0,0,0,0,0]);
});
