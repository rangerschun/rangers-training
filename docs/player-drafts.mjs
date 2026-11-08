export const draftFieldKey=e=>JSON.stringify([e.view,e.context,e.field]);
export function checkDraftSnapshot(snapshot,player){
 if(snapshot?.source!=='google_sheet'||snapshot.player!==player||!Array.isArray(snapshot.entries))throw Error('Google Sheet did not verify your unfinished drafts.');const keys=new Set();
 for(const e of snapshot.entries){if(e.player!==player||typeof e.event_id!=='string'||typeof e.view!=='string'||typeof e.context!=='string'||typeof e.field!=='string'||!['set','delete'].includes(e.operation)||!(e.value===null||typeof e.value==='string'||typeof e.value==='boolean'))throw Error('An unfinished draft could not be read.');const key=draftFieldKey(e);if(keys.has(key))throw Error('Duplicate unfinished field.');keys.add(key);}return snapshot;
}
export function createPlayerDraftStore({storage,read,write,onState=()=>{},makeId=()=>globalThis.crypto?.randomUUID?.()??`${Date.now()}-${Math.random().toString(36).slice(2)}`}){
 const prefix='rangers-field-draft-v1-',pending=new Map(),snapshots=new Map(),working=new Map(),frozen=new Set(),states=new Map(),seen=new Map();let durable=true,sequence=0;
 try{for(let i=0;i<storage.length;i++){const key=storage.key(i);if(!key?.startsWith(prefix))continue;const e=JSON.parse(storage.getItem(key));if(e?.event_id&&typeof e.player==='string')pending.set(e.event_id,e);else throw Error();}}catch{durable=false;}
 const own=p=>[...pending.values()].filter(e=>e.player===p).sort((a,b)=>(a.client_order??Date.parse(a.client_at)*1000)-(b.client_order??Date.parse(b.client_at)*1000));
 const state=p=>states.get(p)??{message:'Loading unfinished drafts from Google Sheet…',saved:false};
 const notify=(p,next)=>{states.set(p,next);onState(p,next);};
 function persist(e){try{storage.setItem(prefix+e.event_id,JSON.stringify(e));}catch{durable=false;}}
 function forget(e){try{storage.removeItem(prefix+e.event_id);}catch{durable=false;}}
 function entries(p){return snapshots.get(p)?.entries??[];}
 function markSeen(player,fields){if(!seen.has(player))seen.set(player,new Map());for(const field of fields)seen.get(player).set(draftFieldKey(field),field.event_id);}
 async function load(player){try{const result=checkDraftSnapshot(await read(player),player);snapshots.set(player,result);notify(player,{saved:!own(player).length,message:own(player).length?'Draft changes waiting for Google Sheet.':'Unfinished drafts loaded from Google Sheet.'});return result;}catch(error){notify(player,{saved:false,message:error.message+' Your local draft is kept.'});throw error;}}
 function queue({player,view,context,field,value,operation='set',requireSeen=false}){
  const key=draftFieldKey({view,context,field}),existing=own(player).find(e=>draftFieldKey(e)===key&&!frozen.has(e.event_id)),saved=entries(player).find(e=>draftFieldKey(e)===key);
  if(!existing&&saved?.operation===operation&&saved.value===value)return null;
  const base=requireSeen?(seen.get(player)?.get(key)??(saved?.operation==='delete'?saved.event_id:null)):(saved?.event_id??null);
  const e=existing?{...existing,value,operation}:{event_id:'draft-'+makeId(),player,view,context,field,value,operation,base_revision:base,client_at:new Date().toISOString(),client_order:Date.now()*1000+(sequence++%1000)};pending.set(e.event_id,e);persist(e);const conflict=state(player).conflict===true;notify(player,{saved:false,conflict,message:conflict?'A draft field changed on another device. Your local entries are kept; review the conflict.':durable?'Auto-saving unfinished draft…':'Device saving unavailable. Keep this page open until Google Sheet confirms your draft.'});return e;
 }
 async function flush(player){
  if(working.has(player))return working.get(player);
  const task=Promise.resolve().then(async()=>{try{
   while(own(player).length){const batch=own(player).slice(0,30).map(e=>structuredClone(e));for(const e of batch)frozen.add(e.event_id);
    const result=checkDraftSnapshot(await write(player,batch),player),accepted=result.accepted;
    if(!Array.isArray(accepted)||accepted.length!==batch.length||new Set(accepted.map(a=>a.event_id)).size!==batch.length||accepted.some(a=>!batch.some(e=>e.event_id===a.event_id)||typeof a.received_at!=='string'))throw Error('Google Sheet did not confirm every unfinished field.');
    snapshots.set(player,result);markSeen(player,batch);const touched=new Map(batch.map(e=>[draftFieldKey(e),e.event_id]));for(const e of batch){pending.delete(e.event_id);frozen.delete(e.event_id);forget(e);}
    for(const e of own(player))if(touched.has(draftFieldKey(e))){e.base_revision=touched.get(draftFieldKey(e));persist(e);}
   }
   notify(player,{saved:true,message:'Draft saved in Google Sheet · unfinished work is kept.'});return true;
  }catch(error){notify(player,{saved:false,conflict:/another device|identity conflict/i.test(error.message),message:error.message+' Your local draft is still waiting.'});throw error;}finally{for(const e of own(player))frozen.delete(e.event_id);working.delete(player);}});working.set(player,task);return task;
 }
 async function review(player,confirm){await load(player);const changes=own(player),saved=entries(player);if(!confirm(changes.map(e=>({field:e.field,yourValue:e.value,savedValue:saved.find(s=>draftFieldKey(s)===draftFieldKey(e))?.value??null})))){notify(player,{saved:false,conflict:true,message:'Both draft versions are kept. Review before replacing the saved fields.'});return false;}for(const e of changes){e.base_revision=saved.find(s=>draftFieldKey(s)===draftFieldKey(e))?.event_id??null;persist(e);}return flush(player);}
 function clearContext(player,view,context,submitted=null){for(const e of entries(player).filter(e=>e.view===view&&e.context===context&&e.operation==='set'&&(!submitted||Object.hasOwn(submitted,e.field)&&submitted[e.field]===e.value)))queue({...e,operation:'delete',value:null});return flush(player);}
 return {load,flush,queue,review,clearContext,markSeen,entries,state,pending:own,pendingAll:()=>[...pending.values()],loaded:p=>snapshots.has(p),durable:()=>durable};
}
