export function parseGameChangerCsv(text){
 if(typeof text!=='string'||!text.trim()||text.length>150000)throw Error('Choose one GameChanger CSV export, up to 150 KB.');
 text=text.replace(/^\uFEFF/,'');const rows=[];let row=[],value='',quoted=false,closed=false;
 for(let i=0;i<text.length;i++){const c=text[i];if(quoted){if(c==='"'){if(text[i+1]==='"'){value+='"';i++;}else{quoted=false;closed=true;}}else value+=c;continue;}
  if(c==='"'){if(value||closed)throw Error('Invalid CSV quoting.');quoted=true;}else if(c===','){row.push(value);value='';closed=false;}else if(c==='\r'||c==='\n'){if(c==='\r'&&text[i+1]==='\n')i++;row.push(value);if(row.some(v=>v!==''))rows.push(row);row=[];value='';closed=false;}else{if(closed&&c.trim())throw Error('Invalid CSV field after a closing quote.');if(!closed)value+=c;}}
 if(quoted)throw Error('CSV has an unfinished quoted field.');row.push(value);if(row.some(v=>v!==''))rows.push(row);
 const headers=rows[1];if(!headers||headers.length!==174||headers.slice(0,6).join('|')!=='Number|Last|First|GP|PA|AB'||headers.slice(54,59).join('|')!=='IP|GP|GS|BF|#P'||headers.slice(148,153).join('|')!=='TC|A|PO|FPCT|E')throw Error('Choose the full GameChanger batting, pitching and fielding season export. This CSV format is not supported.');
 if(rows.some(r=>r.length!==174))throw Error('The CSV rows have inconsistent columns. Export it again from GameChanger.');
 const players=rows.slice(2).filter(r=>r[0]!=='Totals'&&r[0]!=='Glossary'&&r[1].trim()&&r[2].trim()),totals=rows.filter(r=>r[0]==='Totals'),glossary=rows.find(r=>r[0]==='Glossary');
 if(!players.length||players.length>60||totals.length!==1||!glossary)throw Error('The export needs player rows, one Totals row and the GameChanger glossary.');
 for(const r of [...players,totals[0]]){for(const index of [3,4,5,10,17,18,20,22,43,57,58,65,67,68,69,148,149,150,152])if(!/^\d+$/.test(r[index]))throw Error('A required counting statistic is missing or invalid.');if(!/^\d+\.[012]$/.test(r[54]))throw Error('IP must use baseball notation, such as 10.1 for 10⅓ innings.');if(r.some(cell=>cell.length>400))throw Error('A CSV field is too long.');}
 return {headers,glossary,rows:players,totals:totals[0]};
}
export function gameChangerSnapshot(text,{slot,label,fileName,importedOn,eraInnings=7,rangeKey='full'}){
 if(!['full','last_10'].includes(rangeKey))throw Error('Choose the exported stats range.');
 if(!['current','previous'].includes(slot)||typeof label!=='string'||!label.trim()||label.length>80)throw Error('Choose current or previous season and enter its season name.');
 if(typeof fileName!=='string'||fileName.length>180||!fileName.toLowerCase().endsWith('.csv'))throw Error('Choose a .csv file.');
 if(![7,9].includes(Number(eraInnings))||!/^\d{4}-\d{2}-\d{2}$/.test(importedOn))throw Error('Check the import date and ERA innings.');
 return {id:'shared-'+slot,label:label.trim(),slot,range_key:rangeKey,source_file:fileName,imported_on:importedOn,era_innings:Number(eraInnings),...parseGameChangerCsv(text)};
}
export function mergeGameChangerSnapshots(base,seasons){
 if(!Array.isArray(seasons)||seasons.length>2)throw Error('The shared stats response was invalid.');
 const slots=new Set();for(const s of seasons){if(!s||!['current','previous'].includes(s.slot)||slots.has(s.slot)||!Array.isArray(s.headers)||s.headers.length!==174||!Array.isArray(s.rows)||!s.rows.length||s.rows.length>60||s.rows.some(r=>!Array.isArray(r)||r.length!==174)||!Array.isArray(s.totals)||s.totals.length!==174||!Array.isArray(s.glossary)||s.glossary.length!==174||![7,9].includes(s.era_innings)||typeof s.label!=='string'||typeof s.id!=='string')throw Error('The shared stats response was invalid.');slots.add(s.slot);}
 return {...base,seasons:[...base.seasons.filter(s=>!slots.has(s.slot)),...seasons]};
}
