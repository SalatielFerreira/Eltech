-- ============================================================
-- FARM v4.2.0 — novos campos no cadastro do animal
-- ============================================================
-- Como aplicar (uma vez só): Supabase -> SQL Editor -> New query,
-- cole este arquivo e clique em Run. Pode rodar mais de uma vez
-- sem problema ("if not exists").
--
-- Enquanto não for aplicado, o app continua salvando os animais
-- normalmente, só sem estes campos novos (e avisa na tela).
-- ============================================================
alter table public.animais add column if not exists brinco        text;
alter table public.animais add column if not exists registro      text;
alter table public.animais add column if not exists pelagem       text;
alter table public.animais add column if not exists obs           text;
alter table public.animais add column if not exists data_compra   date;
alter table public.animais add column if not exists valor_compra  numeric;
alter table public.animais add column if not exists vendedor      text;

-- Faz a API do Supabase enxergar as colunas novas imediatamente.
notify pgrst, 'reload schema';
