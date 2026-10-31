import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFileSync} from 'node:fs';import {webcrypto} from 'node:crypto';
const code=readFileSync(new URL('../docs/google-bridge.mjs',import.meta.url),'utf8').replaceAll('export ',''),config={url:'https://script.google.com/macros/s/synthetic-deployment/exec',origin:'https://rangerschun.github.io'};
function fixture({blocked=false,timeoutMs=1000}={}){
 let receive;const sent=[],popups=[],frames=[];
 const node=()=>({textContent:'',style:{},children:[],attributes:{},setAttribute(k,v){this.attributes[k]=v;},append(...children){this.children.push(...children);},remove(){},cloneNode(){return node();}});
 const form=()=>({...node(),submit:{textContent:'Continue',disabled:false},listeners:[],valid:true,querySelector(){return this.submit;},checkValidity(){return this.valid;},addEventListener(type,fn,capture){this.listeners.push({type,fn,capture});}});
 const forms={'player-access-form':form(),'gamechanger-access-form':form()},doc={createElement(){return node();},getElementById:id=>forms[id],body:{append(frame){frames.push(frame);}}};
 const peer=()=>({closed:false,focus(){},postMessage(data,origin){sent.push({data,origin,source:this});}}),iframePeer=peer();
 const window={location:{origin:config.origin},addEventListener(type,fn){if(type==='message')receive=fn;},removeEventListener(){receive=null;},open(){if(blocked)return null;const p=peer();popups.push(p);return p;}};
 const context=vm.createContext({window,document:doc,location:window.location,crypto:webcrypto,URL,Uint8Array,setTimeout,clearTimeout,MutationObserver:class{observe(){}}});
 vm.runInContext(code+';globalThis.api={createGoogleBridge,installGoogleBridge,GOOGLE_BRIDGE_METHODS,isGoogleBridgeOrigin}',context);
 const bridge=context.api.installGoogleBridge(config);const nonce=new URL(frames[0].src).searchParams.get('nonce'),origin='https://fixture-script.googleusercontent.com';
 function message(data,source=iframePeer,edits={}){receive({origin,source,data:{channel:'rangers-google-bridge-v1',nonce,...data},...edits});}
 function submit(id='player-access-form'){const event={prevented:false,stopped:false,preventDefault(){this.prevented=true;},stopImmediatePropagation(){this.stopped=true;}};for(const l of forms[id].listeners)l.fn(event);return event;}
 return {bridge,context,forms,frames,sent,popups,message,submit,iframePeer,origin,nonce};
}
test('one sign-in uses an already connected Sheet without a popup or extra button',()=>{
 const f=fixture();try{f.message({type:'ready'});const e=f.submit();assert.equal(e.stopped,false);assert.equal(f.popups.length,0);for(const form of Object.values(f.forms)){assert.equal(form.submit.textContent,'Sign in');assert.equal(form.children.some(n=>n.textContent==='Connect Google in a separate window'),false);assert.equal(form.listeners[0].capture,true);}assert.match(f.bridge.status.textContent,/Signing in/);}finally{f.bridge.dispose();}
});
test('the submit gesture opens the connection and continues the exact queued login automatically',async()=>{
 const f=fixture();try{assert.equal(f.submit().stopped,false);assert.equal(f.popups.length,1);const request={player:'Synthetic',mode:'challenge'},waiting=f.bridge.call('authenticatePlayer',[request]);assert.equal(f.sent.length,0);f.message({type:'ready'},f.popups[0]);assert.equal(f.sent.length,1);assert.equal(f.sent[0].data.args[0],request);const id=f.sent[0].data.id;f.message({type:'response',id,ok:true,value:{player:'Synthetic',scheme:'legacy',revision:'test'}},f.popups[0]);assert.equal((await waiting).player,'Synthetic');assert.match(f.bridge.status.textContent,/automatically/);assert.equal(f.popups.length,1);}finally{f.bridge.dispose();}
});
test('a blocked connection stops login cleanly and gives one Sign in retry',()=>{
 const f=fixture({blocked:true});try{const e=f.submit();assert.equal(e.prevented,true);assert.equal(e.stopped,true);assert.equal(f.sent.length,0);assert.equal(f.forms['player-access-form'].submit.disabled,false);assert.match(f.bridge.status.textContent,/tap Sign in again/);}finally{f.bridge.dispose();}
});
test('GameChanger uses the same integrated sign-in connection',()=>{
 const f=fixture();try{assert.equal(f.submit('gamechanger-access-form').stopped,false);assert.equal(f.popups.length,1);assert.equal(f.forms['gamechanger-access-form'].submit.textContent,'Sign in');}finally{f.bridge.dispose();}
});
test('closed connection windows reconnect during the next sign-in gesture',()=>{
 const f=fixture();try{f.submit();f.message({type:'ready'},f.popups[0]);f.popups[0].closed=true;assert.equal(f.submit().stopped,false);assert.equal(f.popups.length,2);}finally{f.bridge.dispose();}
});
test('untrusted handshakes and responses cannot complete a sign-in',async()=>{
 const f=fixture();try{const waiting=f.bridge.call('authenticatePlayer',[{player:'Synthetic'}]);f.message({type:'ready'},f.iframePeer,{origin:'https://attacker.test'});f.message({type:'ready',nonce:'incorrect'});assert.equal(f.sent.length,0);f.message({type:'ready'});const id=f.sent[0].data.id;let resolved=false;waiting.then(()=>resolved=true);f.message({type:'response',id,ok:true,value:true},{});await Promise.resolve();assert.equal(resolved,false);f.message({type:'response',id,ok:true,value:{verified:true}});assert.equal((await waiting).verified,true);}finally{f.bridge.dispose();}
});
test('retained app installation is idempotent and the bootstrap precedes the app',()=>{
 const f=fixture();try{assert.equal(f.context.api.installGoogleBridge(config),null);assert.equal(f.frames.length,1);const html=readFileSync(new URL('../docs/index.html',import.meta.url),'utf8');assert.ok(html.indexOf('src="./login-connection.mjs')<html.indexOf('src="./app-provelocity-'));assert.ok(html.includes('id="hitting-menu"'));assert.ok(html.includes('v=team-roster-20261031'));}finally{f.bridge.dispose();}
});
