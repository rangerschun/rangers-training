export const PERSONAL_PASSWORD_ITERATIONS=600000;
export function validatePersonalPassword(password,confirm){
 if(typeof password!=='string'||password.length<8||password.length>128||!password.trim())throw Error('Use a new password with 8–128 characters.');
 if(password!==confirm)throw Error('The new passwords do not match.');return password;
}
export async function personalPasswordProof(password,salt,iterations=PERSONAL_PASSWORD_ITERATIONS,crypto=globalThis.crypto){
 if(typeof password!=='string'||password.length>128||!/^[a-f0-9]{48}$/.test(salt)||iterations!==PERSONAL_PASSWORD_ITERATIONS||!crypto?.subtle)throw Error('This browser could not prepare your password. Use an up-to-date browser and reload.');
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveBits']);
 const bytes=await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:Uint8Array.from(salt.match(/../g),pair=>parseInt(pair,16)),iterations},key,256);
 return Array.from(new Uint8Array(bytes),byte=>byte.toString(16).padStart(2,'0')).join('');
}
export async function authenticateWithPersonalPassword(call,player,password,newPassword=null,crypto=globalThis.crypto){
 const challenge=await call('authenticatePlayer',[{player,mode:'challenge'}]);
 if(challenge?.player!==player||!['legacy','pbkdf2-sha256'].includes(challenge.scheme)||typeof challenge.revision!=='string')throw Error('Reload the page to connect to the updated password service.');
 const request={player,auth_revision:challenge.revision};
 if(challenge.scheme==='legacy')request.password=password;
 else request.password_proof=await personalPasswordProof(password,challenge.salt,challenge.iterations,crypto);
 if(newPassword!==null){validatePersonalPassword(newPassword,newPassword);const salt=Array.from(crypto.getRandomValues(new Uint8Array(24)),byte=>byte.toString(16).padStart(2,'0')).join('');request.new_password_salt=salt;request.new_password_iterations=PERSONAL_PASSWORD_ITERATIONS;request.new_password_proof=await personalPasswordProof(newPassword,salt,PERSONAL_PASSWORD_ITERATIONS,crypto);}
 try{return await call('authenticatePlayer',[request]);}catch(error){if(newPassword!==null&&/did not respond|not confirmed|connection|timeout|unavailable/i.test(error?.message??''))throw Error('The password update was not confirmed. Try your new password; if it does not work, try your previous password. '+error.message);throw error;}
}
export function passwordChangeFields(prefix,element){
 const choice=element(prefix+'-password-change'),fields=element(prefix+'-password-fields'),password=element(prefix+'-password-new'),confirm=element(prefix+'-password-confirm');
 if(!choice||!fields||!password||!confirm)return {read:()=>null,reset(){},setBusy(){},isBusy:()=>false};
 const cancel=element(prefix==='player'?'player-access-cancel':'gamechanger-access-cancel');let busy=false;function render(){if(cancel)cancel.disabled=busy;fields.hidden=!choice.checked;choice.disabled=busy;password.disabled=confirm.disabled=busy||!choice.checked;password.required=confirm.required=choice.checked;}
 choice.addEventListener('change',()=>{if(!choice.checked){password.value='';confirm.value='';}render();});render();
 return {read(){return choice.checked?validatePersonalPassword(password.value,confirm.value):null;},isBusy:()=>busy,setBusy(value){busy=value;render();},reset(){busy=false;choice.checked=false;password.value='';confirm.value='';render();}};
}
