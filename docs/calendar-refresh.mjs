export const CALENDAR_REFRESH_MS=60*60*1000;
export function startCalendarAutoRefresh({refresh,canRefresh=()=>true,now=()=>Date.now(),setInterval:interval=globalThis.setInterval,clearInterval:cancel=globalThis.clearInterval,host=globalThis.window,document=globalThis.document}={}){
 let last=now(),pending=false,disposed=false;
 async function check(){if(disposed||pending||now()-last<CALENDAR_REFRESH_MS||!canRefresh())return;pending=true;last=now();try{await refresh();}catch{/* The calendar view retains its previous events and reports connection errors. */}finally{pending=false;}}
 const resume=()=>{if(!document?.hidden)void check();},timer=interval(()=>void check(),60000);host?.addEventListener('focus',resume);host?.addEventListener('online',resume);document?.addEventListener('visibilitychange',resume);
 return {check,noteRefreshed(){last=now();},dispose(){disposed=true;cancel(timer);host?.removeEventListener('focus',resume);host?.removeEventListener('online',resume);document?.removeEventListener('visibilitychange',resume);}};
}
