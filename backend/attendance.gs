// Coach-only attendance in the existing independently configured Rangers Sheet.
const ATTENDANCE_HEADERS_=['received_at','session_id','revision','request_id','session_date','event_type','event_name','player','status','notes','session_json'];
function attendanceRequest_(request){if(typeof request==='string'){if(request.length>20000)throw Error('Attendance request is too large.');request=JSON.parse(request);}if(!request||typeof request!=='object'||Array.isArray(request))throw Error('Invalid attendance request.');return request;}
function attendancePlayers_(properties){return JSON.parse(properties.getProperty('players')||'[]').filter(player=>!['Marcus','Dominic','Demo'].includes(player));}
function attendanceSheet_(properties,create){const book=SpreadsheetApp.openById(properties.getProperty('coachSheetId'));let sheet=book.getSheetByName('Attendance');if(!sheet&&create){sheet=book.insertSheet('Attendance');sheet.getRange(1,1,1,ATTENDANCE_HEADERS_.length).setValues([ATTENDANCE_HEADERS_]);sheet.setFrozenRows(1);}if(sheet&&JSON.stringify(sheet.getRange(1,1,1,ATTENDANCE_HEADERS_.length).getValues()[0])!==JSON.stringify(ATTENDANCE_HEADERS_))throw Error('Attendance sheet headers changed.');return sheet;}
function attendanceRows_(sheet){return sheet&&sheet.getLastRow()>1?sheet.getRange(2,1,sheet.getLastRow()-1,ATTENDANCE_HEADERS_.length).getValues():[];}
function attendanceSessions_(rows){const sessions=new Map();for(const row of rows){let record;try{record=JSON.parse(row[10]);}catch{throw Error('A saved attendance session is unreadable.');}if(record.id!==row[1]||record.revision!==row[2])throw Error('Attendance record identity mismatch.');sessions.set(record.id,record);}return Array.from(sessions.values()).sort((a,b)=>b.session_date.localeCompare(a.session_date)||b.updated_at.localeCompare(a.updated_at));}
function attendanceValidated_(record,players,today){
 if(!record||typeof record!=='object'||!/^attendance-[A-Za-z0-9-]{8,80}$/.test(record.id))throw Error('Invalid attendance session ID.');
 const date=record.session_date;if(typeof date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date+'T12:00:00Z'))||new Date(date+'T12:00:00Z').toISOString().slice(0,10)!==date||date>today)throw Error('Choose today or an earlier attendance date.');
 if(!['practice','game','training','other'].includes(record.event_type))throw Error('Choose an event type.');
 if(typeof record.event_name!=='string'||!record.event_name.trim()||record.event_name.trim().length>80)throw Error('Enter an event name within 80 characters.');
 if(typeof record.notes!=='string'||record.notes.length>400)throw Error('Keep session notes within 400 characters.');
 if(!Array.isArray(record.marks)||record.marks.length!==players.length||new Set(record.marks.map(m=>m?.player)).size!==players.length)throw Error('Attendance must contain each team player once.');
 const statuses=['','present','late','absent','excused'];for(const m of record.marks)if(!players.includes(m?.player)||!statuses.includes(m.status))throw Error('Invalid attendance player or status.');
 if(!record.marks.some(m=>m.status))throw Error('Mark at least one player before saving.');
 return {id:record.id,session_date:date,event_type:record.event_type,event_name:record.event_name.trim(),notes:record.notes.trim(),marks:players.map(player=>({player,status:record.marks.find(m=>m.player===player).status}))};
}
function getCoachAttendance(request){request=attendanceRequest_(request);const properties=authenticateCoach_(request.code),players=attendancePlayers_(properties);return JSON.stringify({source:'google_sheet',players,sessions:attendanceSessions_(attendanceRows_(attendanceSheet_(properties,false))),as_of:new Date().toISOString()});}
function saveCoachAttendance(request){
 request=attendanceRequest_(request);const properties=authenticateCoach_(request.code),players=attendancePlayers_(properties),today=Utilities.formatDate(new Date(),'America/Toronto','yyyy-MM-dd'),record=attendanceValidated_(request.record,players,today);
 if(typeof request.request_id!=='string'||!/^attendance-save-[A-Za-z0-9-]{8,80}$/.test(request.request_id))throw Error('Invalid attendance save request.');
 if(request.expected_revision!==null&&(typeof request.expected_revision!=='string'||request.expected_revision.length>100))throw Error('Invalid attendance revision.');
 const lock=LockService.getScriptLock();lock.waitLock(20000);try{
  const sheet=attendanceSheet_(properties,true),rows=attendanceRows_(sheet),prior=rows.find(row=>row[3]===request.request_id),sessions=attendanceSessions_(rows),existing=sessions.find(r=>r.id===record.id);
  if(prior){const saved=JSON.parse(prior[10]);if(JSON.stringify(attendanceValidated_(saved,players,today))!==JSON.stringify(record))throw Error('Attendance save identity conflict.');return JSON.stringify({source:'google_sheet',request_id:request.request_id,record:saved,as_of:new Date().toISOString()});}
  if((existing?.revision??null)!==request.expected_revision)throw Error('Attendance changed on another device. Refresh and reopen the saved session before editing again. Your draft is still on this page.');
  if(sessions.some(r=>r.id!==record.id&&r.session_date===record.session_date&&r.event_type===record.event_type&&r.event_name.toLowerCase().replace(/\s+/g,' ')===record.event_name.toLowerCase().replace(/\s+/g,' ')))throw Error('This attendance session already exists. Open it from saved history to make corrections.');
  const stamp=new Date().toISOString(),saved={...record,revision:Utilities.getUuid(),created_at:existing?.created_at??stamp,updated_at:stamp},json=JSON.stringify(saved),cell=value=>typeof value==='string'&&/^\s*[=+@-]/.test(value)?"'"+value:value;
  const values=saved.marks.map(m=>[stamp,saved.id,saved.revision,request.request_id,saved.session_date,saved.event_type,saved.event_name,m.player,m.status,saved.notes,json].map(cell));const start=sheet.getLastRow()+1;if(start+values.length-1>sheet.getMaxRows())sheet.insertRowsAfter(sheet.getMaxRows(),Math.max(100,values.length));sheet.getRange(start,1,values.length,ATTENDANCE_HEADERS_.length).setValues(values);SpreadsheetApp.flush();
  return JSON.stringify({source:'google_sheet',request_id:request.request_id,record:saved,as_of:stamp});
 }finally{lock.releaseLock();}
}
