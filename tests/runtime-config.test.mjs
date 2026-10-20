import test from 'node:test';import assert from 'node:assert/strict';
import {loadRuntimeConfig,saveRuntimeConfig,CONNECTION_KEY,toConfig,configDocument} from '../src/runtime-config.js';
import {createSessionStorage} from '../src/session-storage.js';
import {checkConnection} from '../src/connection-check.js';
function memory(){const data=new Map();return{data,async get({key}){return{value:data.get(key)||null};},async set({key,value}){data.set(key,value);},async remove({key}){data.delete(key);}};}
const CONFIG={version:1,supabaseUrl:'https://example.supabase.co',supabasePublishableKey:'sb_publishable_test'};
const response=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});
test('sem configuração abre instalador; config.json pode conectar sem build',async()=>{
 const prefs=memory();
 const empty=await loadRuntimeConfig({preferences:prefs,fetcher:async()=>response({})});assert.equal(empty.ready,false);
 const ready=await loadRuntimeConfig({preferences:prefs,fetcher:async()=>response(CONFIG),baseUrl:'https://site.example/'});assert.equal(ready.ready,true);assert.equal(ready.source,'file');assert.equal(ready.url,CONFIG.supabaseUrl);
});
test('conexão salva pela tela é recuperada no próximo carregamento',async()=>{
 const prefs=memory(),config=toConfig(CONFIG);await saveRuntimeConfig(config,prefs);
 const ready=await loadRuntimeConfig({preferences:prefs,fetcher:async()=>{throw Error('não precisa consultar arquivo');}});
 assert.equal(ready.ready,true);assert.equal(ready.source,'device');assert.ok(prefs.data.has(CONNECTION_KEY));assert.deepEqual(configDocument(ready),CONFIG);
});
test('configuração corrompida não impede o uso do arquivo publicado',async()=>{
 const prefs=memory();prefs.data.set(CONNECTION_KEY,'{invalid');
 const ready=await loadRuntimeConfig({preferences:prefs,fetcher:async()=>response(CONFIG)});assert.equal(ready.source,'file');assert.equal(ready.ready,true);
});
test('a tela recusa gravar chave secreta',async()=>{
 const prefs=memory();const config=toConfig({...CONFIG,supabasePublishableKey:'sb_secret_forbidden'});
 assert.equal(config.unsafe,true);await assert.rejects(saveRuntimeConfig(config,prefs));assert.equal(prefs.data.size,0);
});
test('trocar de Supabase não reutiliza tokens do projeto anterior',async()=>{
 const prefs=memory(),first=createSessionStorage(prefs,'https://first.supabase.co'),second=createSessionStorage(prefs,'https://second.supabase.co');
 await first.save({access_token:'first-access',refresh_token:'first-refresh',expires_at:123});
 assert.equal((await first.read()).access_token,'first-access');assert.equal(await second.read(),null);
});
test('verificação consulta o banco pelo SDK e aceita somente SQL completo',async()=>{
 const config=toConfig(CONFIG);let endpoint='',apiKey='';
 const data=await checkConnection(config,{fetcher:async(url,init)=>{endpoint=String(url);apiKey=new Headers(init.headers).get('apikey');return response({schema_version:2,ready:true});}});
 assert.ok(data.ready);assert.match(endpoint,/rest\/v1\/rpc\/nu_schema_status/);assert.equal(apiKey,CONFIG.supabasePublishableKey);
 await assert.rejects(checkConnection(config,{fetcher:async()=>response({schema_version:1,ready:true})}),/incompleto/);
});
test('verificação explica SQL ausente e erro de conexão',async()=>{
 const config=toConfig(CONFIG);
 await assert.rejects(checkConnection(config,{fetcher:async()=>response({code:'PGRST202',message:'not found'},404)}),/SQL completo/);
 await assert.rejects(checkConnection(config,{fetcher:async()=>{throw TypeError('network');}}),/conectar|URL/);
});
