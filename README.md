# 🐄 FARM — Gestão Pecuária

Aplicativo web (PWA) para gestão de gado leiteiro: controle de **rebanho**, **inseminação**,
**medicação**, **alimentação** e geração de **relatórios** (Excel e PDF). Feito para o
celular: telas pensadas para dedos, troca de tela arrastando para os lados e lixeira de 30 dias.

Os dados ficam salvos na nuvem (**Supabase**: banco de dados + autenticação + fotos), então
funcionam em qualquer aparelho em que você entrar com seu e-mail e senha. O app pode ser
**instalado** no celular ou computador como um aplicativo normal (PWA).

> ⚠️ Esta versão precisa de **internet** para ler/gravar dados (não funciona 100% offline
> como a versão anterior, que guardava tudo só no navegador).

---

## 📁 Estrutura do projeto

```
FARM/
├── index.html                  → Página principal (HTML das telas e modais)
├── manifest.json                → Configuração do app instalável (PWA)
├── sw.js                        → Service worker (cache do app-shell + auto-atualização)
├── version.js                   → Versão do app (ÚNICO lugar para mudar ao publicar)
├── vercel.json                  → Gera assets/js/config.js no deploy da Vercel
├── scripts/
│   └── generate-config.js       → Lê as Environment Variables da Vercel e gera config.js
├── supabase/
│   ├── schema.sql                → Schema completo do banco (tabelas, RLS, buckets de fotos)
│   └── migrations/               → Atualizações do banco para quem já tem o projeto criado
├── tests/                       → Testes automatizados (Playwright + Supabase falso em memória)
├── .github/workflows/testes.yml → Roda os testes a cada push (GitHub Actions)
├── .nojekyll / .gitignore / README.md / CHANGELOG.md
└── assets/
    ├── css/styles.css           → Todo o visual (estilos)
    ├── img/                      → Ícones e imagem de fundo
    └── js/
        ├── config.example.js    → Modelo das credenciais do Supabase (copie -> config.js)
        ├── config.js             → Suas credenciais reais (gitignored, você cria localmente)
        ├── supabaseClient.js     → Cliente único do Supabase
        ├── state.js               → Estado em memória da sessão atual
        ├── main.js                → Ponto de entrada: registra as ações usadas pelo HTML
        └── modules/               → Toda a lógica, dividida por assunto
            ├── ui.js                (toast, janelas, navegação, sistema de ações data-click)
            ├── swipe.js             (arrasto lateral entre telas)
            ├── lixeira.js           (lixeira de 30 dias)
            ├── charts.js            (gráfico de pizza e de linha)
            ├── constants.js         (listas de opções compartilhadas)
            ├── data.js              (Supabase: leitura paginada, carregamento em 2 fases, RPC)
            ├── animalRow.js         (template de uma linha de animal em lista)
            ├── auth.js              (login/cadastro/logout/troca de senha)
            ├── profile.js           (nome e foto de perfil)
            ├── fotos.js             (fotos dos animais — Supabase Storage)
            ├── lotes.js / animais.js / rebanho.js / baixas.js
            ├── touros.js / inseminacao.js
            ├── medicacao.js / alimentacao.js
            ├── dashboard.js         (Início: gráfico, alertas, painel do sítio)
            ├── relatorios.js        (Excel/CSV e PDF pela impressão do navegador)
            └── help.js              (botão "?" de ajuda por página)
```

---

## ☁️ Configurar o Supabase (uma vez só)

