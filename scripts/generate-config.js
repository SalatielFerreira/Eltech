// Executado pela Vercel como "Build Command" (Node puro, sem dependências).
// Gera assets/js/config.js a partir das Environment Variables do projeto
// na Vercel (Project Settings -> Environment Variables), já que o app é
// estático (sem bundler) e config.js não vai para o Git.
const fs = require('fs');

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error('Defina SUPABASE_URL e SUPABASE_ANON_KEY nas Environment Variables do projeto na Vercel.');
  process.exit(1);
}

fs.writeFileSync(
  'assets/js/config.js',
  `export const SUPABASE_URL = ${JSON.stringify(url)};\nexport const SUPABASE_ANON_KEY = ${JSON.stringify(key)};\n`
);
console.log('assets/js/config.js gerado a partir das variáveis de ambiente.');
