-- ============================================================
-- FARM — Schema Supabase (Postgres)
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
  brinco        text,
  registro      text,
  pelagem       text,
  obs           text,
  data_compra   date,
  valor_compra  numeric,
  vendedor      text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
-- Colunas adicionadas na v4.2.0 (para bancos criados antes dela).
alter table public.animais add column if not exists brinco        text;
alter table public.animais add column if not exists registro      text;
alter table public.animais add column if not exists pelagem       text;
alter table public.animais add column if not exists obs           text;
alter table public.animais add column if not exists data_compra   date;
alter table public.animais add column if not exists valor_compra  numeric;
alter table public.animais add column if not exists vendedor      text;
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

-- ============================================================
-- v4.4.0 — integridade, lixeira e funções atômicas
-- (mesmo conteúdo de supabase/migrations/20261124_v44_integridade_lixeira.sql)
-- ============================================================
-- 1) Mãe e pai por ID -----------------------------------------------------
alter table public.animais add column if not exists mae_id uuid references public.animais(id) on delete set null;
alter table public.animais add column if not exists pai_id uuid references public.animais(id) on delete set null;
create index if not exists idx_animais_mae on public.animais(mae_id);
create index if not exists idx_animais_pai on public.animais(pai_id);

update public.animais a set mae_id = (
  select m.id from public.animais m
  where m.owner_id = a.owner_id and m.nome = a.nome_mae and m.sexo = 'Fêmea' and m.id <> a.id
  order by m.created_at limit 1)
where a.mae_id is null and coalesce(a.nome_mae, '') <> '';

update public.animais a set pai_id = (
  select p.id from public.animais p
  where p.owner_id = a.owner_id and p.nome = a.nome_pai and p.sexo = 'Macho' and p.id <> a.id
  order by p.created_at limit 1)
where a.pai_id is null and coalesce(a.nome_pai, '') <> '';

-- 2) Lixeira ---------------------------------------------------------------
alter table public.lotes                 add column if not exists deleted_at timestamptz;
alter table public.animais               add column if not exists deleted_at timestamptz;
alter table public.inseminacao_planilhas add column if not exists deleted_at timestamptz;
alter table public.medicacoes            add column if not exists deleted_at timestamptz;
alter table public.alimentacoes          add column if not exists deleted_at timestamptz;
create index if not exists idx_lotes_deleted     on public.lotes(owner_id) where deleted_at is not null;
create index if not exists idx_animais_deleted   on public.animais(owner_id) where deleted_at is not null;

-- Índices que faltavam nas ligações com o animal (consultas mais rápidas)
create index if not exists idx_medani_animal  on public.medicacao_animais(animal_id);
create index if not exists idx_alianim_animal on public.alimentacao_animais(animal_id);

-- 3) Nº único por usuário ---------------------------------------------------
do $$
begin
  if exists (
    select 1 from public.animais where deleted_at is null
    group by owner_id, num having count(*) > 1
  ) then
    raise notice 'Existem animais com o mesmo nº. Corrija-os no app e rode este arquivo de novo para criar a regra de nº único.';
  else
    create unique index if not exists uq_animais_owner_num on public.animais(owner_id, num) where deleted_at is null;
  end if;
end $$;

-- 4) Funções atômicas -----------------------------------------------------
-- "security invoker": rodam com as permissões de quem chama, então as regras de
-- Row Level Security continuam valendo (cada usuário só mexe no que é seu).

create or replace function public.salvar_medicacao(p_id uuid, p_dados jsonb, p_medicamentos jsonb, p_animais jsonb)
returns uuid language plpgsql security invoker set search_path = public as $$
declare v_id uuid;
begin
  if p_id is null then
    insert into medicacoes (data_ini, data_fim, tipo, carencia_leite, carencia_carne)
    values (nullif(p_dados->>'data_ini', '')::date, nullif(p_dados->>'data_fim', '')::date, p_dados->>'tipo',
            nullif(p_dados->>'carencia_leite', '')::int, nullif(p_dados->>'carencia_carne', '')::int)
    returning id into v_id;
  else
    update medicacoes set data_ini = nullif(p_dados->>'data_ini', '')::date, data_fim = nullif(p_dados->>'data_fim', '')::date,
      tipo = p_dados->>'tipo', carencia_leite = nullif(p_dados->>'carencia_leite', '')::int, carencia_carne = nullif(p_dados->>'carencia_carne', '')::int
    where id = p_id returning id into v_id;
    if v_id is null then raise exception 'Medicação não encontrada'; end if;
    delete from medicacao_medicamentos where medicacao_id = v_id;
    delete from medicacao_animais where medicacao_id = v_id;
  end if;
  insert into medicacao_medicamentos (medicacao_id, nome, dose)
    select v_id, x->>'nome', nullif(x->>'dose', '') from jsonb_array_elements(p_medicamentos) x;
  insert into medicacao_animais (medicacao_id, num, nome, animal_id)
    select v_id, x->>'num', x->>'nome', nullif(x->>'animal_id', '')::uuid from jsonb_array_elements(p_animais) x;
  return v_id;
