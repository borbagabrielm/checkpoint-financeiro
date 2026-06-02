-- =====================================================
-- Pocket Compass Finance v2 — Migration consolidada
-- Execute no SQL Editor do Supabase
-- =====================================================

-- ─── Extensões ───────────────────────────────────────────────
create extension if not exists "uuid-ossp";

-- ─── Perfis de usuário (tabela unificada) ────────────────────
-- Substitui as antigas 'profiles' + 'user_profiles'
create table if not exists public.user_profiles (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null unique references auth.users(id) on delete cascade,
  username     text unique,
  display_name text,
  avatar_url   text,
  bio          text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table public.user_profiles enable row level security;

create policy "Perfis visíveis para todos autenticados"
  on public.user_profiles for select
  to authenticated using (true);

create policy "Usuário atualiza próprio perfil"
  on public.user_profiles for insert
  with check (auth.uid() = user_id);

create policy "Usuário edita próprio perfil"
  on public.user_profiles for update
  using (auth.uid() = user_id);

-- Auto-criar perfil ao cadastrar
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer
set search_path = 'public'
as $$
begin
  insert into public.user_profiles (user_id, display_name)
  values (new.id, new.raw_user_meta_data->>'full_name')
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─── Preferências ────────────────────────────────────────────
create table if not exists public.user_preferences (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null unique references auth.users(id) on delete cascade,
  categories            jsonb default '[]'::jsonb,
  debit_payment_methods jsonb default '[]'::jsonb,
  credit_payment_methods jsonb default '[]'::jsonb,
  theme                 text default 'system' check (theme in ('light', 'dark', 'system')),
  currency              text default 'BRL',
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

alter table public.user_preferences enable row level security;

create policy "Usuário acessa próprias preferências"
  on public.user_preferences for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ─── Transações ───────────────────────────────────────────────
create table if not exists public.transactions (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  description    text not null,
  amount         numeric(12,2) not null,
  type           text not null check (type in ('credit', 'debit')),
  category       text not null,
  payment_method text,
  date           date not null default current_date,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists idx_transactions_user_date on public.transactions(user_id, date desc);

alter table public.transactions enable row level security;

create policy "Usuário acessa próprias transações"
  on public.transactions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Permitir inserir transações para despesas compartilhadas (quando um amigo aprova)
create policy "Inserir transação aprovada de despesa compartilhada"
  on public.transactions for insert
  with check (
    auth.uid() = user_id or
    exists (
      select 1 from public.friendships
      where status = 'accepted'
      and (
        (requester_id = auth.uid() and addressee_id = user_id) or
        (addressee_id = auth.uid() and requester_id = user_id)
      )
    )
  );

-- ─── Amizades ─────────────────────────────────────────────────
create table if not exists public.friendships (
  id           uuid primary key default gen_random_uuid(),
  requester_id uuid not null references auth.users(id) on delete cascade,
  addressee_id uuid not null references auth.users(id) on delete cascade,
  status       text not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique(requester_id, addressee_id)
);

alter table public.friendships enable row level security;

create policy "Usuário vê próprias amizades"
  on public.friendships for select
  using (auth.uid() = requester_id or auth.uid() = addressee_id);

create policy "Usuário envia solicitações"
  on public.friendships for insert
  with check (auth.uid() = requester_id);

create policy "Destinatário responde solicitação"
  on public.friendships for update
  using (auth.uid() = addressee_id or auth.uid() = requester_id);

create policy "Usuário remove amizade"
  on public.friendships for delete
  using (auth.uid() = requester_id or auth.uid() = addressee_id);

-- ─── Transações compartilhadas ────────────────────────────────
create table if not exists public.shared_transactions (
  id                   uuid primary key default gen_random_uuid(),
  transaction_id       uuid not null references public.transactions(id) on delete cascade,
  shared_with_user_id  uuid references auth.users(id) on delete set null,
  split_amount         numeric(12,2) not null,
  split_percentage     numeric(5,2),
  status               text not null default 'pending_approval'
                         check (status in ('pending_approval', 'approved', 'rejected')),
  created_at           timestamptz not null default now()
);

create index if not exists idx_shared_tx_user on public.shared_transactions(shared_with_user_id, status);

alter table public.shared_transactions enable row level security;

create policy "Partes envolvidas veem transação compartilhada"
  on public.shared_transactions for select
  using (
    shared_with_user_id = auth.uid() or
    exists (
      select 1 from public.transactions
      where id = shared_transactions.transaction_id
      and user_id = auth.uid()
    )
  );

create policy "Criador insere compartilhamento"
  on public.shared_transactions for insert
  with check (
    exists (
      select 1 from public.transactions
      where id = transaction_id and user_id = auth.uid()
    )
  );

create policy "Destinatário atualiza status"
  on public.shared_transactions for update
  using (shared_with_user_id = auth.uid())
  with check (shared_with_user_id = auth.uid());

-- ─── Notificações de transações compartilhadas ───────────────
create table if not exists public.shared_transaction_notifications (
  id                     uuid primary key default gen_random_uuid(),
  shared_transaction_id  uuid not null references public.shared_transactions(id) on delete cascade,
  recipient_user_id      uuid not null references auth.users(id) on delete cascade,
  sender_user_id         uuid not null references auth.users(id) on delete cascade,
  transaction_amount     numeric(12,2) not null,
  transaction_description text not null,
  transaction_date       date,
  is_read                boolean not null default false,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

alter table public.shared_transaction_notifications enable row level security;

create policy "Usuário vê notificações recebidas ou enviadas"
  on public.shared_transaction_notifications for select
  using (auth.uid() = recipient_user_id or auth.uid() = sender_user_id);

create policy "Usuário atualiza próprias notificações"
  on public.shared_transaction_notifications for update
  using (auth.uid() = recipient_user_id);

-- Trigger: criar notificação ao inserir shared_transaction pendente
create or replace function public.create_shared_transaction_notification()
returns trigger language plpgsql security definer
set search_path = 'public'
as $$
declare
  tx record;
begin
  if new.status = 'pending_approval' and new.shared_with_user_id is not null then
    select amount, description, user_id, date
    into tx
    from public.transactions
    where id = new.transaction_id;

    insert into public.shared_transaction_notifications (
      shared_transaction_id, recipient_user_id, sender_user_id,
      transaction_amount, transaction_description, transaction_date
    ) values (
      new.id, new.shared_with_user_id, tx.user_id,
      new.split_amount, tx.description, tx.date
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_shared_tx_notification on public.shared_transactions;
create trigger trg_shared_tx_notification
  after insert on public.shared_transactions
  for each row execute function public.create_shared_transaction_notification();

-- ─── Metas financeiras (nova feature) ────────────────────────
create table if not exists public.financial_goals (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  title          text not null,
  target_amount  numeric(12,2) not null,
  current_amount numeric(12,2) not null default 0,
  deadline       date,
  category       text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

alter table public.financial_goals enable row level security;

create policy "Usuário acessa próprias metas"
  on public.financial_goals for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
