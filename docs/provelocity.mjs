// Exact 32-inch program from the coach-supplied ten-page ProVelocity PDF.
export const PV_PROGRAM_ID='provelocity-32in-v1';
export const PV_MANUAL='https://provelocitybat.com/pages/training-manual-v1';
export const PV_WEEKS=[
 [['Dry Swings',10,0,1],['Check Swing Drill',10,2,0],['Tee',20,2,1],['Front Toss',10,2,1],['Front Toss',10,0,2]],
 [['Dry Swings',5,1,1],['Dry Swings',10,0,2],['Tampa Bay Trigger',10,2,0],['Tee',20,1,2],['Front Toss',10,0,2],['Front Toss',10,2,2]],
 [['Dry Swings',5,0,2],['Dry Swings',10,2,2],['Bottom-Hand Drill',10,1,1],['Tee – Outside',10,2,2],['Tee – Inside',10,2,2],['End Loaded Side Toss',10,null,null],['Front Toss',10,0,3]],
 [['Dry Swings',5,1,2],['Dry Swings',10,1,3],['Top-Hand Drill',10,0,1],['Tee – Outside',10,0,3],['Tee – Inside',10,0,3],['End Loaded Front Toss',10,null,null],['Pitch',10,2,3]],
 [['Dry Swings',5,2,1],['Dry Swings',10,0,3],['Dry Swings',5,1,4],['3/4 Drill',10,1,1],['End Loaded Tee',10,null,null],['Side Toss',10,1,3],['Max Out','Until failure','Your max','Your max']],
 [['Dry Swings',5,2,3],['Dry Swings',10,2,4],['Tee',5,2,4],['Front Toss',10,1,4],['Front Toss',10,null,null],['Pitch',10,1,3],['Pitch',10,2,4],['Pitch',10,0,5]],
 [['Top-Hand Drill',10,1,1],['Bottom-Hand Drill',10,1,1],['Tee',10,1,3],['End Loaded Side Toss',10,null,null],['Front Toss',10,0,4],['Front Toss',10,1,5],['Pitch',10,2,4],['Pitch',10,1,5]],
 [['Dry Swings',5,1,4],['Dry Swings',10,2,5],['Follow Thru Drill',10,2,2],['End Loaded Tee',10,null,null],['Side Toss',10,2,3],['Front Toss',10,1,5],['Pitch',10,0,6],['Max Out','Until failure','Your max','Your max']],
 [['Trigger Drill','5–10',0,1],['Top-Hand Drill','5–10',1,2],['Bottom-Hand Drill','5–10',1,2],['Check Swing Drill','5–10','Build to max','Build to max'],['3/4 Drill','5–10',0,3],['Follow Through','5–10','Build to max','Build to max'],['Max Out','Until failure','Your max','Your max'],['End Loaded – Front Toss',10,null,null]],
 [['Dry Swings',10,2,5],['Dry Swings',10,1,6],['Tee – Inside',10,1,5],['Tee – Outside',10,1,5],['Front Toss',10,1,5],['Front Toss',10,2,5],['Pitch',10,1,6],['Pitch',10,2,6]]
].map((rows,w)=>({week:w+1,drills:rows.map(([name,reps,bands_5lb,bands_15lb],i)=>({id:`pv-w${w+1}-d${i+1}`,name,reps,bands_5lb,bands_15lb}))}));
export function pvRecordId(player,week,day){return `pv-${day?'session':'baseline'}-${player}-${week}${day?'-'+day:''}`;}
export function pvToday(date=new Date()){return new Intl.DateTimeFormat('en-CA',{timeZone:'America/Toronto',year:'numeric',month:'2-digit',day:'2-digit'}).format(date);}
export function pvAddDays(date,days){return new Date(Date.parse(date+'T12:00:00Z')+days*86400000).toISOString().slice(0,10);}
export function pvComplete(record){return record?.record_type==='session'&&record.completion_status==='completed'&&record.steps?.length===PV_WEEKS[record.week-1]?.drills.length;}
export function pvProgress(records,player,today=pvToday()){
 const own=records.filter(r=>r.player===player&&r.record_type==='session'),first=own.find(r=>r.week===1&&r.day===1)?.session_date;
 const weeks=PV_WEEKS.map(({week})=>{const days=[1,2,3,4].map(day=>own.find(r=>r.week===week&&r.day===day)??null);return {week,days,complete:days.every(pvComplete),earliest:first?pvAddDays(first,(week-1)*7):null};});
 for(const w of weeks)w.unlocked=(w.week===1||weeks.slice(0,w.week-1).every(v=>v.complete))&&(!w.earliest||w.earliest<=today);
 return {weeks,completed:own.filter(pvComplete).length,total:40,finished:weeks.every(w=>w.complete),first};
}
export function validateProVelocity(record,players){
 const r=record,integer=(n,min,max)=>Number.isInteger(n)&&n>=min&&n<=max,date=d=>typeof d==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(d)&&Number.isFinite(Date.parse(d+'T12:00:00Z'))&&new Date(d+'T12:00:00Z').toISOString().slice(0,10)===d;
 if(!r||!players.includes(r.player)||r.program_id!==PV_PROGRAM_ID||r.bat_length_in!==32||!integer(r.week,1,10)||!['session','baseline'].includes(r.record_type)||!date(r.session_date)||typeof r.created_at!=='string'||!Number.isFinite(Date.parse(r.created_at))||typeof r.updated_at!=='string'||!Number.isFinite(Date.parse(r.updated_at))||typeof r.notes!=='string'||r.notes.length>500)throw Error('Invalid ProVelocity workout.');
 if(r.id!==pvRecordId(r.player,r.week,r.record_type==='session'?r.day:null))throw Error('ProVelocity week/day identity does not match.');
 const speed=n=>n===null||Number.isFinite(n)&&n>0&&n<=200;
 if(r.record_type==='baseline'){
  if(r.max_bands!==null&&!integer(r.max_bands,0,100)||!speed(r.bat_speed_mph)||typeof r.time_in_zone!=='string'||r.time_in_zone.length>40||typeof r.power_efficiency!=='string'||r.power_efficiency.length>40||[r.max_bands,r.bat_speed_mph].every(v=>v===null)&&!r.time_in_zone.trim()&&!r.power_efficiency.trim())throw Error('Enter at least one valid baseline result.');
  return true;
 }
 const plan=PV_WEEKS[r.week-1].drills;
 if(!integer(r.day,1,4)||!['pocket_radar','no_radar'].includes(r.radar_mode)||!Array.isArray(r.steps)||r.steps.length<1||r.steps.length>plan.length||r.completion_status!==(r.steps.length===plan.length?'completed':'in_progress'))throw Error('Save each ProVelocity drill in order.');
 r.steps.forEach((step,i)=>{
  const drill=plan[i],variable=typeof drill.bands_5lb==='string';
  if(step.drill_id!==drill.id||step.completed!==true||typeof step.notes!=='string'||step.notes.length>300||!integer(step.actual_reps,1,1000)||typeof drill.reps==='number'&&step.actual_reps!==drill.reps||drill.reps==='5–10'&&!integer(step.actual_reps,5,10))throw Error('Complete the prescribed reps for each ProVelocity drill.');
  if(variable?!integer(step.bands_5lb,0,50)||!integer(step.bands_15lb,0,50)||step.bands_5lb+step.bands_15lb<1:step.bands_5lb!==drill.bands_5lb||step.bands_15lb!==drill.bands_15lb)throw Error('Record the prescribed bands, or your actual maximum where requested.');
  if(!Array.isArray(step.swings_mph)||step.swings_mph.length!==3||!step.swings_mph.every(speed)||r.radar_mode==='pocket_radar'&&!step.swings_mph.some(n=>n!==null)||r.radar_mode==='no_radar'&&step.swings_mph.some(n=>n!==null))throw Error('Enter a Pocket Radar speed, or choose no radar before starting.');
 });
 return true;
}
/** The Sheet receiver and the UI use the same sequential and calendar-week rules. */
export function validateProVelocityChange(records,record,players,today=pvToday()){
 validateProVelocity(record,players);if(record.session_date>today)throw Error('A ProVelocity workout cannot be dated in the future.');
 const own=records.filter(r=>r.player===record.player),other=own.filter(r=>r.id!==record.id),progress=pvProgress(other,record.player,today),w=progress.weeks[record.week-1];
 if(record.week>1&&(!progress.weeks.slice(0,record.week-1).every(v=>v.complete)||!progress.first||record.session_date<pvAddDays(progress.first,(record.week-1)*7)))throw Error('Finish the previous four-workout weeks and wait for the next training week.');
 if(record.record_type==='baseline')return true;
 if(record.day>1&&!pvComplete(other.find(r=>r.week===record.week&&r.day===record.day-1&&r.record_type==='session')))throw Error('Complete the previous ProVelocity workout first.');
 if(other.some(r=>r.record_type==='session'&&r.session_date===record.session_date))throw Error('Only one ProVelocity workout can be recorded on a date.');
 const earlier=other.filter(r=>r.record_type==='session'&&(r.week<record.week||r.week===record.week&&r.day<record.day));if(earlier.some(r=>r.session_date>=record.session_date))throw Error('Choose a date after the preceding ProVelocity workout.');
 const later=other.filter(r=>r.record_type==='session'&&(r.week>record.week||r.week===record.week&&r.day>record.day));if(later.some(r=>r.session_date<=record.session_date)||later.length&&!pvComplete(record))throw Error('Keep this workout complete before continuing to later workouts.');
 if(record.week===1&&record.day===1&&later.some(r=>r.session_date<pvAddDays(record.session_date,(r.week-1)*7)))throw Error('That date would move a later workout before its training week.');
 return true;
}
export function pvReadings(record){return record?.steps?.flatMap(s=>s.swings_mph.filter(n=>n!==null))??[];}
