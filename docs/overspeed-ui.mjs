import { overSpeedSteps,overSpeedStepProgress } from './overspeed.mjs?v=schedule-auto-refresh-20261025';
const OVERSPEED_BAT_VISUALS=Object.freeze({
  base:{src:'./assets/overspeed/bat-base.png',label:'Base bat only',alt:'Velo OverSpeed base bat with no sleeves'},
  first_sleeve:{src:'./assets/overspeed/bat-green-sleeve.png',label:'Green sleeve',alt:'Velo OverSpeed bat with the green sleeve'},
  both_sleeves:{src:'./assets/overspeed/bat-green-black-sleeves.png',label:'Green & black sleeves',alt:'Velo OverSpeed bat with green and black sleeves'}
});
export function startOverSpeed({library,players,scope,element,download,validate,upsert,summarize,contextFor,progressFor,toCsv,configurations,devices,onChange,protocol,canUseProgram=()=>true,beforePlayerChange=()=>true,onPlayerChanged=()=>{}}){
  const node=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
  const key='rangers-overspeed-v1-'+scope;let records=[],readable=true,saved=true,lastPlayer='',lastProgram='';let activeProgram=null,currentHosts=[],manualMode=false,reviewStepId=null;const noRadarChoices=new Map();let noRadarPanel=null;const entries=new Map(),programs=new Map(library.programs.map(p=>[p.id,p]));
  const entryKey=(p,d,side='dominant')=>side==='dominant'?`${p.id}/${d.id}`:`${p.id}/${d.id}/${side}`;
  const playerSelect=element('overspeed-player'),programSelect=element('overspeed-program');const prompt=node('option','','Choose a player');prompt.value='';playerSelect.replaceChildren(prompt);for(const name of players){const option=node('option','',name);option.value=name;playerSelect.append(option);}
  for(const family of ['overspeed','counterweight']){const group=node('optgroup');group.label=family==='overspeed'?'OverSpeed':'Counterweight';for(const p of library.programs.filter(p=>p.family===family)){const option=node('option','',p.name);option.value=p.id;group.append(option);}programSelect.append(group);}
  try{const value=localStorage.getItem(key);if(value){const parsed=JSON.parse(value);if(parsed.version!==1||!Array.isArray(parsed.records))throw Error();const ids=new Set();for(const r of parsed.records){validate(r,players);if(ids.has(r.id))throw Error();ids.add(r.id);}records=parsed.records;}}
  catch{readable=false;saved=false;element('overspeed-storage').textContent='Saved bat-speed records could not be read. Existing data is preserved; new records stay in this page. Export before closing.';}
  function persist(next){onChange(records,next);records=next;if(readable){try{localStorage.setItem(key,JSON.stringify({version:1,records}));saved=true;element('overspeed-storage').textContent='';}catch{saved=false;element('overspeed-storage').textContent='Device saving is unavailable. Export your bat-speed records before closing.';}}}
  function refreshAccess(){
    const player=playerSelect.value,date=element('os-session-date').value;
    for(const group of programSelect.children)for(const option of group.tagName==='OPTGROUP'?group.children:[]){option.disabled=!player||!canUseProgram(option.value,player,date);option.textContent=programs.get(option.value).name+(option.disabled?' · Locked':'');}programSelect.disabled=!player;
  }
  function createEntry(p,d,entrySide='dominant'){
    const form=node('form','overspeed-inline-form');form.noValidate=true;form.dataset.drill=d.id;form.dataset.program=p.id;const fields={},wrappers={},uid=`os-${p.id}-${d.id}-${entrySide}`;let dirty=false,editing=null,standaloneStatus=null,guidedStep=null;
    const heading=node('h4','','Pocket Radar · bat speed');form.append(heading);
    const visual=node('figure','overspeed-bat-visual'),photo=node('img','overspeed-bat-photo'),caption=node('figcaption','overspeed-bat-caption');visual.hidden=true;photo.decoding='async';visual.append(photo,caption);form.append(visual);
    const grid=node('div','workout-context-fields');
    function field(key,label,choices,options={}){const wrap=node('label','',label),input=node(choices?'select':'input');input.id=uid+'-'+key;wrap.htmlFor=input.id;input.required=true;
      if(choices)for(const [value,title]of choices){const option=node('option','',title);option.value=value;input.append(option);}else{input.type=options.type??'text';if(options.max)input.maxLength=options.max;if(options.placeholder)input.placeholder=options.placeholder;}
      fields[key]=input;wrappers[key]=wrap;wrap.append(input);grid.append(wrap);return input;
    }
    field('date','Training date',null,{type:'date'}).value=element('os-session-date').value;
    field('configuration','Bat configuration',[['','Choose actual configuration'],...Object.entries(configurations)]);
    field('side','Swing side',[['','Choose side'],['dominant','Dominant'],['non_dominant','Non-dominant']]);
    field('puck','Velo Puck used?',[['','Choose actual setup'],['no','No Puck'],['yes','Puck used']]);
    field('bat','Bat size', [['','Choose bat size'],...['32"','32.5"','33"','33.5"','34"'].map(size=>[size,size])]);const stepHelp=node('p','field-help');form.append(grid,stepHelp);
    const speeds=node('div','overspeed-speed-inputs');fields.swings=[];for(let i=0;i<5;i++){const label=node('label','',`Swing ${i+1}`),input=node('input');input.id=uid+'-swing-'+i;input.type='number';input.inputMode='decimal';input.min='0.1';input.step='any';input.autocomplete='off';label.htmlFor=input.id;label.append(input,node('span','','mph'));speeds.append(label);fields.swings.push(input);}form.append(speeds);
    const notesLabel=node('label','workout-session-notes','Set notes · optional');fields.notes=node('textarea');fields.notes.id=uid+'-notes';fields.notes.maxLength=300;fields.notes.rows=2;notesLabel.htmlFor=fields.notes.id;notesLabel.append(fields.notes);form.append(notesLabel);
    const error=node('p','form-error');error.hidden=true;error.setAttribute('role','alert');const announcement=node('p','blast-announcement');announcement.setAttribute('role','status');
    const actions=node('div','workout-record-actions'),previousStep=node('button','secondary-button overspeed-step-previous','← Previous step'),cancel=node('button','secondary-button','Cancel edit'),save=node('button','primary-button','Save bat speed & complete drill');previousStep.type='button';previousStep.hidden=true;previousStep.addEventListener('click',()=>{const steps=guideProgress().steps,index=steps.findIndex(step=>step.id===guidedStep?.id),previous=steps.slice(0,Math.max(0,index)).reverse().find(step=>savedStepRecord(step));if(previous)goToGuideStep(previous.id);});cancel.type='button';cancel.hidden=true;save.type='submit';actions.append(previousStep,cancel,save);form.append(error,actions,announcement);
    function refreshStandaloneStatus(){if(standaloneStatus){const context=protocol.guidedContext(p.id,fields.date.value),flow=overSpeedStepProgress(records,{player:playerSelect.value,program:p,date:fields.date.value,...context});standaloneStatus.textContent=flow.completed_drills.includes(d.id)?'Completed · all prescribed sides and setups saved.':'In progress · save each prescribed side and setup to complete this drill.';}}
    fields.date.addEventListener('change',refreshStandaloneStatus);
    function syncBatVisual(){const image=OVERSPEED_BAT_VISUALS[fields.configuration.value];visual.hidden=!image;if(image){if(photo.dataset.configuration!==fields.configuration.value){photo.src=image.src;photo.dataset.configuration=fields.configuration.value;}photo.alt=image.alt;caption.textContent=image.label+(p.family==='counterweight'?' · Puck not pictured':'');}}
    function syncBatSize(){const game=fields.configuration.value==='game_bat';wrappers.bat.hidden=!game;fields.bat.disabled=!game;fields.bat.required=game;syncBatVisual();}
    fields.configuration.addEventListener('change',syncBatSize);syncBatSize();
    const counterweight=p.family==='counterweight';wrappers.puck.hidden=!counterweight;fields.puck.disabled=!counterweight;fields.puck.required=counterweight;
    let legacyBatOption=null;
    function restoreBat(value){if(legacyBatOption){legacyBatOption.remove();legacyBatOption=null;}if(![...fields.bat.children].some(o=>o.value===value)){legacyBatOption=node('option','','Previously recorded: '+value);legacyBatOption.value=value;fields.bat.append(legacyBatOption);}fields.bat.value=value;}
    function reset(){if(legacyBatOption){legacyBatOption.remove();legacyBatOption=null;fields.bat.value='';}editing=null;dirty=false;for(const input of fields.swings)input.value='';fields.notes.value='';error.hidden=true;cancel.hidden=true;save.textContent='Save & next';syncBatSize();}
    function configureStep(step){
      const changed=guidedStep?.id!==step?.id;guidedStep=step;form.dataset.reps=String(step?.reps??5);
      for(const key of ['date','configuration','side']){wrappers[key].hidden=Boolean(step);fields[key].disabled=Boolean(step);}
      if(step){fields.configuration.value=step.configuration;fields.side.value=step.side;heading.textContent=`${configurations[step.configuration]} · ${step.side==='dominant'?'Dominant':'Non-dominant'} · ${step.reps} swings`;stepHelp.textContent='Enter each Pocket Radar reading, then Save & next. The next side or setup appears automatically.';}
      else{heading.textContent='Extra / saved bat-speed readings';stepHelp.textContent='Choose the actual setup and side for this drill, then enter the listed readings. Leave unused slots blank; save another set for additional sides or bat setups.';}
      fields.swings.forEach((input,i)=>{const show=!step||i<step.reps;input.disabled=!show;input.required=Boolean(step)&&show;input.parentElement?input.parentElement.hidden=!show:input.parent.hidden=!show;if(!show||changed&&!editing)input.value='';});
      previousStep.hidden=!step||manualMode;if(!previousStep.hidden){const steps=guideProgress().steps,index=steps.findIndex(item=>item.id===step.id);previousStep.disabled=!steps.slice(0,index).some(item=>savedStepRecord(item));}
      save.textContent=editing?(reviewStepId?'Save changes & next':'Update saved set'):step?'Save & next':'Save drill readings';syncBatSize();
    }
    form.addEventListener('input',()=>{dirty=true;});form.addEventListener('change',()=>{dirty=true;});
    form.addEventListener('submit',event=>{event.preventDefault();const existing=records.find(r=>r.id===editing);
      if(!existing&&!canUseProgram(p.id,playerSelect.value,fields.date.value)){error.hidden=false;error.textContent='This OverSpeed level is locked. Complete the earlier phases first.';return;}
      const gameBat=fields.configuration.value==='game_bat';if(gameBat&&!fields.bat.value.trim()){error.hidden=false;error.textContent='Choose a bat size for Game bat.';return;}
      const batLabel=gameBat?fields.bat.value.trim():existing?.configuration===fields.configuration.value?existing.bat_label:'Velo OverSpeed training bat';
      const flow=activeProgram?guideProgress():null,currentUnit=flow?.units?.find(unit=>unit.steps.some(item=>item.id===flow.next?.id)),entryUnit=flow?.units?.find(unit=>unit.steps.some(item=>item.id===guidedStep?.id));if(!existing&&!manualMode&&(!guidedStep||entryUnit?.id!==currentUnit?.id)){error.hidden=false;error.textContent='Continue with the current guided step.';return;}
      const metadata=existing?.guided_protocol?{guided_protocol:existing.guided_protocol,guided_source_sha256:existing.guided_source_sha256,guided_step_id:existing.guided_step_id,guided_stage_id:existing.guided_stage_id}:!manualMode&&guidedStep?{guided_protocol:'velo_overspeed_steps_v1',guided_source_sha256:library.source_sha256,guided_step_id:guidedStep.id,guided_stage_id:protocol.guidedContext(p.id,fields.date.value).stage_id}:{};
      const record={...metadata,id:existing?.id??globalThis.crypto?.randomUUID?.()??`speed-${Date.now()}-${Math.random().toString(36).slice(2)}`,player:playerSelect.value,session_date:fields.date.value,program_id:p.id,drill_id:d.id,configuration:fields.configuration.value,side:fields.side.value,puck_used:counterweight?(fields.puck.value===''?null:fields.puck.value==='yes'):(existing?.puck_used??false),bat_label:batLabel,device_type:existing?.device_type??'pocket_radar',device_label:existing?.device_label??'Pocket Radar',metric:'bat_speed',unit:'mph',swings_mph:fields.swings.map(input=>input.value.trim()===''?null:input.valueAsNumber),notes:fields.notes.value.trim(),created_at:existing?.created_at??new Date().toISOString()};
      let completion;try{const next=upsert(records,record,players),applyCompletion=protocol.prepareSpeedCompletion(record,{editingSpeed:Boolean(existing),nextSpeedRecords:next,manualExtra:manualMode});persist(next);completion=applyCompletion();}catch(problem){error.hidden=false;error.textContent=problem.message;return;}
      const reviewed=reviewStepId;const stats=summarize(record.swings_mph);reset();history();if(reviewed&&!manualMode){const progress=guideProgress(),index=progress.steps.findIndex(step=>step.id===reviewed),following=progress.steps.slice(index+1).find(step=>savedStepRecord(step));reviewStepId=following?.id??null;}refreshGuide(!manualMode);refreshStandaloneStatus();announcement.textContent=`Saved for ${record.player}: best ${stats.best_mph.toFixed(1)} mph, mean ${stats.mean_mph.toFixed(1)} mph. ${completion.message} ${saved?'Readings waiting for Google Sheet confirmation.':'Export readings before closing; device saving is unavailable.'}`;
    });
    cancel.addEventListener('click',()=>{if(dirty&&!window.confirm('Discard unsaved bat-speed edits?'))return;reset();manualMode=false;reviewStepId=null;refreshGuide();});
    return {form,fields,error,configureStep,setStatusTarget:status=>{standaloneStatus=status;refreshStandaloneStatus();},hasDraft:()=>dirty||Boolean(editing),hasChanges:()=>dirty,reset,setDate:date=>{if(!dirty&&!editing)fields.date.value=date;refreshStandaloneStatus();},edit:r=>{editing=r.id;fields.date.value=r.session_date;fields.configuration.value=r.configuration;fields.side.value=r.side;fields.puck.value=r.puck_used?'yes':'no';if(r.configuration==='game_bat')restoreBat(r.bat_label);else fields.bat.value='';syncBatSize();fields.notes.value=r.notes;r.swings_mph.forEach((v,i)=>fields.swings[i].value=v??'');dirty=false;cancel.hidden=false;configureStep(r.guided_protocol?overSpeedSteps(p).find(step=>step.id===r.guided_step_id):null);save.textContent=reviewStepId?'Save changes & next':'Update saved set';if(!reviewStepId)form.scrollIntoView({behavior:'smooth',block:'center'});},editingId:()=>editing};
  }
  function mount(p,hosts){
    activeProgram=p;currentHosts=hosts;if(!p){programSelect.value='';lastProgram='';element('overspeed-guided-progress').replaceChildren();return;}programSelect.value=p.id;lastProgram=p.id;
    for(const {drill,host,status,trackWorkout}of hosts){let wrapper=host.querySelector('.overspeed-paired-forms');if(!wrapper){wrapper=node('div','overspeed-paired-forms');host.append(wrapper);}wrapper.classList.toggle('overspeed-single-form',drill.side!=='Both');
      const sides=drill.side==='Both'?['dominant','non_dominant']:['dominant'];
      for(const side of sides){const id=entryKey(p,drill,side);let entry=entries.get(id);if(!entry){entry=createEntry(p,drill,side);entries.set(id,entry);}entry.setDate(element('os-session-date').value);wrapper.append(entry.form);if(side==='dominant')entry.setStatusTarget(trackWorkout?null:status);}
    }
    refreshAccess();refreshGuide();
  }
  function guideProgress(){
    const p=activeProgram,date=element('os-session-date').value,context=protocol.guidedContext(p.id,date);
    return overSpeedStepProgress(records,{player:playerSelect.value,program:p,date,...context});
  }
  function discardDrafts(){if([...entries.values()].some(e=>e.hasChanges())&&!window.confirm('Discard unsaved bat speeds and change the workout selection?'))return false;for(const entry of entries.values())entry.reset();manualMode=false;reviewStepId=null;return true;}
  function savedStepRecord(step){
    if(!activeProgram||!step)return null;const date=element('os-session-date').value,context=protocol.guidedContext(activeProgram.id,date),eligible=records.filter(r=>r.player===playerSelect.value&&r.program_id===activeProgram.id&&r.session_date===date&&r.guided_protocol==='velo_overspeed_steps_v1'&&r.guided_stage_id===context.stage_id&&r.guided_step_id===step.id),link=context.step_records?.find(link=>link.step_id===step.id);
    return link?eligible.find(r=>r.id===link.record_id)??null:eligible.at(-1)??null;
  }
  function goToGuideStep(stepId){
    if([...entries.values()].some(entry=>entry.hasChanges())&&!window.confirm('Discard unsaved speed changes and open another step?'))return;
    for(const entry of entries.values())entry.reset();reviewStepId=stepId;manualMode=false;refreshGuide(true);
  }
  function radarContext(){const context=protocol.guidedContext(activeProgram.id,element('os-session-date').value),key=JSON.stringify([playerSelect.value,element('os-session-date').value,activeProgram.id]);return {...context,key,noRadar:context.has_session?context.no_radar:noRadarChoices.get(key)===true};}
  function stepHasRecord(step){return radarContext().noRadar?radarContext().unmeasured_steps.includes(step.id):Boolean(savedStepRecord(step));}
  function renderNoRadar(focus=false){
    if(noRadarPanel){noRadarPanel.remove();noRadarPanel=null;}for(const entry of entries.values())entry.form.hidden=true;
    if(!activeProgram)return;
    const radar=radarContext(),noRadar=radar.noRadar,radarChoice=element('os-no-radar');element('os-radar-instructions').textContent=noRadar?'Follow one step at a time. Check the required swings after each side and setup. The next step appears automatically; all prescribed steps are needed for a full workout.':'Each card brings the drill, video and Pocket Radar entry together. Enter the listed speeds and Save & next. The next side and bat setup appear automatically.';radarChoice.checked=noRadar;radarChoice.disabled=radar.has_session||activeProgram.family!=='overspeed';element('os-radar-mode-status').textContent=radar.has_session?'Radar mode is saved for this workout date. Choose a new date for a different mode.':activeProgram.family!=='overspeed'?'This option follows the OverSpeed training phases.':'Choose before saving the first step. No speed readings will be created in no-radar mode.';const progress=guideProgress();progress.total=progress.steps.length;progress.done=radar.unmeasured_steps.length;const p=activeProgram,box=element('overspeed-guided-progress');let step=reviewStepId?progress.steps.find(step=>step.id===reviewStepId):progress.next,record=reviewStepId?savedStepRecord(step):null;
    if(reviewStepId&&!record&&!noRadar){reviewStepId=null;step=progress.next;}const reviewing=Boolean(reviewStepId),position=step?progress.steps.findIndex(item=>item.id===step.id):progress.steps.length;box.replaceChildren();
    box.append(node('div','eyebrow',manualMode?'OPTIONAL EXTRA / CORRECTION':reviewing?'REVIEW SAVED STEP':'GUIDED WORKOUT'),node('h3','',manualMode?'Extra / saved readings':step?`Step ${position+1} of ${progress.total} · ${step.drill_name}`:'Workout steps finished'));
    box.append(node('p','',manualMode?'Return to the guided workout when you are ready.':step?`${configurations[step.configuration]} · ${step.side==='dominant'?'Dominant':'Non-dominant'} · ${step.reps} swings`:`${progress.total} / ${progress.total} steps accounted for. Your next workout uses its own training date.`));
    if(!manualMode){
      box.append(node('p','field-help',`${progress.done} / ${progress.total} steps saved or previously reported complete.`));
      if(reviewing)box.append(node('p','field-help','Your saved speeds are filled in. Save changes & next updates this entry. Resume workout returns to the next unfinished step.'));
      const nav=node('div','overspeed-step-navigation'),previous=progress.steps.slice(0,position).reverse().find(item=>stepHasRecord(item)),back=node('button','secondary-button overspeed-step-previous','← Previous step');back.type='button';back.disabled=!previous;back.addEventListener('click',()=>{if(previous)goToGuideStep(previous.id);});if(!step)nav.append(back);
      if(reviewing){const following=progress.steps.slice(position+1).find(item=>stepHasRecord(item));if(following){const forward=node('button','secondary-button overspeed-step-forward','Next saved step →');forward.type='button';forward.addEventListener('click',()=>goToGuideStep(following.id));nav.append(forward);}const resume=node('button','secondary-button overspeed-step-resume',progress.next?'Resume workout':'Finish review');resume.type='button';resume.addEventListener('click',()=>goToGuideStep(null));nav.append(resume);}box.append(nav);
      if(!previous&&position>0&&progress.done)box.append(node('p','field-help','Earlier speeds are not stored on this device. Use the device where they were entered to correct them.'));
    }
    if(!manualMode&&!step&&focus)box.scrollIntoView({behavior:'smooth',block:'center'});
    if(!manualMode&&!reviewing&&step?.configuration==='both_sleeves'&&step.side==='dominant')box.append(node('p','field-help','The source plan specifies a 60–90 second break before the heavy set for each drill.'));
    if(noRadar){
      for(const {drill,host}of currentHosts){const card=host.parentElement??host.parent;card.hidden=!step||drill.id!==step.drill_id;const entry=entries.get(p.id+'/'+drill.id);entry.form.hidden=true;const status=card.querySelector('.os-drill-status');if(status)status.textContent=progress.completed_drills.includes(drill.id)?'Completed · required swings confirmed.':'In progress · confirm every prescribed side and setup.';if(card.hidden)continue;
        const panel=node('div','overspeed-no-radar-step');noRadarPanel=panel;const image=OVERSPEED_BAT_VISUALS[step.configuration];if(image){const figure=node('figure','overspeed-bat-visual'),photo=node('img','overspeed-bat-photo');photo.src=image.src;photo.alt=image.alt;figure.append(photo,node('figcaption','',image.label));panel.append(figure);}
        const label=node('label','overspeed-no-radar-check'),check=node('input');check.type='checkbox';check.checked=radar.unmeasured_steps.includes(step.id);check.setAttribute('aria-label',`Completed ${step.reps} swings · ${step.side==='dominant'?'dominant':'non-dominant'} · ${configurations[step.configuration]}`);label.append(check,node('span','',`I completed all ${step.reps} required swings on the ${step.side==='dominant'?'dominant':'non-dominant'} side with ${configurations[step.configuration]}.`));panel.append(node('h4','','No radar today · completion only'),label,node('p','field-help','Check after completing this step. The next side, setup or exercise will appear automatically.'));
        const error=node('p','form-error');error.hidden=true;panel.append(error);check.addEventListener('change',()=>{try{if(!check.checked&&reviewing&&!window.confirm('Correct this step and clear later completion checks for this workout?')){check.checked=true;return;}reviewStepId=null;protocol.completeWithoutRadar(step.id,check.checked);refreshGuide(true);}catch(problem){check.checked=!check.checked;error.textContent=problem.message;error.hidden=false;}});
        const previous=progress.steps.slice(0,position).reverse().find(item=>stepHasRecord(item));if(previous){const back=node('button','secondary-button','← Previous step');back.type='button';back.addEventListener('click',()=>goToGuideStep(previous.id));panel.append(back);}host.append(panel);if(focus)panel.scrollIntoView({behavior:'smooth',block:'center'});
      }return;
    }
    const mode=node('button','secondary-button overspeed-manual-mode',manualMode?'Return to guided workout':'Extra / game-bat readings');mode.type='button';mode.addEventListener('click',()=>{const nextMode=!manualMode;if(!discardDrafts())return;manualMode=nextMode;refreshGuide();});box.append(mode);
    for(const {drill,host}of currentHosts){const entry=entries.get(p.id+'/'+drill.id),card=host.parentElement??host.parent;card.hidden=!manualMode&&(!step||drill.id!==step.drill_id);if(!card.hidden){
      if(reviewing){if(entry.editingId()!==record.id)entry.edit(record);else entry.configureStep(step);}else entry.configureStep(manualMode?null:step);
      if(!manualMode&&!reviewing&&p.family==='counterweight'&&!entry.fields.puck.value){const prior=records.filter(r=>r.player===playerSelect.value&&r.program_id===p.id&&r.session_date===element('os-session-date').value&&r.guided_protocol==='velo_overspeed_steps_v1').at(-1);if(prior)entry.fields.puck.value=prior.puck_used?'yes':'no';}
      if(focus&&!manualMode){entry.form.scrollIntoView({behavior:'smooth',block:'center'});entry.fields.swings[0].focus({preventScroll:true});}
    }}
  }
  function refreshGuide(focus=false){
    if(!activeProgram)return;const radar=radarContext(),choice=element('os-no-radar');choice.checked=radar.noRadar;choice.disabled=radar.has_session||activeProgram.family!=='overspeed';element('os-radar-mode-status').textContent=radar.has_session?'Radar mode is saved for this workout date. Choose a new date for a different mode.':activeProgram.family!=='overspeed'?'This option follows the OverSpeed training phases.':'Choose before saving the first step.';
    if(radar.noRadar){renderNoRadar(focus);return;}if(noRadarPanel){noRadarPanel.remove();noRadarPanel=null;}element('os-radar-instructions').textContent='Enter Pocket Radar readings for both sides. The next bat setup appears after both sides are saved.';

    if(!activeProgram)return;const progress=guideProgress(),p=activeProgram,box=element('overspeed-guided-progress');
    let step=reviewStepId?progress.steps.find(item=>item.id===reviewStepId):progress.next,record=reviewStepId?savedStepRecord(step):null;
    if(reviewStepId&&!record){reviewStepId=null;step=progress.next;}
    const reviewing=Boolean(reviewStepId),unit=step?progress.units.find(item=>item.steps.some(candidate=>candidate.id===step.id)):null,position=unit?progress.units.findIndex(item=>item.id===unit.id):progress.units.length,paired=Boolean(unit?.steps.length===2);
    box.replaceChildren();
    box.append(node('div','eyebrow',manualMode?'FULL WORKOUT / ENTER EACH DRILL':reviewing?'REVIEW SAVED STEP':'GUIDED WORKOUT'),node('h3','',manualMode?'Full program · enter each drill':step?`Step ${position+1} of ${progress.total} · ${step.drill_name}`:'Workout steps finished'));
    box.append(node('p','',manualMode?'All drills are shown together. Choose the setup and side you completed, then enter its Pocket Radar readings.':step?`${configurations[step.configuration]} · ${paired?'Dominant & non-dominant':step.side==='dominant'?'Dominant':'Non-dominant'} · ${step.reps} swings${paired?' per side':''}`:`${progress.total} / ${progress.total} steps accounted for. Your next workout uses its own training date.`));
    if(!manualMode){
      box.append(node('p','field-help',`${progress.done} / ${progress.total} steps saved or previously reported complete.`));
      if(reviewing)box.append(node('p','field-help','Your saved speeds are filled in. Save changes & next updates this entry. Resume workout returns to the next unfinished step.'));
      const nav=node('div','overspeed-step-navigation'),previous=progress.units.slice(0,position).flatMap(item=>item.steps).reverse().find(item=>savedStepRecord(item)),back=node('button','secondary-button overspeed-step-previous','← Previous step');back.type='button';back.disabled=!previous;back.addEventListener('click',()=>{if(previous)goToGuideStep(previous.id);});if(!step)nav.append(back);
      if(reviewing){const following=progress.units.slice(position+1).flatMap(item=>item.steps).find(item=>savedStepRecord(item));if(following){const forward=node('button','secondary-button overspeed-step-forward','Next saved step →');forward.type='button';forward.addEventListener('click',()=>goToGuideStep(following.id));nav.append(forward);}const resume=node('button','secondary-button overspeed-step-resume',progress.next?'Resume workout':'Finish review');resume.type='button';resume.addEventListener('click',()=>goToGuideStep(null));nav.append(resume);}box.append(nav);
      if(!previous&&position>0&&progress.done)box.append(node('p','field-help','Earlier speeds are not stored on this device. Use the device where they were entered to correct them.'));
    }
    if(!manualMode&&!step&&focus)box.scrollIntoView({behavior:'smooth',block:'center'});
    if(!manualMode&&!reviewing&&step?.configuration==='both_sleeves'&&step.side==='dominant')box.append(node('p','field-help','The source plan specifies a 60–90 second break before the heavy set for each drill.'));
    for(const {drill,host}of currentHosts){
      const wrapper=host.querySelector('.overspeed-paired-forms');if(!wrapper)continue;
      const card=host.parentElement??host.parent,isCurrent=!manualMode&&Boolean(unit)&&drill.id===step?.drill_id;card.hidden=!manualMode&&!isCurrent;
      wrapper.querySelectorAll('.overspeed-side-complete').forEach(status=>status.remove());
      const sides=drill.side==='Both'?['dominant','non_dominant']:['dominant'];
      for(const side of sides){
        const entry=entries.get(entryKey(p,drill,side));if(!entry)continue;
        if(manualMode){entry.form.hidden=side!=='dominant';if(side==='dominant')entry.configureStep(null);continue;}
        if(!isCurrent){entry.form.hidden=true;continue;}
        const sideStep=unit?.steps.find(candidate=>candidate.side===side)??(step?.side===side?step:null);if(!sideStep){entry.form.hidden=true;continue;}
        const saved=savedStepRecord(sideStep);
        if(saved&&!(reviewing&&sideStep.id===step.id)){entry.form.hidden=true;const stats=summarize(saved.swings_mph),status=node('div','overspeed-side-complete');status.append(node('strong','',side==='dominant'?'Dominant · complete':'Non-dominant · complete'),node('span','',`Best ${stats.best_mph.toFixed(1)} mph · mean ${stats.mean_mph.toFixed(1)} mph`));wrapper.insertBefore(status,entry.form);continue;}
        entry.form.hidden=false;if(reviewing&&sideStep.id===step.id){if(entry.editingId()!==record.id)entry.edit(record);else entry.configureStep(sideStep);}else entry.configureStep(sideStep);
        if(!manualMode&&p.family==='counterweight'&&!entry.fields.puck.value){const prior=records.filter(r=>r.player===playerSelect.value&&r.program_id===p.id&&r.session_date===element('os-session-date').value&&r.guided_protocol==='velo_overspeed_steps_v1').at(-1);if(prior)entry.fields.puck.value=prior.puck_used?'yes':'no';}
        if(focus&&sideStep.id===step?.id){entry.form.scrollIntoView({behavior:'smooth',block:'center'});entry.fields.swings[0].focus({preventScroll:true});}
      }
    }
  }
  function contextLabel(r){const p=programs.get(r.program_id),d=p.drills.find(d=>d.id===r.drill_id);return `${p.name} · ${d.name} · ${configurations[r.configuration]} · ${r.side==='dominant'?'dominant':'non-dominant'} · ${r.puck_used?'Puck':'no Puck'} · ${r.bat_label} · ${r.device_type==='pocket_radar'?'Pocket Radar':devices[r.device_type]+': '+r.device_label}`;}
  function history(){
    const player=playerSelect.value,all=records.filter(r=>r.player===player).sort((a,b)=>b.session_date.localeCompare(a.session_date)||String(b.created_at??'').localeCompare(String(a.created_at??'')));
    element('overspeed-history-title').textContent=player?`${player} · ${all.length} bat-speed sets`:'Choose a player to see bat-speed records';element('overspeed-export').disabled=!all.length;
    const series=element('overspeed-series'),prior=series.value,contexts=[...new Set(all.map(contextFor))];series.replaceChildren();
    if(!contexts.length){const option=node('option','','No recorded contexts');option.value='';series.append(option);}else for(const key of contexts){const option=node('option','',contextLabel(all.find(r=>contextFor(r)===key)));option.value=key;series.append(option);}if(contexts.includes(prior))series.value=prior;
    const progress=progressFor(all,series.value),summary=element('overspeed-progress-summary');summary.replaceChildren();
    for(const[label,value]of [['Sets in this context',progress.sets],['Latest daily best',progress.latest?progress.latest.best_mph.toFixed(1)+' mph':'—'],['Change in daily best',progress.change_best_mph===null?'—':(progress.change_best_mph>0?'+':'')+progress.change_best_mph.toFixed(1)+' mph']]){const card=node('article');card.append(node('span','',label),node('strong','',String(value)));summary.append(card);}
    const daily=element('overspeed-progress-days');daily.replaceChildren();for(const day of progress.days){const tr=node('tr');for(const value of [day.date,day.count,day.best_mph.toFixed(1),day.mean_mph.toFixed(1)])tr.append(node('td','',String(value)));daily.append(tr);}
    const container=element('overspeed-history');container.replaceChildren();if(!all.length){container.append(node('p','workout-history-help','No bat-speed sets for this player yet.'));return;}
    for(const r of all){const stats=summarize(r.swings_mph),card=node('details','workout-record'),heading=node('summary');card.dataset.recordId=r.id;heading.append(node('strong','',`${r.session_date} · Best ${stats.best_mph.toFixed(1)} mph`),node('span','',`${stats.count} swings · mean ${stats.mean_mph.toFixed(1)} mph`));card.append(heading);const body=node('div','workout-record-body');body.append(node('p','',contextLabel(r)),node('p','',r.swings_mph.map((v,i)=>`Swing ${i+1}: ${v===null?'—':v+' mph'}`).join(' · ')));if(r.notes)body.append(node('p','',r.notes));const actions=node('div','workout-record-actions'),edit=node('button','secondary-button','Edit set'),remove=node('button','delete-button','Delete set');edit.type=remove.type='button';
      edit.addEventListener('click',()=>{if([...entries.values()].some(e=>e.hasChanges())&&!window.confirm('Replace unsaved bat-speed readings with this saved set?'))return;entries.clear();reviewStepId=null;manualMode=true;protocol.setProgram(r.program_id);const editProgram=programs.get(r.program_id),editDrill=editProgram.drills.find(drill=>drill.id===r.drill_id);entries.get(entryKey(editProgram,editDrill,r.side)).edit(r);});
      remove.addEventListener('click',()=>{if(!window.confirm('Delete this bat-speed set from this device?'))return;const next=records.filter(v=>v.id!==r.id);let apply;try{apply=r.guided_protocol?protocol.prepareGuidedChange(r,next,{removedRecordIds:[r.id]}):null;}catch(error){element('overspeed-announcement').textContent=error.message;return;}persist(next);apply?.();for(const entry of entries.values())if(entry.editingId()===r.id)entry.reset();history();refreshGuide();});actions.append(edit,remove);body.append(actions);card.append(body);container.append(card);}
  }
  element('os-no-radar').addEventListener('change',()=>{if(!activeProgram)return;const context=radarContext();if(context.has_session||!discardDrafts()){element('os-no-radar').checked=context.noRadar;return;}noRadarChoices.set(context.key,element('os-no-radar').checked);refreshGuide();});
  programSelect.addEventListener('change',()=>{if(!programs.has(programSelect.value)){programSelect.value=lastProgram;return;}if(!discardDrafts()){programSelect.value=lastProgram;return;}protocol.setProgram(programSelect.value);});
  playerSelect.addEventListener('change',()=>{if(!beforePlayerChange()){playerSelect.value=lastPlayer;return;}if([...entries.values()].some(e=>e.hasChanges())&&!window.confirm('Switch players and clear unsaved bat-speed readings?')){playerSelect.value=lastPlayer;return;}lastPlayer=playerSelect.value;entries.clear();manualMode=false;reviewStepId=null;onPlayerChanged();refreshAccess();history();});
  element('os-session-date').addEventListener('change',()=>{for(const e of entries.values())e.setDate(element('os-session-date').value);refreshAccess();refreshGuide();});
  element('overspeed-series').addEventListener('change',history);element('overspeed-export').addEventListener('click',()=>download('rangers-overspeed-bat-speed.csv',toCsv(records.filter(r=>r.player===playerSelect.value))));
  protocol.setContextGuard(discardDrafts);protocol.attachSpeedForms(mount);refreshAccess();history();return {replaceRecords(next){records=next;persist(next);history();},records:()=>records,refreshAccess,clearPlayer(name){if(!players.includes(name))return false;persist(records.filter(r=>r.player!==name));if(playerSelect.value===name){for(const entry of entries.values())entry.reset();entries.clear();reviewStepId=null;manualMode=false;}history();refreshAccess();return true;}};
}