end $$;

create or replace function public.salvar_alimentacao(p_id uuid, p_dados jsonb, p_dietas jsonb, p_animais jsonb)
returns uuid language plpgsql security invoker set search_path = public as $$
declare v_id uuid;
begin
  if p_id is null then
    insert into alimentacoes (nome_dieta, num_animais, custo_total)
    values (p_dados->>'nome_dieta', (p_dados->>'num_animais')::int, (p_dados->>'custo_total')::numeric)
    returning id into v_id;
  else
    update alimentacoes set nome_dieta = p_dados->>'nome_dieta', num_animais = (p_dados->>'num_animais')::int,
      custo_total = (p_dados->>'custo_total')::numeric
    where id = p_id returning id into v_id;
    if v_id is null then raise exception 'Alimentação não encontrada'; end if;
    delete from alimentacao_dietas where alimentacao_id = v_id;
    delete from alimentacao_animais where alimentacao_id = v_id;
  end if;
  insert into alimentacao_dietas (alimentacao_id, tipo, valor_kg, kg)
    select v_id, x->>'tipo', nullif(x->>'valor_kg', '')::numeric, nullif(x->>'kg', '')::numeric from jsonb_array_elements(p_dietas) x;
  insert into alimentacao_animais (alimentacao_id, num, nome, animal_id)
    select v_id, x->>'num', x->>'nome', nullif(x->>'animal_id', '')::uuid from jsonb_array_elements(p_animais) x;
  return v_id;
end $$;

-- Registra a baixa e remove o animal do rebanho na mesma transação.
create or replace function public.dar_baixa(p_animal_id uuid, p_tipo text, p_data date, p_valor numeric, p_obs text, p_lote_name text, p_snapshot jsonb)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare v_row baixas;
begin
  insert into baixas (num, nome, sexo, cat, tipo, data, valor, obs, lote_name, animal_snapshot)
  values (p_snapshot->>'num', p_snapshot->>'nome', p_snapshot->>'sexo', p_snapshot->>'cat', p_tipo, p_data, p_valor, p_obs, p_lote_name, p_snapshot)
  returning * into v_row;
  delete from animais where id = p_animal_id;
  if not found then raise exception 'Animal não encontrado'; end if;
  return to_jsonb(v_row);
end $$;

-- Volta o animal da baixa para o rebanho e apaga o registro de baixa, juntos.
create or replace function public.restaurar_baixa(p_baixa_id uuid, p_animal jsonb)
returns uuid language plpgsql security invoker set search_path = public as $$
declare v_id uuid; r animais;
begin
  r := jsonb_populate_record(null::animais, p_animal);
  insert into animais (lote_id, num, nome, origem, tipo_prenhez, data_nasc, sexo, cat, sit, raca, grau_sangue,
    nome_mae, nome_pai, peso, leite, ultimo_parto, prenha_data, photo_path, brinco, registro, pelagem, obs,
    data_compra, valor_compra, vendedor, mae_id, pai_id)
  values (r.lote_id, r.num, r.nome, r.origem, r.tipo_prenhez, r.data_nasc, r.sexo, r.cat, r.sit, r.raca, r.grau_sangue,
    r.nome_mae, r.nome_pai, r.peso, r.leite, r.ultimo_parto, r.prenha_data, r.photo_path, r.brinco, r.registro, r.pelagem, r.obs,
    r.data_compra, r.valor_compra, r.vendedor,
    (select id from animais where id = r.mae_id), (select id from animais where id = r.pai_id))
  returning id into v_id;
  delete from baixas where id = p_baixa_id;
  return v_id;
end $$;

-- Lote e seus animais vão (ou voltam) juntos da lixeira.
create or replace function public.lote_para_lixeira(p_lote_id uuid)
returns void language plpgsql security invoker set search_path = public as $$
declare v_agora timestamptz := now();
begin
  update lotes set deleted_at = v_agora where id = p_lote_id and deleted_at is null;
  update animais set deleted_at = v_agora where lote_id = p_lote_id and deleted_at is null;
end $$;

create or replace function public.restaurar_lote(p_lote_id uuid)
returns void language plpgsql security invoker set search_path = public as $$
declare v_quando timestamptz;
begin
  select deleted_at into v_quando from lotes where id = p_lote_id;
  update lotes set deleted_at = null where id = p_lote_id;
  -- só os animais que foram para a lixeira junto com o lote
  update animais set deleted_at = null where lote_id = p_lote_id and deleted_at = v_quando;
end $$;

-- Faz a API do Supabase enxergar colunas e funções novas imediatamente.
notify pgrst, 'reload schema';