1. Crie um projeto em [supabase.com](https://supabase.com).
2. No painel do projeto, abra **SQL Editor** → **New query**, cole todo o conteúdo de
   [`supabase/schema.sql`](supabase/schema.sql) e clique em **Run**. Isso cria todas as
   tabelas, ativa a segurança por usuário (Row Level Security) e cria os buckets de fotos
   (`avatars` e `animal-photos`) já com as políticas de acesso.
3. Em **Authentication → Providers → Email**, recomenda-se **desativar "Confirm email"**
   (assim quem se cadastra já entra na hora — é uma ferramenta interna da propriedade, não
   um produto público). Se preferir manter a confirmação por e-mail, também funciona.
4. Em **Project Settings → API**, copie a **Project URL** e a **anon public key** — vai
   precisar delas no passo seguinte e na configuração da Vercel.

### Atualizar um banco já existente

Quando uma versão nova trouxer um arquivo em [`supabase/migrations/`](supabase/migrations/),
rode esse arquivo (uma vez) no **SQL Editor** do Supabase. Os scripts usam `if not exists` e
podem ser executados de novo sem problema.

| Versão | Arquivo | O que faz |
|---|---|---|
| 4.2.0 | `20261117_animais_campos_extras.sql` | Campos novos do animal: brinco, registro, pelagem, observações e dados de compra |
| 4.4.0 | `20261124_v44_integridade_lixeira.sql` | Mãe/pai ligados pelo ID, lixeira de 30 dias, nº do animal único e gravações atômicas (tudo ou nada) |

Sem as migrações o app **continua funcionando** (com o comportamento anterior) e avisa
quando um recurso depende delas.

---

## 🛠️ Desenvolvimento e teste local

```bash
# 1) Copie o modelo de configuração e preencha com as credenciais do seu projeto Supabase
cp assets/js/config.example.js assets/js/config.js
# edite assets/js/config.js com SUPABASE_URL e SUPABASE_ANON_KEY

# 2) Suba um servidor estático (o app usa ES Modules + Service Worker, não abra por file://)
npx serve .
# ou: python -m http.server 8000
```

Depois acesse a URL indicada pelo servidor, crie uma conta pela aba **Cadastrar** e teste as
telas normalmente.

### Testes automatizados

Os testes abrem o app num navegador sem janela, em tamanho de celular, com um **Supabase
falso em memória** (não tocam no banco real). Cobrem cadastro, rebanho, inseminação,
medicação, alimentação, relatórios, lixeira, arrasto lateral, banco sem migração e a
política de segurança.

```bash
pip install -r tests/requirements.txt
python -m playwright install chromium   # na 1ª vez (ou usa o Chrome instalado)
python tests/run_all.py                 # todas as suítes
python tests/farm.py perf               # medição de desempenho (celular lento simulado)
```

A cada `git push`, o GitHub Actions roda a mesma suíte (aba **Actions** do repositório).

---

## 🚀 Publicar (GitHub + Vercel)

1. Suba este repositório para o GitHub (se ainda não estiver lá).
2. Em [vercel.com](https://vercel.com), **Add New → Project** e importe o repositório.
   Como não há framework (é HTML/CSS/JS puro), a Vercel detecta como projeto estático —
   não precisa mexer em nada além do próximo passo.
3. Em **Project Settings → Environment Variables**, adicione:
   - `SUPABASE_URL` = a Project URL do seu projeto Supabase
   - `SUPABASE_ANON_KEY` = a anon public key do seu projeto Supabase

   (Esses dois valores são **públicos por design** — a proteção real dos dados vem das
   políticas de Row Level Security do `schema.sql`, não do sigilo dessas chaves.)
4. Clique em **Deploy**. O `vercel.json` já está configurado para rodar
   `node scripts/generate-config.js` no build, que gera `assets/js/config.js` a partir
   dessas variáveis — você não precisa (e não deve) commitar esse arquivo.

Depois do primeiro deploy, todo novo `git push` na branch publicada atualiza o site
automaticamente.

---

## 🔄 Como lançar uma nova versão

Sempre que alterar o app e quiser publicar:

1. Faça as alterações e commit/push (a Vercel publica sozinha).
2. **Aumente o número da versão em `version.js`** (é o único lugar: o app e o service
   worker leem dali).

Mudar a versão troca o nome do cache do service worker, então quem já tem o app aberto
recebe o aviso **"Nova versão disponível → Atualizar"**.

---

## 📲 Como instalar o app (PWA)

**Android (Chrome):** abra o site → aparece o banner **"Instalar FARM"** → toque em *Instalar*.
Ou menu **⋮ → Instalar aplicativo / Adicionar à tela inicial**.

**iPhone/iPad (Safari):** toque no botão **Compartilhar** (□↑) → **Adicionar à Tela de Início**.

**Computador (Chrome/Edge):** clique no ícone de instalação (⊕) na barra de endereço,
ou menu **⋮ → Instalar FARM**.

---

## 🔐 Segurança dos dados

Cada usuário só enxerga os próprios dados — isso é garantido pelas políticas de **Row Level
Security** do Postgres (`supabase/schema.sql`), aplicadas no banco, não apenas na tela.
As fotos ficam em buckets privados do Supabase Storage, também restritos por usuário.

O app tem uma **política de segurança de conteúdo (CSP)**: só roda scripts do próprio site e
da CDN do Supabase, e o HTML não tem código inline (`onclick`) — os botões usam
`data-click` e as ações ficam registradas no `main.js`.
