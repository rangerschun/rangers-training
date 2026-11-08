// Private unfinished fields. These rows never count as completed training.
const PLAYER_DRAFT_HEADERS=['event_id','received_at','player','view','context','field','operation','value_json'];
const PLAYER_DRAFT_VIEWS=['workouts','throwing','running','blast','tracker','pulse','overspeed','axe','provelocity','targets'];
function playerDraftSheet_(create){
 const book=SpreadsheetApp.openById(TRAINING_SHEET_ID);let sheet=book.getSheetByName('Drafts');
 if(!sheet&&create){sheet=book.insertSheet('Drafts');sheet.getRange(1,1,1,PLAYER_DRAFT_HEADERS.length).setValues([PLAYER_DRAFT_HEADERS]);sheet.setFrozenRows(1);}
 if(sheet&&JSON.stringify(sheet.getRange(1,1,1,PLAYER_DRAFT_HEADERS.length).getValues()[0])!==JSON.stringify(PLAYER_DRAFT_HEADERS))throw Error('The unfinished-draft sheet needs a coach check.');return sheet;
}
function playerDraftRows_(sheet){return sheet&&sheet.getLastRow()>1?sheet.getRange(2,1,sheet.getLastRow()-1,PLAYER_DRAFT_HEADERS.length).getValues():[];}
function playerDraftSnapshot_(rows,player){
 const current=new Map();for(const row of rows){if(row[2]!==player)continue;const entry={event_id:String(row[0]),received_at:String(row[1]),player,view:String(row[3]),context:String(row[4]),field:String(row[5]),operation:String(row[6]),value:JSON.parse(row[7])};current.set(JSON.stringify([entry.view,entry.context,entry.field]),entry);}
 return {source:'google_sheet',player,entries:[...current.values()]};
}
function validatePlayerDraft_(entry,player){
 if(!entry||entry.player!==player||typeof entry.event_id!=='string'||!/^[a-zA-Z0-9-]{8,100}$/.test(entry.event_id)||!PLAYER_DRAFT_VIEWS.includes(entry.view)||typeof entry.context!=='string'||entry.context.length>4000||typeof entry.field!=='string'||entry.field.length<1||entry.field.length>300||/password|secret|token|auth|access-code/i.test(entry.field)||!['set','delete'].includes(entry.operation)||!(typeof entry.value==='string'||typeof entry.value==='boolean'||entry.value===null)||typeof entry.value==='string'&&entry.value.length>6000)throw Error('That unfinished field cannot be saved.');
 let context;try{context=JSON.parse(entry.context);}catch{throw Error('Invalid draft context.');}if(!context||context.view!==entry.view||typeof context.root!=='string'||typeof context.selectors!=='object'||!context.selectors||Array.isArray(context.selectors)||Object.entries(context.selectors).some(([key,value])=>/password|secret|token|auth|access/i.test(key)||typeof value!=='string'||value.length>500))throw Error('Invalid draft context.');
}
function getPlayerDrafts(request){
 const json=typeof request==='string';if(json)request=JSON.parse(request);const player=authenticatePlayerSession_(request),result=playerDraftSnapshot_(playerDraftRows_(playerDraftSheet_(false)),player);return json?JSON.stringify(result):result;
}
function writePlayerDrafts(request){
 const json=typeof request==='string';if(json){if(request.length>250000)throw Error('Draft request too large.');request=JSON.parse(request);}const player=authenticatePlayerSession_(request),changes=request?.changes;
 if(!Array.isArray(changes)||changes.length<1||changes.length>30||JSON.stringify(request).length>250000)throw Error('Invalid draft batch.');for(const entry of changes)validatePlayerDraft_(entry,player);
 const lock=LockService.getScriptLock();lock.waitLock(20000);try{
  const sheet=playerDraftSheet_(true),rows=playerDraftRows_(sheet),snapshot=playerDraftSnapshot_(rows,player),latest=new Map(snapshot.entries.map(e=>[JSON.stringify([e.view,e.context,e.field]),e])),accepted=[],pending=[],touched=new Set();
  for(const entry of changes){const prior=rows.find(r=>r[0]===entry.event_id),key=JSON.stringify([entry.view,entry.context,entry.field]);if(prior){if(prior[2]!==player||prior[3]!==entry.view||prior[4]!==entry.context||prior[5]!==entry.field||prior[6]!==entry.operation||prior[7]!==JSON.stringify(entry.value))throw Error('Draft change identity conflict.');if(latest.get(key)?.event_id===entry.event_id)touched.add(key);accepted.push({event_id:entry.event_id,received_at:String(prior[1])});continue;}
   if(!touched.has(key)&&(entry.base_revision??null)!==(latest.get(key)?.event_id??null))throw Error('This unfinished field changed on another device. Your local entry is preserved; review the saved draft before replacing it.');touched.add(key);pending.push(entry);
  }
  for(const entry of pending){const received=new Date().toISOString(),row=[entry.event_id,received,player,entry.view,entry.context,entry.field,entry.operation,JSON.stringify(entry.value)],target=sheet.getLastRow()+1;if(target>sheet.getMaxRows())sheet.insertRowsAfter(sheet.getMaxRows(),1000);sheet.getRange(target,1,1,row.length).setValues([row]);rows.push(row);accepted.push({event_id:entry.event_id,received_at:received});}
  SpreadsheetApp.flush();const result={...playerDraftSnapshot_(rows,player),accepted};return json?JSON.stringify(result):result;
 }finally{lock.releaseLock();}
}
