const group=document.getElementById('running-menu');
if(group){
 const toggle=group.querySelector('summary'),panel=group.querySelector('.hitting-programs');
 const programs=new Set(['driveline','ota-bodyweight','ota-beginner','ota-advanced']);
 const mobile=()=>window.matchMedia('(max-width:760px)').matches;
 function place(){if(!group.open||!mobile())return;const box=toggle.getBoundingClientRect();group.style.setProperty('--hitting-left',Math.max(12,Math.min(box.left,window.innerWidth-272))+'px');group.style.setProperty('--hitting-top',Math.max(12,Math.min(box.bottom+8,window.innerHeight-340))+'px');}
 function route(){const parts=location.hash.slice(1).split('/'),active=parts[0]==='running',program=programs.has(parts[1])?parts[1]:'driveline';toggle.classList.toggle('active',active);for(const link of panel.querySelectorAll('a')){const chosen=active&&link.dataset.runningProgram===program;link.classList.toggle('active',chosen);if(chosen)link.setAttribute('aria-current','page');else link.removeAttribute('aria-current');}group.open=active&&!mobile();place();}
 panel.addEventListener('click',event=>{const link=event.target.closest('[data-running-program]');if(!link)return;const accepted=document.dispatchEvent(new CustomEvent('running-program-select',{detail:{program:link.dataset.runningProgram},cancelable:true}));if(!accepted){event.preventDefault();return;}if(mobile())group.open=false;});
 group.addEventListener('toggle',place);
 document.addEventListener('pointerdown',event=>{if(group.open&&!group.contains(event.target))group.open=false;});
 document.addEventListener('keydown',event=>{if(event.key==='Escape'&&group.open){group.open=false;toggle.focus();}});
 window.addEventListener('hashchange',route);
 window.addEventListener('resize',()=>{if(mobile())group.open=false;else if(location.hash.slice(1).split('/')[0]==='running')group.open=true;});
 group.closest('nav').addEventListener('scroll',()=>{if(mobile())group.open=false;},{passive:true});route();
}
