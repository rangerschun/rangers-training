import {RUNNING_PROGRAMS,OTA_BEGINNER_SESSIONS,otaBeginnerProgress,otaSession,otaSource,otaRecordProgram,otaWorkoutRecord,otaUserNotes,otaComplete} from './ota-running-program.mjs?v=20261101';
import {runningToday} from './running-program.mjs?v=20261101';
export function startOtaRunning({flow,players,element:$,validate,ready,onChooseProgram}){
 const make=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e;};
 let program='ota-beginner',week=1,day=1,date=runningToday(),dirty=false;
 const player=()=>$('running-player').value;
 const own=()=>flow.records().filter(r=>r.player===player()&&otaRecordProgram(r)===program);
 const current=()=>own().find(r=>r.source_template_id===otaSource(program,week,day)&&(program==='ota-beginner'||r.session_date===date));
 const guard=()=>!dirty||window.confirm('Discard unsaved Running changes?');
 const locked=()=>program==='ota-advanced'&&otaBeginnerProgress(flow.records(),player()).completed<48;
 function error(e){$('running-ota-error').hidden=false;$('running-ota-error').textContent=e.message;}
 function updateDraft(){$('running-ota-save').disabled=!dirty||!$('running-ota-complete').checked||locked();}
 for(const [id,count,label]of [['running-ota-week',12,'Week'],['running-ota-day',4,'Day']]){const select=$(id);select.replaceChildren();for(let i=1;i<=count;i++){const o=make('option','',`${label} ${i}`);o.value=String(i);select.append(o);}}
 function renderHistory(){
  const box=$('running-ota-history');box.replaceChildren();const records=own().sort((a,b)=>b.session_date.localeCompare(a.session_date)||String(b.updated_at).localeCompare(String(a.updated_at)));
  $('running-ota-clear').disabled=!records.length;
  if(!records.length){box.append(make('p','field-help','Your saved sessions for this program will appear here.'));return;}
  for(const r of records){const row=make('article','running-history-row'),text=make('div');text.append(make('strong','',r.title),make('p','',r.session_date+' · Completed'));const b=make('button','secondary-button','Review / correct');b.type='button';b.addEventListener('click',()=>{if(!guard())return;const m=r.source_template_id.match(/-w(\d+)-d(\d+)$/);if(m){week=Number(m[1]);day=Number(m[2]);}date=r.session_date;dirty=false;render();$('running-ota-controls').scrollIntoView({behavior:'smooth',block:'start'});});row.append(text,b);box.append(row);}
 }
 function render(){
  const count=otaBeginnerProgress(flow.records(),player()).completed,isBeginner=program==='ota-beginner',r=current(),session=otaSession(program,week,day);
  $('running-ota-error').hidden=true;$('running-ota-announcement').textContent='';
  $('running-ota-title').textContent=RUNNING_PROGRAMS[program];
  $('running-ota-summary').textContent=isBeginner?`${count} / 48 Beginner sessions completed · 12 weeks · Four sessions per week`:`${own().length} selected-reference workout${own().length===1?'':'s'} saved`;
  $('running-ota-lock').hidden=!locked();$('running-ota-form').hidden=locked();$('running-ota-history-card').hidden=locked();
  $('running-ota-lock-count').textContent=`${count} / 48 Beginner sessions completed. Finish all 12 weeks of Beginner to unlock Advanced.`;
  $('running-ota-lock-progress').value=count;
  $('running-ota-week-label').hidden=$('running-ota-day-label').hidden=!isBeginner;
  $('running-ota-week').value=String(week);$('running-ota-day').value=String(day);
  $('running-ota-coverage').textContent=isBeginner?'All 48 sessions from the Chun-Running Beginner program are included. Check completion only after finishing all the listed work.':'Selected workout reference from Chun-Running. The full '+(program==='ota-bodyweight'?'Body Weight':'Advanced')+' schedule has not been imported in the source site.';
  $('running-ota-session-title').textContent=isBeginner?`Week ${week} / Day ${day} · ${session.title}`:session.title;
  $('running-ota-stage').textContent=isBeginner?`Phase ${session.phase} · ${session.stage}`:'Complete the reference workout listed below.';
  $('running-ota-details').textContent=session.details;
  $('running-ota-date').value=r?.session_date??date;$('running-ota-date').max=runningToday();
  $('running-ota-notes').value=otaUserNotes(r);$('running-ota-complete').checked=Boolean(r&&otaComplete(r));$('running-ota-complete').disabled=Boolean(r);$('running-ota-undo').hidden=!r;
  dirty=false;updateDraft();renderHistory();
 }
 for(const id of ['running-ota-complete','running-ota-notes'])$(id).addEventListener('input',()=>{dirty=true;updateDraft();});
 $('running-ota-complete').addEventListener('change',()=>{dirty=true;updateDraft();});
 $('running-ota-week').addEventListener('change',()=>{if(!guard()){$('running-ota-week').value=String(week);return;}week=Number($('running-ota-week').value);day=1;date=runningToday();dirty=false;render();});
 $('running-ota-day').addEventListener('change',()=>{if(!guard()){$('running-ota-day').value=String(day);return;}day=Number($('running-ota-day').value);date=runningToday();dirty=false;render();});
 $('running-ota-date').addEventListener('change',()=>{if(program==='ota-beginner'){dirty=true;updateDraft();return;}if(!guard()){$('running-ota-date').value=date;return;}date=$('running-ota-date').value;render();});
 $('running-ota-go-beginner').addEventListener('click',()=>onChooseProgram('ota-beginner'));
 $('running-ota-form').addEventListener('submit',event=>{event.preventDefault();try{
  if(!ready(player()))throw Error('Wait for Google Sheet to finish loading or saving.');
  const record=otaWorkoutRecord({program,player:player(),week,day,date:$('running-ota-date').value,notes:$('running-ota-notes').value,completed:$('running-ota-complete').checked,previous:current(),records:flow.records()});validate(record,players);dirty=false;flow.commit([...flow.records().filter(r=>r.id!==record.id),record]);render();$('running-ota-announcement').textContent='Session completed · Waiting for Google Sheet confirmation.';
 }catch(e){dirty=true;updateDraft();error(e);}});
 $('running-ota-undo').addEventListener('click',()=>{try{const r=current();if(!ready(player()))throw Error('Wait for Google Sheet to finish loading or saving.');if(!r||!window.confirm('Undo this saved session completion?'+(program==='ota-beginner'?' Advanced will lock again until all 48 Beginner sessions are complete.':'')))return;dirty=false;flow.commit(flow.records().filter(item=>item.id!==r.id));render();$('running-ota-announcement').textContent='Completion removed · Waiting for Google Sheet confirmation.';}catch(e){error(e);}});
 $('running-ota-clear').addEventListener('click',()=>{try{const records=own();if(!ready(player()))throw Error('Wait for Google Sheet to finish loading or saving.');if(!records.length||!window.confirm(`Clear all ${records.length} ${RUNNING_PROGRAMS[program]} entries for ${player()}?${program==='ota-beginner'?' Advanced will lock again.':''}`))return;const ids=new Set(records.map(r=>r.id));dirty=false;flow.commit(flow.records().filter(r=>!ids.has(r.id)));render();$('running-ota-announcement').textContent='Program entries cleared · Waiting for Google Sheet confirmation.';}catch(e){error(e);}});
 return {activate(next){if(next!==program){program=next;week=1;day=1;date=runningToday();dirty=false;}render();},hasDraft:()=>dirty,reset(){dirty=false;week=1;day=1;date=runningToday();},refresh:render};
}
