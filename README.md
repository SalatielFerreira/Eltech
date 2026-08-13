# 🐄 ELTECH — Gestão Pecuária

Aplicativo web (PWA) para gestão de gado leiteiro: controle de **rebanho**, **inseminação**,
**medicação**, **alimentação** e geração de **relatórios** (Excel/CSV e HTML).

Os dados ficam salvos na nuvem (**Supabase**: banco de dados + autenticação + fotos), então
funcionam em qualquer aparelho em que você entrar com seu e-mail e senha. O app pode ser
**instalado** no celular ou computador como um aplicativo normal (PWA).

> ⚠️ Esta versão precisa de **internet** para ler/gravar dados (não funciona 100% offline
> como a versão anterior, que guardava tudo só no navegador).

---

## 📁 Estrutura do projeto

```
ELTECH/
├── index.html                  → Página principal (HTML das telas e modais)
├── manifest.json                → Configuração do app instalável (PWA)
├── sw.js                        → Service worker (cache do app-shell + auto-atualização)
├── version.json                 → Versão atual do app
├── vercel.json                  → Gera assets/js/config.js no deploy da Vercel
├── scripts/
│   └── generate-config.js       → Lê as Environment Variables da Vercel e gera config.js
├── supabase/
│   └── schema.sql                → Schema completo do banco (tabelas, RLS, buckets de fotos)
├── .nojekyll / .gitignore / README.md / CHANGELOG.md
└── assets/
    ├── css/styles.css           → Todo o visual (estilos)
    ├── img/                      → Ícones e imagem de fundo
    └── js/
        ├── config.example.js    → Modelo das credenciais do Supabase (copie -> config.js)
        ├── config.js             → Suas credenciais reais (gitignored, você cria localmente)
        ├── supabaseClient.js     → Cliente único do Supabase
        ├── state.js               → Estado em memória da sessão atual
        ├── main.js                → Ponto de entrada (é o único <script> carregado pelo HTML)
        └── modules/               → Toda a lógica, dividida por assunto
            ├── ui.js                (toast, modais, confirmação, navegação)
            ├── charts.js            (gráfico de pizza e de linha)
            ├── constants.js         (listas de opções compartilhadas)
            ├── data.js              (acesso ao Supabase + helpers de leitura)
            ├── animalRow.js         (template de uma linha de animal em lista)
            ├── auth.js              (login/cadastro/logout/troca de senha)
            ├── profile.js           (nome e foto de perfil)
            ├── fotos.js             (fotos dos animais — Supabase Storage)
            ├── lotes.js / animais.js / rebanho.js / baixas.js
            ├── touros.js / inseminacao.js
            ├── medicacao.js / alimentacao.js
            ├── dashboard.js         (Início: gráfico, alertas, painel do sítio)
            ├── relatorios.js        (exportação em CSV/HTML)
            ├── help.js              (botão "?" de ajuda por página)
            └── backup.js            (exportar backup + importar backup de versão antiga)
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
telas normalmente. Se você já tinha dados na versão anterior do ELTECH (guardados no
navegador), veja a seção **Trazer dados da versão anterior** abaixo.

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
2. **Aumente o número da versão em 3 lugares** (mantenha os três iguais):
   - `version.json` → campo `"version"`
   - `sw.js` → constante `VERSION`
   - `assets/js/main.js` → constante `APP_VERSION`

Mudar a versão troca o nome do cache do service worker, então quem já tem o app aberto
recebe o aviso **"Nova versão disponível → Atualizar"**.

---

## 📲 Como instalar o app (PWA)

**Android (Chrome):** abra o site → aparece o banner **"Instalar ELTECH"** → toque em *Instalar*.
Ou menu **⋮ → Instalar aplicativo / Adicionar à tela inicial**.

**iPhone/iPad (Safari):** toque no botão **Compartilhar** (□↑) → **Adicionar à Tela de Início**.

**Computador (Chrome/Edge):** clique no ícone de instalação (⊕) na barra de endereço,
ou menu **⋮ → Instalar ELTECH**.

---

## 💾 Backup e dados de versões anteriores

Dentro do app, em **Configurações**:
- **Exportar backup** → salva um arquivo `.json` com uma cópia de segurança dos seus dados.
- **Importar backup antigo** → traz os dados de uma exportação feita pela **versão anterior**
  do ELTECH (a que guardava tudo só no navegador do aparelho) para dentro da sua conta atual
  na nuvem. Os dados são **adicionados**, não substituem o que já existe.
- **Importar fotos antigas** → depois de importar o backup antigo (na mesma sessão), importe
  também o arquivo de fotos exportado da versão anterior, se tiver um.

> Se você é o usuário original do ELTECH (dados salvos no navegador antes desta migração):
> abra a versão antiga do app, use **Configurações → Exportar backup** (e, se tiver fotos
> de animais cadastradas, **Exportar fotos** também) antes de trocar para esta versão —
> assim você pode trazer tudo para a nuvem através do fluxo acima.

---

## 🔐 Segurança dos dados

Cada usuário só enxerga os próprios dados — isso é garantido pelas políticas de **Row Level
Security** do Postgres (`supabase/schema.sql`), aplicadas no banco, não apenas na tela.
As fotos ficam em buckets privados do Supabase Storage, também restritos por usuário.
