import {authenticateWithPersonalPassword} from './player-password.mjs?v=personal-passwords-20261029';
export const SHEET_KINDS=['blast','blast_pcr','baseball','workout','overspeed','overspeed_session','pulse','player_settings'];
export function checkSheetSnapshot(snapshot,player,validate){
 if(!snapshot||snapshot.source!=='google_sheet'||snapshot.player!==player||!snapshot.records||!snapshot.revisions||typeof snapshot.as_of!=='string')throw Error('The Google Sheet response could not be verified.');
 for(const kind of SHEET_KINDS){const records=snapshot.records[kind];if(!Array.isArray(records))throw Error('A Google Sheet history is missing.');const ids=new Set();for(const record of records){validate({event_id:'sheet-read-record',player,kind,operation:'save',record},[player]);if(ids.has(record.id))throw Error('Duplicate Google Sheet record.');ids.add(record.id);}}
 return snapshot;
}
export function overlayWaiting(snapshot,events){
 const records=Object.fromEntries(SHEET_KINDS.map(kind=>[kind,new Map(snapshot.records[kind].map(r=>[r.id,r]))]));
 for(const event of events)if(event.player===snapshot.player&&!event.received_at&&records[event.kind]){if(event.operation==='delete')records[event.kind].delete(event.record.id);else records[event.kind].set(event.record.id,event.record);}
 return Object.fromEntries(SHEET_KINDS.map(kind=>[kind,[...records[kind].values()]]));
}
/** Sheet reads precede access. Device storage holds only cached records and a retry queue. */
export function startSheetSync({call,journal,apply,validate,onState=()=>{}}){
 const sessions=new Map(),snapshots=new Map(),states=new Map(),working=new Map();let timer=null,applying=false;
 function status(player){return states.get(player)??{ready:false,message:'Enter your password to load your records from Google Sheet.'};}
 function set(player,ready,message,extra={}){states.set(player,{ready,message,...extra});onState(player,status(player));}
 function hydrate(snapshot){checkSheetSnapshot(snapshot,snapshot.player,validate);snapshots.set(snapshot.player,snapshot);applying=true;try{apply(snapshot.player,overlayWaiting(snapshot,journal.pending(snapshot.player)));}finally{applying=false;}}
 async function load(player){const token=sessions.get(player);if(!token)throw Error('Enter your password to load your Google Sheet records.');const snapshot=await call('getPlayerData',[{player,token}]);checkSheetSnapshot(snapshot,player,validate);hydrate(snapshot);return snapshot;}
 async function drain(player){
  while(journal.pending(player).length){
   const batch=journal.pending(player).slice(0,5),expected_revisions={};for(const event of batch){const key=event.kind+'|'+event.record.id;if(!Object.hasOwn(expected_revisions,key))expected_revisions[key]=event.base_revision??null;}
   set(player,false,`Saving ${journal.pending(player).length} waiting change(s) to Google Sheet…`);
   const result=await call('writePlayerJournal',[{player,token:sessions.get(player),events:batch.map(({received_at,base_revision,...event})=>event),expected_revisions}]);
   if(!result||!Array.isArray(result.accepted)||result.accepted.length!==batch.length||new Set(result.accepted.map(a=>a.event_id)).size!==batch.length||result.accepted.some(a=>!batch.some(e=>e.event_id===a.event_id)||typeof a.received_at!=='string'))throw Error('Google Sheet did not confirm every change. Your entries remain waiting.');
   checkSheetSnapshot(result.snapshot,player,validate);journal.accept(result.accepted,result.snapshot.revisions);hydrate(result.snapshot);
  }
  set(player,true,'Saved in Google Sheet · your records are up to date.');
 }
 function run(player,task){
  if(working.has(player))return working.get(player);
  const work=(async()=>{try{return await task();}catch(error){set(player,false,error.message+' Nothing waiting has been discarded.',{conflict:/changed on another device/.test(error.message)});throw error;}finally{working.delete(player);}})();working.set(player,work);return work;
 }
 async function login(player,password,newPassword=null){
  return run(player,async()=>{set(player,false,'Loading your records from Google Sheet…');const auth=await authenticateWithPersonalPassword(call,player,password,newPassword);if(auth?.player!==player||typeof auth.token!=='string')throw Error('Player access was not confirmed by Google Sheet.');sessions.set(player,auth.token);try{await load(player);await drain(player);}catch(error){if(auth.password_changed)throw Error('Your password was changed. Sign in again using your new password. '+error.message);throw error;}return true;});
 }
 function refresh(player){if(!sessions.has(player))return Promise.reject(Error('Enter your password again.'));return run(player,async()=>{set(player,false,'Refreshing your records from Google Sheet…');await load(player);await drain(player);return true;});}
 function changed(){
  if(applying)return;
  for(const player of sessions.keys())if(journal.pending(player).length)set(player,false,'Saving to Google Sheet…');
  clearTimeout(timer);timer=setTimeout(()=>{for(const player of sessions.keys())if(journal.pending(player).length)void run(player,()=>drain(player)).catch(()=>{});},0);
 }
 async function review(player,confirm){return run(player,async()=>{const snapshot=await load(player),waiting=journal.pending(player),items=waiting.map(e=>({type:e.kind,action:e.operation,date:e.record.session_date??'',entry:e.record.title??e.record.context??e.record.drill_id??e.record.id,waiting:e.record,saved:snapshot.records[e.kind].find(r=>r.id===e.record.id)??null}));if(!confirm('Review waiting changes for '+player+'\n\n'+JSON.stringify(items,null,2).slice(0,6000)+'\n\nUse this device’s waiting changes instead of the current Google Sheet versions?')){set(player,false,'Waiting changes preserved. Review them before replacing the Google Sheet versions.',{conflict:true});return false;}journal.rebase(player,snapshot.revisions);await drain(player);return true;});}
 return {login,refresh,changed,status,review,async readCalendar(player){const token=sessions.get(player);if(!token)throw Error('Sign in to view the team calendar.');return call('getPlayerTeamCalendar',[{player,token}]);},ready:player=>status(player).ready,applying:()=>applying,revision:(player,kind,id)=>snapshots.get(player)?.revisions[kind+'|'+id]??null,async applyCoach(result){if(result?.source!=='google_sheet'||!Array.isArray(result.snapshots))throw Error('Coach Google Sheet records could not be verified.');for(const snapshot of result.snapshots)checkSheetSnapshot(snapshot,snapshot.player,validate);for(const snapshot of result.snapshots)hydrate(snapshot);},hasSession:player=>sessions.has(player)};
}
