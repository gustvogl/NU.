import { createClient } from '@supabase/supabase-js';
export async function checkConnection(config,{fetcher=globalThis.fetch,timeout=12000}={}) {
 if(!config.ready||config.unsafe)throw Error('Informe a URL do projeto e uma chave pública válida.');
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeout);
 const client=createClient(config.url,config.key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:(input,init={})=>fetcher(input,{...init,signal:controller.signal})}});
 try{
  const {data,error}=await client.rpc('nu_schema_status').abortSignal(controller.signal);
  if(error){
   if(['PGRST202','PGRST205','42883'].includes(error.code))throw Error('Falta instalar ou atualizar o banco. Execute o SQL completo desta versão no SQL Editor e tente novamente.');
   if(error.code==='42501')throw Error('Permissão de acesso incompleta. Execute o SQL inteiro no mesmo projeto.');
   if(error.code==='PGRST301'||error.status===401||/invalid.*key|invalid.*jwt|no api key/i.test(error.message||''))throw Error('A chave pública não foi aceita. Copie a chave publishable ou anon do mesmo projeto da URL.');
   throw Error('Não foi possível conectar ao Supabase. Confira URL, chave, internet e se o projeto está ativo.');
  }
  if(data?.schema_version!==2||data?.ready!==true)throw Error('O banco ainda está incompleto. Execute o SQL completo desta versão e tente novamente.');
  return data;
 }catch(error){
  if(controller.signal.aborted)throw Error('O Supabase demorou para responder. Confira se o projeto está ativo e tente novamente.');
  if(error?.name==='TypeError')throw Error('Não foi possível acessar essa URL. Confira a internet e a URL do Supabase.');
  throw error;
 }finally{clearTimeout(timer);client.auth.stopAutoRefresh();}
}
