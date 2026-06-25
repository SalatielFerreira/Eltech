# 🐄 ELTECH — Gestão Pecuária

Aplicativo web (PWA) para gestão de gado leiteiro: controle de **rebanho**, **inseminação**,
**medicação**, **alimentação** e geração de **relatórios** (Excel/CSV e HTML).

Funciona direto no navegador, pode ser **instalado como app** no celular ou computador e
**funciona offline**. Todos os dados ficam salvos no próprio aparelho (localStorage).

---

## 📁 Estrutura do projeto

```
ELTECH/
├── index.html              → Página principal (somente o HTML)
├── manifest.json           → Configuração do app instalável (PWA)
├── sw.js                   → Service worker (cache offline + auto-atualização)
├── version.json            → Versão atual do app
├── .nojekyll               → Faz o GitHub Pages servir os arquivos sem processar
├── .gitignore
├── README.md
├── CHANGELOG.md            → Histórico de versões
└── assets/
    ├── css/
    │   └── styles.css      → Todo o visual (estilos)
    ├── js/
    │   └── app.js          → Toda a lógica do aplicativo
    └── img/
        ├── icon-192.png    → Ícone do app
        ├── icon-512.png    → Ícone do app (alta resolução)
        └── fundo.png       → Imagem de fundo
```

---

## 🚀 Como publicar no GitHub Pages

1. Crie um repositório no GitHub (ex.: `eltech`) e envie todos os arquivos desta pasta.
2. No repositório, vá em **Settings → Pages**.
3. Em **Source**, escolha **Deploy from a branch**.
4. Em **Branch**, selecione **`main`** e a pasta **`/ (root)`**. Clique em **Save**.
5. Aguarde ~1 minuto. O app ficará disponível em:
   `https://SEU-USUARIO.github.io/eltech/`

> ✅ Todos os caminhos do projeto são **relativos**, então funciona tanto em
> `usuario.github.io/eltech/` quanto em um domínio próprio, sem ajustes.

---

## 🔄 Como atualizar o app (e garantir que todos recebam a nova versão)

Sempre que você alterar o app e quiser publicar a nova versão:

1. Faça suas alterações nos arquivos.
2. **Aumente o número da versão em 3 lugares** (mantenha os três iguais):
   - `version.json` → campo `"version"`
   - `sw.js` → constante `VERSION`
   - `assets/js/app.js` → constante `APP_VERSION`
3. Envie (commit + push) para o GitHub.

O que acontece automaticamente:
- Quem abrir o app **com internet** já recebe a versão nova na hora (estratégia *network-first*).
- Quem estiver com o app aberto vê o aviso **"Nova versão disponível → Atualizar"**.
  Ao tocar em **Atualizar**, o app recarrega já na versão nova.
- **Sem internet**, o app continua funcionando com a última versão salva (offline).

> 💡 Dica: mesmo se esquecer de mudar a versão, quem estiver online normalmente já
> recebe os arquivos novos. Mudar a versão garante o aviso de atualização e a limpeza
> do cache antigo.

---

## 📲 Como instalar o app (PWA)

**Android (Chrome):** abra o site → aparece o banner **"Instalar ELTECH"** → toque em *Instalar*.
Ou menu **⋮ → Instalar aplicativo / Adicionar à tela inicial**.

**iPhone/iPad (Safari):** toque no botão **Compartilhar** (□↑) → **Adicionar à Tela de Início**.

**Computador (Chrome/Edge):** clique no ícone de instalação (⊕) na barra de endereço,
ou menu **⋮ → Instalar ELTECH**.

Depois de instalado, o ELTECH abre como um aplicativo normal, em tela cheia e offline.

---

## 💾 Backup dos dados

Os dados ficam salvos **apenas no aparelho**. Dentro do app, em **Configurações**, use:
- **Exportar backup** → salva um arquivo `.json` com tudo.
- **Importar backup** → restaura os dados a partir desse arquivo.

> Faça backup antes de trocar de celular ou limpar os dados do navegador.

---

## 🛠️ Desenvolvimento local

Por usar service worker, abra com um servidor local (não dê duplo-clique no arquivo):

```bash
# Python
python -m http.server 8000

# ou Node
npx serve
```

Depois acesse `http://localhost:8000`.
