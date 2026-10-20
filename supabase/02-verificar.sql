-- Consultas de verificação. Não alteram dados.
-- Rode no SQL Editor do mesmo projeto em que executou 01-banco.sql.

-- Todas as tabelas nu_ públicas devem apresentar RLS = true.
select tablename, rowsecurity as rls
from pg_tables where schemaname='public' and left(tablename,3)='nu_'
order by tablename;

-- Políticas de leitura devem restringir o titular pelo auth.uid().
select tablename, policyname, roles, cmd, qual
from pg_policies where schemaname='public' and left(tablename,3)='nu_'
order by tablename;

-- Usuário autenticado lê; não pode alterar saldo diretamente.
select
 has_table_privilege('authenticated','public.nu_accounts','SELECT') as pode_ler,
 has_table_privilege('authenticated','public.nu_accounts','UPDATE') as pode_alterar_saldo,
 has_table_privilege('anon','public.nu_accounts','SELECT') as anon_pode_ler;

-- A API pública usa wrappers invoker. Definer fica no nu_private.
select n.nspname as schema, p.proname, p.prosecdef as security_definer, p.proconfig
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where (n.nspname='nu_private' or (n.nspname='public' and left(p.proname,3)='nu_'))
order by 1,2;

-- Deve retornar ZERO linhas: todo saldo deve conferir com o extrato.
select a.user_id,a.balance_cents,coalesce(sum(t.delta_cents),0) as saldo_pelo_extrato
from public.nu_accounts a left join public.nu_transactions t on t.user_id=a.user_id
group by a.user_id,a.balance_cents
having a.balance_cents<>coalesce(sum(t.delta_cents),0);

-- Deve retornar ZERO linhas: Pix interno tem uma saída e uma entrada iguais.
select operation_id,count(*) as registros,sum(delta_cents) as diferenca
from public.nu_transactions where kind in ('pix_in','pix_out')
group by operation_id having count(*)<>2 or sum(delta_cents)<>0;

-- Deve retornar ZERO linhas: limite utilizado = compras em aberto.
select a.user_id,a.credit_used_cents,coalesce(sum(c.amount_cents) filter(where c.paid_at is null),0) as fatura
from public.nu_accounts a left join public.nu_card_charges c on c.user_id=a.user_id
group by a.user_id,a.credit_used_cents
having a.credit_used_cents<>coalesce(sum(c.amount_cents) filter(where c.paid_at is null),0);

-- Status utilizado pelo instalador; ready deve ser true.
select public.nu_schema_status();
