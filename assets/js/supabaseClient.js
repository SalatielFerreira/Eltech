// Cliente único do Supabase, compartilhado por todos os módulos.
// Carregado via CDN ESM (sem bundler/build step) e com versão fixa
// para não quebrar silenciosamente quando a CDN atualizar a lib.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true }
});
