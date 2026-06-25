# Histórico de versões

O formato segue, de forma simplificada, o [Versionamento Semântico](https://semver.org/lang/pt-BR/).

## [3.4.2] — 2026-06-25

### Correções

- **Aviso de backup:** não aparece mais na primeira abertura (onde se sobrepunha ao banner
  de instalar o app). Agora surge somente após **30 alterações** desde o último backup.

## [3.4.0] — 2026-06-25

### Ajustes de visual

- **Botões sólidos e fortes:** os botões deixaram de usar degradê e passaram a ter cor
  cheia e vibrante (verde, vermelho e azul conforme a função), com melhor contraste.
- **Quadros mais escuros e foscos:** cards, painéis, modais, listas e barras passaram de
  vidro branco translúcido para **vidro verde-escuro mais opaco**, deixando o conteúdo
  muito mais legível.

## [3.3.0] — 2026-06-25

### Sistema integrado — o animal no centro de tudo

- **Ficha do Animal 360°:** tocar em um animal (ou no botão de perfil) abre tudo sobre ele
  numa tela só — dados, **genealogia clicável** (mãe, pai e filhos, navegando pela família),
  reprodução (inseminações, parto previsto, último parto), medicações (com carência),
  alimentação com **custo de ração acumulado**, gráficos de leite e peso, e **linha do tempo**
  com todos os eventos em ordem.
- **Vínculo por ID:** os registros de inseminação, medicação e alimentação passam a guardar o
  **id interno** do animal (além do número), mantendo as conexões corretas mesmo que o número
  seja alterado. Dados antigos continuam ligados pelo número (compatível).
- **Painel do Sítio (Home):** visão do conjunto — leite/dia total, vacas em lactação, taxa de
  prenhez, nº de prenhas, custo de ração e animais em tratamento.
- **Custo × retorno por vaca:** a Ficha mostra o custo de ração acumulado ao lado da produção
  atual de leite, ajudando a avaliar quais animais valem a pena.

## [3.2.0] — 2026-06-25

### Novos recursos (Etapa 1 — locais, sem dependência externa)

- **Lembrete de backup:** o app conta as alterações e mostra um aviso "Faça um backup"
  quando passam 7 dias ou 30 alterações desde o último. O botão "Baixar" exporta na hora
  e zera o contador.
- **Alertas de medicação e carência:** novos campos "carência leite (dias)" e
  "carência carne (dias)" no cadastro de medicação. O app avisa quais animais estão em
  tratamento e até quando **não** vender leite / abater (data de liberação calculada).
- **Calendário reprodutivo:** a partir da inseminação/prenhez, calcula o **parto previsto**
  (gestação de 283 dias) e avisa quando está próximo; lembra de fazer o **diagnóstico de
  prenhez** ~30 dias após a inseminação.
- **Histórico de leite e peso por animal:** botão de gráfico (📈) em cada animal abre a
  evolução da produção de leite e do peso ao longo do tempo. O histórico de leite é
  registrado automaticamente quando o campo "Leite" é alterado na edição.
- **Seção de Alertas na Home** reunindo medicação, carência e reprodução.

> Próxima etapa (planejada): backup automático no Google Drive.

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
