# Histórico de versões

O formato segue, de forma simplificada, o [Versionamento Semântico](https://semver.org/lang/pt-BR/).

## [4.1.1] — 2026-08-13

### Limite de 2MB por foto

- Fotos de animais e de perfil agora têm um teto garantido de **2MB** por arquivo. Se a
  compressão padrão já resultar em um arquivo menor (o caso comum), nada muda; se ainda
  assim ficar maior que 2MB, o app reduz a qualidade automaticamente (e, em último caso,
  também a resolução) até caber no limite, antes de enviar para o Supabase Storage.

## [4.1.0] — 2026-08-13

### Remove o quadro de Backup dos Dados

- Removido o quadro **Backup dos Dados** da tela de Configurações (exportar backup,
  importar backup antigo e importar fotos antigas) — com os dados já vivendo na nuvem via
  Supabase, deixou de fazer sentido como recurso permanente do app.
- Removido o módulo `assets/js/modules/backup.js` (sem uso após a remoção da tela) e o
  código morto associado (CSS `.backup-section`, campo `lastImportAnimalMap` do estado).

## [4.0.0] — 2026-08-13

### Migração para Supabase + Vercel

- **Dados na nuvem:** o app deixou de guardar tudo em `localStorage`/IndexedDB do aparelho
  e passou a usar **Supabase** (Postgres + Auth + Storage). Os mesmos dados agora aparecem
  em qualquer aparelho ao entrar com o mesmo e-mail e senha.
- **Login por e-mail:** a autenticação caseira (senha em hash local, múltiplas contas no
  mesmo navegador) foi substituída pelo Supabase Auth. O login passou a ser só por e-mail
  (antes aceitava e-mail ou nome) e a sessão fica conectada automaticamente — o campo
  "Manter conectado" não existe mais por ser redundante.
- **Fotos na nuvem:** fotos de animais e de perfil, antes guardadas em IndexedDB local,
  agora ficam em buckets privados do Supabase Storage — não é mais preciso exportar/importar
  fotos manualmente ao trocar de aparelho.
- **Importar dados antigos:** novo fluxo em Configurações — **Importar backup antigo** (e
  **Importar fotos antigas**) traz os dados de uma exportação feita pela versão anterior do
  app para dentro da conta atual na nuvem.
- **Reestruturação do código:** o antigo `assets/js/app.js` (arquivo único) foi dividido em
  ~20 módulos ES por assunto (`assets/js/modules/`), sem alterar nenhuma tela do `index.html`.
  Código morto foi removido (autenticação caseira, IndexedDB de fotos, lembrete de backup por
  contagem de alterações, funções sem nenhuma chamada no app).
- **Publicação via Vercel:** o app estático passa a ser publicado pela Vercel a partir do
  GitHub (`vercel.json` + `scripts/generate-config.js`), além de continuar compatível com
  GitHub Pages. Veja o `README.md` para o passo a passo completo.
- **Sem modo offline nesta versão:** como os dados vivem no Supabase, o app agora exige
  internet para ler/gravar (o app-shell continua instalável e abre offline, mas mostra um
  aviso e bloqueia edição sem conexão).

## [3.9.0] — 2026-07-13

### Enviar backup (compartilhar)

- Novos botões **"Enviar backup"** e **"Enviar fotos"** em Configurações: abrem o menu de
  compartilhar do celular, permitindo salvar direto no **Google Drive**, WhatsApp, e-mail etc.
  com um toque — **sem nenhuma configuração**.
- Em aparelhos que não suportam compartilhar arquivos (ex.: alguns computadores), o botão
  automaticamente **baixa** o arquivo como alternativa.

## [3.8.0] — 2026-06-26

### Foto dos animais

- Novo campo de **foto** no cadastro do animal (no celular abre direto a **câmera**).
- As fotos são **comprimidas automaticamente** e guardadas em um banco próprio do aparelho
  (**IndexedDB**), feito para aguentar **muitas fotos** sem encher o armazenamento.
- A foto aparece como **miniatura na lista** de animais e em **tamanho grande na Ficha 360°**.
- Em Configurações: **Exportar fotos / Importar fotos** (as fotos ficam à parte do backup
  normal, então use esses botões ao trocar de aparelho).
- Removido o emoji 🏡 do título "Painel do Sítio".

## [3.7.0] — 2026-06-26

### Botão de ajuda (instruções por página)

- Novo botão **?** (círculo bege) na barra superior, no canto direito. Ao tocar, mostra
  **o que dá para fazer na página atual** — instruções específicas de Início, Rebanho,
  Inseminação, Medicação, Alimentação, Relatórios e Configurações.
- Removidos os textos de instrução das telas (ex.: "Toque no 📁 para criar um lote.");
  os estados vazios agora mostram só "Nenhum lote criado.", "Nenhum animal neste lote." etc.

## [3.6.5] — 2026-06-26

### Cor

- Marrom dos textos (títulos, saudação, estados vazios) trocado para o tom escolhido `#4A4135`.

## [3.6.4] — 2026-06-25

### Mais ajustes de cor

- Botões **Editar** e **Salvar** (e os botões principais em geral) agora em **verde**.
- Botão **Voltar** agora **sólido amarelo**.
- Mantido o padrão: mesmo verde, mesmo azul, mesmo amarelo e mesmo marrom em todo o app.

## [3.6.3] — 2026-06-25

### Ajustes de cor

- **Marrom mais escuro** nos títulos e na saudação.
- Os textos de **estado vazio** (ex.: "Nenhum lote criado…") em todas as páginas também
  passaram a usar o mesmo marrom.

## [3.6.2] — 2026-06-25

### Ajustes de cores

- **Saudação e data na Home** e **títulos das páginas** (Rebanho, Inseminação, Medicação,
  Alimentação) agora em **marrom/bege**.
- **Botões de adicionar** (Novo Lote, Nova Planilha, Adicionar Animal/Medicação/Alimentação)
  em **verde** (o mesmo verde do gráfico de pizza).
- **Relatório:** botão **PDF azul** e **Excel verde**. **Backup:** **Exportar azul** e **Importar verde**.
- Padronizado: o mesmo verde, o mesmo azul e o mesmo marrom em todo o app.

## [3.6.0] — 2026-06-25

### Tema bege escuro

- A cor do tema mudou de **verde** para **bege escuro** em todo o app: botões, bordas,
  destaques, textos, quadros, relatório gerado e a cor do tema do PWA (barra do sistema).
- Os quadros continuam escuros e foscos, agora em tom **marrom/bege** quente.
- Cores funcionais (vermelho de excluir, azul de abrir) e as cores dos gráficos foram mantidas.

## [3.5.0] — 2026-06-25

### Múltiplas contas na mesma máquina

- Agora é possível **cadastrar e manter várias contas** no mesmo navegador, cada uma com
  seus **próprios dados** (lotes, animais, inseminação, medicação, alimentação). Antes o
  cadastro bloqueava criar uma segunda conta.
- Para **trocar de conta**: sair (logout) e entrar com o outro usuário. O app lembra a
  última conta usada (com "Manter conectado").
- O cadastro agora bloqueia apenas **emails repetidos** (não mais "já existe uma conta").
- **Migração automática:** a conta única que já existia é convertida para o novo formato
  sem perder nenhum dado; senha em texto puro vira hash no primeiro login.
- Importar backup substitui os dados **apenas da conta atual**.

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
