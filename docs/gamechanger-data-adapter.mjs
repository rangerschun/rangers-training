import {gcNumber,gcOuts} from './gamechanger-metrics.mjs?v=schedule-auto-refresh-20261025';
const gcRate=(n,d)=>n!==null&&d!==null&&d>0?n/d:null;
export function applyGameChangerExposure(season){
 const players=season.players??[];season.benchmarks??={batting:{},pitching:{},fielding:{}};
 for(const group of ['batting','pitching','fielding']){season.benchmarks[group]??={};const keys=group==='batting'?['H','1B','2B','3B','XBH','HR','RBI','R','BB','SO','SB']:group==='pitching'?['SO','BB','H','ER','R']:['TC','A','PO','E','DP','TP'];
  const exposure=group==='pitching'?players.reduce((a,p)=>a+(gcOuts(p.pitching?.IP)??0)/3,0):players.reduce((a,p)=>a+(Number(p.batting?.GP)||0),0);
  for(const key of keys){const sum=players.reduce((a,p)=>a+(Number(p[group]?.[key])||0),0);season.benchmarks[group][key]={value:gcRate(sum,exposure),kind:'opportunity rate',unit_rate:gcRate(sum,exposure),opportunity:group==='pitching'?'IP':'GP'};}
 }
 const pa=players.reduce((n,p)=>n+(Number(p.batting?.PA)||0),0),so=players.reduce((n,p)=>n+(Number(p.batting?.SO)||0),0);season.benchmarks.batting['K%']={value:gcRate(so*100,pa),kind:'team rate'};
 if(season.ranges)for(const key of Object.keys(season.ranges))applyGameChangerExposure(season.ranges[key]);return season;
}
export function gameChangerBenchmark(season,player,group,key){if(group==='batting'&&['H','1B','2B','3B','XBH','HR','RBI','SB'].includes(key))return null;const bench=season.benchmarks[group]?.[key];if(bench?.kind!=='opportunity rate')return bench;const amount=bench.opportunity==='IP'?(gcOuts(player.pitching?.IP)??0)/3:Number(player.batting?.GP)||0;return {...bench,value:amount>0&&bench.unit_rate!==null?bench.unit_rate*amount:null,kind:'at your '+bench.opportunity,exposure:amount};}
export function gameChangerSeasonFromSnapshot(snapshot,base,hashes={}){
 const number=gcNumber,groupNames=['batting','pitching','fielding'],ranges=[[3,54],[54,148],[148,174]],label=snapshot.slot==='current'?'16U':'15U';
 const old=base.find(s=>s.id===label),players=snapshot.rows.map(row=>{const name=row[2]+' '+row[1],prior=old?.players.find(p=>p.name===name)??base.flatMap(s=>s.players).find(p=>p.name===name),p={id:prior?.id??(row[0]+'-'+name).toLowerCase().replace(/[^a-z0-9]+/g,'-'),number:row[0],name};
  ranges.forEach(([a,b],g)=>{p[groupNames[g]]=Object.fromEntries(row.slice(a,b).map((v,j)=>[snapshot.headers[a+j],number(v)]));});p.batting['K%']=gcRate(p.batting.SO*100,p.batting.PA);
  if(prior?.password_hash){p.password_hash=prior.password_hash;p.password_label=prior.password_label;}else if(hashes[row[2]]){p.password_hash=hashes[row[2]];p.password_label=row[2];}return p;
 });
 const benchmarks={batting:{},pitching:{},fielding:{}};ranges.forEach(([a,b],g)=>{for(let i=a;i<b;i++)benchmarks[groupNames[g]][snapshot.headers[i]]={value:number(snapshot.totals[i]),kind:'team rate'};});
 const t=snapshot.totals,obp=gcRate(number(t[10])+number(t[17])+number(t[20]),number(t[5])+number(t[17])+number(t[20])+number(t[22])),slg=gcRate(number(t[43]),number(t[5]));
 for(const [key,value]of [['AVG',gcRate(number(t[10]),number(t[5]))],['OBP',obp],['SLG',slg],['OPS',obp===null||slg===null?null:obp+slg],['BB/K',gcRate(number(t[17]),number(t[18]))]])benchmarks.batting[key]={value,kind:'team rate'};
 benchmarks.pitching.WHIP={value:gcRate(number(t[65])+number(t[68]),gcOuts(t[54])/3),kind:'team rate'};
 const season=applyGameChangerExposure({id:label,label:snapshot.label,players,benchmarks,imported_on:snapshot.imported_on,source_file:snapshot.source_file});
 return season;
}
export function applySharedGameChangerSnapshots(base,snapshots,hashes={}){
 if(!Array.isArray(snapshots)||snapshots.length>6)throw Error('Invalid shared stats response.');
 const result=JSON.parse(JSON.stringify(base));for(const snapshot of snapshots){if(!snapshot||!Array.isArray(snapshot.rows)||snapshot.headers?.length!==174||snapshot.totals?.length!==174||!['current','previous'].includes(snapshot.slot))throw Error('Invalid shared season export.');const converted=gameChangerSeasonFromSnapshot(snapshot,result,hashes),range=snapshot.range_key??'full',index=result.findIndex(s=>s.id===converted.id);
  if(range==='full'){converted.ranges=index>=0?result[index].ranges??{}:{};if(index>=0)result[index]=converted;else result.push(converted);}else if(['last_month','last_10'].includes(range)){if(index<0)throw Error('Import the full season before a date range.');result[index].ranges??={};result[index].ranges[range]=converted;}else throw Error('Invalid stats range.');
 }return result;
}
