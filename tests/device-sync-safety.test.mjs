import test from 'node:test';import assert from 'node:assert/strict';
import {mergeJournalEvents,startDeviceSyncSafety} from '../docs/device-sync-safety.mjs';
test('tab outboxes merge without dropping a waiting change or downgrading a receipt; identity conflicts stop merging',()=>{const e={event_id:'a',player:'Synthetic',kind:'workout',operation:'save',record:{id:'one',player:'Synthetic'}};const other={...e,event_id:'b',record:{...e.record,id:'two'}};assert.equal(mergeJournalEvents([e],[other]).length,2);assert.equal(mergeJournalEvents([{...e,received_at:'confirmed'}],[e])[0].received_at,'confirmed');assert.equal(mergeJournalEvents([e],[{...e,received_at:'confirmed'}])[0].received_at,'confirmed');assert.throws(()=>mergeJournalEvents([e],[{...e,record:{...e.record,value:99}}]),/conflicting/);});
test('idle refresh waits for drafts and never resolves conflicts; leaving warns only while entries are waiting',async()=>{
 const handlers={},docHandlers={};let refreshes=0,safe=false,waiting=true,conflict=false,prevented=false;
 const win={navigator:{onLine:true},addEventListener:(k,f)=>handlers[k]=f,removeEventListener:k=>delete handlers[k],setInterval:f=>{handlers.interval=f;return 1;},clearInterval(){}};const doc={hidden:false,addEventListener:(k,f)=>docHandlers[k]=f,removeEventListener:k=>delete docHandlers[k]};const lifecycle=startDeviceSyncSafety({sync:{hasSession:()=>true,status:()=>({ready:true,conflict}),refreshInBackground:async(name,canApply)=>{assert.equal(name,'Synthetic');assert.equal(canApply(),true);refreshes++;return true;}},journal:{pendingAll:()=>waiting?[{}]:[]},player:()=> 'Synthetic',canRefresh:()=>safe,window:win,document:doc});assert.equal(await lifecycle.refresh(),false);assert.equal(refreshes,0);safe=true;conflict=true;assert.equal(await lifecycle.refresh(),false);conflict=false;assert.equal(await lifecycle.refresh(),true);assert.equal(refreshes,1);handlers.beforeunload({preventDefault(){prevented=true;}});assert.equal(prevented,true);waiting=false;prevented=false;handlers.beforeunload({preventDefault(){prevented=true;}});assert.equal(prevented,false);lifecycle.destroy();assert.equal(handlers.beforeunload,undefined);
});
test('real journal retains two open-tab queues and shows device-storage failure instead of calling it safe',async()=>{
 const values=new Map();let full=false;globalThis.localStorage={getItem:key=>values.get(key)??null,setItem:(key,value)=>{if(full)throw Error('Quota');values.set(key,value);}};const receipts=[];globalThis.window={addEventListener(){},dispatchEvent:event=>receipts.push(event)};globalThis.CustomEvent??=class{constructor(type,options){this.type=type;this.detail=options.detail;}};globalThis.document={getElementById:()=>null,createElement:()=>({append(){},addEventListener(){}})};
 const {startTeamJournal}=await import('../docs/journal-ui.mjs');const ui=()=>{const elements=new Map();return id=>{if(!elements.has(id))elements.set(id,{append(){},addEventListener(){},textContent:'',hidden:false,disabled:false});return elements.get(id);};};
 const change=(kind,before,after,id,now)=>after.map(record=>({kind,player:record.player,record,event_id:id(),client_at:now,operation:'save'}));
 const make=()=>{const $=ui();return {journal:startTeamJournal({players:['Synthetic'],scope:'test',getRecords:()=>({}),element:$,download(){},changes:change,toCsv:()=>'',validate:e=>assert.ok(e.event_id),cloud:true}),$};};const a=make(),b=make();a.journal.record('workout',[],[{id:'a',player:'Synthetic'}]);b.journal.record('workout',[],[{id:'b',player:'Synthetic'}]);assert.equal(JSON.parse(values.get('rangers-training:rangers-coach-journal-v1-test')).events.length,2);assert.equal(b.journal.pendingAll().length,2);const event=a.journal.pendingAll()[0];a.journal.accept([{event_id:event.event_id,received_at:'confirmed'}],{});assert.equal(receipts[0].type,'rangers-sheet-receipt');assert.deepEqual(receipts[0].detail,{event_ids:[event.event_id]});b.journal.record('workout',[],[{id:'c',player:'Synthetic'}]);const disk=JSON.parse(values.get('rangers-training:rangers-coach-journal-v1-test')).events;assert.equal(disk.length,3);assert.equal(disk.find(e=>e.event_id===event.event_id).received_at,'confirmed');full=true;b.journal.record('workout',[],[{id:'d',player:'Synthetic'}]);assert.equal(b.journal.storageState().saved,false);assert.match(b.$('team-journal-status').textContent,/Keep this page open/);assert.ok(b.journal.pendingAll().some(e=>e.record.id==='d'));
});


test('background Sheet reads leave the screen open and apply only current, changed records',async()=>{
 const {startSheetSync,SHEET_KINDS}=await import('../docs/sheet-sync.mjs');
 const player='Synthetic',states=[],applied=[];
 let records=Object.fromEntries(SHEET_KINDS.map(kind=>[kind,[]]));
 let revisions={},release,pause=false,fail=false,canApply=true,pending=[];
 const sync=startSheetSync({
  journal:{pending:()=>pending},
  validate:()=>{},
  apply:(_,value)=>applied.push(value),
  onState:(_,state)=>states.push(state),
  async call(method,[request]){
   if(method==='authenticatePlayer')return request.mode==='challenge'?{player,scheme:'legacy',revision:'test'}:{player,token:'test'};
   assert.equal(method,'getPlayerData');
   const snapshot={player,source:'google_sheet',as_of:new Date().toISOString(),records,revisions};
   if(fail)throw Error('Connection interrupted');
   if(pause)await new Promise(resolve=>{release=resolve;});
   return snapshot;
  }
 });
 await sync.login(player,'test');
 const statesAfterLogin=states.length;
 revisions={'workout|one':'rev-1'};
 assert.equal(await sync.refreshInBackground(player,()=>canApply),true);
 assert.equal(applied.length,1);
 assert.equal(sync.revision(player,'workout','one'),'rev-1');
 records={...records,workout:[{id:'one'}]};
 pause=true;
 const read=sync.refreshInBackground(player,()=>canApply);
 assert.equal(sync.ready(player),true);
 canApply=false;
 release();
 assert.equal(await read,false);
 assert.equal(applied.length,1);
 canApply=true;
 pause=false;
 assert.equal(await sync.refreshInBackground(player,()=>canApply),true);
 assert.equal(applied.length,2);
 assert.equal(applied.at(-1).workout[0].id,'one');
 pause=true;
 const raced=sync.refreshInBackground(player,()=>canApply);
 pending=[{player}];
 release();
 assert.equal(await raced,false);
 pending=[];
 pause=false;
 fail=true;
 await assert.rejects(sync.refreshInBackground(player,()=>canApply),/Connection interrupted/);
 assert.equal(sync.ready(player),true);
 assert.equal(states.length,statesAfterLogin);
});

