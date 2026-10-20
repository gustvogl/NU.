-- NUBANK ACADÊMICO — somente dinheiro fictício.
-- Execute este arquivo COMPLETO no SQL Editor de um projeto Supabase seu.
-- Nenhuma chave secreta, senha, CPF, PAN ou CVV é armazenada nestas tabelas.
begin;

create schema if not exists nu_private;
revoke all on schema nu_private from public, anon;
grant usage on schema nu_private to authenticated;

create table if not exists public.nu_profiles (
 user_id uuid primary key references auth.users(id) on delete cascade,
 display_name text not null check (length(btrim(display_name)) between 2 and 80),
 phone text not null default '' check (length(phone) <= 20),
 theme text not null default 'light' check (theme in ('light','dark')),
 created_at timestamptz not null default now()
);
create table if not exists public.nu_accounts (
 user_id uuid primary key references auth.users(id) on delete cascade,
 account_number text not null unique,
 balance_cents bigint not null default 0 check (balance_cents between 0 and 100000000000),
 credit_limit_cents bigint not null default 200000 check (credit_limit_cents between 0 and 500000),
 credit_used_cents bigint not null default 0 check (credit_used_cents >= 0 and credit_used_cents <= credit_limit_cents),
 created_at timestamptz not null default now()
);
create table if not exists public.nu_transactions (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 operation_id uuid not null,
 kind text not null,
 amount_cents bigint not null check (amount_cents > 0),
 delta_cents bigint not null,
 description text not null,
 counterparty text not null default '',
 metadata jsonb not null default '{}',
 created_at timestamptz not null default now()
);
create index if not exists nu_transactions_user_date on public.nu_transactions(user_id, created_at desc, id desc);
create index if not exists nu_transactions_operation on public.nu_transactions(operation_id);
create table if not exists public.nu_pix_keys (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 kind text not null check (kind in ('email','random')),
 key_value text not null unique,
 created_at timestamptz not null default now()
);
create index if not exists nu_pix_keys_owner on public.nu_pix_keys(user_id);
create table if not exists public.nu_cards (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 label text not null,
 kind text not null check (kind in ('physical','virtual')),
 last_four text not null check (last_four ~ '^[0-9]{4}$'),
 blocked boolean not null default false,
 created_at timestamptz not null default now()
);
create index if not exists nu_cards_owner on public.nu_cards(user_id);
create table if not exists public.nu_card_charges (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 card_id uuid not null references public.nu_cards(id),
 merchant text not null,
 amount_cents bigint not null check (amount_cents > 0),
 paid_at timestamptz,
 created_at timestamptz not null default now()
);
create index if not exists nu_charges_owner on public.nu_card_charges(user_id, created_at desc);
create table if not exists public.nu_goals (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 label text not null check (length(btrim(label)) between 2 and 60),
 target_cents bigint not null check (target_cents > 0 and target_cents <= 10000000000),
 balance_cents bigint not null default 0 check (balance_cents >= 0),
 created_at timestamptz not null default now()
);
create index if not exists nu_goals_owner on public.nu_goals(user_id);
create table if not exists public.nu_loans (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 principal_cents bigint not null,
 monthly_rate_bps integer not null default 200,
 months integer not null check (months between 2 and 24),
 installment_cents bigint not null,
 remaining_cents bigint not null check (remaining_cents >= 0),
 installments_paid integer not null default 0,
 created_at timestamptz not null default now()
);
create index if not exists nu_loans_owner on public.nu_loans(user_id);
create table if not exists public.nu_schedules (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 key_value text not null,
 amount_cents bigint not null check (amount_cents > 0),
 description text not null,
 due_at timestamptz not null,
 status text not null default 'pending' check (status in ('pending','done','cancelled','failed')),
 result_message text not null default '',
 created_at timestamptz not null default now()
);
create index if not exists nu_schedules_owner_due on public.nu_schedules(user_id, due_at) where status = 'pending';
create table if not exists public.nu_notifications (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 title text not null,
 body text not null,
 read_at timestamptz,
 created_at timestamptz not null default now()
);
create index if not exists nu_notifications_owner on public.nu_notifications(user_id, created_at desc);
create table if not exists public.nu_tickets (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 subject text not null check (length(btrim(subject)) between 3 and 100),
 message text not null check (length(btrim(message)) between 5 and 2000),
 status text not null default 'open' check (status in ('open','closed')),
 created_at timestamptz not null default now()
);
create index if not exists nu_tickets_owner on public.nu_tickets(user_id, created_at desc);
create table if not exists nu_private.requests (
 user_id uuid not null references auth.users(id) on delete cascade,
 request_id uuid not null,
 operation text not null,
 payload jsonb not null,
 response jsonb not null,
 primary key(user_id, request_id)
);
alter table nu_private.requests enable row level security;

