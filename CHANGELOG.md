# Histórico de versões

O formato segue, de forma simplificada, o [Versionamento Semântico](https://semver.org/lang/pt-BR/).

## [4.4.0] — 2026-11-24

### Troca de tela arrastando o dedo

- **Arraste para os lados** para ir à aba vizinha (mesma ordem da barra inferior): a tela
  seguinte entra junto com o dedo, com resistência "elástica" nas pontas e aceitação de
  gesto rápido. Dentro de uma sub-tela (lote, todos os animais, planilha), arrastar para a
  direita **volta**. O arrasto não atrapalha a rolagem vertical, os campos, os filtros
  roláveis nem os gestos de borda do sistema.
- Ao tocar nas abas, a tela agora **desliza da direção certa** (aba à direita entra pela
  direita).
- **Tela de abertura** com a marca enquanto a sessão é verificada (antes a tela de login
  aparecia por um instante para quem já estava logado).

### Dados mais seguros

- **Nada some com rebanho grande:** o Supabase devolve no máximo 1.000 linhas por consulta;
  agora o app busca **em páginas** (testado com 2.400 pesagens e com limite de servidor menor).
- **Carregamento em duas fases:** rebanho na hora; históricos, inseminação, medicação,
  alimentação e baixas chegam em segundo plano (com esqueleto animado enquanto isso).
- **Histórico completo de peso e leite** (antes guardava só as 5 últimas pesagens e os 20
  últimos registros de leite). Os gráficos da ficha mostram os 30 mais recentes.
- **Mãe e pai ligados pelo ID** do animal: renomear a mãe não quebra mais a família, e os
  cadastros antigos são ligados automaticamente pela migração.
- **Nº do animal único** também no banco (antes só o app conferia).
- **Gravações atômicas (tudo ou nada):** salvar medicação/alimentação, dar baixa, restaurar
  baixa e excluir lote acontecem numa transação só no banco — se a internet cair no meio,
  nada fica pela metade.
- **Lixeira de 30 dias** (Configurações → Lixeira): lotes (com os animais), animais,
  planilhas, medicações e alimentações excluídos podem ser **restaurados**; depois de 30
  dias são apagados de vez, com as fotos.
- Alertas, gráficos e relatórios identificam o animal pelo ID (o nº fica só para dados
  antigos).

### Desempenho e técnica

- **PDF de verdade:** o relatório abre a impressão do navegador ("Salvar como PDF"), com
  cabeçalho, tabelas em A4, cabeçalho repetido a cada página e nome de arquivo pronto.
- **Ícones** do app 75% menores (680 KB → 155 KB) e fora do carregamento da página.
- **Versão em um lugar só** (`version.js`), lida pelo app e pelo service worker.
- **Zoom liberado** (acessibilidade) e campos com 16 px no celular, para o iPhone não dar
  zoom sozinho ao tocar num campo; suporte às bordas de celulares com entalhe.
- **Sem código inline no HTML:** os ~190 `onclick`/`oninput`/`onchange` viraram
  `data-click`/`data-input`/`data-change` com ações registradas no `main.js`, o que permitiu
  uma **política de segurança (CSP)** que bloqueia scripts injetados.
- **Testes automatizados no repositório** (`tests/`, 141 verificações) e no **GitHub
  Actions** a cada push.

### ⚠️ Atualização do banco (uma vez)

Rode `supabase/migrations/20261124_v44_integridade_lixeira.sql` no SQL Editor do Supabase.
Sem ela o app continua funcionando como antes (exclusão definitiva, gravações em etapas,
mãe/pai pelo nome) e a Lixeira avisa que precisa da atualização.

## [4.3.0] — 2026-11-17

### Todas as telas redesenhadas no padrão do Rebanho

- **Início:** cartão de boas-vindas com saudação, data, total de animais, lotes e leite/dia;
  **atalhos** que já abrem o formulário (Animal, Inseminação, Medicação, Alimentação);
  **Painel da fazenda** com anel da taxa de prenhez, vacas em lactação, média de leite por
  vaca, animais em tratamento e custo de ração; **alertas por urgência** (resumo por tipo,
  5 visíveis + "ver todos", toque abre a ficha do animal) e gráfico em rosca com **legenda
  em barras** e porcentagens. Gráficos agora ficam nítidos em telas de alta resolução.
- **Inseminação:** indicadores (últimos 30 dias, aguardando diagnóstico, prenhas, taxa de
  concepção); planilhas com **barra de resultado** (prenhas/vazias/aguardando); dentro da
  planilha, filtro Todas/Aguardando/Prenhas/Vazias, aviso "Pronta p/ diagnóstico" após 28
  dias e botão **Dar diagnóstico**; diagnóstico em botões grandes (Prenha primeiro);
  formulário em seções, data já preenchida com hoje, muco em botões e escolha de várias
  vacas direto na lista.
- **Touros e sêmen:** janela nova com contagem de inseminações por touro e menu ⋮.
- **Medicação:** indicadores (em andamento, em carência, animais tratados); filtro
  Todas/Ativas/Encerradas; cada registro mostra a situação e **quando leite e carne ficam
  liberados**; formulário com tipo em botões, marcar/desmarcar todos do lote, dica da data de
  liberação e opção **Repetir** (nova aplicação hoje, útil para reforço de vacina).
- **Alimentação:** indicadores (custo total, por animal, registros, animais), **custo por
  ingrediente** em barras, cartões com custo em destaque, formulário com tabela de
  ingredientes e **resumo de custo ao vivo**; opção **Repetir** registro.
- **Relatórios:** em 4 passos (fontes agrupadas, filtros, colunas, baixar) com resumo ao
  vivo de quantos registros vão sair; botões grandes de PDF e Excel.
- **Configurações:** cartão de perfil com e-mail, "Alterar senha" recolhível, **Atualizar
  dados** (traz alterações feitas em outro aparelho) e Ajuda.
- **Barra inferior:** destaque da aba ativa.

### Correções

- Medicação começando hoje não aparecia como "em andamento" no Início no primeiro dia.
- Dias restantes de carência podiam diferir em 1 entre o Início e a Medicação.
- Na Alimentação, marcar um novo ingrediente apagava os valores já digitados nos outros.
- Editar uma alimentação mudava a data dela para o dia da edição.
- Editar uma inseminação trocando a planilha deixava o registro na planilha antiga na tela.
- O filtro do gráfico do Início desmarcava botões de outras telas.
- Janelas de Medicação e Alimentação abrem mais rápido (a lista de todos os animais só é
  montada ao escolher "Escolher animais").

## [4.2.0] — 2026-11-17

### Desempenho (telas e janelas mais leves)

- **Janelas abrem na hora:** as listas de seleção (animais, lotes, mãe/pai) eram montadas item
  por item, refazendo a lista inteira a cada animal. Com 400 animais num celular simulado
  (CPU 4x mais lenta), abrir **Adicionar Animal** caiu de **3,2 s → 0,1 s** e **Medicação** de
  **4,5 s → 0,1 s**.
- **Troca de páginas:** entrar no Rebanho caiu de **0,67 s → 0,03 s**; o app só desenha a
  lista que está aberta (antes desenhava as três, mesmo escondidas).
- **Listas longas** aparecem imediatamente (primeiros cartões na hora, o resto em partes) e
  usam `content-visibility` para não pintar o que está fora da tela.
- **Fotos das listas** são buscadas numa única chamada ao Storage (antes era uma por animal).
- **Visual mais leve para o celular:** removido o desfoque (`backdrop-filter`) de cartões,
  barras e janelas — era o efeito mais caro durante a rolagem; os quadros ficaram um pouco
  mais opacos para manter a leitura.
- **Imagem de fundo** trocada de PNG 4K (7,7 MB) para JPEG otimizado (255 KB).
- Carregamento inicial dos dados reorganizado (agrupamento por tabela em vez de varreduras
  repetidas).

### Rebanho redesenhado

- **Tela inicial:** resumo (fêmeas, machos, em lactação, prenhas, leite/dia), atalhos com
  descrição e **composição do rebanho por categoria**.
- **Cartões de animal** mais limpos: nº, nome, sexo, categoria, situação colorida (prenha,
  vazia, cio, anestro), lote, produção e dados reprodutivos (DEL, dias de prenhez, parto
  previsto, última inseminação).
- **Menu de ações (⋮)** no lugar dos três botões coloridos: ver ficha, editar, dar baixa e
  excluir. O mesmo padrão em lotes (abrir, adicionar animal, renomear, excluir) e baixas
  (restaurar, excluir).
- **Filtros** com contador de filtros ativos, filtro por **lote**, todas as situações
  (inclui Vazia Cloe, Vazia Clod e Cio) e **ordenação** (nº, nome, maior produção, idade).
  Busca também por **brinco**.
- **Lotes:** número de fêmeas/machos, animais em lactação, leite/dia e prenhas em cada lote.
- **Baixas:** total de vendas, valor vendido e mortes no topo.
- Cabeçalhos com botão voltar compacto e contadores; em telas largas a lista vira duas colunas.

### Cadastro de animal mais completo

- Formulário em seções: **Identificação**, **Classificação**, **Origem e genealogia**,
  **Produção e reprodução** e **Observações**.
- **Campos novos:** brinco/chip, registro genealógico, pelagem, observações e, para animais
  comprados, data da compra, valor pago e vendedor/procedência.
- **Sugestão do próximo nº livre** e aviso imediato de **nº já usado** (agora em todo o
  rebanho, não só no lote).
- **Cálculos automáticos:** idade, DEL (dias em lactação) e dias de prenhez com **parto previsto**.
- **Validação antes de salvar** com o campo destacado: datas futuras, parto antes do
  nascimento, prenhez acima de 300 dias, peso/leite fora da faixa, animal como a própria mãe.
- **Salvar e próximo:** cadastro em sequência mantendo lote, sexo, categoria, origem e raça.
- **Ficha do animal** com os dados novos e botões **Editar** e **Dar baixa**.
- Relatórios: novos campos Brinco, Registro, Pelagem e Obs.

### Correções

- Datas registradas pelo app (pesagem, leite, parecer, baixa) usavam o horário UTC e, depois
  das 21h, gravavam a data de amanhã. Agora usam a data local.
- Editar um animal sem mudar o peso/leite criava uma pesagem/registro de leite repetido.
- Ao cadastrar um animal nascido na fazenda, a mãe só é atualizada (último parto, lactação)
  se o nascimento for recente — cadastrar um animal antigo não altera mais a mãe.
- As setas de ordenar lotes usavam uma ordem diferente da exibida.

### ⚠️ Atualização do banco (uma vez)

Para gravar os campos novos, rode `supabase/migrations/20261117_animais_campos_extras.sql`
no SQL Editor do Supabase. Até lá o app continua funcionando e salvando os animais, só sem
os campos novos (e mostra um aviso).

## [4.1.2] — 2026-11-17

### App renomeado para FARM

- O nome do aplicativo passa a ser **FARM** (Eltech é o nome da empresa): título da página,
  barra superior, tela de login, nome do app instalado (PWA), avisos de instalação/atualização/
  sem internet, relatórios gerados (título e nome do arquivo `FARM_dd-mm-aaaa`) e documentação.
- Novo rodapé em **Configurações** com a versão do app: `FARM v4.1.2 · Eltech` — único ponto
  do app onde o nome da empresa aparece.
- O cache do service worker passou a se chamar `farm-v…` (o cache antigo `eltech-v…` é removido
  automaticamente na atualização).

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
