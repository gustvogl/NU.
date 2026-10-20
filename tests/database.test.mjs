import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
const db = new PGlite();
const U1='11111111-1111-4111-8111-111111111111', U2='22222222-2222-4222-8222-222222222222';
before(async()=>{
 await db.exec(`create role anon; create role authenticated; create schema auth;
 create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}');
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid; $$;
 grant usage on schema auth to authenticated;
 insert into auth.users values ('${U1}','aluno1@example.test','{"name":"Gustavo"}'),('${U2}','aluno2@example.test','{"name":"Ana"}');`);
 await db.exec(await readFile(new URL('../supabase/01-banco.sql',import.meta.url),'utf8'));
});
after(()=>db.close());
async function user(id, fn) {
 await db.exec("set role authenticated");
 await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);
 try{return await fn();} finally {await db.exec('reset role');}
}
async function op(id,operation,payload={},request=crypto.randomUUID()) {
 return user(id,async()=> (await db.query('select public.nu_operate($1,$2::jsonb,$3::uuid) as data',[operation,JSON.stringify(payload),request])).rows[0].data);
}
async function balance(id) {return Number((await user(id,()=>db.query('select balance_cents from public.nu_accounts'))).rows[0].balance_cents);}
test('contas iniciam uma vez e usuários enxergam apenas seus dados',async()=>{
 for(const u of [U1,U2,U1]) await user(u,()=>db.query('select public.nu_ensure_account()'));
 assert.equal(await balance(U1),100000);
 const rows=await user(U1,()=>db.query('select user_id from public.nu_accounts'));
 assert.deepEqual(rows.rows,[{user_id:U1}]);
 await assert.rejects(user(U1,()=>db.exec('update public.nu_accounts set balance_cents=999999')),/permission denied/);
 await assert.rejects(user(U1,()=>db.exec("insert into public.nu_transactions(user_id,operation_id,kind,amount_cents,delta_cents,description) values('"+U1+"',gen_random_uuid(),'deposit',1,1,'fraude')")),/permission denied/);
});
test('transferência é dupla, atômica e idempotente',async()=>{
 const rid=crypto.randomUUID(), payload={key:'aluno2@example.test',amount:12550,description:'Teste'};
 const first=await op(U1,'transfer',payload,rid);
 const again=await op(U1,'transfer',payload,rid);
 assert.deepEqual(again,first);
 assert.equal(await balance(U1),87450);assert.equal(await balance(U2),112550);
 const rows=await db.query('select count(*)::int as n,sum(delta_cents)::int as delta from public.nu_transactions where operation_id=$1',[first.operation_id]);
 assert.equal(rows.rows[0].n,2);assert.equal(rows.rows[0].delta,0);
 await assert.rejects(op(U1,'deposit',{amount:123},rid),/Identificador/);
});
test('saldo insuficiente e valor negativo não alteram saldos',async()=>{
 const before=await balance(U1);
 await assert.rejects(op(U1,'transfer',{key:'aluno2@example.test',amount:999999}),/Saldo insuficiente/);
 await assert.rejects(op(U1,'deposit',{amount:-1}),/Valor inválido/);
 await assert.rejects(op(U1,'transfer',{key:'aluno1@example.test',amount:100}),/outra conta/);
 assert.equal(await balance(U1),before);
});
test('caixinhas guardam e resgatam sem criar dinheiro',async()=>{
 const start=await balance(U1);
 const goal=await op(U1,'goal_create',{label:'Minha casa',amount:100000});
 await op(U1,'goal_deposit',{id:goal.id,amount:10000});
 assert.equal(await balance(U1),start-10000);
 await assert.rejects(op(U2,'goal_withdraw',{id:goal.id,amount:10000}),/não encontrada/);
 await assert.rejects(op(U1,'goal_remove',{id:goal.id}),/Resgate/);
 await op(U1,'goal_withdraw',{id:goal.id,amount:10000});
 await op(U1,'goal_remove',{id:goal.id});
 assert.equal(await balance(U1),start);
});
test('cartão bloqueado não compra; pagar fatura reduz saldo e libera limite',async()=>{
 const card=(await user(U1,()=>db.query('select id from public.nu_cards limit 1'))).rows[0];
 const start=await balance(U1);
 await op(U1,'card_purchase',{id:card.id,amount:10000,merchant:'Loja fictícia'});
 assert.equal(await balance(U1),start);
 await op(U1,'card_block',{id:card.id});
 await assert.rejects(op(U1,'card_purchase',{id:card.id,amount:100,merchant:'Loja'}),/bloqueado/);
 await assert.rejects(op(U2,'card_block',{id:card.id}),/não encontrado/);
 await op(U1,'invoice_pay');
 assert.equal(await balance(U1),start-10000);
 const account=(await user(U1,()=>db.query('select credit_used_cents from public.nu_accounts'))).rows[0];
 assert.equal(Number(account.credit_used_cents),0);
 const charges=(await user(U1,()=>db.query('select paid_at from public.nu_card_charges'))).rows;
 assert.ok(charges.every(c=>c.paid_at));
});
test('empréstimo simulado possui parcelas e quitação consistente',async()=>{
 const start=await balance(U1);
 const loan=await op(U1,'loan_create',{amount:10000,months:2});
 assert.equal(await balance(U1),start+10000);
 assert.ok(loan.total>10000);
 await assert.rejects(op(U1,'loan_create',{amount:10000,months:2}),/Quite/);
 await assert.rejects(op(U2,'loan_pay',{id:loan.id}),/não encontrado/);
 await op(U1,'loan_pay',{id:loan.id});await op(U1,'loan_pay',{id:loan.id});
 assert.equal(await balance(U1),start+10000-loan.total);
 const row=(await user(U1,()=>db.query('select remaining_cents,installments_paid from public.nu_loans'))).rows[0];
 assert.equal(Number(row.remaining_cents),0);assert.equal(row.installments_paid,2);
});
test('pagamentos e recargas validam dados e geram débitos reais no projeto',async()=>{
 const start=await balance(U1);
 await assert.rejects(op(U1,'payment',{amount:100,barcode:'123',merchant:'Teste'}),/44/);
 await op(U1,'payment',{amount:100,barcode:'1'.repeat(44),merchant:'Boleto de teste'});
 await op(U1,'topup',{amount:1000,phone:'15999999999',operator:'Operadora de teste'});
 assert.equal(await balance(U1),start-1100);
});
test('chaves, perfil, suporte e notificações respeitam o titular',async()=>{
 const key=await op(U1,'key_create',{kind:'random'});
 await assert.rejects(op(U2,'key_remove',{id:key.id}),/não encontrada/);
 const recipient=await user(U2,()=>db.query('select public.nu_lookup_recipient($1) as data',[key.key]));
 assert.equal(recipient.rows[0].data.name,'Gustavo');
 await op(U1,'key_remove',{id:key.id});
 await op(U1,'profile_update',{name:'Gustavo Luis',phone:'',theme:'dark'});
 const ticket=await op(U1,'ticket_create',{subject:'Teste',message:'Minha dúvida sobre o projeto'});
 await assert.rejects(op(U2,'ticket_close',{id:ticket.id}),/não encontrada/);
 await op(U1,'ticket_close',{id:ticket.id});
 await op(U2,'notifications_read',{});
 assert.ok((await user(U2,()=>db.query('select read_at from public.nu_notifications'))).rows.every(x=>x.read_at));
});
test('agendamento pode ser cancelado e executa uma vez quando vencido',async()=>{
 const schedule=await op(U1,'schedule_create',{key:'aluno2@example.test',amount:500,due_at:new Date(Date.now()+86400000).toISOString()});
 await op(U1,'schedule_cancel',{id:schedule.id});
 const scheduled=await op(U1,'schedule_create',{key:'aluno2@example.test',amount:700,due_at:new Date(Date.now()+86400000).toISOString()});
 await db.query("update public.nu_schedules set due_at=now()-interval '1 hour' where id=$1",[scheduled.id]);
 const start=await balance(U1);
 for(let i=0;i<2;i++)await user(U1,()=>db.query('select public.nu_process_schedules()'));
 assert.equal(await balance(U1),start-700);
 const row=(await user(U1,()=>db.query('select status from public.nu_schedules where id=$1',[scheduled.id]))).rows[0];
 assert.equal(row.status,'done');
});
test('anon não acessa contas nem operações',async()=>{
 await db.exec('set role anon');
 try {
  await assert.rejects(db.exec('select * from public.nu_accounts'),/permission denied/);
  await assert.rejects(db.exec('select public.nu_ensure_account()'),/permission denied/);
 } finally {await db.exec('reset role');}
});

test('instalador pode conferir versão e permissões sem ler dados de clientes',async()=>{
 await db.exec('set role anon');
 try{
  const result=(await db.query('select public.nu_schema_status() as data')).rows[0].data;
  assert.equal(result.schema_version,2);assert.equal(result.ready,true);assert.equal(result.tables,11);
  assert.deepEqual(Object.keys(result).sort(),['ready','schema_version','tables']);
  await assert.rejects(db.exec('select * from public.nu_accounts'),/permission denied/);
 }finally{await db.exec('reset role');}
});
