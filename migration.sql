-- ============================================================
-- Casa de Lagos — Migração Supabase
-- Executar no SQL Editor do Supabase (uma vez).
-- ============================================================

-- Extensão para gerar UUIDs (normalmente já ativa no Supabase)
create extension if not exists "pgcrypto";

-- ---------------- Tabela de reservas ----------------
create table if not exists public.bookings (
  id          uuid primary key default gen_random_uuid(),
  person_name text        not null,
  start_date  date        not null,
  end_date    date        not null,
  guests      int         not null default 1,
  created_at  timestamptz not null default now()
);

-- Índice para consultas por data
create index if not exists bookings_dates_idx
  on public.bookings (start_date, end_date);

-- ---------------- RLS: acesso público (app familiar de confiança) ----------------
-- Sem autenticação. Acesso aberto por design — a proteção é a partilha
-- privada do link em família. NÃO usar a chave service_role no frontend.
alter table public.bookings enable row level security;

drop policy if exists "public_select_bookings" on public.bookings;
drop policy if exists "public_insert_bookings" on public.bookings;
drop policy if exists "public_update_bookings" on public.bookings;
drop policy if exists "public_delete_bookings" on public.bookings;

create policy "public_select_bookings" on public.bookings
  for select using (true);
create policy "public_insert_bookings" on public.bookings
  for insert with check (true);
create policy "public_update_bookings" on public.bookings
  for update using (true) with check (true);
create policy "public_delete_bookings" on public.bookings
  for delete using (true);
