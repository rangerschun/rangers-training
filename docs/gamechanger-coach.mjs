import {gameChangerSnapshot} from './gamechanger-import.mjs?v=schedule-auto-refresh-20261025';
export function startGameChangerCoach({element:$,publish,onPublished,isCoach=()=>false}){
 let file=null,text='',busy=false,code='';const drop=$('gc-upload-drop'),input=$('gc-upload-file'),button=$('gc-upload-publish'),status=$('gc-upload-status');
 async function select(files){if(!isCoach())return;if(busy)return;file=null;text='';button.disabled=true;
  try{if(files.length!==1)throw Error('Choose one CSV at a time.');const next=files[0];if(next.size>150000)throw Error('The CSV must be 150 KB or smaller.');const value=await next.text();const snapshot=gameChangerSnapshot(value,{slot:$('gc-upload-slot').value,label:$('gc-upload-label').value||'Season preview',fileName:next.name,importedOn:new Date().toISOString().slice(0,10),eraInnings:Number($('gc-upload-era').value),rangeKey:$('gc-upload-range').value});file=next;text=value;status.textContent=`${next.name}: ${snapshot.rows.length} player rows · ${snapshot.totals[3]} team games. Ready to publish to the selected season.`;button.disabled=false;
  }catch(error){status.textContent=error.message;}
 }
 input.addEventListener('change',()=>void select([...input.files]));
 for(const name of ['dragenter','dragover'])drop.addEventListener(name,event=>{event.preventDefault();if(!busy&&isCoach())drop.classList.add('is-dragging');});
 for(const name of ['dragleave','drop'])drop.addEventListener(name,event=>{event.preventDefault();drop.classList.remove('is-dragging');if(name==='drop'&&isCoach())void select([...event.dataTransfer.files]);});
 $('gc-upload-form').addEventListener('submit',async event=>{event.preventDefault();if(!file||busy||!isCoach())return;
  try{const snapshot=gameChangerSnapshot(text,{slot:$('gc-upload-slot').value,label:$('gc-upload-label').value,fileName:file.name,importedOn:new Date().toISOString().slice(0,10),eraInnings:Number($('gc-upload-era').value),rangeKey:$('gc-upload-range').value});if(!window.confirm(`Publish ${file.name} as ${snapshot.label} (${snapshot.slot} season, ${snapshot.range_key}) for all players? This replaces the displayed cumulative totals for that season; earlier uploads remain archived.`))return;
   busy=true;button.disabled=true;code=$('gc-upload-code').value.trim()||code;status.textContent='Publishing stats to the team…';const result=await publish({code,slot:snapshot.slot,label:snapshot.label,file_name:file.name,csv:text,era_innings:snapshot.era_innings,range_key:snapshot.range_key});
   if(!result?.confirmed||!Array.isArray(result.seasons))throw Error('The shared update was not confirmed. Your file is still ready to retry.');onPublished(result.seasons);$('gc-upload-code').value='';status.textContent=`Published ${snapshot.label}. Players will see these stats when they open GameChanger. Earlier uploads are archived.`;
  }catch(error){status.textContent=error.message||'The shared update was not confirmed.';}finally{busy=false;button.disabled=!file;}
 });
 return {reset(){code='';$('gc-upload-code').value='';}};
}
