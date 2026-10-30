// Replaces authenticatePlayer and authenticatePlayerSession_ in the copied Code.gs.
// No credentials belong in this file. Personal verifiers live in private Script Properties.
const PERSONAL_PASSWORD_ITERATIONS = 600000;
function personalPasswordKey_(player){return 'player-personal-auth-v1:'+digest_(player);}
function personalPasswordRecord_(properties,player){
 const raw=properties.getProperty(personalPasswordKey_(player));if(!raw)return null;
 let record;try{record=JSON.parse(raw);}catch{throw Error('Your coach needs to check the password record.');}
 if(record.version!==1||!/^[a-f0-9]{48}$/.test(record.salt)||record.iterations!==PERSONAL_PASSWORD_ITERATIONS||!/^[a-f0-9]{64}$/.test(record.verifier)||!/^[a-f0-9]{32}$/.test(record.revision))throw Error('Your coach needs to check the password record.');
 return record;
}
function personalPasswordEqual_(left,right){
 if(typeof left!=='string'||typeof right!=='string')return false;let different=left.length^right.length;for(let i=0;i<Math.max(left.length,right.length);i++)different|=(left.charCodeAt(i)||0)^(right.charCodeAt(i)||0);return different===0;
}
function personalPasswordVerifier_(properties,player,salt,proof,create){
 let pepper=properties.getProperty('playerAuthPepperV1');
 if(!pepper&&create){pepper=Utilities.getUuid().replace(/-/g,'')+Utilities.getUuid().replace(/-/g,'');properties.setProperty('playerAuthPepperV1',pepper);}
 if(!pepper)throw Error('Your coach needs to check the password service.');
 return Utilities.computeHmacSha256Signature('rangers-personal-proof-v1\0'+player+'\0'+salt+'\0'+proof,pepper).map(byte=>((byte+256)%256).toString(16).padStart(2,'0')).join('');
}
function authenticatePlayer(request){
 const json=typeof request==='string';if(json){if(request.length>2000)throw Error('Invalid player request.');request=JSON.parse(request);}
 const properties=PropertiesService.getScriptProperties(),players=JSON.parse(properties.getProperty('players')||'[]'),player=request?.player;
 if(typeof player!=='string'||!players.includes(player)||!PLAYER_LOGIN_HASHES?.[player])throw Error('That password does not match. Try again.');
 let personal=personalPasswordRecord_(properties,player);
 if(request?.mode==='challenge'){const result={player,scheme:personal?'pbkdf2-sha256':'legacy',salt:personal?.salt??null,iterations:PERSONAL_PASSWORD_ITERATIONS,revision:personal?.revision??'legacy'};return json?JSON.stringify(result):result;}
 const lock=LockService.getScriptLock();if(!lock.tryLock(10000))throw Error('The password service is busy. Try again shortly.');
 try{
  personal=personalPasswordRecord_(properties,player);const revision=personal?.revision??'legacy',cache=CacheService.getScriptCache(),failureKey='player-auth-failures:'+digest_(player),failures=Number(cache.get(failureKey)||0);
  if(failures>=20)throw Error('Too many password attempts. Wait 10 minutes and try again.');
  if(request.auth_revision!==undefined&&request.auth_revision!==revision)throw Error('Your password changed on another device. Sign in again.');
  let valid=false;
  if(personal){if(typeof request.password_proof==='string'&&/^[a-f0-9]{64}$/.test(request.password_proof))valid=personalPasswordEqual_(personal.verifier,personalPasswordVerifier_(properties,player,personal.salt,request.password_proof,false));}
  else{const password=typeof request.password==='string'?request.password.trim().replace(/^#/,''):'';valid=/^\d{1,3}$/.test(password)&&personalPasswordEqual_(digest_('rangers-jersey-v1\0'+player+'\0'+password),PLAYER_LOGIN_HASHES[player]);}
  if(!valid){cache.put(failureKey,String(failures+1),600);throw Error(personal&&!request.password_proof?'Reload the page to use your personal password.':'That password does not match. Try again.');}
  const changing=Object.prototype.hasOwnProperty.call(request,'new_password_proof');
  if(changing){
   if(typeof request.new_password_proof!=='string'||!/^[a-f0-9]{64}$/.test(request.new_password_proof)||typeof request.new_password_salt!=='string'||!/^[a-f0-9]{48}$/.test(request.new_password_salt)||request.new_password_iterations!==PERSONAL_PASSWORD_ITERATIONS)throw Error('The new password could not be verified. Reload and try again.');
   personal={version:1,salt:request.new_password_salt,iterations:PERSONAL_PASSWORD_ITERATIONS,verifier:personalPasswordVerifier_(properties,player,request.new_password_salt,request.new_password_proof,true),revision:Utilities.getUuid().replace(/-/g,'')};
   properties.setProperty(personalPasswordKey_(player),JSON.stringify(personal));
  }
  cache.remove(failureKey);const token=Utilities.getUuid().replace(/-/g,'')+Utilities.getUuid().replace(/-/g,'');
  cache.put('player-session:'+digest_(token),JSON.stringify({player,revision:personal?.revision??'legacy'}),21600);
  const result={player,token,expires_in:21600,password_changed:changing};return json?JSON.stringify(result):result;
 }finally{lock.releaseLock();}
}
function authenticatePlayerSession_(request){
 const token=request?.token;if(typeof token!=='string'||!/^[a-f0-9]{64}$/.test(token))throw Error('Enter your password again to load your Google Sheet records.');
 let session;try{session=JSON.parse(CacheService.getScriptCache().get('player-session:'+digest_(token))||'null');}catch{}
 const personal=personalPasswordRecord_(PropertiesService.getScriptProperties(),request?.player),revision=personal?.revision??'legacy';
 if(!session||session.player!==request?.player||(session.revision??'legacy')!==revision)throw Error('Your session expired. Enter your password again.');
 return session.player;
}
