-- =====================================================
-- Raxo — Recorrências com geração antecipada + compartilhamento
-- Execute no SQL Editor do Supabase (roda depois do supabase-migration.sql)
-- =====================================================

-- ─── Passo 0: introspecção — rode antes e confira o resultado ──
-- `recurring_transactions` nunca foi versionada em SQL (foi criada direto
-- no dashboard), então vale conferir o schema/policies reais antes de aplicar:
--
-- select policyname, cmd, qual, with_check
--   from pg_policies where tablename = 'recurring_transactions';
-- select column_name, data_type
--   from information_schema.columns where table_name = 'recurring_transactions';

-- ─── recurring_transactions: controle de geração antecipada ────
alter table public.recurring_transactions
  add column if not exists generated_until text;
-- 'yyyy-MM' do último mês já gerado. NULL = recorrência legada — continua
-- no motor antigo (reativo, dia a dia). Preenchido = motor novo (geração
-- antecipada até dezembro do ano corrente).

-- ─── transactions: vínculo com a recorrência de origem ─────────
alter table public.transactions
  add column if not exists recurring_id uuid references public.recurring_transactions(id) on delete set null;

create index if not exists idx_transactions_recurring
  on public.transactions(recurring_id) where recurring_id is not null;

-- ─── shared_transactions: vínculo com a recorrência de origem ──
-- Permite que approveSharedTransaction propague recurring_id pra cópia
-- que cria na conta do amigo, sem depender de nenhuma policy nova em
-- transactions (o amigo já tem select garantido aqui via shared_with_user_id).
alter table public.shared_transactions
  add column if not exists recurring_id uuid references public.recurring_transactions(id) on delete set null;

-- ─── Compartilhamento de recorrências ───────────────────────────
create table if not exists public.recurring_transaction_shares (
  id                   uuid primary key default gen_random_uuid(),
  recurring_id         uuid not null references public.recurring_transactions(id) on delete cascade,
  shared_with_user_id  uuid not null references auth.users(id) on delete cascade,
  split_amount         numeric(12,2) not null,
  split_percentage     numeric(5,2),
  created_at           timestamptz not null default now()
);

alter table public.recurring_transaction_shares enable row level security;

do $$ begin
  create policy "Dono gerencia compartilhamentos da recorrência"
    on public.recurring_transaction_shares for all
    using (exists (
      select 1 from public.recurring_transactions rt
      where rt.id = recurring_id and rt.user_id = auth.uid()
    ))
    with check (exists (
      select 1 from public.recurring_transactions rt
      where rt.id = recurring_id and rt.user_id = auth.uid()
    ));
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "Destinatário vê compartilhamento recebido"
    on public.recurring_transaction_shares for select
    using (shared_with_user_id = auth.uid());
exception when duplicate_object then null; end $$;

-- ─── recurring_transactions: amigo vê a recorrência compartilhada ─
-- (assume que já existe a policy padrão "for all using auth.uid() = user_id"
-- pro dono, igual às outras tabelas do projeto — esta é só a policy adicional)
do $$ begin
  create policy "Amigo vê recorrência compartilhada com ele"
    on public.recurring_transactions for select
    using (
      exists (
        select 1 from public.recurring_transaction_shares s
        where s.recurring_id = recurring_transactions.id
        and s.shared_with_user_id = auth.uid()
      )
    );
exception when duplicate_object then null; end $$;

-- ─── transactions: dono da recorrência apaga futuras (inclusive as do amigo) ─
-- RLS combina policies do mesmo comando com OR e avalia linha a linha, então
-- um único DELETE ... WHERE recurring_id = X AND date >= <próximo mês> feito
-- pelo dono apaga tanto as próprias transações futuras (via policy antiga
-- auth.uid()=user_id) quanto a cópia já aprovada na conta do amigo (via esta
-- policy nova). A restrição de "só futuras" é aplicada pela aplicação (WHERE
-- date >= ...), não pela policy — mesmo padrão do resto do projeto, onde RLS
-- define o teto de permissão e a regra de negócio fica no client.
do $$ begin
  create policy "Dono da recorrência apaga transações futuras vinculadas"
    on public.transactions for delete
    using (
      recurring_id is not null and exists (
        select 1 from public.recurring_transactions rt
        where rt.id = transactions.recurring_id and rt.user_id = auth.uid()
      )
    );
exception when duplicate_object then null; end $$;

-- ─── transactions: bug fix — amigo lê a transação original ao aprovar ──
-- Sem isso, approveSharedTransaction (sharedExpensesService.ts) sempre cai
-- no fallback genérico ("Despesa compartilhada" / categoria "Outros" / data
-- de hoje) porque não existe policy de SELECT que permita ao amigo ler a
-- transação do dono antes de aprovar — o select vinha sempre null. Numa
-- recorrência isso quebraria "um lançamento por mês na data certa".
do $$ begin
  create policy "Amigo lê transação que compartilharam com ele"
    on public.transactions for select
    using (
      exists (
        select 1 from public.shared_transactions st
        where st.transaction_id = transactions.id
        and st.shared_with_user_id = auth.uid()
      )
    );
exception when duplicate_object then null; end $$;

-- ─── Hardening: valida recurring_id antes de gravar em transactions ────
-- Impede vincular recurring_id a uma recorrência com a qual o usuário não
-- tem relação legítima (não é o dono nem destinatário do compartilhamento).
create or replace function public.validate_transaction_recurring_id()
returns trigger language plpgsql security definer
set search_path = 'public'
as $$
begin
  if new.recurring_id is not null and not exists (
    select 1 from public.recurring_transactions rt
    where rt.id = new.recurring_id
    and (
      rt.user_id = new.user_id or
      exists (
        select 1 from public.recurring_transaction_shares s
        where s.recurring_id = rt.id and s.shared_with_user_id = new.user_id
      )
    )
  ) then
    raise exception 'recurring_id inválido para este usuário';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_validate_transaction_recurring_id on public.transactions;
create trigger trg_validate_transaction_recurring_id
  before insert or update on public.transactions
  for each row execute function public.validate_transaction_recurring_id();
