const GROUPS={
 batting:{label:'Batting',stats:[
  ['GP','Games played','int',0],['PA','Plate appearances','int',0],['AB','At-bats','int',0],
  ['AVG','Batting average','avg',1],['OBP','On-base percentage','avg',1],['OPS','On-base plus slugging','ops',1],['SLG','Slugging percentage','avg',1],
  ['H','Hits','int',1],['1B','Singles','int',1],['2B','Doubles','int',1],['3B','Triples','int',1],['XBH','Extra-base hits','int',1],['HR','Home runs','int',1],
  ['RBI','Runs batted in','int',1],['R','Runs scored','int',1],['BB','Walks','int',1],['SO','Strikeouts','int',-1],['SB','Stolen bases','int',1],['SB%','Stolen-base percentage','pct',1]
 ]},
 pitching:{label:'Pitching',stats:[
  ['IP','Innings pitched · decimal','ip',0],['GP','Games pitched','int',0],['GS','Games started','int',0],['BF','Batters faced','int',0],
  ['W','Wins','int',1],['L','Losses','int',-1],['SV','Saves','int',1],['ERA','Earned run average','era',-1],['WHIP','Walks + hits per inning','whip',-1],
  ['SO','Strikeouts','int',1],['BB','Walks','int',-1],['H','Hits allowed','int',-1],['R','Runs allowed','int',-1],['ER','Earned runs','int',-1],['MPHFB','Fastball average velocity','mph',1]
 ]},
 fielding:{label:'Fielding',stats:[
  ['TC','Total chances','int',0],['A','Assists','int',0],['PO','Putouts','int',0],['FPCT','Fielding percentage','fpct',1],['E','Errors','int',-1],['DP','Double plays','int',1],['TP','Triple plays','int',1]
 ]}
};
const fmt=(value,type)=>{
 if(value===null||value===undefined||value===''||!Number.isFinite(Number(value)))return '—';
 const n=Number(value);
 if(type==='avg'||type==='ops'||type==='era'||type==='fpct')return n.toFixed(3);
 if(type==='whip')return n.toFixed(2);
 if(type==='pct')return n.toFixed(1)+'%';
 if(type==='ip')return n.toFixed(2);
 if(type==='mph')return n.toFixed(1)+' mph';
 return Number.isInteger(n)?n.toLocaleString():n.toFixed(1);
};
const deltaText=(player,bench,type)=>{
 if(!Number.isFinite(Number(player))||!Number.isFinite(Number(bench)))return 'No team benchmark';
 const d=Number(player)-Number(bench);if(Math.abs(d)<0.0005)return 'At team average';
 const sign=d>0?'+':'−',abs=Math.abs(d);
 if(['avg','fpct','pct'].includes(type))return sign+(abs*100).toFixed(1)+' percentage points';
 if(type==='ops'||type==='era')return sign+abs.toFixed(3);
 if(type==='whip')return sign+abs.toFixed(2);
 if(type==='ip')return sign+abs.toFixed(2)+' IP';
 if(type==='mph')return sign+abs.toFixed(1)+' mph';
 return sign+(Number.isInteger(abs)?abs.toLocaleString():abs.toFixed(1));
};
export function startGameChanger({element:$}){
 const seasonSelect=$('gamechanger-season'),playerSelect=$('gamechanger-player');
 const statSelect=$('gamechanger-stat'),focus=$('gamechanger-focus');
 const message=$('gamechanger-message'),details=$('gamechanger-player-stats'),summary=$('gamechanger-summary'),comparison=$('gamechanger-comparison');
 const buttons=[...document.querySelectorAll('[data-gamechanger-group]')];let seasons=[],group='batting';
 function metricCard(season,player,key,label,type,direction){
  const value=player.batting[key],benchmark=season.benchmarks.batting[key];
  const card=document.createElement('article');card.className='gc-stat-card';
  const name=document.createElement('span');name.textContent=label;
  const main=document.createElement('strong');main.textContent=fmt(value,type);
  const note=document.createElement('small');
  if(benchmark?.value!==null&&benchmark?.value!==undefined){
   const delta=Number(value)-Number(benchmark.value),favorable=direction===0?null:delta*direction>=0;
   note.className=favorable===null?'gc-neutral':favorable?'gc-positive':'gc-negative';
   note.textContent=deltaText(value,benchmark.value,type)+' vs '+(benchmark.kind==='team rate'?'team rate':'player average');
  }else note.textContent='No team benchmark';
  card.append(name,main,note);return card;
 }
 function draw(){
  const season=seasons.find(s=>s.id===seasonSelect.value),player=season?.players.find(p=>p.id===playerSelect.value);
  details.hidden=!player;
  if(!player){message.hidden=false;message.textContent=season?'Choose a player to see season stats and team comparisons.':'Loading GameChanger stats…';return;}
  message.hidden=true;
  summary.replaceChildren(
   metricCard(season,player,'AVG','Batting average','avg',1),metricCard(season,player,'OPS','OPS','ops',1),
   metricCard(season,player,'H','Hits','int',1),metricCard(season,player,'RBI','Runs batted in','int',1)
  );
  const config=GROUPS[group],hasStats=group==='batting'?Number(player.batting.PA)>0:group==='pitching'?Number(player.pitching.GP)>0:Number(player.fielding.TC)>0;
  const available=config.stats.filter(([key])=>hasStats&&Number.isFinite(Number(player[group][key]))&&Number.isFinite(Number(season.benchmarks[group][key]?.value)));
  const previous=statSelect.value,preferred={batting:'AVG',pitching:'ERA',fielding:'FPCT'}[group];
  statSelect.replaceChildren(...available.map(([key,label])=>new Option(label+' · '+key,key)));
  statSelect.value=available.some(([key])=>key===previous)?previous:available.some(([key])=>key===preferred)?preferred:(available[0]?.[0]??'');
  const selected=config.stats.find(([key])=>key===statSelect.value),benchmark=selected?season.benchmarks[group][selected[0]]:null;
  focus.replaceChildren();
  if(selected&&benchmark){
   const [key,label,type,direction]=selected,value=player[group][key],delta=Number(value)-Number(benchmark.value);
   const card=document.createElement('article');card.className='gc-focus-stat';
   const title=document.createElement('h3');title.textContent=label+' · '+key;
   const values=document.createElement('div');values.className='gc-focus-values';
   const entries=[['PLAYER',fmt(value,type)],['TEAM '+(benchmark.kind==='team rate'?'RATE':'AVG'),fmt(benchmark.value,type)]];
   for(const [caption,number]of entries){const item=document.createElement('div'),small=document.createElement('small'),strong=document.createElement('strong');small.textContent=caption;strong.textContent=number;item.append(small,strong);values.append(item);}
   const diff=document.createElement('div');diff.className='gc-focus-difference';const diffLabel=document.createElement('small');diffLabel.textContent='DIFFERENCE';const diffValue=document.createElement('strong');diffValue.textContent=deltaText(value,benchmark.value,type);diff.className+=' '+(direction===0?'gc-neutral':delta*direction>=0?'gc-positive':'gc-negative');diff.append(diffLabel,diffValue);values.append(diff);
   card.append(title,values);focus.append(card);
  }
  comparison.replaceChildren();
  const heading=document.createElement('div');heading.className='gc-comparison-heading';
  const title=document.createElement('h2');title.textContent=config.label+' comparison';
  const seasonLabel=document.createElement('span');seasonLabel.textContent=season.label+' · '+player.name+' · #'+player.number;
  heading.append(title,seasonLabel);comparison.append(heading);
  const note=document.createElement('p');note.className='gc-method-note';
  note.textContent='Rate stats use the exported team rate. Counting stats compare season totals with the average for players who recorded stats in that category; playing time differs.';
  comparison.append(note);
  const wrap=document.createElement('div');wrap.className='gc-table-wrap';
  const table=document.createElement('table');table.className='gc-stats-table';
  const head=document.createElement('thead'),headRow=document.createElement('tr');
  for(const label of ['Statistic','Player','Team benchmark','Difference']){const th=document.createElement('th');th.scope='col';th.textContent=label;headRow.append(th);}
  head.append(headRow);table.append(head);
  const body=document.createElement('tbody');let visible=0;
  for(const [key,label,type,direction] of (hasStats?config.stats:[])){
   const value=player[group][key],bench=season.benchmarks[group][key];
   if((value===null||value===undefined)&&(!bench||bench.value===null||bench.value===undefined))continue;
   visible++;const row=document.createElement('tr');if(key===statSelect.value)row.className='gc-selected-stat';
   const name=document.createElement('th');name.scope='row';name.textContent=label;
   const personal=document.createElement('td');personal.textContent=fmt(value,type);
   const team=document.createElement('td');team.textContent=fmt(bench?.value,type);
   const kind=document.createElement('small');kind.className='gc-benchmark-kind';kind.textContent=bench?.kind==='team rate'?'Team rate':bench?.kind==='avg per pitcher'?'Pitcher average':'Player average';team.append(document.createElement('br'),kind);
   const delta=document.createElement('td');delta.textContent=deltaText(value,bench?.value,type);
   if(direction!==0&&Number.isFinite(Number(value))&&Number.isFinite(Number(bench?.value))){const d=(Number(value)-Number(bench.value))*direction;delta.className=d>=0?'gc-positive':'gc-negative';}else delta.className='gc-neutral';
   row.append(name,personal,team,delta);body.append(row);
  }
  if(!visible){const row=document.createElement('tr'),cell=document.createElement('td');cell.colSpan=4;cell.textContent='No '+config.label.toLowerCase()+' stats were recorded for this player in this export.';row.append(cell);body.append(row);}
  table.append(body);wrap.append(table);comparison.append(wrap);
 }
 function fillPlayers(keep=true){
  const season=seasons.find(s=>s.id===seasonSelect.value),previous=keep?playerSelect.value:'';
  playerSelect.replaceChildren(new Option('Choose a player',''));
  for(const player of season?.players??[])playerSelect.add(new Option('#'+player.number+' · '+player.name,player.id));
  playerSelect.value=season?.players.some(p=>p.id===previous)?previous:'';draw();
 }
 function setGroup(next){
  if(!GROUPS[next])return;group=next;
  for(const button of buttons){const active=button.dataset.gamechangerGroup===group;button.classList.toggle('selected',active);button.setAttribute('aria-pressed',active?'true':'false');}
  draw();
 }
 for(const button of buttons)button.addEventListener('click',()=>setGroup(button.dataset.gamechangerGroup));
 statSelect.addEventListener('change',draw);seasonSelect.addEventListener('change',()=>fillPlayers(false));playerSelect.addEventListener('change',draw);
 fetch('./gamechanger-stats.json?v=gamechanger-20261027').then(response=>{if(!response.ok)throw new Error('Stats unavailable');return response.json();}).then(data=>{
  seasons=data.seasons??[];seasonSelect.replaceChildren(...seasons.map(s=>new Option(s.label,s.id)));
  seasonSelect.value=seasons.find(s=>s.id==='16U')?.id??seasons[0]?.id??'';fillPlayers(false);
  message.hidden=false;message.textContent='Choose a player to see season stats and team comparisons.';
 }).catch(()=>{message.hidden=false;message.textContent='GameChanger stats could not be loaded. Please refresh the page.';});
}
