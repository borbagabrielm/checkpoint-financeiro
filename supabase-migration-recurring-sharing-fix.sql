-- =====================================================
-- Raxo — FIX urgente: referência circular de RLS
-- Execute no SQL Editor do Supabase AGORA (depois do
-- supabase-migration-recurring-sharing.sql)
-- =====================================================
--
-- Bug: a policy "Amigo lê transação que compartilharam com ele" (em
-- transactions) consulta shared_transactions, e shared_transactions já
-- tinha uma policy que consulta transactions de volta — referência
-- circular entre as duas tabelas. O mesmo aconteceu entre
-- recurring_transactions e recurring_transaction_shares. Isso faz o
-- Postgres estourar o limite de recursão ao avaliar a policy, e QUALQUER
-- select em transactions (inclusive das suas próprias transações) passa
-- a falhar — o app trata erro de query como lista vazia, por isso a
-- tela ficou em branco mesmo com os dados intactos no banco.
--
-- Fix: mover a checagem cruzada pra dentro de uma função SECURITY
-- DEFINER (mesmo padrão já usado em create_shared_transaction_notification),
-- que roda com o dono das tabelas e ignora RLS internamente — quebra o
-- ciclo sem abrir mão da regra de negócio.

create or replace function public.is_shared_with_me(tx_id uuid, uid uuid)
returns boolean language sql security definer stable
set search_path = 'public'
as $$
  select exists (
    select 1 from public.shared_transactions st
    where st.transaction_id = tx_id and st.shared_with_user_id = uid
  );
$$;

create or replace function public.recurring_shared_with_me(rec_id uuid, uid uuid)
returns boolean language sql security definer stable
set search_path = 'public'
as $$
  select exists (
    select 1 from public.recurring_transaction_shares s
    where s.recurring_id = rec_id and s.shared_with_user_id = uid
  );
$$;

drop policy if exists "Amigo lê transação que compartilharam com ele" on public.transactions;
create policy "Amigo lê transação que compartilharam com ele"
  on public.transactions for select
  using (public.is_shared_with_me(id, auth.uid()));

drop policy if exists "Amigo vê recorrência compartilhada com ele" on public.recurring_transactions;
create policy "Amigo vê recorrência compartilhada com ele"
  on public.recurring_transactions for select
  using (public.recurring_shared_with_me(id, auth.uid()));
