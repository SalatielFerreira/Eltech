-- ============================================================
-- FARM v4.4.0 — integridade dos dados, lixeira e gravações atômicas
-- ============================================================
-- Como aplicar (uma vez só): Supabase -> SQL Editor -> New query,
-- cole este arquivo e clique em Run. Pode rodar de novo sem problema.
--
-- Enquanto não for aplicado, o app continua funcionando como antes
-- (exclusões definitivas, gravações em várias etapas, mãe/pai pelo nome).
--
-- O que faz:
--  1) Mãe e pai ligados pelo ID do animal (mae_id / pai_id), preenchendo
--     os cadastros antigos a partir do nome.
--  2) Lixeira: coluna deleted_at em lotes, animais, planilhas, medicações
--     e alimentações (o app apaga de vez depois de 30 dias).
--  3) Nº do animal único por usuário (entre os animais fora da lixeira).
--  4) Funções que gravam tudo de uma vez (ou nada): medicação,
--     alimentação, dar baixa, restaurar baixa e lote para a lixeira.
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
