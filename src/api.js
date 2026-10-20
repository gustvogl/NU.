import { supabase } from './client.js';
import { monthStart } from './money.js';
export const PAGE_SIZE=15;
function check(result){if(result.error)throw result.error;return result.data;}
export async function operate(operation,payload={},requestId=crypto.randomUUID()){
 return check(await supabase.rpc('nu_operate',{p_operation:operation,p_payload:payload,p_request_id:requestId}));
}
export async function initializeAccount(){check(await supabase.rpc('nu_ensure_account'));check(await supabase.rpc('nu_process_schedules'));}
export async function loadDashboard(userId){
 const requests={
  profile:supabase.from('nu_profiles').select('*').eq('user_id',userId).single(),
  account:supabase.from('nu_accounts').select('*').eq('user_id',userId).single(),
  transactions:supabase.from('nu_transactions').select('*').eq('user_id',userId).order('created_at',{ascending:false}).order('id',{ascending:false}).limit(8),
  keys:supabase.from('nu_pix_keys').select('*').eq('user_id',userId).order('created_at'),
  cards:supabase.from('nu_cards').select('*').eq('user_id',userId).order('created_at'),
  charges:supabase.from('nu_card_charges').select('*').eq('user_id',userId).order('created_at',{ascending:false}).limit(30),
  goals:supabase.from('nu_goals').select('*').eq('user_id',userId).order('created_at'),
  loans:supabase.from('nu_loans').select('*').eq('user_id',userId).order('created_at',{ascending:false}).limit(20),
  schedules:supabase.from('nu_schedules').select('*').eq('user_id',userId).order('created_at',{ascending:false}).limit(40),
  notifications:supabase.from('nu_notifications').select('*').eq('user_id',userId).order('created_at',{ascending:false}).limit(30),
  tickets:supabase.from('nu_tickets').select('*').eq('user_id',userId).order('created_at',{ascending:false}).limit(30),
  monthly:supabase.rpc('nu_monthly_summary',{p_since:monthStart()}),
 };
 const results=await Promise.all(Object.entries(requests).map(async([key,promise])=>[key,check(await promise)]));
 return Object.fromEntries(results);
}
export async function lookupRecipient(key){return check(await supabase.rpc('nu_lookup_recipient',{p_key:key.trim().toLowerCase()}));}
function statementQuery(userId,{search='',direction='all',from='',to=''}={}){
 let q=supabase.from('nu_transactions').select('*',{count:'exact'}).eq('user_id',userId).order('created_at',{ascending:false}).order('id',{ascending:false});
 if(search.trim())q=q.ilike('description','%'+search.trim().replace(/[\\%_]/g,'\\$&')+'%');
 if(direction==='in')q=q.gt('delta_cents',0);
 if(direction==='out')q=q.lt('delta_cents',0);
 if(direction==='credit')q=q.eq('delta_cents',0);
 if(from)q=q.gte('created_at',new Date(from+'T00:00:00').toISOString());
 if(to)q=q.lte('created_at',new Date(to+'T23:59:59.999').toISOString());
 return q;
}
export async function listStatement(userId,filters,page=1){
 const r=await statementQuery(userId,filters).range((page-1)*PAGE_SIZE,page*PAGE_SIZE-1);check(r);
 return{rows:r.data,total:r.count||0};
}
export async function exportStatement(userId,filters){
 const rows=[];let page=0;
 for(;;){const r=await statementQuery(userId,filters).range(page*500,page*500+499);check(r);rows.push(...r.data);if(r.data.length<500)break;page++;}
 return rows;
}
export function friendlyError(e){
 const message=e?.message||'';
 if(['42P01','PGRST202','PGRST205'].includes(e?.code)||/nu_ensure_account.*schema cache/i.test(message))return 'Execute o arquivo supabase/01-banco.sql completo no SQL Editor do seu Supabase.';
 if(e?.code==='23505')return 'Este registro já existe. Atualize a tela para conferir.';
 if(e?.code==='23514'||e?.code==='23502')return 'Confira os valores e preencha todos os campos.';
 if(e?.code==='42501')return 'Acesso recusado. Confira se o SQL foi executado completo e entre novamente.';
 if(e?.code==='invalid_credentials'||/Invalid login credentials/i.test(message))return 'E-mail ou senha do projeto incorretos.';
 if(e?.code==='email_not_confirmed')return 'Confirme seu e-mail antes de entrar.';
 if(e?.status===429||/rate.limit|too many/i.test(message))return 'Muitas tentativas. Aguarde um pouco e tente novamente.';
 if(e?.code==='weak_password')return 'Escolha uma senha mais forte, com pelo menos 8 caracteres.';
 if(e?.code==='P0001')return message;
 if(e?.name==='TypeError'||e?.name==='AbortError'||e?.name==='AuthRetryableFetchError'||/fetch|network/i.test(message))return 'Falha de conexão. Confira a internet e tente novamente. Se a operação foi enviada, repetir usa o mesmo identificador.';
 if(e instanceof Error&&!e.code&&message&&!/unexpected|JSON|permission|invalid|jwt/i.test(message))return message;
 return 'Não foi possível concluir. Confira a configuração e tente novamente.';
}
