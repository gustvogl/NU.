import assert from 'node:assert/strict';
import { spawnSync,spawn } from 'node:child_process';
const base=process.env.QA_BASE_URL||'http://127.0.0.1:5189';
const preview=process.env.QA_PREVIEW_URL||'http://127.0.0.1:4189';
const processes=[];
process.on('exit',()=>{for(const p of processes)p.kill();});
if(!process.env.QA_BASE_URL){
 const built=spawnSync(process.platform==='win32'?'npm.cmd':'npm',['run','build'],{cwd:process.cwd(),stdio:'inherit',env:{...process.env,VITE_SUPABASE_URL:'',VITE_SUPABASE_PUBLISHABLE_KEY:''},shell:process.platform==='win32'});
 if(built.status!==0)throw Error('Build do teste falhou.');
 for(const [args,env]of[
  [['--host','127.0.0.1','--port','5189','--strictPort'],{...process.env,VITE_SUPABASE_URL:'https://bank.test',VITE_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_fixture'}],
  [['preview','--host','127.0.0.1','--port','4189','--strictPort'],process.env]
 ]){const p=spawn(process.execPath,['node_modules/vite/bin/vite.js',...args],{cwd:process.cwd(),env,stdio:'ignore'});p.unref();processes.push(p);}
 for(const url of[base,preview]){
  let ready=false;for(let n=0;n<100;n++){try{const r=await fetch(url);if(r.ok){ready=true;break;}}catch{}await new Promise(resolve=>setTimeout(resolve,100));}
  if(!ready)throw Error('Servidor de teste indisponível: '+url);
 }
}
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const qaDir=join(tmpdir(),'nubank-academico-qa');
import {PGlite} from '@electric-sql/pglite';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const U1='11111111-1111-4111-8111-111111111111',U2='22222222-2222-4222-8222-222222222222';
const user={id:U1,email:'aluno1@example.test',aud:'authenticated',role:'authenticated',app_metadata:{},user_metadata:{name:'Gustavo'},created_at:new Date().toISOString()};
const exp=Math.floor(Date.now()/1000)+3600;
const token=Buffer.from('{"alg":"HS256","typ":"JWT"}').toString('base64url')+'.'+Buffer.from(JSON.stringify({sub:U1,aud:'authenticated',role:'authenticated',exp})).toString('base64url')+'.c2lnbmF0dXJl';
const session={access_token:token,refresh_token:'refresh-browser-fixture',expires_at:exp,expires_in:3600,token_type:'bearer',user};
const db=new PGlite();
await db.exec("create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}');create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid; $$;grant usage on schema auth to authenticated;");
await db.query('insert into auth.users values($1,$2,$3),($4,$5,$6)',[U1,user.email,{name:'Gustavo'},U2,'aluno2@example.test',{name:'Ana'}]);
await db.exec(await readFile(new URL('../supabase/01-banco.sql',import.meta.url),'utf8'));
async function withUser(id,fn){await db.exec('set role authenticated');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);try{return await fn();}finally{await db.exec('reset role');}}
for(const u of[U1,U2])await withUser(u,()=>db.query('select public.nu_ensure_account()'));
let dbQueue=Promise.resolve();
async function rest(url,request){
 const path=url.pathname.split('/').at(-1),params=url.searchParams;
 if(url.pathname.includes('/rpc/')){
  const p=request.postDataJSON()||{};
  const rpc={
   nu_schema_status:['select public.nu_schema_status() as data',[]],
   nu_ensure_account:['select public.nu_ensure_account() as data',[]],
   nu_process_schedules:['select public.nu_process_schedules() as data',[]],
   nu_lookup_recipient:['select public.nu_lookup_recipient($1) as data',[p.p_key]],
   nu_operate:['select public.nu_operate($1,$2::jsonb,$3::uuid) as data',[p.p_operation,JSON.stringify(p.p_payload),p.p_request_id]],
   nu_monthly_summary:['select public.nu_monthly_summary($1::timestamptz) as data',[p.p_since]]
  }[path];
  if(!rpc)throw Error('Unknown RPC '+path);
  return{body:JSON.stringify((await db.query(...rpc)).rows[0].data)};
 }
 assert.match(path,/^nu_[a-z_]+$/);
 const values=[],conditions=[];
 for(const[k,v]of params){
  if(['select','order','limit','offset'].includes(k))continue;
  assert.match(k,/^[a-z_]+$/);
  const idx=v.indexOf('.'),op=v.slice(0,idx),value=v.slice(idx+1);
  const ops={eq:'=',gt:'>',lt:'<',gte:'>=',lte:'<=',ilike:'ilike'};assert.ok(ops[op],op);
  values.push(value);conditions.push(k+' '+ops[op]+' $'+values.length);
 }
 const where=conditions.length?' where '+conditions.join(' and '):'';
 const selected=params.get('select')||'*';
 assert.match(selected,/^(?:\*|[a-z_,]+)$/);
 const order=params.get('order');
 const orders=order?order.split(',').map(x=>{const[c,d]=x.split('.');assert.match(c,/^[a-z_]+$/);return c+(d==='desc'?' desc':' asc');}).join(','):'';
 const count=Number((await db.query('select count(*) as n from public.'+path+where,values)).rows[0].n);
 const limit=Math.min(1000,Number(params.get('limit')||1000)),offset=Number(params.get('offset')||0);
 const rows=(await db.query('select '+selected+' from public.'+path+where+(orders?' order by '+orders:'')+' limit '+limit+' offset '+offset,values)).rows;
 const single=(request.headers()['accept']||'').includes('vnd.pgrst.object');
 return{body:JSON.stringify(single?rows[0]||null:rows),headers:{'content-range':offset+'-'+Math.max(offset,offset+rows.length-1)+'/'+count}};
}
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const context=await browser.newContext({viewport:{width:1440,height:1050},deviceScaleFactor:1,locale:'pt-BR',timezoneId:'America/Sao_Paulo'});
const page=await context.newPage();
const errors=[];page.on('pageerror',e=>errors.push(e.message));
let schemaMissing=true,healthRequests=0;
const apiHandler=async route=>{
 const request=route.request(),url=new URL(request.url());
 const headers={'content-type':'application/json','access-control-allow-origin':'*'};
 if(request.method()==='OPTIONS')return route.fulfill({status:200,headers,body:'{}'});
 if(url.pathname.endsWith('/rpc/nu_schema_status')){
  healthRequests++;
  if(schemaMissing)return route.fulfill({status:404,headers,body:JSON.stringify({code:'PGRST202',message:'schema missing'})});
 }
 if(url.pathname.startsWith('/auth/')){
  if(url.pathname.endsWith('/logout'))return route.fulfill({status:204,body:''});
  if(url.pathname.endsWith('/user'))return route.fulfill({status:200,headers,body:JSON.stringify(user)});
  return route.fulfill({status:200,headers,body:JSON.stringify(session)});
 }
 const task=dbQueue.then(()=>withUser(U1,()=>rest(url,request)));
 dbQueue=task.catch(()=>{});
 try{const result=await task;await route.fulfill({status:200,headers:{...headers,...result.headers},body:result.body});}
 catch(e){await route.fulfill({status:400,headers,body:JSON.stringify({code:e.code||'TEST_ERROR',message:e.message})});}
};
await context.route('https://bank.test/**',apiHandler);
const site=preview;
await page.goto(site);
await page.getByRole('heading',{name:'Conecte seu banco.'}).waitFor();
await page.getByPlaceholder('https://seu-projeto.supabase.co').fill('https://bank.test');
await page.getByPlaceholder('sb_publishable_...').fill('sb_secret_forbidden');
await page.getByRole('button',{name:'Testar e conectar'}).click();
await page.getByText(/Essa chave é secreta/).waitFor();assert.equal(healthRequests,0);
await page.getByPlaceholder('sb_publishable_...').fill('sb_publishable_fixture');
await page.getByRole('button',{name:'Testar e conectar'}).click();
await page.getByText(/Falta instalar ou atualizar o banco/).waitFor();
schemaMissing=false;
await page.getByRole('button',{name:'Testar e conectar'}).click();
await page.getByText(/Banco verificado e conexão salva/).waitFor();
const configDownload=page.waitForEvent('download');
await page.getByRole('button',{name:'Baixar config.json para publicar'}).click();
const downloaded=await configDownload;
assert.equal(downloaded.suggestedFilename(),'config.json');
const exported=JSON.parse(await readFile(await downloaded.path(),'utf8'));
assert.equal(exported.supabaseUrl,'https://bank.test');assert.equal(exported.supabasePublishableKey,'sb_publishable_fixture');
await page.getByRole('button',{name:'Entrar no banco',exact:true}).click();
await page.getByRole('heading',{name:'Bom ter você de volta.'}).waitFor();
await page.reload();await page.getByRole('heading',{name:'Bom ter você de volta.'}).waitFor();
console.log('OK: instalador sem .env, recusa de segredo, SQL ausente, conexão validada, config.json exportado e conexão persistente.');

await page.getByPlaceholder('voce@exemplo.com').fill(user.email);
await page.getByPlaceholder('Sua senha neste projeto').fill('senha-fixture-123');
await page.getByRole('button',{name:'Acessar minha conta',exact:true}).click();
await page.getByRole('heading',{name:'Olá, Gustavo.'}).waitFor();
console.log('OK: login e conta carregada do PostgreSQL de teste.');
await page.reload();await page.getByRole('heading',{name:'Olá, Gustavo.'}).waitFor();
const saved=await page.evaluate(()=>Object.entries(localStorage).find(([k])=>k.endsWith('supabase_session'))?.[1]);
assert.ok(saved);assert.ok(!saved.includes('senha-fixture'));
console.log('OK: sessão restaurada após reabertura e senha ausente do armazenamento.');
async function nav(name){await page.getByRole('navigation',{name:'Menu principal',exact:true}).getByRole('button',{name,exact:true}).click();}
await nav('Área Pix');
await page.getByRole('button',{name:/Transferir Envie/}).click();
await page.getByPlaceholder('E-mail ou chave aleatória').fill('aluno2@example.test');
await page.getByRole('button',{name:'Buscar',exact:true}).click();
await page.getByText('Ana',{exact:true}).waitFor();
await page.getByPlaceholder('0,00').fill('25,00');
await page.getByRole('button',{name:'Revisar operação'}).click();
await page.getByRole('button',{name:'Confirmar operação fictícia'}).click();
await page.getByRole('dialog').waitFor({state:'hidden'});
await dbQueue;
const result=await db.query('select user_id,balance_cents from public.nu_accounts order by user_id');
assert.equal(Number(result.rows[0].balance_cents),97500);assert.equal(Number(result.rows[1].balance_cents),102500);
console.log('OK: Pix pela interface debitou e creditou as duas contas.');
await nav('Caixinhas');await page.getByRole('button',{name:'Nova caixinha',exact:true}).click();
await page.getByPlaceholder('Ex.: Minha primeira casa').fill('Minha primeira casa');
await page.getByPlaceholder('0,00').fill('1000,00');
await page.getByRole('button',{name:'Revisar operação'}).click();
await page.getByRole('button',{name:'Confirmar operação fictícia'}).click();
await page.getByRole('dialog').waitFor({state:'hidden'});await page.getByRole('heading',{name:'Minha primeira casa',exact:true}).waitFor();
await page.getByRole('button',{name:'Guardar',exact:true}).click();await page.getByPlaceholder('0,00').fill('100,00');
await page.getByRole('button',{name:'Revisar operação'}).click();await page.getByRole('button',{name:'Confirmar operação fictícia'}).click();await page.getByRole('dialog').waitFor({state:'hidden'});
console.log('OK: criação e depósito na caixinha.');
await nav('Meus cartões');await page.getByRole('button',{name:'Simular compra',exact:true}).first().click();
await page.getByPlaceholder('Ex.: Loja de demonstração').fill('Loja de teste');await page.getByPlaceholder('0,00').fill('50,00');
await page.getByRole('button',{name:'Revisar operação'}).click();await page.getByRole('button',{name:'Confirmar operação fictícia'}).click();await page.getByRole('dialog').waitFor({state:'hidden'});await page.getByText('Loja de teste',{exact:true}).waitFor();
await page.getByRole('button',{name:'Pagar fatura simulada',exact:true}).click();await page.getByRole('button',{name:'Revisar operação'}).click();await page.getByRole('button',{name:'Confirmar operação fictícia'}).click();await page.getByRole('dialog').waitFor({state:'hidden'});
console.log('OK: compra e pagamento da fatura.');
await nav('Extrato');
await page.getByRole('button',{name:/Ver comprovante:/}).first().click();
const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'Baixar comprovante',exact:true}).click();assert.match((await downloadPromise).suggestedFilename(),/^comprovante-academico/);
await page.getByRole('button',{name:'Fechar',exact:true}).click();
const csvPromise=page.waitForEvent('download');await page.getByRole('button',{name:'Exportar CSV',exact:true}).click();assert.equal((await csvPromise).suggestedFilename(),'extrato-academico.csv');
console.log('OK: extrato e downloads de CSV/comprovante.');
await nav('Início');
await page.getByRole('heading',{name:'Olá, Gustavo.'}).waitFor();
await mkdir(qaDir,{recursive:true});
await page.screenshot({path:join(qaDir,'desktop.png'),fullPage:true});
await page.setViewportSize({width:390,height:844});
const mobileChecks=[];
for(const [route,name]of[['inicio','Início'],['pix','Área Pix'],['cartoes','Meus cartões'],['caixinhas','Caixinhas'],['extrato','Extrato'],['emprestimos','Empréstimos'],['pagamentos','Pagamentos'],['perfil','Meu perfil'],['ajuda','Central de ajuda']]){
 await page.goto(site+'/#/'+route);await page.locator('.page-intro h1').waitFor();
 const sizes=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));
 assert.ok(sizes.scroll<=sizes.width+1,route+' ultrapassou largura: '+JSON.stringify(sizes));mobileChecks.push(route);
}
await page.goto(site+'/#/inicio');await page.getByRole('heading',{name:'Olá, Gustavo.'}).waitFor();
await page.screenshot({path:join(qaDir,'mobile.png'),fullPage:true});
await page.getByRole('button',{name:'Abrir menu',exact:true}).click();await page.getByRole('button',{name:'Sair da conta',exact:true}).click();
await page.getByRole('heading',{name:'Bom ter você de volta.'}).waitFor();
await page.reload();await page.getByRole('heading',{name:'Bom ter você de volta.'}).waitFor();
assert.deepEqual(errors,[]);
console.log('OK: 9 telas em 390px, logout persistente e nenhum erro de página.');
await writeFile(join(qaDir,'result.json'),JSON.stringify({passed:true,checks:['configuração','login','auto-login','Pix real no PostgreSQL de teste','caixinha','cartão e fatura','extrato CSV','comprovante','responsividade','logout'],mobileChecks,pageErrors:errors},null,2));

const fresh=await browser.newContext({viewport:{width:1280,height:900}});
await fresh.route('https://bank.test/**',apiHandler);
await fresh.route('**/config.json',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(exported)}));
const visitor=await fresh.newPage();await visitor.goto(site);
await visitor.getByRole('heading',{name:'Bom ter você de volta.'}).waitFor();
assert.equal(await visitor.getByRole('heading',{name:'Conecte seu banco.'}).count(),0);
console.log('OK: visitante novo usa config.json publicado sem configurar novamente.');
await fresh.close();


await browser.close();await db.close();
