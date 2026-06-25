# Histórico de versões

O formato segue, de forma simplificada, o [Versionamento Semântico](https://semver.org/lang/pt-BR/).

## [3.1.0] — 2026-06-25

### Segurança e usabilidade

- **Senha criptografada (SHA-256):** a senha deixou de ser salva em texto puro — agora é
  armazenada como hash irreversível (Web Crypto). Login e troca de senha comparam o hash.
  Contas já existentes são **migradas automaticamente** no primeiro login.
- **Proteção contra XSS / quebra de layout:** todos os textos digitados (nomes de animais,
  lotes, touros, observações, medicamentos etc.) passam por `esc()` antes de irem para a tela.
  Removidos os `onclick` que embutiam nomes (lotes e planilhas) — substituídos por funções seguras.
- **Manter conectado:** novo campo no login. Quando marcado, o app entra direto na próxima
  abertura, sem pedir senha de novo. Ao sair (logout), a sessão é encerrada.

## [3.0.0] — 2026-06-25

### Reestruturação profissional do projeto

- **Separação de arquivos**: CSS movido para `assets/css/styles.css` e JavaScript para
  `assets/js/app.js`; imagens organizadas em `assets/img/`. O `index.html` agora contém apenas o HTML.
- **Compatibilidade com GitHub Pages**: todos os caminhos passaram a ser **relativos**
  (`manifest.json` e `sw.js`), corrigindo o funcionamento em repositórios de projeto
  (`usuario.github.io/eltech/`).
- **Auto-atualização**: novo service worker *network-first* — sempre busca a versão mais
  nova quando online e funciona offline como fallback. Adicionado aviso
  **"Nova versão disponível"** com recarregamento automático ao atualizar.
- **Arquivos de apoio**: adicionados `README.md`, `CHANGELOG.md`, `version.json`,
  `.gitignore` e `.nojekyll`.
- **Manifest aprimorado**: ícones `any` e `maskable` separados, `scope`/`start_url` relativos,
  idioma e categorias definidos.

### Funcionalidades existentes (mantidas)

- Login/cadastro local, gestão de rebanho por lotes, inseminação, medicação, alimentação
  com custos, relatórios em Excel/CSV e HTML, e backup/restauração de dados.
