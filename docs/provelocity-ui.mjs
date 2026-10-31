import {PV_WEEKS,PV_PROGRAM_ID,PV_MANUAL,pvRecordId,pvToday,pvProgress,pvComplete,validateProVelocityChange} from './provelocity.mjs';
import {validateWorkout} from './engine.mjs';
export function startProVelocity({players,flow,element:$,download,ready=()=>true}){
 const n=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e;};
 let week=1,day=1,index=0,dirty=false,player='',mode=false;
 const drafts=new Map();
 const select=$('pv-player');select.replaceChildren();for(const name of ['',...players]){const o=n('option','',name||'Choose a player');o.value=name;select.append(o);}
 const records=()=>flow.records().filter(r=>r.source_template_id===PV_PROGRAM_ID&&r.provelocity).map(r=>r.provelocity);
 const current=()=>records().find(r=>r.id===pvRecordId(select.value,week,day));
 const number=id=>$(id).value.trim()===''?null:Number($(id).value);
 function input(box,id,label,type='number',value=''){const l=n('label','',label),e=n('input');e.id=id;e.type=type;e.value=value??'';if(type==='number'){e.min='0';e.step='any';e.inputMode='decimal';}else e.maxLength=40;l.htmlFor=id;l.append(e);box.append(l);return e;}
 function button(box,label,fn,disabled=false,cls='secondary-button'){const b=n('button',cls,label);b.type='button';b.disabled=disabled;b.addEventListener('click',fn);box.append(b);return b;}
 function error(e){$('pv-error').textContent=e.message;$('pv-error').hidden=false;}
 function guard(){if(!dirty)return true;if(!window.confirm('Discard unsaved ProVelocity changes?'))return false;drafts.clear();dirty=false;return true;}
 function persist(record){if(!ready(select.value))throw Error('Wait for Google Sheet to load or finish saving.');validateProVelocityChange(records(),record,players);const wrapped={id:record.id,player:record.player,session_date:record.session_date,title:`ProVelocity · Week ${record.week}${record.record_type==='session'?' / Day '+record.day:' baseline'}`,category:'baseball',duration_minutes:null,effort:'',notes:record.notes||(record.record_type==='session'&&record.completion_status!=='completed'?'ProVelocity workout in progress.':''),source_template_id:PV_PROGRAM_ID,completion_status:record.record_type==='baseline'||pvComplete(record)?'completed':'partial',completion_confirmed:true,created_at:record.created_at,updated_at:record.updated_at,provelocity:record,exercises:record.record_type==='baseline'?[{name:'Weekly baseline test',sets:1,reps:1,weight:null,weight_unit:'none',notes:'Baseline values retained in ProVelocity details.',completed:true}]:record.steps.map(s=>({name:PV_WEEKS[record.week-1].drills.find(d=>d.id===s.drill_id).name,sets:1,reps:s.actual_reps,weight:s.bands_5lb===null?null:s.bands_5lb*5+s.bands_15lb*15,weight_unit:s.bands_5lb===null?'none':'lb',notes:s.notes,completed:true,source_exercise_id:s.drill_id}))};validateWorkout(wrapped,players);dirty=false;flow.commit([...flow.records().filter(r=>r.id!==wrapped.id),wrapped]);$('pv-announcement').textContent='Waiting for Google Sheet confirmation. Progress will be available on your other devices after saving finishes.';}
 function base(type){const prior=type==='session'?current():records().find(r=>r.id===pvRecordId(select.value,week,null)),stamp=new Date().toISOString();return {id:pvRecordId(select.value,week,type==='session'?day:null),player:select.value,program_id:PV_PROGRAM_ID,record_type:type,bat_length_in:32,week,...(type==='session'?{day}:{}),session_date:$('pv-date').value,notes:'',created_at:prior?.created_at??stamp,updated_at:stamp};}
 function choose(w,d){if(!guard())return;week=w;day=d;index=current()?.steps.length??0;dirty=false;render();}
 function render(){
  const own=records(),p=pvProgress(own,select.value),w=p.weeks[week-1],r=current(),plan=PV_WEEKS[week-1].drills;
  $('pv-week').replaceChildren();for(const item of p.weeks){const o=n('option','',`Week ${item.week}${item.complete?' · X':!item.unlocked?' · locked':''}`);o.value=String(item.week);o.disabled=!item.unlocked;$('pv-week').append(o);}$('pv-week').value=String(week);
  $('pv-summary').textContent=`${p.completed} / 40 workouts completed · 32-inch program`;
  $('pv-lock-note').textContent='Four completed workouts per training week. Later weeks open after the preceding weeks are complete and their seven-day start date arrives. One workout per date.';
  const days=$('pv-days');days.replaceChildren();for(let d=1;d<=4;d++){const saved=w.days[d-1];button(days,`${pvComplete(saved)?'X · ':''}Day ${d}${saved&&!pvComplete(saved)?' · resume':''}`,()=>choose(week,d),!w.unlocked||d>1&&!pvComplete(w.days[d-2]),'secondary-button'+(day===d?' pv-selected':''));}
  $('pv-date').value=r?.session_date??pvToday();$('pv-date').max=pvToday();$('pv-date').disabled=Boolean(r);$('pv-error').hidden=true;
  const box=$('pv-step');box.replaceChildren();
  if(!w.unlocked){box.append(n('p','field-help',`This week is locked.${w.earliest?' Earliest start: '+w.earliest+'.':''}`));renderBaseline();renderHistory();return;}
  box.append(n('div','eyebrow',`WEEK ${week} / DAY ${day}`),n('h2','',pvComplete(r)?'Workout completed':'Your drill checklist'),n('p','field-help','Complete the required reps, then check each drill to save it. No speed readings are needed.'));
  const grid=n('div','pv-drill-grid');
  plan.forEach((d,i)=>{
   const saved=r?.steps[i],draft=drafts.get(d.id),values=draft??saved,card=n('article','pv-drill-card'+(saved?' pv-card-complete':'')),prefix='pv-drill-'+i+'-',locked=i>(r?.steps.length??0);
   const label=n('label','pv-drill-heading'),check=n('input');check.id=prefix+'complete';check.type='checkbox';check.checked=Boolean(saved);check.disabled=locked||Boolean(saved);check.setAttribute('aria-label',`Complete drill ${i+1}: ${d.name}`);label.append(check,n('span','',`${i+1}. ${d.name}`));card.append(label,n('p','pv-reps-label',`${d.reps} reps`));
   card.append(n('p','pv-band-label',`5-lb bands: ${d.bands_5lb??'—'} | 15-lb bands: ${d.bands_15lb??'—'}`));
   if(d.bands_5lb===null)card.append(n('p','field-help','Band counts not specified in the source. Confirm the setup with your coach.'));
   const link=n('a','exercise-demo',d.name==='Check Swing Drill'?'Watch demo ↗':'Technique videos ↗');link.href=d.name==='Check Swing Drill'?'https://player.vimeo.com/video/725669407?h=fbc5a7efe2':PV_MANUAL;link.target='_blank';link.rel='noopener noreferrer';card.append(link);
   const fields=n('div','pv-card-fields');
   function field(key,label,value,opts={}){const e=input(fields,prefix+key,label,opts.type??'number',value);Object.assign(e,opts);e.disabled=locked;return e;}
   if(typeof d.reps!=='number')field('reps','Actual reps',values?.actual_reps,{step:'1',min:d.reps==='5–10'?'5':'1',max:d.reps==='5–10'?'10':'999'});
   if(typeof d.bands_5lb==='string'){field('band5','5-lb bands used',values?.bands_5lb,{step:'1'});field('band15','15-lb bands used',values?.bands_15lb,{step:'1'});}
   field('notes','Notes (optional)',values?.notes,{type:'text',maxLength:200});card.append(fields);
   const message=n('p','pv-card-status',saved?'Completed':locked?'Complete the previous drill first.':'Check the box after completing all reps.');message.setAttribute('role','status');card.append(message);
   function readStep(){return {drill_id:d.id,completed:true,actual_reps:typeof d.reps==='number'?d.reps:number(prefix+'reps'),bands_5lb:typeof d.bands_5lb==='string'?number(prefix+'band5'):d.bands_5lb,bands_15lb:typeof d.bands_15lb==='string'?number(prefix+'band15'):d.bands_15lb,swings_mph:saved?.swings_mph??[null,null,null],notes:$(prefix+'notes').value.trim()};}
   card.addEventListener('input',event=>{if(event.target===check)return;drafts.set(d.id,readStep());dirty=true;});
   function saveDrill(){try{const latest=current(),steps=[...(latest?.steps??[])];steps[i]=readStep();const record={...base('session'),entry_mode:'completion',radar_mode:latest?.radar_mode??'no_radar',steps,completion_status:steps.length===plan.length?'completed':'in_progress'};persist(record);drafts.delete(d.id);render();}catch(e){check.checked=Boolean(saved);message.textContent=e.message;message.className='pv-card-status form-error';error(e);}}
   check.addEventListener('change',()=>{if(check.checked)saveDrill();});if(saved)button(card,'Update notes',saveDrill,false,'secondary-button');grid.append(card);
  });box.append(grid);
  if(pvComplete(r)){const actions=n('div','pv-actions');if(day<4)button(actions,'Next workout',()=>choose(week,day+1));else if(week<10)button(actions,'Next week',()=>choose(week+1,1),!p.weeks[week].unlocked);box.append(actions);}
  $('pv-outline').replaceChildren();
  renderBaseline();renderHistory();dirty=drafts.size>0;
 }
 function renderBaseline(){const r=records().find(r=>r.id===pvRecordId(select.value,week,null));$('pv-baseline-title').textContent=`Week ${week} baseline results`;for(const [id,key]of [['pv-max-bands','max_bands'],['pv-baseline-speed','bat_speed_mph'],['pv-zone','time_in_zone'],['pv-efficiency','power_efficiency']])$(id).value=r?.[key]??'';}
 function renderHistory(){const box=$('pv-history');box.replaceChildren();for(const r of records().filter(r=>r.player===select.value).sort((a,b)=>b.week-a.week||(b.day??0)-(a.day??0))){const card=n('details','workout-record'),summary=n('summary','',`Week ${r.week}${r.day?' / Day '+r.day:' baseline'} · ${r.session_date} · ${r.record_type==='baseline'?'Results':pvComplete(r)?'Completed':'In progress'}`);card.append(summary);const body=n('div','workout-record-body');if(r.record_type==='baseline')body.append(n('p','',`Max bands: ${r.max_bands??'—'} | Bat speed: ${r.bat_speed_mph??'—'} mph | Time in zone: ${r.time_in_zone||'—'} | Power efficiency: ${r.power_efficiency||'—'}`));else for(const s of r.steps)body.append(n('p','',`${PV_WEEKS[r.week-1].drills.find(d=>d.id===s.drill_id).name}: ${s.actual_reps} reps · bands ${s.bands_5lb??'—'} x 5 lb + ${s.bands_15lb??'—'} x 15 lb · ${s.swings_mph.filter(v=>v!==null).join(', ')||'Completion recorded'}${s.swings_mph.some(v=>v!==null)?' mph':''}${s.notes?' · '+s.notes:''}`));button(body,'Review / correct',()=>{if(!guard())return;week=r.week;day=r.day??1;index=0;render();$('pv-step').scrollIntoView({behavior:'smooth',block:'start'});});card.append(body);box.append(card);}}
 select.addEventListener('change',()=>{if(!guard()){select.value=player;return;}player=select.value;const p=pvProgress(records(),player);week=p.weeks.find(w=>w.unlocked&&!w.complete)?.week??1;day=p.weeks[week-1].days.findIndex(r=>!pvComplete(r))+1;day=Math.max(1,day);index=current()?.steps.length??0;dirty=false;render();});
 $('pv-week').addEventListener('change',()=>choose(Number($('pv-week').value),1));

 $('pv-baseline-form').addEventListener('submit',event=>{event.preventDefault();try{persist({...base('baseline'),max_bands:number('pv-max-bands'),bat_speed_mph:number('pv-baseline-speed'),time_in_zone:$('pv-zone').value.trim(),power_efficiency:$('pv-efficiency').value.trim()});renderHistory();}catch(e){error(e);}});
 $('pv-export').addEventListener('click',()=>download('provelocity-'+select.value+'.json',JSON.stringify(records().filter(r=>r.player===select.value),null,2),'application/json'));
 flow.subscribe(()=>{if(!dirty)render();});render();return {refresh(){if(!dirty)render();},records};
}
