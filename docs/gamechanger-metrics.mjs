import {isTeamAveragePlayer} from './team-averages.mjs';
export const GC_GROUPS={batting:[3,54],pitching:[54,148],fielding:[148,174]};
export function gcNumber(value){const text=String(value??'').trim();return /^\d*(?:\.\d+)?$/.test(text)&&text!==''?Number(text):null;}
export function gcOuts(value){const match=String(value??'').match(/^(\d+)(?:\.([012]))?$/);return match?Number(match[1])*3+Number(match[2]??0):null;}
export function gcInnings(outs){return Number.isInteger(outs)&&outs>=0?`${Math.floor(outs/3)}.${outs%3}`:'—';}
const gcRatio=(a,b)=>a!==null&&b!==null&&b>0?a/b:null;
const gcSum=(row,indices)=>{const values=indices.map(i=>gcNumber(row?.[i]));return values.some(x=>x===null)?null:values.reduce((a,b)=>a+b,0);};
export function gcPlayerRow(season,player,matches){
 const identity=matches[player];if(!season)return null;
 // Exact full-name match: jersey numbers and first names are not reliable identities.
 const found=season.rows.filter(row=>identity?row[1]===identity[0]&&row[2]===identity[1]:row[2]===player);
 if(found.length>1)return null;
 return found[0]??null;
}
export function gcReconciliation(season){
 const indices=[58,65,66,67,68,69,148,149,150,152];
 return indices.flatMap(i=>{const sum=gcSum(season.rows.map(row=>row[i]),season.rows.map((_,j)=>j)),official=gcNumber(season.totals[i]);return sum!==null&&official!==null&&sum!==official?[{index:i,group:i<148?'Pitching':'Fielding',stat:season.headers[i],player_sum:sum,team_total:official}]:[];});
}
export function gcComparisons(season,player,group){
 const rows=season.rows.filter(row=>isTeamAveragePlayer(row[2])),era=season.era_innings,metrics=[];
 const total=rows.length===season.rows.length?season.totals:season.totals.map((_,i)=>i===54?gcInnings(rows.reduce((n,r)=>n+(gcOuts(r[i])??0),0)):gcSum(rows.map(r=>r[i]),rows.map((_,j)=>j)));
 const number=(row,i)=>gcNumber(row?.[i]),sum=(row,indices)=>gcSum(row,indices);
 const ratio=(row,n,d)=>gcRatio(sum(row,n),sum(row,d));
 const rate=(row,i,multiple=1)=>{const outs=gcOuts(row?.[54]),value=number(row,i);return outs===null||value===null?null:gcRatio(value*multiple,outs/3);};
 function add(id,label,format,calculate,basis,lower=false){metrics.push({id,label,format,player:player?calculate(player):null,team:calculate(total),basis,lower});}
 function perGame(i,label){
  const numerator=gcSum(rows.map(row=>row[i]),rows.map((_,j)=>j)),gp=gcSum(rows.map(row=>row[3]),rows.map((_,j)=>j));
  metrics.push({id:'game-'+i,label:label+' / game',format:'decimal',player:player?gcRatio(number(player,i),number(player,3)):null,team:gcRatio(numerator,gp),basis:`Per player-game: summed ${label.toLowerCase()} ÷ summed player GP (${gp??'—'}).`,lower:i===152});
 }
 if(group==='batting'){
  add('avg','AVG','average',r=>ratio(r,[10],[5]),'Hits ÷ at-bats (AB).');
  add('obp','OBP','average',r=>ratio(r,[10,17,20],[5,17,20,22]),'(H + BB + HBP) ÷ (AB + BB + HBP + SF).');
  add('slg','SLG','average',r=>ratio(r,[43],[5]),'Total bases ÷ AB.');
  add('ops','OPS','average',r=>{const obp=ratio(r,[10,17,20],[5,17,20,22]),slg=ratio(r,[43],[5]);return obp===null||slg===null?null:obp+slg;},'OBP + SLG, each calculated from team totals.');
  add('bb','Walk rate','percent',r=>ratio(r,[17],[4]),'Walks ÷ plate appearances (PA).');
  add('k','Strikeout rate','percent',r=>ratio(r,[18],[4]),'Strikeouts ÷ PA.',true);
  add('contact','Contact rate','percent',r=>{const ab=number(r,5),so=number(r,18);return ab===null||so===null?null:gcRatio(ab-so,ab);},'(AB − strikeouts) ÷ AB.');
  add('qab','Quality at-bats','percent',r=>ratio(r,[29],[4]),'Quality at-bats ÷ PA.');
  add('sb','Steal success','percent',r=>ratio(r,[25],[25,27]),'Stolen bases ÷ (stolen bases + caught stealing).');
  for(const [i,label]of [[10,'Hits'],[16,'Runs'],[15,'RBI'],[42,'Extra-base hits'],[25,'Stolen bases']])perGame(i,label);
 }else if(group==='pitching'){
  add('era','ERA','decimal',r=>rate(r,67,era),`Earned runs × ${era} ÷ IP. ERA uses the export’s ${era}-inning convention.`,true);
  add('whip','WHIP','decimal',r=>{const outs=gcOuts(r?.[54]);return outs===null?null:gcRatio(sum(r,[65,68]),outs/3);},'(Hits allowed + walks) ÷ IP.',true);
  add('k7',`Strikeouts / ${era} IP`,'decimal',r=>rate(r,69,era),`Strikeouts × ${era} ÷ IP.`);
  add('bb7',`Walks / ${era} IP`,'decimal',r=>rate(r,68,era),`Walks × ${era} ÷ IP.`,true);
  add('h7',`Hits allowed / ${era} IP`,'decimal',r=>rate(r,65,era),`Hits allowed × ${era} ÷ IP.`,true);
  add('kbf','Strikeout rate','percent',r=>ratio(r,[69],[57]),'Strikeouts ÷ batters faced (BF).');
  add('bbbf','Walk rate','percent',r=>ratio(r,[68],[57]),'Walks ÷ BF.',true);
  add('kbb','K / BB','decimal',r=>ratio(r,[69],[68]),'Strikeouts ÷ walks. No walks gives no finite ratio.');
  add('pip','Pitches / IP','decimal',r=>rate(r,58),'Total pitches ÷ IP.',true);
 }else if(group==='fielding'){
  add('fpct','Fielding percentage','average',r=>ratio(r,[149,150],[148]),'(Putouts + assists) ÷ total chances.');
  for(const [i,label]of [[148,'Chances'],[150,'Putouts'],[149,'Assists'],[152,'Errors'],[153,'Double plays']])perGame(i,label);
 }else throw Error('Unknown stats group');
 return metrics;
}
export function gcFormat(value,format){if(value===null||!Number.isFinite(value))return '—';if(format==='percent')return (value*100).toFixed(1)+'%';if(format==='average')return value.toFixed(3).replace(/^0\./,'.');return value.toFixed(2);}
export function gcDifference(metric){if(metric.player===null||metric.team===null)return '—';const diff=metric.player-metric.team,prefix=diff>0?'+':diff<0?'−':'';return prefix+(metric.format==='percent'?(Math.abs(diff)*100).toFixed(1)+' pp':gcFormat(Math.abs(diff),metric.format));}

