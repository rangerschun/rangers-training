import {passwordChangeFields} from './player-password.mjs?v=personal-passwords-20261029';
import {applyGameChangerExposure,gameChangerBenchmark,applySharedGameChangerSnapshots} from './gamechanger-data-adapter.mjs?v=batting-player-totals-20261029';
const ROSTER=new Set(['Rory Chi','Ambrose Chun','Michael Kim','Max Hall','Carson Pavao','Jayden Salas-Smith','Andre Stajan','Aidan Scane','Joseph Mestre','Nathan Bussey','Raiden Huether','Josh Mosakos','Walker Thompson','Carter Nelson']);const GROUPS={
 batting:{label:'Batting',stats:[
  ['OPS','OPS','ops',1],['AVG','AVG','avg',1],['OBP','OBP','avg',1],['SLG','SLG','avg',1],
  ['BB/K','BB/K','ratio',1],['BABIP','BABIP','avg',1],['BA/RISP','BA/RISP','avg',1],['K%','K%','pct100',-1],
  ['H','Hits','int',1],['1B','Singles','int',1],['2B','Doubles','int',1],['3B','Triples','int',1],['XBH','Extra-base hits','int',1],['HR','Home runs','int',1],
  ['RBI','Runs batted in','int',1],['SB','Stolen bases','int',1],
 ]},
 pitching:{label:'Pitching',stats:[
  
  ['WHIP','WHIP','whip',-1],
  ['FPS%','First-pitch strike %','pct100',1],['S%','Strike %','pct100',1],['SO','SO','int',1],['BB','BB','int',-1],
 ]},
 fielding:{label:'Fielding',stats:[
  ['TC','Total chances','int',0],['A','Assists','int',0],['PO','Putouts','int',0],['FPCT','Fielding percentage','fpct',1],['E','Errors','int',-1],['DP','Double plays','int',1],['TP','Triple plays','int',1]
 ]}
};
const fmt=(value,type)=>{
 if(value===null||value===undefined||value===''||!Number.isFinite(Number(value)))return '—';
 const n=Number(value);
 if(type==='avg'||type==='ops'||type==='era'||type==='fpct')return n.toFixed(3);
 if(type==='whip'||type==='ratio')return n.toFixed(2);
 if(type==='pct'||type==='pct100')return n.toFixed(1)+'%';
 if(type==='ip')return n.toFixed(2);
 if(type==='mph')return n.toFixed(1)+' mph';
 return Number.isInteger(n)?n.toLocaleString():n.toFixed(1);
};
const deltaText=(player,bench,type)=>{
 if(player===null||player===undefined||bench===null||bench===undefined||!Number.isFinite(Number(player))||!Number.isFinite(Number(bench)))return 'No team benchmark';
 const d=Number(player)-Number(bench);if(Math.abs(d)<0.0005)return 'At team average';
 const sign=d>0?'+':'−',abs=Math.abs(d);
 if(['avg','fpct'].includes(type))return sign+abs.toFixed(3);if(['pct','pct100'].includes(type))return sign+abs.toFixed(1);
 if(type==='ops'||type==='era')return sign+abs.toFixed(3);
 if(type==='whip'||type==='ratio')return sign+abs.toFixed(2);
 if(type==='ip')return sign+abs.toFixed(2)+' IP';
 if(type==='mph')return sign+abs.toFixed(1)+' mph';
 return sign+(Number.isInteger(abs)?abs.toLocaleString():abs.toFixed(1));
};
export function startGameChanger({element:$,onPlayerAuthorized=()=>{},players=[],hashes={},readRemote=null,authenticatePlayer=null}){ const seasonSelect=$('gamechanger-season'),rangeSelect=$('gamechanger-range'),playerSelect=$('gamechanger-player');
 const statSelect=$('gamechanger-stat'),focus=$('gamechanger-focus');
 const message=$('gamechanger-message'),details=$('gamechanger-player-stats'),summary=$('gamechanger-summary'),comparison=$('gamechanger-comparison'),updated=$('gamechanger-updated');
 const changeFields=passwordChangeFields('gamechanger',$);
 const accessDialog=$('gamechanger-access-dialog'),accessForm=$('gamechanger-access-form'),accessInput=$('gamechanger-access-password'),accessError=$('gamechanger-access-error'); let pendingPlayer=null,authorizedPlayerKey='',pendingSyncName='';
 const gcOption=(text,value)=>{const n=document.createElement('option');n.textContent=text;n.value=value;return n;};
 const rangeLabels={full:'Full season stats',last_10:'Last 10 games'};
 const buttons=[...document.querySelectorAll('[data-gamechanger-group]')];for(const button of buttons)if(button.dataset.gamechangerGroup==='fielding')button.hidden=true;let seasons=[],group='batting',busy=false,ready=false; function playerKey(season,player){return season&&player?season.id+'|'+player.id:'';}
 function selectedRangeSeason(baseSeason){
  if(!baseSeason)return null;const key=rangeSelect.value||'full';
  if(key==='full')return baseSeason;
  const snapshot=baseSeason.ranges?.[key];
  if(snapshot)return {...baseSeason,...snapshot,id:baseSeason.id,label:baseSeason.label};
  const games=Math.max(0,...baseSeason.players.map(player=>Number(player.batting?.GP)||0));
  return key==='last_10'&&games<=10?baseSeason:null;
 }
 function hidePlayerStats(){details.hidden=true;summary.replaceChildren();focus.replaceChildren();comparison.replaceChildren();message.hidden=false;message.textContent='Choose your player and enter your password to view their stats.';}
 function requestPlayer(season,player){changeFields.reset();pendingPlayer={season,player};accessInput.value='';accessError.hidden=true;accessError.textContent='';$('gamechanger-access-name').textContent=player.name;if(!accessDialog.open)accessDialog.showModal();accessInput.focus();}
 async function verifyPlayerPassword(player,password,newPassword=null){
  if(authenticatePlayer)return authenticatePlayer(player,password,newPassword);
  if(newPassword!==null)throw Error('Connect to Google Sheet to change your password.');
  const code=String(password??'').trim().replace(/^#/,'');
  if(!/^\d{1,3}$/.test(code)||!player.password_hash||!globalThis.crypto?.subtle)return false;
  const bytes=new TextEncoder().encode('rangers-jersey-v1\0'+(player.password_label??player.name)+'\0'+code);
  const digest=await crypto.subtle.digest('SHA-256',bytes);
  const actual=Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,'0')).join('');
  return actual===player.password_hash;
 }
 function metricCard(season,player,key,label,type,direction){
  const value=player.batting[key],benchmark=gameChangerBenchmark(season,player,'batting',key);
  const card=document.createElement('article');card.className='gc-stat-card';
  const name=document.createElement('span');name.textContent=label;
  const main=document.createElement('strong');main.textContent=fmt(value,type);
  const note=document.createElement('small');
  if(benchmark?.value!==null&&benchmark?.value!==undefined){
   const delta=Number(value)-Number(benchmark.value),favorable=direction===0?null:delta*direction>=0;
   note.className=favorable===null?'gc-neutral':favorable?'gc-positive':'gc-negative';
   note.textContent=deltaText(value,benchmark.value,type)+' vs '+(benchmark.kind==='team rate'?'team rate':benchmark.kind?.startsWith('at your ')?benchmark.kind:'team benchmark');
  }else note.textContent='No team benchmark';
  card.append(name,main,note);return card;
 }
 function rosterRank(season,player,group,key,type,direction){const current=player[group]?.[key];if(current===null||current===undefined||current===''||!Number.isFinite(Number(current))||Number(current)===0)return null;const values=[];for(const name of ROSTER){const rosterPlayer=season.players.find(candidate=>candidate.name===name),value=rosterPlayer?.[group]?.[key];if(value===null||value===undefined||value===''||!Number.isFinite(Number(value))){if(type==='int')values.push(0);continue;}values.push(Number(value));}const ahead=values.filter(value=>direction<0?value<Number(current):value>Number(current)).length;const rank=ahead+1;return rank<=6?rank:null;} function draw(){  const baseSeason=seasons.find(s=>s.id===seasonSelect.value),basePlayer=baseSeason?.players.find(p=>p.id===playerSelect.value);  if(basePlayer&&authorizedPlayerKey!==playerKey(baseSeason,basePlayer)){hidePlayerStats();return;}
  const season=selectedRangeSeason(baseSeason),player=season?.players.find(p=>p.id===basePlayer?.id);
  details.hidden=!player;  if(!basePlayer){message.hidden=false;message.textContent=baseSeason?'Choose a player to see stats and team comparisons.':'Loading GameChanger stats…';return;}
  if(!season||!player){summary.replaceChildren();focus.replaceChildren();comparison.replaceChildren();message.hidden=false;message.textContent=(rangeLabels[rangeSelect.value]??'Selected range')+' stats have not been imported for this season yet.';return;}
  message.hidden=true;
  summary.replaceChildren(
   metricCard(season,player,'OPS','OPS','ops',1),metricCard(season,player,'AVG','Batting average','avg',1),
   metricCard(season,player,'BA/RISP','BA/RISP','avg',1),metricCard(season,player,'BB/K','BB/K','ratio',1)
  );
  const config=GROUPS[group],hasStats=group==='batting'?Number(player.batting.PA)>0:Number(player.pitching.GP)>0;
  const available=config.stats.filter(([key])=>hasStats&&player[group][key]!==null&&player[group][key]!==undefined&&player[group][key]!==''&&Number.isFinite(Number(player[group][key]))&&Number.isFinite(Number(gameChangerBenchmark(season,player,group,key)?.value)));
  const previous=statSelect.value,preferred={batting:'OPS',pitching:'WHIP'}[group];
  statSelect.replaceChildren(...available.map(([key,label])=>gcOption(label+' · '+key,key)));
  statSelect.value=available.some(([key])=>key===previous)?previous:available.some(([key])=>key===preferred)?preferred:(available[0]?.[0]??'');
  const selected=config.stats.find(([key])=>key===statSelect.value),benchmark=selected?gameChangerBenchmark(season,player,group,selected[0]):null;
  focus.replaceChildren();
  if(selected&&benchmark){
   const [key,label,type,direction]=selected,value=player[group][key],delta=Number(value)-Number(benchmark.value);
   const card=document.createElement('article');card.className='gc-focus-stat';
   const title=document.createElement('h3');title.textContent=label+' · '+key;
   const values=document.createElement('div');values.className='gc-focus-values';
   const entries=[['PLAYER',fmt(value,type)],['TEAM '+(benchmark.kind==='team rate'?'RATE':benchmark.kind?.startsWith('at your ')?benchmark.kind.toUpperCase():'AVG'),fmt(benchmark.value,type)]];
   for(const [caption,number]of entries){const item=document.createElement('div'),small=document.createElement('small'),strong=document.createElement('strong');small.textContent=caption;strong.textContent=number;item.append(small,strong);values.append(item);}
   const diff=document.createElement('div');diff.className='gc-focus-difference';const diffLabel=document.createElement('small');diffLabel.textContent='DIFFERENCE';const diffValue=document.createElement('strong');diffValue.textContent=deltaText(value,benchmark.value,type);diff.className+=' '+(direction===0?'gc-neutral':delta*direction>=0?'gc-positive':'gc-negative');diff.append(diffLabel,diffValue);values.append(diff);
   card.append(title,values);focus.append(card);
  }
  comparison.replaceChildren();
  const heading=document.createElement('div');heading.className='gc-comparison-heading';
  const title=document.createElement('h2');title.textContent=config.label+' comparison';  const seasonLabel=document.createElement('span');seasonLabel.textContent=season.label+' · '+(rangeLabels[rangeSelect.value]??rangeLabels.full)+' · '+player.name+' · #'+player.number;
  heading.append(title,seasonLabel);comparison.append(heading);
  const note=document.createElement('p');note.className='gc-method-note';  note.textContent=group==='batting'?'Rate stats use team AB, PA or other relevant opportunities. Hitting counting stats show player totals only. All source players contribute to team rates. Team rank retains the roster comparison.':'Rate stats use team IP or other relevant opportunities. Pitching counting-stat benchmarks show the team rate over your own innings pitched (IP). All source players contribute to team rates. Team rank retains the roster comparison.';  comparison.append(note);
  const wrap=document.createElement('div');wrap.className='gc-table-wrap';
  const table=document.createElement('table');table.className='gc-stats-table';
  const head=document.createElement('thead'),headRow=document.createElement('tr');
  for(const label of ['Statistic','Player','Team benchmark','Difference','Team rank · top 6']){const th=document.createElement('th');th.scope='col';th.textContent=label;headRow.append(th);}
  head.append(headRow);table.append(head);
  const body=document.createElement('tbody');let visible=0;
  for(const [key,label,type,direction] of (hasStats?config.stats:[])){
   const value=player[group][key],bench=gameChangerBenchmark(season,player,group,key);
   if(key!=='FPS%'&&(value===null||value===undefined)&&(!bench||bench.value===null||bench.value===undefined))continue;
   visible++;const row=document.createElement('tr');if(key===statSelect.value)row.className='gc-selected-stat';
   const name=document.createElement('th');name.scope='row';name.textContent=label;
   const personal=document.createElement('td');personal.textContent=fmt(value,type);
   const team=document.createElement('td');team.textContent=bench?fmt(bench.value,type):'';
   const kind=document.createElement('small');kind.className='gc-benchmark-kind';kind.textContent=bench?.kind==='team rate'?'Team rate':bench?.kind?.startsWith('at your ')?'Team rate '+bench.kind:'Team benchmark';if(bench)team.append(document.createElement('br'),kind);
   const delta=document.createElement('td');delta.textContent=bench?deltaText(value,bench.value,type):'';
   if(direction!==0&&Number.isFinite(Number(value))&&Number.isFinite(Number(bench?.value))){const d=(Number(value)-Number(bench.value))*direction;delta.className=d>=0?'gc-positive':'gc-negative';}else delta.className='gc-neutral';
   const rank=document.createElement('td'),rankNumber=rosterRank(season,player,group,key,type,direction);rank.textContent=['avg','ops','fpct','pct','pct100','whip','ratio','era'].includes(type)&&rankNumber?'#'+rankNumber:'';row.append(name,personal,team,delta,rank);body.append(row);
  }
  if(!visible){const row=document.createElement('tr'),cell=document.createElement('td');cell.colSpan=5;cell.textContent='No '+config.label.toLowerCase()+' stats were recorded for this player in this export.';row.append(cell);body.append(row);}
  table.append(body);wrap.append(table);comparison.append(wrap);
 }
 function syncPlayer(name){pendingSyncName=String(name??'').trim();if(!pendingSyncName||!seasons.length)return;const season=seasons.find(s=>s.id===seasonSelect.value),player=season?.players.find(p=>p.name===pendingSyncName||p.name.split(/\s+/)[0]===pendingSyncName);if(!player)return;playerSelect.value=player.id;playerSelect.dispatchEvent(new Event('change',{bubbles:true}));} function fillPlayers(keep=true){
  const season=seasons.find(s=>s.id===seasonSelect.value),previous=keep?playerSelect.value:'';
  playerSelect.replaceChildren(gcOption('Choose a player',''));
  for(const player of season?.players??[])if(ROSTER.has(player.name)||['Marcus','Dominic','Demo'].includes(player.name.split(/\s+/)[0]))playerSelect.add(gcOption('#'+player.number+' · '+player.name,player.id));
  playerSelect.value=season?.players.some(p=>p.id===previous)&&authorizedPlayerKey===playerKey(season,season.players.find(p=>p.id===previous))?previous:'';draw();
 }
 function setGroup(next){
  if(!GROUPS[next])return;group=next;
  for(const button of buttons){const active=button.dataset.gamechangerGroup===group;button.classList.toggle('selected',active);button.setAttribute('aria-pressed',active?'true':'false');}
  draw();
 }
 for(const button of buttons)button.addEventListener('click',()=>setGroup(button.dataset.gamechangerGroup)); statSelect.addEventListener('change',draw);
 rangeSelect.addEventListener('change',draw);
 seasonSelect.addEventListener('change',()=>{authorizedPlayerKey='';playerSelect.value='';hidePlayerStats();fillPlayers(false);});
 playerSelect.addEventListener('change',()=>{
  const season=seasons.find(s=>s.id===seasonSelect.value),player=season?.players.find(p=>p.id===playerSelect.value);
  if(!player){authorizedPlayerKey='';hidePlayerStats();return;}
  if(authorizedPlayerKey===playerKey(season,player)){draw();return;}
  authorizedPlayerKey='';
  playerSelect.value='';hidePlayerStats();requestPlayer(season,player);
 });
 accessForm.addEventListener('submit',async event=>{
  event.preventDefault();if(!pendingPlayer||changeFields.isBusy())return;
  const candidate=pendingPlayer;const submit=$('gamechanger-access-submit');submit.disabled=true;accessError.hidden=true;
  let valid=false;try{const newPassword=changeFields.read();changeFields.setBusy(true);valid=await verifyPlayerPassword(candidate.player,accessInput.value,newPassword);}catch(problem){submit.disabled=false;changeFields.setBusy(false);accessError.textContent=problem?.message||'The Google connection did not confirm sign-in. Try again.';accessError.hidden=false;return;}
  submit.disabled=false;changeFields.setBusy(false);
  if(!valid){accessError.textContent='That password does not match. Try again.';accessError.hidden=false;accessInput.value='';accessInput.focus();return;}
  authorizedPlayerKey=playerKey(candidate.season,candidate.player);playerSelect.value=candidate.player.id;pendingPlayer=null;changeFields.reset();accessInput.value='';accessDialog.close();draw();onPlayerAuthorized(candidate.player.name.split(/\s+/)[0]);
 });
 $('gamechanger-access-cancel').addEventListener('click',()=>{if(changeFields.isBusy())return;pendingPlayer=null;changeFields.reset();accessInput.value='';accessDialog.close();hidePlayerStats();});
 accessDialog.addEventListener('cancel',event=>{event.preventDefault();if(changeFields.isBusy())return;pendingPlayer=null;changeFields.reset();accessInput.value='';accessDialog.close();hidePlayerStats();});
  Promise.all([fetch('./gamechanger-stats.json?v=gamechanger-metrics-20261027').then(response=>response.json()),fetch('./gamechanger-advanced-stats.json?v=coach-summary-fps-20261029').then(response=>response.json())]).then(([data,advanced])=>{
  seasons=data.seasons??[];for(const season of seasons){const extra=advanced[season.id]??{};for(const player of season.players){Object.assign(player.batting,extra.batting?.players?.[player.number]??{});Object.assign(player.pitching,extra.pitching?.players?.[player.number]??{});const pa=Number(player.batting.PA),so=Number(player.batting.SO);player.batting['K%']=pa>0&&Number.isFinite(so)?so/pa*100:null;}for(const key of ['BB/K','BABIP','BA/RISP'])if(extra.batting?.team?.[key]!==undefined)season.benchmarks.batting[key]={value:extra.batting.team[key],kind:'team rate',eligible:14};const pa=Number(season.benchmarks.batting.PA?.value),so=Number(season.benchmarks.batting.SO?.value);if(pa>0&&Number.isFinite(so))season.benchmarks.batting['K%']={value:so/pa*100,kind:'team rate',eligible:14};for(const key of ['S%','FPS%']){for(const player of season.players){const value=extra.pitching?.players?.[player.number]?.[key];if(value!==undefined)player.pitching[key]=value;}if(extra.pitching?.team?.[key]!==undefined)season.benchmarks.pitching[key]={value:extra.pitching.team[key],kind:'team rate'};}}for(const season of seasons)applyGameChangerExposure(season);ready=true;seasonSelect.replaceChildren(...seasons.map(s=>gcOption(s.label,s.id)));
  if(data.last_updated){const date=new Date(data.last_updated+'T12:00:00Z');updated.textContent='LAST UPDATED · '+new Intl.DateTimeFormat('en-CA',{dateStyle:'long',timeZone:'UTC'}).format(date);}
  seasonSelect.value=seasons.find(s=>s.id==='16U')?.id??seasons[0]?.id??'';fillPlayers(false);if(pendingSyncName)syncPlayer(pendingSyncName);
  hidePlayerStats();void refresh();
 }).catch(()=>{message.hidden=false;message.textContent='GameChanger stats could not be loaded. Please refresh the page.';});
 function apply(snapshots){const selected=seasonSelect.value,priorPlayer=playerSelect.value;seasons=applySharedGameChangerSnapshots(seasons,snapshots,hashes);seasonSelect.replaceChildren(...seasons.map(s=>gcOption(s.label,s.id)));seasonSelect.value=seasons.some(s=>s.id===selected)?selected:seasons[0]?.id??'';fillPlayers();const player=seasons.find(s=>s.id===seasonSelect.value)?.players.find(p=>p.id===priorPlayer);if(player&&authorizedPlayerKey===playerKey(seasons.find(s=>s.id===seasonSelect.value),player)){playerSelect.value=priorPlayer;draw();}const newest=snapshots.map(s=>s.imported_on).filter(Boolean).sort().at(-1);if(newest)updated.textContent='LAST IMPORTED · '+newest;}
 async function refresh(){if(!readRemote||busy||!ready)return;busy=true;try{const result=await readRemote();apply(result.seasons);$('gc-shared-status').textContent='Latest shared coach uploads checked.';}catch{$('gc-shared-status').textContent='Shared updates unavailable. Saved GameChanger exports remain available.';}finally{busy=false;}}
 $('gc-refresh').addEventListener('click',()=>void refresh());return {syncPlayer,refresh,apply};
}
