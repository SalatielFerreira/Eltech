// ========== AJUDA / INSTRUÇÕES POR PÁGINA ==========
import { openModal } from './ui.js';

const HELP = {
  pageHome: { t: 'Início', items: [
    'No topo, a saudação com o <b>total de animais, lotes e leite/dia</b>.',
    'Os <b>atalhos</b> (Animal, Inseminação, Medicação, Alimentação) já abrem o formulário certo.',
    '<b>Painel da fazenda</b>: taxa de prenhez (anel), vacas em lactação, média de leite por vaca, animais em tratamento e custo de ração.',
    '🔔 <b>Alertas</b> em ordem de urgência: carência de leite/carne, parto próximo, hora de secar a vaca e diagnóstico de prenhez. Toque no alerta para abrir a ficha do animal.',
    '📊 <b>Visão do rebanho</b>: escolha como dividir (categoria, situação, lote, raça...) e veja o gráfico com a legenda em barras.',
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
    'No topo: inseminações dos últimos 30 dias, quantas aguardam diagnóstico, prenhas confirmadas e taxa de concepção.',
    'Botões do topo: <b>🐂 Touros</b> (cadastro de touros/sêmen), <b>📁 Nova planilha</b> e <b>+ Nova inseminação</b> (dá para escolher várias vacas de uma vez).',
    'Cada planilha mostra uma barra com prenhas (verde), vazias (vermelho) e aguardando (cinza).',
    'Dentro da planilha, filtre por <b>Aguardando / Prenhas / Vazias</b>. Use <b>Dar diagnóstico</b> para registrar o resultado: a situação do animal no rebanho é atualizada.',
    'Toque no registro (ou no ⋮) para diagnóstico, ver ficha do animal, editar ou excluir.',
  ] },
  pageMedicacao: { t: 'Medicação', items: [
    'No topo: tratamentos em andamento, registros em carência e animais tratados.',
    'Use o filtro <b>Todas / Ativas / Encerradas</b> e a busca por animal ou medicamento.',
    'Cada registro mostra a situação (em andamento, em carência, encerrada) e quando o <b>leite</b> e a <b>carne</b> ficam liberados.',
    '<b>+</b> registra para um <b>lote inteiro</b> (marque/desmarque animais) ou <b>animais escolhidos</b>. Ao informar a carência, o app mostra a data de liberação.',
    'Pelo ⋮: editar, <b>repetir</b> (nova aplicação hoje, ótima para reforço de vacina) ou excluir.',
  ] },
  pageAlimentacao: { t: 'Alimentação', items: [
    'No topo: custo total, custo médio por animal, número de registros e de animais.',
    '<b>Custo por ingrediente</b> mostra para onde está indo o dinheiro da alimentação.',
    '<b>+</b> registra uma dieta: escolha os ingredientes, informe R$/kg e kg por animal, e os animais (lote inteiro ou escolhidos). O custo é calculado na hora.',
    'Pelo ⋮: editar, <b>repetir</b> (novo registro igual) ou excluir.',
  ] },
  pageRelatorios: { t: 'Relatórios', items: [
    '<b>1.</b> Escolha as fontes: lotes do rebanho, planilhas de inseminação, medicação e alimentação (ou Selecionar todos).',
    '<b>2.</b> Filtre o rebanho por sexo, categoria, situação e inseminadas.',
    '<b>3.</b> Escolha as colunas que aparecem para cada animal.',
    '<b>4.</b> Baixe em <b>PDF</b> (para imprimir) ou <b>Excel</b> (planilha). O resumo mostra quantos registros vão sair.',
  ] },
  pageConfig: { t: 'Configurações', items: [
    'Toque na <b>foto</b> ou no <b>nome</b> para alterar seu perfil.',
    '<b>Alterar senha</b>: abra o item, informe a senha atual e a nova.',
    '<b>Atualizar dados</b>: traz o que foi alterado em outro aparelho sem precisar sair do app.',
    '☁️ Seus dados ficam na nuvem: em outro aparelho, é só entrar com o mesmo e-mail e senha.',
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