-- Dados financeiros são somente leitura pela API. Toda movimentação passa por RPC.
do $$
declare t text;
begin
 foreach t in array array['nu_profiles','nu_accounts','nu_transactions','nu_pix_keys','nu_cards','nu_card_charges','nu_goals','nu_loans','nu_schedules','nu_notifications','nu_tickets'] loop
  execute format('alter table public.%I enable row level security', t);
  execute format('revoke all on public.%I from public, anon, authenticated', t);
  execute format('grant select on public.%I to authenticated', t);
  execute format('drop policy if exists owner_read on public.%I', t);
  execute format('create policy owner_read on public.%I for select to authenticated using ((select auth.uid()) = user_id)', t);
 end loop;
end $$;
grant usage on schema public to authenticated;

create or replace function nu_private.ensure_account() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
 u uuid := auth.uid();
 n text;
 e text;
 new_user uuid;
begin
 if u is null then raise exception 'Faça login para continuar.'; end if;
 select left(coalesce(nullif(btrim(raw_user_meta_data->>'name'),''),'Estudante'),80), lower(email)
 into n,e from auth.users where id = u;
 if n is null then raise exception 'Usuário não encontrado.'; end if;
 if length(n) < 2 then n := 'Estudante'; end if;
 perform pg_advisory_xact_lock(hashtextextended(u::text, 0));
 insert into public.nu_profiles(user_id,display_name) values(u,n) on conflict do nothing;
 insert into public.nu_accounts(user_id,account_number,balance_cents)
 values(u,'DEMO-'||upper(substr(replace(u::text,'-',''),1,10)),100000)
 on conflict do nothing returning user_id into new_user;
 if new_user is not null then
  insert into public.nu_transactions(user_id,operation_id,kind,amount_cents,delta_cents,description,counterparty)
  values(u,gen_random_uuid(),'welcome',100000,100000,'Saldo inicial fictício','Projeto acadêmico');
  insert into public.nu_cards(user_id,label,kind,last_four) values(u,'Meu roxinho','physical',lpad((floor(random()*10000)::int)::text,4,'0'));
  insert into public.nu_pix_keys(user_id,kind,key_value) values(u,'email',e) on conflict do nothing;
  insert into public.nu_notifications(user_id,title,body) values(u,'Sua conta acadêmica está pronta','Você recebeu R$ 1.000,00 fictícios para testar o projeto.');
 end if;
 return jsonb_build_object('ok',true);
end $$;

