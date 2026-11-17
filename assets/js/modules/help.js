// ========== AJUDA / INSTRUÇÕES POR PÁGINA ==========
import { openModal } from './ui.js';

const HELP = {
  pageHome: { t: 'Início', items: [
    'Aqui você vê a saudação e a data do dia.',
    '🔔 <b>Alertas</b>: medicação em andamento, carência de leite/carne (até quando NÃO vender o leite ou abater), <b>hora de secar a vaca</b> (~60 dias antes do parto), parto previsto e lembrete de diagnóstico de prenhez.',
    '🏡 <b>Painel do Sítio</b>: total de leite por dia, vacas em lactação, taxa de prenhez, nº de prenhas, custo de ração e animais em tratamento.',
    '📊 <b>Gráfico do rebanho</b>: toque nos filtros (Categoria, Sexo, Situação, Raça, Lote, Medicado, Inseminado, Origem) para ver a divisão do rebanho.',
  ] },
  pageRebanho: { t: 'Rebanho', items: [
    'No topo aparece o <b>resumo do rebanho</b> (fêmeas, machos, em lactação, prenhas e leite/dia) e, embaixo, a <b>composição por categoria</b>.',
    'Use o botão verde <b>+</b> para cadastrar um animal. Os atalhos levam a <b>Todos os animais</b>, <b>Lotes</b> e <b>Baixas</b>.',
    '<b>Todos os animais</b>: busque por nº, nome ou brinco. O botão de funil filtra por sexo, categoria, situação e lote, e ordena (nº, nome, leite, idade).',
    'Toque no animal para abrir a <b>ficha completa</b>. O botão <b>⋮</b> abre as ações: ver ficha, editar, <b>dar baixa</b> (venda ou morte) e excluir.',
    '<b>Lotes</b>: crie lotes, reordene com ↑ ↓ e use <b>⋮</b> para renomear ou excluir. Dentro do lote aparecem os números do grupo (fêmeas, lactação, leite/dia, prenhas).',
    '<b>Cadastro do animal</b>: preencha por seções (identificação, classificação, origem, produção). O app sugere o próximo nº livre, calcula idade, DEL e parto previsto, e avisa se algo estiver errado antes de salvar.',
    'Use <b>Salvar e próximo</b> para cadastrar vários animais em sequência: lote, sexo, categoria, origem e raça ficam preenchidos.',
    '<b>Baixas</b>: vendas e mortes, com total vendido. Pelo <b>⋮</b> dá para restaurar o animal ao rebanho ou excluir o registro.',
  ] },
  pageInseminacao: { t: 'Inseminação', items: [
    '➕ <b>Nova planilha</b> de inseminação (ex.: por mês ou por touro).',
    '➕ <b>Adicionar inseminação</b>: animal, data, tempo, touro, muco e observações (pode vários animais de uma vez).',
    '☰ <b>Lista de Touros</b> (3º botão): cadastre nome, raça, grau de sangue e nº de registro. Esses touros aparecem no campo Touro e no "Pai" do animal.',
    '🟡 <b>Parecer</b> (botão amarelo): registre o diagnóstico da vaca inseminada — Prenha, Vazia, Vazia Cloe, Vazia Clod, Anestro ou Cio. A situação é atualizada no rebanho; se for <b>Prenha</b>, o parto previsto é calculado a partir da data da inseminação.',
    'Toque na planilha para abrir; editar ✏️ ou excluir 🗑️ cada registro.',
    'As inseminações alimentam o <b>calendário reprodutivo</b> (parto previsto e diagnóstico) na tela Início.',
  ] },
  pageMedicacao: { t: 'Medicação', items: [
    '➕ Registrar medicação para um <b>lote inteiro</b> ou <b>animais individuais</b>.',
    'Escolha o tipo (vacina, vermífugo, tratamento), os medicamentos e doses, e as datas (início/fim).',
    'Informe a <b>carência de leite</b> e de <b>carne</b> (em dias) — o app avisa até quando não vender o leite / não abater.',
    'Editar ✏️ ou excluir 🗑️ os registros.',
  ] },
  pageAlimentacao: { t: 'Alimentação', items: [
    '➕ Registrar alimentação para um <b>lote</b> ou <b>animais individuais</b>.',
    'Escolha as dietas, o consumo (kg por animal) e o valor por kg — o <b>custo é calculado automaticamente</b>.',
    'Veja o custo total e por dieta.',
    'Editar ✏️ ou excluir 🗑️ os registros.',
  ] },
  pageRelatorios: { t: 'Relatórios', items: [
    'Selecione as <b>fontes</b> (lotes, inseminação, medicação, alimentação) — ou use <b>Selecionar todos</b> para marcar tudo de uma vez.',
    'Aplique <b>filtros</b> (categoria, sexo, situação, inseminadas) e escolha os <b>campos</b> do relatório.',
    'Baixe em <b>PDF</b> (azul) ou <b>Excel</b> (verde). Os lotes saem em ordem alfabética e os animais em ordem crescente de número.',
  ] },
  pageConfig: { t: 'Configurações', items: [
    'Edite seu <b>nome</b> e a <b>foto</b> de perfil.',
    'Troque a sua <b>senha</b>.',
    '☁️ Seus dados e as fotos dos animais ficam salvos na nuvem (Supabase) — abrindo em outro aparelho, é só entrar com o mesmo e-mail e senha.',
    'Sair da conta (botão vermelho).',
  ] },
};

export function openHelp() {
  const pg = document.querySelector('.page.active');
  const id = pg ? pg.id : 'pageHome';
  const h = HELP[id] || HELP.pageHome;
  document.getElementById('helpTitle').textContent = 'Ajuda — ' + h.t;
  document.getElementById('helpContent').innerHTML = '<div class="card-sub" style="margin-bottom:12px;color:var(--text2)">O que você pode fazer nesta página:</div>' +
    h.items.map(i => `<div class="card glass3" style="margin-bottom:8px;display:flex;gap:10px;align-items:flex-start"><span style="color:var(--green);font-weight:800;flex-shrink:0">•</span><div style="font-size:.82rem;line-height:1.5;color:var(--text)">${i}</div></div>`).join('');
  openModal('helpModal');
}
