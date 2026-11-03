export const ATTENDANCE_STATUSES=Object.freeze({'':'Unmarked',present:'Present',late:'Late',absent:'Absent',excused:'Excused'});
export const ATTENDANCE_TYPES=Object.freeze({practice:'Practice',game:'Game',training:'Team training',other:'Other'});
export const attendanceToday=(date=new Date())=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Toronto',year:'numeric',month:'2-digit',day:'2-digit'}).format(date);
export function attendanceCounts(marks){const out={present:0,late:0,absent:0,excused:0,unmarked:0};for(const m of marks)out[m.status||'unmarked']++;return out;}
export function attendanceDraft(players,{id='attendance-'+crypto.randomUUID(),date=attendanceToday()}={}){return {id,session_date:date,event_type:'practice',event_name:'Team practice',notes:'',marks:players.map(player=>({player,status:''}))};}
export function validateAttendance(record,players,today=attendanceToday()){
 if(!record||!/^attendance-[A-Za-z0-9-]{8,80}$/.test(record.id))throw Error('Invalid attendance session.');
 const date=record.session_date;if(typeof date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date+'T12:00:00Z'))||new Date(date+'T12:00:00Z').toISOString().slice(0,10)!==date||date>today)throw Error('Choose today or an earlier attendance date.');
 if(!Object.hasOwn(ATTENDANCE_TYPES,record.event_type))throw Error('Choose an event type.');if(typeof record.event_name!=='string'||!record.event_name.trim()||record.event_name.trim().length>80)throw Error('Enter an event name within 80 characters.');if(typeof record.notes!=='string'||record.notes.length>400)throw Error('Keep session notes within 400 characters.');
 if(!Array.isArray(record.marks)||record.marks.length!==players.length||new Set(record.marks.map(m=>m.player)).size!==players.length||record.marks.some(m=>!players.includes(m.player)||!Object.hasOwn(ATTENDANCE_STATUSES,m.status)))throw Error('Check the team roster and attendance marks.');if(!record.marks.some(m=>m.status))throw Error('Mark at least one player before saving.');return record;
}
