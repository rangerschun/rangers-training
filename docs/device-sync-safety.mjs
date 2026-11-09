// Merge the device outbox before writing it so open tabs retain each other's events.
export function mergeJournalEvents(current,incoming){
 const result=new Map(current.map(e=>[e.event_id,e]));
 const payload=e=>JSON.stringify({player:e.player,kind:e.kind,operation:e.operation,record:e.record});
 for(const event of incoming){const prior=result.get(event.event_id);if(!prior){result.set(event.event_id,event);continue;}if(payload(prior)!==payload(event))throw Error('A waiting change has conflicting copies. Export entries before closing.');if(!prior.received_at&&event.received_at)result.set(event.event_id,{...prior,received_at:event.received_at});}
 return [...result.values()];
}
/** Retry/refresh only at an idle, safe point. Never resolve a conflict automatically. */
export function startDeviceSyncSafety({sync,journal,player,canRefresh=()=>false,window:win=globalThis.window,document:doc=globalThis.document,intervalMs=30000}){
 let busy=false,lastRefresh=0;
 async function refresh(){const name=player();if(busy||doc.hidden||win.navigator?.onLine===false||!name||!sync.hasSession(name)||sync.status(name).conflict||!canRefresh())return false;
  const status=sync.status(name);if(!status.ready&&/expired|password|sign in again/i.test(status.message??''))return false;
  if(Date.now()-lastRefresh<5000)return false;busy=true;lastRefresh=Date.now();try{
   if(!status.ready||journal.pendingAll().some(event=>event.player===name)){
    await sync.refresh(name);
    return true;
   }
   return await sync.refreshInBackground(name,()=>!doc.hidden&&player()===name&&canRefresh());
  }catch{return false;}finally{busy=false;}
 }
 function beforeUnload(event){if(!journal.pendingAll().length)return;event.preventDefault();event.returnValue='';}
 const visible=()=>{if(!doc.hidden)void refresh();};
 win.addEventListener('beforeunload',beforeUnload);win.addEventListener('focus',refresh);win.addEventListener('online',refresh);doc.addEventListener('visibilitychange',visible);
 const timer=win.setInterval(()=>void refresh(),intervalMs);
 return {refresh,destroy(){win.clearInterval(timer);win.removeEventListener('beforeunload',beforeUnload);win.removeEventListener('focus',refresh);win.removeEventListener('online',refresh);doc.removeEventListener('visibilitychange',visible);}};
}