create or replace function nu_private.lookup_recipient(p_key text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare r jsonb;
begin
 if auth.uid() is null then raise exception 'Faça login para continuar.'; end if;
 select jsonb_build_object('name',p.display_name,'account',a.account_number,'key',k.key_value,'own',k.user_id=auth.uid())
 into r from public.nu_pix_keys k
 join public.nu_profiles p on p.user_id=k.user_id
 join public.nu_accounts a on a.user_id=k.user_id
 where k.key_value=lower(btrim(p_key));
 if r is null then raise exception 'Chave não encontrada neste projeto.'; end if;
 return r;
end $$;

create or replace function nu_private.operate(p_operation text, p_payload jsonb, p_request_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
 u uuid := auth.uid();
 a public.nu_accounts%rowtype;
 other_user uuid;
 other_name text;
 own_name text;
 cents bigint;
 tx uuid;
 op_id uuid := gen_random_uuid();
 out_data jsonb := '{}'::jsonb;
 saved nu_private.requests%rowtype;
 row_id uuid;
 g public.nu_goals%rowtype;
 c public.nu_cards%rowtype;
 loan public.nu_loans%rowtype;
 installment bigint;
 total bigint;
 due timestamptz;
 label_text text;
 key_text text;
begin
 if u is null then raise exception 'Faça login para continuar.'; end if;
 if p_request_id is null or p_payload is null or jsonb_typeof(p_payload) <> 'object' then raise exception 'Operação inválida.'; end if;
 if p_operation not in ('deposit','transfer','payment','topup','key_create','key_remove','goal_create','goal_deposit','goal_withdraw','goal_remove','card_create','card_block','card_limit','card_purchase','invoice_pay','loan_create','loan_pay','schedule_create','schedule_cancel','profile_update','notifications_read','ticket_create','ticket_close') then raise exception 'Operação desconhecida.'; end if;

 select * into saved from nu_private.requests where user_id=u and request_id=p_request_id;
 if saved.request_id is not null then
  if saved.operation<>p_operation or saved.payload<>p_payload then raise exception 'Identificador já utilizado. Reabra o formulário.'; end if;
  return saved.response;
 end if;
 -- Uma transferência bloqueia as duas contas em ordem fixa, evitando deadlock.
 if p_operation = 'transfer' then
  key_text := lower(btrim(coalesce(p_payload->>'key','')));
  select user_id into other_user from public.nu_pix_keys where key_value=key_text;
  if other_user is null then raise exception 'Chave não encontrada neste projeto.'; end if;
  if other_user=u then raise exception 'Escolha uma chave de outra conta do projeto.'; end if;
  perform 1 from public.nu_accounts where user_id in (u,other_user) order by user_id for update;
 else
  perform 1 from public.nu_accounts where user_id=u for update;
 end if;
 select * into a from public.nu_accounts where user_id=u;
 if a.user_id is null then raise exception 'Abra sua conta acadêmica antes de continuar.'; end if;
 select * into saved from nu_private.requests where user_id=u and request_id=p_request_id;
 if saved.request_id is not null then
  if saved.operation<>p_operation or saved.payload<>p_payload then raise exception 'Identificador já utilizado. Reabra o formulário.'; end if;
  return saved.response;
 end if;
 select display_name into own_name from public.nu_profiles where user_id=u;
 if p_payload ? 'amount' then
  if coalesce(p_payload->>'amount','') !~ '^[0-9]{1,10}$' then raise exception 'Valor inválido.'; end if;
  cents := (p_payload->>'amount')::bigint;
  if cents < 1 or cents > 10000000 then raise exception 'Valor fora do limite da simulação.'; end if;
 end if;
 label_text := left(btrim(coalesce(p_payload->>'description','')),120);

 if p_operation = 'deposit' then
  if cents is null then raise exception 'Informe o valor.'; end if;
  update public.nu_accounts set balance_cents=balance_cents+cents where user_id=u;
  insert into public.nu_transactions(user_id,operation_id,kind,amount_cents,delta_cents,description,counterparty)
  values(u,op_id,'deposit',cents,cents,'Adição de saldo fictício','Simulador') returning id into tx;

 elsif p_operation = 'transfer' then
  if cents is null then raise exception 'Informe o valor.'; end if;
  if a.balance_cents<cents then raise exception 'Saldo insuficiente.'; end if;
  select display_name into other_name from public.nu_profiles where user_id=other_user;
  update public.nu_accounts set balance_cents=balance_cents-cents where user_id=u;
  update public.nu_accounts set balance_cents=balance_cents+cents where user_id=other_user;
  insert into public.nu_transactions(user_id,operation_id,kind,amount_cents,delta_cents,description,counterparty,metadata)
  values(u,op_id,'pix_out',cents,-cents,coalesce(nullif(label_text,''),'Pix enviado · simulação'),other_name,jsonb_build_object('key',key_text)) returning id into tx;
  insert into public.nu_transactions(user_id,operation_id,kind,amount_cents,delta_cents,description,counterparty)
  values(other_user,op_id,'pix_in',cents,cents,coalesce(nullif(label_text,''),'Pix recebido · simulação'),own_name);
  insert into public.nu_notifications(user_id,title,body) values(other_user,'Pix acadêmico recebido',own_name||' enviou uma transferência fictícia.');
  out_data := jsonb_build_object('recipient',other_name);

 elsif p_operation in ('payment','topup') then
  if cents is null or a.balance_cents<cents then raise exception 'Saldo insuficiente ou valor inválido.'; end if;
  if p_operation='payment' then
   key_text := regexp_replace(coalesce(p_payload->>'barcode',''),'[^0-9]','','g');
   if length(key_text) not in (44,47,48) then raise exception 'Use um código de teste com 44, 47 ou 48 dígitos.'; end if;
   if length(btrim(coalesce(p_payload->>'merchant',''))) not between 2 and 80 then raise exception 'Informe o beneficiário fictício.'; end if;
   label_text := 'Pagamento simulado';
   other_name := left(btrim(p_payload->>'merchant'),80);
  else
   key_text := regexp_replace(coalesce(p_payload->>'phone',''),'[^0-9]','','g');
   if length(key_text) not in (10,11) or cents not in (1000,2000,3000,5000,10000) then raise exception 'Recarga inválida.'; end if;
   label_text := 'Recarga simulada';
   other_name := left(coalesce(p_payload->>'operator','Operadora'),30)||' · '||key_text;
  end if;
  update public.nu_accounts set balance_cents=balance_cents-cents where user_id=u;
  insert into public.nu_transactions(user_id,operation_id,kind,amount_cents,delta_cents,description,counterparty,metadata)
  values(u,op_id,p_operation,cents,-cents,label_text,other_name,jsonb_build_object('reference',key_text)) returning id into tx;

 elsif p_operation='key_create' then
  if (select count(*) from public.nu_pix_keys where user_id=u)>=5 then raise exception 'Limite de cinco chaves.'; end if;
  if p_payload->>'kind'='email' then
   select lower(email) into key_text from auth.users where id=u;
  elsif p_payload->>'kind'='random' then key_text:=gen_random_uuid()::text;
  else raise exception 'Tipo de chave inválido.'; end if;
  insert into public.nu_pix_keys(user_id,kind,key_value) values(u,p_payload->>'kind',key_text) returning id into row_id;
  out_data:=jsonb_build_object('id',row_id,'key',key_text);

 elsif p_operation='key_remove' then
  delete from public.nu_pix_keys where id=(p_payload->>'id')::uuid and user_id=u returning id into row_id;
  if row_id is null then raise exception 'Chave não encontrada.'; end if;

 elsif p_operation='goal_create' then
  if cents is null then raise exception 'Informe sua meta.'; end if;
  if (select count(*) from public.nu_goals where user_id=u)>=20 then raise exception 'Limite de vinte caixinhas.'; end if;
  insert into public.nu_goals(user_id,label,target_cents) values(u,left(btrim(coalesce(p_payload->>'label','')),60),cents) returning id into row_id;
  out_data:=jsonb_build_object('id',row_id);

 elsif p_operation in ('goal_deposit','goal_withdraw','goal_remove') then
  select * into g from public.nu_goals where id=(p_payload->>'id')::uuid and user_id=u for update;
  if g.id is null then raise exception 'Caixinha não encontrada.'; end if;
  if p_operation='goal_remove' then
   if g.balance_cents<>0 then raise exception 'Resgate o saldo antes de excluir.'; end if;
   delete from public.nu_goals where id=g.id;
  else
   if cents is null then raise exception 'Informe o valor.'; end if;
   if p_operation='goal_deposit' then
    if a.balance_cents<cents then raise exception 'Saldo insuficiente.'; end if;
    update public.nu_accounts set balance_cents=balance_cents-cents where user_id=u;
    update public.nu_goals set balance_cents=balance_cents+cents where id=g.id;
   else
    if g.balance_cents<cents then raise exception 'Saldo insuficiente na caixinha.'; end if;
    update public.nu_accounts set balance_cents=balance_cents+cents where user_id=u;
    update public.nu_goals set balance_cents=balance_cents-cents where id=g.id;
   end if;
   insert into public.nu_transactions(user_id,operation_id,kind,amount_cents,delta_cents,description,counterparty)
   values(u,op_id,p_operation,cents,case when p_operation='goal_deposit' then -cents else cents end,case when p_operation='goal_deposit' then 'Dinheiro guardado' else 'Resgate da caixinha' end,g.label) returning id into tx;
  end if;

 elsif p_operation='card_create' then
  if (select count(*) from public.nu_cards where user_id=u)>=5 then raise exception 'Limite de cinco cartões.'; end if;
  insert into public.nu_cards(user_id,label,kind,last_four)
  values(u,coalesce(nullif(left(btrim(p_payload->>'label'),40),''),'Cartão virtual'),'virtual',lpad((floor(random()*10000)::int)::text,4,'0')) returning id into row_id;
  out_data:=jsonb_build_object('id',row_id);

 elsif p_operation='card_block' then
  update public.nu_cards set blocked=not blocked where id=(p_payload->>'id')::uuid and user_id=u returning id into row_id;
  if row_id is null then raise exception 'Cartão não encontrado.'; end if;

 elsif p_operation='card_limit' then
  if cents is null or cents>500000 or cents<a.credit_used_cents then raise exception 'Limite deve cobrir a fatura e ficar até R$ 5.000 fictícios.'; end if;
  update public.nu_accounts set credit_limit_cents=cents where user_id=u;

 elsif p_operation='card_purchase' then
  if cents is null then raise exception 'Informe o valor.'; end if;
  select * into c from public.nu_cards where id=(p_payload->>'id')::uuid and user_id=u;
  if c.id is null or c.blocked then raise exception 'Cartão bloqueado ou não encontrado.'; end if;
  if a.credit_used_cents+cents>a.credit_limit_cents then raise exception 'Limite de crédito insuficiente.'; end if;
  other_name:=left(btrim(coalesce(p_payload->>'merchant','')),80);
  if length(other_name)<2 then raise exception 'Informe a loja fictícia.'; end if;
  update public.nu_accounts set credit_used_cents=credit_used_cents+cents where user_id=u;
  insert into public.nu_card_charges(user_id,card_id,merchant,amount_cents) values(u,c.id,other_name,cents);
  insert into public.nu_transactions(user_id,operation_id,kind,amount_cents,delta_cents,description,counterparty)
  values(u,op_id,'card_purchase',cents,0,'Compra no crédito · simulação',other_name) returning id into tx;

 elsif p_operation='invoice_pay' then
  cents:=a.credit_used_cents;
  if cents<1 then raise exception 'Sua fatura está zerada.'; end if;
  if a.balance_cents<cents then raise exception 'Saldo insuficiente.'; end if;
  update public.nu_accounts set balance_cents=balance_cents-cents,credit_used_cents=0 where user_id=u;
  update public.nu_card_charges set paid_at=now() where user_id=u and paid_at is null;
  insert into public.nu_transactions(user_id,operation_id,kind,amount_cents,delta_cents,description,counterparty)
  values(u,op_id,'invoice_pay',cents,-cents,'Pagamento da fatura simulada','Cartão acadêmico') returning id into tx;

 elsif p_operation='loan_create' then
  if cents is null or cents<10000 or cents>500000 then raise exception 'Empréstimo fictício: de R$ 100 a R$ 5.000.'; end if;
  if exists(select 1 from public.nu_loans where user_id=u and remaining_cents>0) then raise exception 'Quite o empréstimo ativo antes de simular outro.'; end if;
  if coalesce(p_payload->>'months','') !~ '^[0-9]{1,2}$' or (p_payload->>'months')::int not between 2 and 24 then raise exception 'Escolha de 2 a 24 parcelas.'; end if;
  installment:=round(cents * .02 / (1-power(1.02,-(p_payload->>'months')::int)))::bigint;
  total:=installment*(p_payload->>'months')::int;
  insert into public.nu_loans(user_id,principal_cents,months,installment_cents,remaining_cents)
  values(u,cents,(p_payload->>'months')::int,installment,total) returning id into row_id;
  update public.nu_accounts set balance_cents=balance_cents+cents where user_id=u;
  insert into public.nu_transactions(user_id,operation_id,kind,amount_cents,delta_cents,description,counterparty)
  values(u,op_id,'loan_credit',cents,cents,'Empréstimo fictício liberado','Simulador · 2% a.m.') returning id into tx;
  out_data:=jsonb_build_object('id',row_id,'installment',installment,'total',total);

 elsif p_operation='loan_pay' then
  select * into loan from public.nu_loans where id=(p_payload->>'id')::uuid and user_id=u for update;
  if loan.id is null or loan.remaining_cents=0 then raise exception 'Empréstimo não encontrado ou já quitado.'; end if;
  cents:=least(loan.installment_cents,loan.remaining_cents);
  if a.balance_cents<cents then raise exception 'Saldo insuficiente.'; end if;
  update public.nu_accounts set balance_cents=balance_cents-cents where user_id=u;
  update public.nu_loans set remaining_cents=remaining_cents-cents,installments_paid=installments_paid+1 where id=loan.id;
  insert into public.nu_transactions(user_id,operation_id,kind,amount_cents,delta_cents,description,counterparty)
  values(u,op_id,'loan_pay',cents,-cents,'Parcela de empréstimo fictício','Parcela '||(loan.installments_paid+1)::text) returning id into tx;

 elsif p_operation='schedule_create' then
  if cents is null then raise exception 'Informe o valor.'; end if;
  key_text:=lower(btrim(coalesce(p_payload->>'key','')));
  if not exists(select 1 from public.nu_pix_keys where key_value=key_text and user_id<>u) then raise exception 'Chave de destino inválida.'; end if;
  due:=(p_payload->>'due_at')::timestamptz;
  if due is null or due<now() or due>now()+interval '365 days' then raise exception 'Escolha uma data futura em até um ano.'; end if;
  if (select count(*) from public.nu_schedules where user_id=u and status='pending')>=20 then raise exception 'Limite de vinte agendamentos pendentes.'; end if;
  insert into public.nu_schedules(user_id,key_value,amount_cents,description,due_at)
  values(u,key_text,cents,coalesce(nullif(label_text,''),'Pix agendado · simulação'),due) returning id into row_id;
  out_data:=jsonb_build_object('id',row_id);

 elsif p_operation='schedule_cancel' then
  update public.nu_schedules set status='cancelled' where id=(p_payload->>'id')::uuid and user_id=u and status='pending' returning id into row_id;
  if row_id is null then raise exception 'Agendamento não pode ser cancelado.'; end if;

 elsif p_operation='profile_update' then
  if length(btrim(coalesce(p_payload->>'name',''))) not between 2 and 80 then raise exception 'Nome deve ter de 2 a 80 caracteres.'; end if;
  update public.nu_profiles set display_name=btrim(p_payload->>'name'),phone=left(coalesce(p_payload->>'phone',''),20),
   theme=case when p_payload->>'theme'='dark' then 'dark' else 'light' end where user_id=u;

 elsif p_operation='notifications_read' then
  update public.nu_notifications set read_at=now() where user_id=u and read_at is null;

 elsif p_operation='ticket_create' then
  insert into public.nu_tickets(user_id,subject,message) values(u,left(btrim(p_payload->>'subject'),100),left(btrim(p_payload->>'message'),2000)) returning id into row_id;
  out_data:=jsonb_build_object('id',row_id);

 elsif p_operation='ticket_close' then
  update public.nu_tickets set status='closed' where id=(p_payload->>'id')::uuid and user_id=u returning id into row_id;
  if row_id is null then raise exception 'Solicitação não encontrada.'; end if;
 end if;
 out_data:=out_data||jsonb_build_object('ok',true,'operation_id',op_id,'transaction_id',tx);
 insert into nu_private.requests(user_id,request_id,operation,payload,response) values(u,p_request_id,p_operation,p_payload,out_data);
 return out_data;
end $$;

-- Agendamentos são processados quando o titular abre/atualiza o app.
-- Não há promessa de envio em segundo plano nem integração com Pix oficial.
create or replace function nu_private.process_schedules() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare s public.nu_schedules%rowtype; processed int:=0; error_text text;
begin
 if auth.uid() is null then raise exception 'Faça login para continuar.'; end if;
 perform 1 from public.nu_accounts where user_id=auth.uid() or user_id in (
  select k.user_id from public.nu_pix_keys k join public.nu_schedules sc on sc.key_value=k.key_value
  where sc.user_id=auth.uid() and sc.status='pending' and sc.due_at<=now()
 ) order by user_id for update;
 for s in select * from public.nu_schedules where user_id=auth.uid() and status='pending' and due_at<=now() order by due_at for update skip locked loop
  begin
   perform nu_private.operate('transfer',jsonb_build_object('key',s.key_value,'amount',s.amount_cents,'description',s.description),s.id);
   update public.nu_schedules set status='done',result_message='Executado ao abrir o aplicativo.' where id=s.id;
  exception when others then
   get stacked diagnostics error_text=message_text;
   update public.nu_schedules set status='failed',result_message=left(error_text,200) where id=s.id;
  end;
  processed:=processed+1;
 end loop;
 return jsonb_build_object('processed',processed);
end $$;

-- Entradas públicas são SECURITY INVOKER; o código privilegiado fica fora da API.
create or replace function public.nu_ensure_account() returns jsonb language sql security invoker set search_path='' as $$ select nu_private.ensure_account(); $$;
create or replace function public.nu_lookup_recipient(p_key text) returns jsonb language sql security invoker set search_path='' as $$ select nu_private.lookup_recipient(p_key); $$;
create or replace function public.nu_operate(p_operation text,p_payload jsonb,p_request_id uuid) returns jsonb language sql security invoker set search_path='' as $$ select nu_private.operate(p_operation,p_payload,p_request_id); $$;
create or replace function public.nu_process_schedules() returns jsonb language sql security invoker set search_path='' as $$ select nu_private.process_schedules(); $$;

revoke all on function nu_private.ensure_account(),nu_private.lookup_recipient(text),nu_private.operate(text,jsonb,uuid),nu_private.process_schedules() from public,anon,authenticated;
grant execute on function nu_private.ensure_account(),nu_private.lookup_recipient(text),nu_private.operate(text,jsonb,uuid),nu_private.process_schedules() to authenticated;
revoke all on function public.nu_ensure_account(),public.nu_lookup_recipient(text),public.nu_operate(text,jsonb,uuid),public.nu_process_schedules() from public,anon,authenticated;
grant execute on function public.nu_ensure_account(),public.nu_lookup_recipient(text),public.nu_operate(text,jsonb,uuid),public.nu_process_schedules() to authenticated;

-- As funções autenticadas ainda verificam auth.uid() e cada propriedade na operação.
-- Não adicione nu_private aos schemas expostos pela Data API.
create or replace function public.nu_monthly_summary(p_since timestamptz) returns jsonb
 language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('income',coalesce(sum(delta_cents) filter(where delta_cents>0),0),'expenses',coalesce(-sum(delta_cents) filter(where delta_cents<0),0),'unread',(select count(*) from public.nu_notifications where user_id=(select auth.uid()) and read_at is null))
 from public.nu_transactions where user_id=(select auth.uid()) and created_at>=p_since and created_at<=now();
 $$;
revoke all on function public.nu_monthly_summary(timestamptz) from public,anon;
grant execute on function public.nu_monthly_summary(timestamptz) to authenticated;

-- Verificação anônima do instalador: retorna apenas status do esquema, nunca dados de clientes.
create or replace function public.nu_schema_status() returns jsonb
language sql stable security invoker set search_path='' as $$
 with required(name) as (
  values ('nu_profiles'),('nu_accounts'),('nu_transactions'),('nu_pix_keys'),('nu_cards'),('nu_card_charges'),('nu_goals'),('nu_loans'),('nu_schedules'),('nu_notifications'),('nu_tickets')
 ), checked as (
  select r.name,c.oid,c.relrowsecurity
  from required r left join pg_catalog.pg_namespace n on n.nspname='public'
  left join pg_catalog.pg_class c on c.relnamespace=n.oid and c.relname=r.name and c.relkind='r'
 ), required_functions(signature) as (
  values ('public.nu_ensure_account()'),('public.nu_operate(text,jsonb,uuid)'),('public.nu_lookup_recipient(text)'),('public.nu_process_schedules()'),('public.nu_monthly_summary(timestamp with time zone)')
 )
 select jsonb_build_object(
  'schema_version',2,
  'ready',
   (select count(oid)=11 and bool_and(coalesce(relrowsecurity,false))
     and bool_and(case when oid is null then false else pg_catalog.has_table_privilege('authenticated',oid,'SELECT') end)
     and bool_and(case when oid is null then false else not pg_catalog.has_table_privilege('authenticated',oid,'INSERT,UPDATE,DELETE') end)
     and bool_and(case when oid is null then false else not pg_catalog.has_table_privilege('anon',oid,'SELECT') end) from checked)
   and (select bool_and(pg_catalog.to_regprocedure(signature) is not null) from required_functions)
   and not pg_catalog.has_schema_privilege('anon','nu_private','USAGE'),
  'tables', (select count(oid) from checked)
 );
$$;
grant usage on schema public to anon;
revoke all on function public.nu_schema_status() from public,anon,authenticated;
grant execute on function public.nu_schema_status() to anon,authenticated;


notify pgrst, 'reload schema';
commit;
