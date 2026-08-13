-- ============================================================
-- ELTECH — Schema Supabase (Postgres)
-- ============================================================
-- Como usar: abra o painel do seu projeto em supabase.com,
-- vá em "SQL Editor" -> "New query", cole TODO este arquivo
-- e clique em "Run". Ele cria as tabelas, ativa Row Level
-- Security (cada usuário só enxerga os próprios dados) e
-- cria os buckets de fotos com as políticas de acesso.
--
-- Pode rodar mais de uma vez sem problema: os comandos usam
-- "if not exists" / "on conflict do nothing" onde possível.
-- ============================================================

create extension if not exists pgcrypto;

-- ------------------------------------------------------------
-- PROFILES (1 linha por usuário autenticado)
-- ------------------------------------------------------------
create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  name         text not null default 'Usuário',
  avatar_path  text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Cria automaticamente uma linha em profiles quando alguém se cadastra.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, name)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', 'Usuário'))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- LOTES
-- ------------------------------------------------------------
create table if not exists public.lotes (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name       text not null,
  ordem      integer,
  created_at timestamptz not null default now()
);
create index if not exists idx_lotes_owner on public.lotes(owner_id);

-- ------------------------------------------------------------
-- ANIMAIS
-- ------------------------------------------------------------
create table if not exists public.animais (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  lote_id       uuid not null references public.lotes(id) on delete cascade,
  num           text not null,
  nome          text not null,
  origem        text,
  tipo_prenhez  text,
  data_nasc     date,
  sexo          text not null,
  cat           text not null,
  sit           text,
  raca          text,
  grau_sangue   text,
  nome_mae      text,
  nome_pai      text,
  peso          numeric,
  leite         numeric,
  ultimo_parto  date,
  prenha_data   date,
  photo_path    text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists idx_animais_owner on public.animais(owner_id);
create index if not exists idx_animais_lote  on public.animais(lote_id);

drop trigger if exists trg_animais_updated_at on public.animais;
create trigger trg_animais_updated_at
  before update on public.animais
  for each row execute function public.set_updated_at();

create table if not exists public.animal_pesagens (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null default auth.uid() references auth.users(id) on delete cascade,
  animal_id  uuid not null references public.animais(id) on delete cascade,
  peso       numeric not null,
  data       date not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_pesagens_animal on public.animal_pesagens(animal_id);

create table if not exists public.animal_leite_hist (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null default auth.uid() references auth.users(id) on delete cascade,
  animal_id  uuid not null references public.animais(id) on delete cascade,
  leite      numeric not null,
  data       date not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_leitehist_animal on public.animal_leite_hist(animal_id);

-- ------------------------------------------------------------
-- TOUROS
-- ------------------------------------------------------------
create table if not exists public.touros (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  nome        text not null,
  raca        text,
  grau_sangue text,
  registro    text,
  created_at  timestamptz not null default now()
);
create index if not exists idx_touros_owner on public.touros(owner_id);

-- ------------------------------------------------------------
-- INSEMINAÇÃO
-- ------------------------------------------------------------
create table if not exists public.inseminacao_planilhas (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name       text not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_insemp_owner on public.inseminacao_planilhas(owner_id);

create table if not exists public.inseminacao_registros (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  planilha_id   uuid not null references public.inseminacao_planilhas(id) on delete cascade,
  animal_id     uuid references public.animais(id) on delete set null,
  num           text not null,
  nome          text not null,
  data          date,
  tempo         text,
  touro         text,
  muco          text,
  obs           text,
  parecer       text,
  parecer_data  date,
  created_at    timestamptz not null default now()
);
create index if not exists idx_insemr_planilha on public.inseminacao_registros(planilha_id);
create index if not exists idx_insemr_animal   on public.inseminacao_registros(animal_id);

-- ------------------------------------------------------------
-- MEDICAÇÃO
-- ------------------------------------------------------------
create table if not exists public.medicacoes (
  id               uuid primary key default gen_random_uuid(),
  owner_id         uuid not null default auth.uid() references auth.users(id) on delete cascade,
  data_ini         date,
  data_fim         date,
  tipo             text,
  carencia_leite   integer,
  carencia_carne   integer,
  created_at       timestamptz not null default now()
);
create index if not exists idx_med_owner on public.medicacoes(owner_id);

create table if not exists public.medicacao_medicamentos (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  medicacao_id  uuid not null references public.medicacoes(id) on delete cascade,
  nome          text not null,
  dose          text
);
create index if not exists idx_medmed_medicacao on public.medicacao_medicamentos(medicacao_id);

create table if not exists public.medicacao_animais (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  medicacao_id  uuid not null references public.medicacoes(id) on delete cascade,
  animal_id     uuid references public.animais(id) on delete set null,
  num           text not null,
  nome          text not null
);
create index if not exists idx_medani_medicacao on public.medicacao_animais(medicacao_id);

-- ------------------------------------------------------------
-- ALIMENTAÇÃO
-- ------------------------------------------------------------
create table if not exists public.alimentacoes (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  nome_dieta   text,
  num_animais  integer default 0,
  custo_total  numeric default 0,
  created_at   timestamptz not null default now()
);
create index if not exists idx_ali_owner on public.alimentacoes(owner_id);

create table if not exists public.alimentacao_dietas (
  id              uuid primary key default gen_random_uuid(),
  owner_id        uuid not null default auth.uid() references auth.users(id) on delete cascade,
  alimentacao_id  uuid not null references public.alimentacoes(id) on delete cascade,
  tipo            text not null,
  valor_kg        numeric,
  kg              numeric
);
create index if not exists idx_alidieta_ali on public.alimentacao_dietas(alimentacao_id);

create table if not exists public.alimentacao_animais (
  id              uuid primary key default gen_random_uuid(),
  owner_id        uuid not null default auth.uid() references auth.users(id) on delete cascade,
  alimentacao_id  uuid not null references public.alimentacoes(id) on delete cascade,
  animal_id       uuid references public.animais(id) on delete set null,
  num             text not null,
  nome            text not null
);
create index if not exists idx_alianim_ali on public.alimentacao_animais(alimentacao_id);

-- ------------------------------------------------------------
-- BAIXAS (histórico — snapshot do animal no momento da baixa)
-- ------------------------------------------------------------
create table if not exists public.baixas (
  id               uuid primary key default gen_random_uuid(),
  owner_id         uuid not null default auth.uid() references auth.users(id) on delete cascade,
  num              text not null,
  nome             text not null,
  sexo             text,
  cat              text,
  tipo             text not null check (tipo in ('venda','morte')),
  data             date not null,
  valor            numeric,
  obs              text,
  lote_name        text,
  animal_snapshot  jsonb not null,
  created_at       timestamptz not null default now()
);
create index if not exists idx_baixas_owner on public.baixas(owner_id);

-- ============================================================
-- ROW LEVEL SECURITY — todas as tabelas isoladas por owner_id
-- ============================================================
alter table public.profiles                enable row level security;
alter table public.lotes                    enable row level security;
alter table public.animais                  enable row level security;
alter table public.animal_pesagens          enable row level security;
alter table public.animal_leite_hist        enable row level security;
alter table public.touros                   enable row level security;
alter table public.inseminacao_planilhas    enable row level security;
alter table public.inseminacao_registros    enable row level security;
alter table public.medicacoes               enable row level security;
alter table public.medicacao_medicamentos   enable row level security;
alter table public.medicacao_animais        enable row level security;
alter table public.alimentacoes             enable row level security;
alter table public.alimentacao_dietas       enable row level security;
alter table public.alimentacao_animais      enable row level security;
alter table public.baixas                   enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_insert_own" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_select_own" on public.profiles for select using (id = auth.uid());
create policy "profiles_insert_own" on public.profiles for insert with check (id = auth.uid());
create policy "profiles_update_own" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());

-- Gera as 4 policies padrão (select/insert/update/delete) para cada tabela com owner_id.
do $$
declare
  t text;
  tables text[] := array[
    'lotes','animais','animal_pesagens','animal_leite_hist','touros',
    'inseminacao_planilhas','inseminacao_registros',
    'medicacoes','medicacao_medicamentos','medicacao_animais',
    'alimentacoes','alimentacao_dietas','alimentacao_animais',
    'baixas'
  ];
begin
  foreach t in array tables loop
    execute format('drop policy if exists "%s_select_own" on public.%I;', t, t);
    execute format('drop policy if exists "%s_insert_own" on public.%I;', t, t);
    execute format('drop policy if exists "%s_update_own" on public.%I;', t, t);
    execute format('drop policy if exists "%s_delete_own" on public.%I;', t, t);
    execute format('create policy "%s_select_own" on public.%I for select using (owner_id = auth.uid());', t, t);
    execute format('create policy "%s_insert_own" on public.%I for insert with check (owner_id = auth.uid());', t, t);
    execute format('create policy "%s_update_own" on public.%I for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());', t, t);
    execute format('create policy "%s_delete_own" on public.%I for delete using (owner_id = auth.uid());', t, t);
  end loop;
end $$;

-- ============================================================
-- STORAGE — buckets privados + políticas por pasta do próprio dono
-- Convenção de caminho: {auth.uid()}/arquivo.ext
-- ============================================================
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('animal-photos', 'animal-photos', false)
on conflict (id) do nothing;

drop policy if exists "avatars_select_own" on storage.objects;
drop policy if exists "avatars_insert_own" on storage.objects;
drop policy if exists "avatars_update_own" on storage.objects;
drop policy if exists "avatars_delete_own" on storage.objects;
create policy "avatars_select_own" on storage.objects
  for select using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatars_insert_own" on storage.objects
  for insert with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatars_update_own" on storage.objects
  for update using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatars_delete_own" on storage.objects
  for delete using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "animal_photos_select_own" on storage.objects;
drop policy if exists "animal_photos_insert_own" on storage.objects;
drop policy if exists "animal_photos_update_own" on storage.objects;
drop policy if exists "animal_photos_delete_own" on storage.objects;
create policy "animal_photos_select_own" on storage.objects
  for select using (bucket_id = 'animal-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "animal_photos_insert_own" on storage.objects
  for insert with check (bucket_id = 'animal-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "animal_photos_update_own" on storage.objects
  for update using (bucket_id = 'animal-photos' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'animal-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "animal_photos_delete_own" on storage.objects
  for delete using (bucket_id = 'animal-photos' and (storage.foldername(name))[1] = auth.uid()::text);
