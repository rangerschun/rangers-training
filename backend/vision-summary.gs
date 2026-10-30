// Replace the older team-average reader in the copied backend.
function getConcentrationSummary(request){
  const json=typeof request==='string';if(json){if(request.length>2000)throw Error('Invalid team-average request.');request=JSON.parse(request);}
  authenticatePlayerSession_(request);
  const properties=PropertiesService.getScriptProperties(),players=JSON.parse(properties.getProperty('players')||'[]');
  const sheet=SpreadsheetApp.openById(TRAINING_SHEET_ID).getSheetByName('Entries');
  if(!sheet||JSON.stringify(sheet.getRange(1,1,1,ENTRY_HEADERS.length).getValues()[0])!==JSON.stringify(ENTRY_HEADERS))throw Error('Team results unavailable.');
  const last=sheet.getLastRow(),rows=last>1?sheet.getRange(2,1,last-1,ENTRY_HEADERS.length).getValues():[];
  const records=workoutsFromJournal(rows,players).filter(r=>r.source_template_id==='concentration-grid-100'&&r.completion_status==='completed'&&r.completion_confirmed===true&&Number.isFinite(r.duration_minutes)&&r.duration_minutes>0&&r.duration_minutes<=1440);
  const total_ms=records.reduce((sum,r)=>sum+Math.round(r.duration_minutes*60000),0);
  const result={session_count:records.length,average_ms:records.length?total_ms/records.length:null,as_of:new Date().toISOString()};return json?JSON.stringify(result):result;
}
