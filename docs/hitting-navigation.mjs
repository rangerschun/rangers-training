const group=document.getElementById('hitting-menu');
if(group){
 const toggle=group.querySelector('summary'),panel=group.querySelector('.hitting-programs');
 const programs=new Set(['blast','overspeed','provelocity','axe']);
 const mobile=()=>window.matchMedia('(max-width:760px)').matches;
 function place(){
  if(!group.open||!mobile())return;
  const box=toggle.getBoundingClientRect();
  group.style.setProperty('--hitting-left',Math.max(12,Math.min(box.left,window.innerWidth-272))+'px');
  group.style.setProperty('--hitting-top',Math.max(12,Math.min(box.bottom+8,window.innerHeight-240))+'px');
 }
 function route(){
  const active=programs.has(location.hash.slice(1));
  toggle.classList.toggle('active',active);
  group.open=active&&!mobile();
  place();
 }
 group.addEventListener('toggle',place);
 panel.addEventListener('click',event=>{if(event.target.closest('a')&&mobile())group.open=false;});
 document.addEventListener('pointerdown',event=>{if(group.open&&!group.contains(event.target))group.open=false;});
 document.addEventListener('keydown',event=>{if(event.key==='Escape'&&group.open){group.open=false;toggle.focus();}});
 window.addEventListener('hashchange',route);
 window.addEventListener('resize',()=>{if(mobile())group.open=false;else if(programs.has(location.hash.slice(1)))group.open=true;});
 group.closest('nav').addEventListener('scroll',()=>{if(mobile())group.open=false;},{passive:true});
 route();
}
