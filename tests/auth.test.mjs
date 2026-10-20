import test from 'node:test';import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { createSessionController } from '../src/session-controller.js';
import { createSessionStorage,SESSION_KEY } from '../src/session-storage.js';
const USER={id:'11111111-1111-4111-8111-111111111111',email:'aluno@example.test',aud:'authenticated',role:'authenticated',app_metadata:{},user_metadata:{},created_at:new Date().toISOString()};
function session(expired=false,refresh='refresh-first'){
 const exp=Math.floor(Date.now()/1000)+(expired?-60:3600);
 const jwt=Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url')+'.'+Buffer.from(JSON.stringify({sub:USER.id,aud:'authenticated',role:'authenticated',exp})).toString('base64url')+'.c2lnbmF0dXJl';
 return{access_token:jwt,refresh_token:refresh,expires_at:exp,expires_in:3600,token_type:'bearer',user:USER};
}
function memory(initial){const data=new Map(initial?[[SESSION_KEY,typeof initial==='string'?initial:JSON.stringify(initial)]]:[]);return{data,fail:false,async get({key}){return{value:data.get(key)||null};},async set({key,value}){if(this.fail)throw Error('disk');data.set(key,value);},async remove({key}){data.delete(key);}};}
function setup(t,prefs=memory(),offline=false){
 const calls=[];
 const auth=createClient('https://example.supabase.co','sb_publishable_test',{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:async(url,init)=>{
  calls.push(String(url));
  if(offline)throw TypeError('fetch failed');
  if(String(url).includes('/user'))return new Response(JSON.stringify(USER),{status:200,headers:{'Content-Type':'application/json'}});
  if(String(url).includes('/logout'))return new Response(null,{status:204});
  return new Response(JSON.stringify(session(false,String(url).includes('refresh_token')?'refresh-renewed':'refresh-first')),{status:200,headers:{'Content-Type':'application/json'}});
 }}}).auth;
 const controller=createSessionController({auth,storage:createSessionStorage(prefs)});
 t.after(()=>{controller.dispose();auth.stopAutoRefresh();});
 return{controller,prefs,calls};
}
test('login persiste somente tokens e expiração, sem senha',async t=>{
 const {controller,prefs}=setup(t);await controller.initialize();await controller.signIn(USER.email,'senha-de-teste');
 assert.equal(controller.getSnapshot().status,'authenticated');
 const saved=JSON.parse(prefs.data.get(SESSION_KEY));
 assert.deepEqual(Object.keys(saved).sort(),['access_token','expires_at','refresh_token']);assert.ok(!JSON.stringify(saved).includes('senha-de-teste'));
});
test('novo processo restaura sessão sem pedir senha',async t=>{
 const {controller,calls}=setup(t,memory(session()));await controller.initialize();
 assert.equal(controller.getSnapshot().status,'authenticated');assert.equal(controller.getSnapshot().source,'restored');assert.ok(!calls.some(x=>x.includes('grant_type=password')));
});
test('refresh de token vencido também persiste',async t=>{
 const {controller,prefs}=setup(t,memory(session(true)));await controller.initialize();
 assert.equal(controller.getSnapshot().status,'authenticated');assert.equal(JSON.parse(prefs.data.get(SESSION_KEY)).refresh_token,'refresh-renewed');
});
test('logout remove sessão e próxima abertura fica anônima',async t=>{
 const {controller,prefs}=setup(t,memory(session()));await controller.initialize();await controller.signOut();
 assert.equal(prefs.data.has(SESSION_KEY),false);assert.equal(controller.getSnapshot().status,'anonymous');
});
test('JSON inválido é removido sem travar o app',async t=>{
 const {controller,prefs}=setup(t,memory('{invalid'));await controller.initialize();
 assert.equal(controller.getSnapshot().status,'anonymous');assert.equal(prefs.data.has(SESSION_KEY),false);
});
test('falha ao gravar impede acesso até recuperação do armazenamento',async t=>{
 const {controller,prefs}=setup(t);await controller.initialize();prefs.fail=true;
 await assert.rejects(controller.signIn(USER.email,'senha'));assert.equal(controller.getSnapshot().status,'storage-error');
 prefs.fail=false;await controller.retry();assert.equal(controller.getSnapshot().status,'authenticated');
});

test('falha transitória na restauração preserva os tokens para nova tentativa',async()=>{
 const prefs=memory(session());
 const auth={onAuthStateChange(){return{data:{subscription:{unsubscribe(){}}}};},async setSession(){return{data:{session:null},error:{status:503,name:'AuthRetryableFetchError'}};}};
 const controller=createSessionController({auth,storage:createSessionStorage(prefs)});
 await controller.initialize();
 assert.equal(controller.getSnapshot().status,'recovery-error');
 assert.ok(prefs.data.has(SESSION_KEY));
 controller.dispose();
});
