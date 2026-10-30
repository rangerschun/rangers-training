export function startCoachPasswordReset({element:$,players,isCoach,reset,confirm=message=>globalThis.confirm(message)}){
 const player=$('coach-password-player'),button=$('coach-password-reset'),status=$('coach-password-status');let busy=false;
 if(!player||!button||!status)return {clear(){}};
 for(const name of players){const option=document.createElement('option');option.value=option.textContent=name;player.append(option);}
 function render(){button.disabled=busy||!player.value;player.disabled=busy;}
 player.addEventListener('change',()=>{status.textContent='';render();});
 button.addEventListener('click',async()=>{
  if(busy||!isCoach()||!players.includes(player.value))return;const selected=player.value;
  if(!confirm(`Reset ${selected}’s password to their jersey number? Their personal password and earlier sign-in sessions will stop working.`))return;
  busy=true;render();status.textContent='Resetting password…';
  try{const result=await reset(selected);if(result?.player!==selected||result.password_reset!==true||result.scheme!=='legacy')throw Error('The reset could not be verified.');if(isCoach())status.textContent=`${selected}’s password is now their jersey number. They can choose a new personal password at sign-in.`;}
  catch(error){if(isCoach())status.textContent=`${error.message} If the connection was interrupted, try the jersey number before resetting again.`;}
  finally{busy=false;render();}
 });
 render();return {clear(){player.value='';status.textContent='';render();}};
}
