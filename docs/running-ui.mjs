import {RUNNING_DAYS,RUNNING_WEEKS,runningDay,runningSource,runningRecord,runningProgress,runningNotes,runningToday} from './running-program.mjs?v=20261101';
export function startRunning({players,flow,element:$,validate,ready=()=>true}){
 const make=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e;};
 let player='',week=1,day=1,dirty=false;
 const picker=$('running-player'),weekPicker=$('running-week'),dayPicker=$('running-day');
 for(const [select,options]of [[picker,[['','Choose a player'],...players.map(p=>[p,p])]], [weekPicker,RUNNING_WEEKS.map(w=>[w,'Week '+w])], [dayPicker,RUNNING_DAYS.map((d,i)=>[i+1,d.day+' · '+d.focus])]]){
  select.replaceChildren();for(const [value,label]of options){const o=make('option','',label);o.value=String(value);select.append(o);}
 }
 const own=()=>flow.records().filter(r=>r.player===picker.value&&/^driveline-running-w[1-6]-d[1-4]$/.test(r.source_template_id??''));
 const current=()=>own().find(r=>r.source_template_id===runningSource(week,day));
 const guard=()=>!dirty||window.confirm('Discard unsaved Running changes?');
 function clearError(){$('running-error').hidden=true;$('running-error').textContent='';}
 function error(e){$('running-error').textContent=e.message;$('running-error').hidden=false;}
 function progress(){
  const p=runningProgress(own(),picker.value);$('running-summary').textContent=`${p.completed} / 24 workouts completed · Six weeks · Four training days per week`;
  for(const o of weekPicker.options){const w=Number(o.value),count=p.weeks[w-1];o.textContent=`Week ${w}${count===4?' · X':''} · ${count}/4 completed`;}
  for(const o of dayPicker.options){const d=Number(o.value),r=own().find(r=>r.source_template_id===runningSource(week,d));o.textContent=`${r?.completion_status==='completed'?'X · ':''}${RUNNING_DAYS[d-1].day} · ${RUNNING_DAYS[d-1].focus}`;}
  weekPicker.value=String(week);dayPicker.value=String(day);
 }
 function updateDraft(){
  const checks=[...$('running-exercises').querySelectorAll('input[type="checkbox"]')],count=checks.filter(e=>e.checked).length;
  $('running-day-progress').textContent=`${count} / ${checks.length} exercises checked${dirty?' · Unsaved changes':''}`;
  $('running-save').disabled=!picker.value||count===0||!dirty;
 }
 function history(){
  const box=$('running-history');box.replaceChildren();const records=own().sort((a,b)=>b.session_date.localeCompare(a.session_date)||b.updated_at.localeCompare(a.updated_at));
  $('running-clear').disabled=!records.length;
  if(!records.length){box.append(make('p','field-help','Your saved Running workouts will appear here.'));return;}
  for(const r of records){const m=r.source_template_id.match(/w([1-6])-d([1-4])$/),row=make('article','running-history-row'),text=make('div');text.append(make('strong','',`Week ${m[1]} · ${RUNNING_DAYS[Number(m[2])-1].day}`),make('p','',`${r.session_date} · ${r.completion_status==='completed'?'Completed':'In progress'} · ${r.exercises.filter(e=>e.completed).length}/${r.exercises.length} exercises`));
   const b=make('button','secondary-button','Review / correct');b.type='button';b.addEventListener('click',()=>{if(!guard())return;week=Number(m[1]);day=Number(m[2]);dirty=false;render();$('running-controls').scrollIntoView({behavior:'smooth',block:'start'});});row.append(text,b);box.append(row);
  }
 }
 function render(){
  clearError();$('running-announcement').textContent='';const r=current(),plan=runningDay(week,day);progress();
  $('running-focus').textContent=`Week ${week} · ${plan.day} · ${plan.focus}`;
  $('running-variation').textContent=week>=4?'Weeks 4–6 include kneeling starts, hurdle and skater sprint-outs, and competition in the T Drill.':'Weeks 1–3 use the original start and hurdle variations. Exercise changes begin in Week 4.';
  $('running-date').value=r?.session_date??runningToday();$('running-date').max=runningToday();$('running-notes').value=runningNotes(r);
  const grid=$('running-exercises');grid.replaceChildren();
  plan.rows.forEach((d,i)=>{const item=make('li','running-exercise'),label=make('label','running-check'),check=make('input');check.type='checkbox';check.id='running-check-'+i;check.checked=r?.exercises.find(e=>e.source_exercise_id===d.id)?.completed===true;check.setAttribute('aria-label',`Complete exercise ${i+1}: ${d.name}`);label.append(check,make('span','',`${i+1}. ${d.name}`));label.htmlFor=check.id;item.append(label,make('p','running-dose',d.dose),make('p','field-help','Rest '+d.rest));
   if(d.url){const link=make('a','exercise-demo',d.related?'Related demo ↗':'Watch demo ↗');link.href=d.url;link.target='_blank';link.rel='noopener noreferrer';link.setAttribute('aria-label',`${d.related?'Watch related demonstration':'Watch demonstration'}: ${d.name}`);item.append(link);}
   else item.append(make('p','field-help','No demo linked in the source program.'));
   if(d.note)item.append(make('p','field-help',d.note));
   check.addEventListener('change',()=>{dirty=true;item.classList.toggle('running-done',check.checked);updateDraft();});item.classList.toggle('running-done',check.checked);grid.append(item);
  });
  dirty=false;updateDraft();history();
 }
 picker.addEventListener('change',()=>{if(!guard()){picker.value=player;return;}player=picker.value;week=1;day=1;dirty=false;$('running-announcement').textContent='';render();});
 weekPicker.addEventListener('change',()=>{if(!guard()){weekPicker.value=String(week);return;}week=Number(weekPicker.value);day=1;dirty=false;render();});
 dayPicker.addEventListener('change',()=>{if(!guard()){dayPicker.value=String(day);return;}day=Number(dayPicker.value);dirty=false;render();});
 for(const id of ['running-date','running-notes'])$(id).addEventListener('input',()=>{dirty=true;updateDraft();});
 $('running-form').addEventListener('submit',event=>{
  event.preventDefault();clearError();try{
   if(!ready(picker.value))throw Error('Wait for your Google Sheet records to load or finish saving, then try again.');
   const record=runningRecord({player:picker.value,week,day,date:$('running-date').value,notes:$('running-notes').value,checked:[...$('running-exercises').querySelectorAll('input[type="checkbox"]')].map(e=>e.checked),previous:current()});validate(record,players);
   dirty=false;flow.commit([...flow.records().filter(r=>r.id!==record.id),record]);render();$('running-announcement').textContent=`${record.completion_status==='completed'?'Workout completed':'Progress saved'} · Waiting for Google Sheet confirmation. Your checkmarks will be available on your other devices after saving finishes.`;
  }catch(e){dirty=true;updateDraft();error(e);}
 });
 $('running-clear').addEventListener('click',()=>{try{if(!ready(picker.value))throw Error('Wait for Google Sheet to finish loading or saving.');const records=own();if(!records.length||!window.confirm(`Clear all ${records.length} saved Running workouts for ${picker.value}? Other workouts and players are kept.`))return;const ids=new Set(records.map(r=>r.id));dirty=false;flow.commit(flow.records().filter(r=>!ids.has(r.id)));render();$('running-announcement').textContent='Running entries cleared · Waiting for Google Sheet confirmation.';}catch(e){error(e);}});
 flow.subscribe(()=>{if(!dirty)render();});render();return {refresh(){if(!dirty)render();},hasDraft:()=>dirty};
}
