import {OVERSPEED_LIBRARY} from './overspeed-library.mjs';
import {overSpeedSteps,BAT_CONFIGURATIONS} from './overspeed.mjs';
const AREAS={blast:'Blast readings',blast_pcr:'Blast session',baseball:'Baseball throws',workout:'Workout / throwing / vision',overspeed:'OverSpeed readings',overspeed_session:'OverSpeed workout',pulse:'Pulse daily summary'};
const LABELS={bat_speed_mph:'Bat speed (mph)',attack_angle_deg:'Attack angle (°)',time_to_contact_s:'Time to contact (s)',rotational_acceleration_g:'Rotational acceleration (g)',on_plane_efficiency_pct:'On-plane efficiency (%)',peak_hand_speed_mph:'Peak hand speed (mph)',vertical_bat_angle_deg:'Vertical bat angle (°)',early_connection_deg:'Early connection (°)',connection_at_impact_deg:'Connection at impact (°)',power_kw:'Power (kW)',score_scale:'PCR scale',configuration:'Bat setup',device_label:'Device',puck_used:'Puck used',time_to_contact_ms:'Time to contact (ms)',time_to_contact_seconds:'Time to contact (s)',plane_score:'Plane score',connection_score:'Connection score',rotation_score:'Rotation score',total_throws:'Throws',high_effort_throws:'High-effort throws',one_day_workload:'1-day workload',average_torque_nm:'Average torque (N·m)',acute_workload:'Acute workload',chronic_workload:'Chronic workload',ac_ratio:'A:C ratio',average_arm_speed_rpm:'Average arm speed (rpm)',max_arm_speed_rpm:'Max arm speed (rpm)',arm_health_score:'Arm health',distance_ft:'Distance (ft)',duration_minutes:'Duration (min)',effort:'Effort',bat:'Bat',bat_label:'Bat',device:'Device',side:'Side',drill:'Drill',drill_id:'Drill',context:'Context'};
const present=value=>value!==null&&value!==undefined&&value!=='';
function itemText(item){return [item.name??item.drill_id,...[['sets','sets'],['reps','reps']].filter(([key])=>present(item[key])).map(([key,label])=>`${item[key]} ${label}`),present(item.weight)?`${item.weight}${item.weight_unit&&item.weight_unit!=='none'?' '+item.weight_unit:''}`:'',item.planned_details??'',item.notes??''].filter(Boolean).join(' · ');}
export function coachPlayerSummaryRows(snapshot){
 if(!snapshot?.player||!snapshot.records)return [];
 const rows=[];
 for(const [kind,area]of Object.entries(AREAS))for(const record of snapshot.records[kind]??[]){
  if(record.player!==snapshot.player)continue;
  const isWorkout=kind==='workout'||kind==='overspeed_session';
  if(isWorkout&&(record.completion_confirmed!==true||!['completed','partial'].includes(record.completion_status)))continue;
  let items=(record.exercises??record.drills??[]).filter(item=>item.completed===true||(record.completion_status==='completed'&&item.completed!==false));
  if(kind==='overspeed_session'){const program=OVERSPEED_LIBRARY.programs.find(p=>p.id===record.program_id);items=items.map(item=>({...item,name:program?.drills.find(d=>d.id===item.drill_id)?.name??item.drill_id}));if(program){const ids=new Set([...(record.guided_completed_steps??[]),...(record.unmeasured_steps??[])]);items.push(...overSpeedSteps(program).filter(step=>ids.has(step.id)).map(step=>({name:step.drill_name+' · '+BAT_CONFIGURATIONS[step.configuration]+' · '+step.side.replace('_',' '),reps:step.reps})));}}
  const readings=Object.entries(LABELS).filter(([key])=>present(record[key])).map(([key,label])=>`${label}: ${record[key]}`);
  for(const [key,label,unit]of [['throws','Throw readings','mph'],['swings_mph','Swing readings','mph']])if(Array.isArray(record[key]))readings.push(`${label}: ${record[key].filter(present).join(', ')} ${unit}`);
  rows.push({id:record.id,date:record.session_date??'',area,title:record.title??record.context??record.drill??area,status:isWorkout?(record.completion_status==='completed'?'Completed':'Partial · completed items only'):'Recorded',items:items.map(itemText).join('\n'),results:readings.join('\n'),notes:record.notes??''});
 }
 return rows.sort((a,b)=>b.date.localeCompare(a.date)||a.area.localeCompare(b.area)||String(a.id).localeCompare(String(b.id)));
}
const COLUMNS=[['date','Date'],['area','Activity'],['title','Session'],['status','Status'],['items','Completed items'],['results','Recorded results'],['notes','Notes']];
export function coachPlayerSummaryCsv(player,rows){
 const cell=value=>{let s=String(value??'');if(/^[\s]*[=+@-]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';};
 return [['Player',...COLUMNS.map(([,label])=>label)],...rows.map(row=>[player,...COLUMNS.map(([key])=>row[key])])].map(row=>row.map(cell).join(',')).join('\r\n');
}
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function coachPlayerSummaryHtml(player,rows,asOf){
 return '<!doctype html><html><head><meta charset="utf-8"><title>'+escape(player)+' — Rangers summary</title><style>body{font:14px system-ui;color:#243b53;margin:30px}h1{font-size:26px}p{line-height:1.6}table{width:100%;border-collapse:collapse;font-size:11px}th,td{padding:9px;border:1px solid #ccd9e3;text-align:left;vertical-align:top;white-space:pre-wrap;overflow-wrap:anywhere}th{background:#edf5fb}thead{display:table-header-group}tr{break-inside:avoid}@page{size:landscape;margin:12mm}</style></head><body><h1>'+escape(player)+' · Player summary sheet</h1><p>'+rows.length+' saved activity records · Sheet records as of '+escape(asOf)+'.<br>Partial sessions show completed items only. Readings are recorded results; completion is player-reported.</p><table><thead><tr>'+COLUMNS.map(([,label])=>'<th>'+label+'</th>').join('')+'</tr></thead><tbody>'+rows.map(row=>'<tr>'+COLUMNS.map(([key])=>'<td>'+escape(row[key])+'</td>').join('')+'</tr>').join('')+'</tbody></table></body></html>';
}
export function startCoachPlayerSummary({players,element:$,download,isCoach,refresh}){
 const select=$('coach-summary-player'),status=$('coach-summary-status'),output=$('coach-summary-output'),csv=$('coach-summary-csv'),print=$('coach-summary-print'),reload=$('coach-summary-refresh');let snapshots=[],asOf='',busy=false;
 const make=(tag,text)=>{const node=document.createElement(tag);if(text!==undefined)node.textContent=text;return node;};
 for(const player of players){const option=make('option',player);option.value=player;select.append(option);}
 function selected(){return snapshots.find(snapshot=>snapshot.player===select.value);}
 function render(){
  output.replaceChildren();const snapshot=selected(),rows=coachPlayerSummaryRows(snapshot),ready=Boolean(snapshot);csv.disabled=print.disabled=!ready||!rows.length;reload.disabled=busy;
  if(!snapshots.length){status.textContent='Load the coach’s Google Sheet records to create a player summary.';return;}
  status.textContent='Shared Google Sheet records · updated '+asOf+(busy?' · Refreshing…':'');
  if(!select.value)return;
  output.append(make('h3',select.value+' · Player summary sheet'));
  if(!snapshot){output.append(make('p','No shared records were returned for this player. Refresh the Sheet to try again.'));return;}
  if(!rows.length){output.append(make('p','No completed work or saved activity records for this player yet.'));return;}
  const counts=make('p',rows.length+' saved activity records. Completed portions of partial sessions are included; unfinished exercises are omitted.');output.append(counts);
  const wrap=make('div');wrap.className='accountability-table-wrap';const table=make('table');table.className='accountability-table coach-summary-table';const head=make('thead'),tr=make('tr');for(const [,label]of COLUMNS){const th=make('th',label);th.scope='col';tr.append(th);}head.append(tr);table.append(head);const body=make('tbody');for(const row of rows){const tr=make('tr');for(const [key]of COLUMNS)tr.append(make('td',row[key]));body.append(tr);}table.append(body);wrap.append(table);output.append(wrap);
 }
 select.addEventListener('change',render);
 csv.addEventListener('click',()=>{if(!isCoach()||!selected())return;download('rangers-'+select.value.toLowerCase().replace(/[^a-z0-9]+/g,'-')+'-summary.csv',coachPlayerSummaryCsv(select.value,coachPlayerSummaryRows(selected())));});
 print.addEventListener('click',()=>{if(!isCoach()||!selected())return;const page=window.open('','_blank');if(!page){status.textContent='Allow a new window to print this player’s summary.';return;}page.opener=null;page.document.write(coachPlayerSummaryHtml(select.value,coachPlayerSummaryRows(selected()),asOf));page.document.close();page.focus();page.print();});
 reload.addEventListener('click',async()=>{if(!isCoach()||busy)return;busy=true;render();let failed=false;try{await refresh();}catch(error){failed=true;status.textContent='Could not refresh: '+error.message+(asOf?' Showing records from '+asOf+'.':'');}finally{busy=false;if(!failed)render();else reload.disabled=false;}});
 render();return {applyShared(result){if(result?.source!=='google_sheet'||!Array.isArray(result.snapshots))throw Error('Coach summary needs verified Google Sheet records.');snapshots=result.snapshots;asOf=result.as_of??snapshots[0]?.as_of??new Date().toISOString();render();},clear(){snapshots=[];asOf='';select.value='';render();}};
}
