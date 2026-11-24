"""Testes funcionais: Início, Inseminação, Touros, Medicação, Alimentação, Relatórios, Config."""
from datetime import date
from playwright.sync_api import sync_playwright
from farm import open_app

results = []


def check(name, cond, detail=''):
    results.append((bool(cond), name, detail))


def db(page, t):
    return page.evaluate(f"window.__MOCKDB['{t}']")


def run():
    hoje = date.today().isoformat()
    with sync_playwright() as pw:
        app = open_app(pw, '?n=40'); page, errors = app.page, app.errors
        W = lambda ms=400: page.wait_for_timeout(ms)

        # ---------- Início ----------
        page.evaluate("FARM.goPage('pageHome')"); W()
        check('Início: saudação com nome', 'Salatiel' in page.inner_text('#homeHero'))
        check('Início: painel com taxa de prenhez', '%' in page.inner_text('#farmPanel'))
        n_al = page.locator('#homeAlerts .al-item').count()
        check('Início: alertas limitados a 5', n_al == 5, str(n_al))
        page.click('#homeAlerts .al-more'); W(200)
        check('Início: "Ver todos" expande alertas', page.locator('#homeAlerts .al-item').count() > 5)
        page.click('#chartFilters >> text=Lote'); W(200)
        check('Início: gráfico por lote', page.locator('#chartLegend .lg-row').count() == 6)
        page.click('.quick-actions >> text=Medicação'); W()
        check('Atalho abre Medicação com formulário', page.is_visible('#medAnimalModal') and page.is_visible('#pageMedicacao'))
        page.evaluate("FARM.closeModal('medAnimalModal')")

        # ---------- Inseminação ----------
        page.evaluate("FARM.goPage('pageInseminacao')"); W()
        check('Insem: KPIs aparecem', page.locator('#insemKpis .kpi').count() == 4)
        page.click('#insemList .head-actions .icon-btn >> nth=1'); W()
        page.fill('#planilhaNome', 'Dezembro'); page.click('#planilhaModal .btn-primary'); W(500)
        check('Insem: nova planilha criada', any(p['name'] == 'Dezembro' for p in db(page, 'inseminacao_planilhas')))
        page.click('#insemList .add-btn'); W()
        check('Insem: data vem com hoje', page.input_value('#insemData') == hoje)
        page.select_option('#insemPlanSelect', label='Dezembro')
        opts = page.evaluate("[...document.querySelectorAll('#insemAnimalSelect option')].slice(1,3).map(o=>o.value)")
        for v in opts:
            page.select_option('#insemAnimalSelect', v); W(100)
        check('Insem: escolher na lista adiciona chip', page.locator('#insemSelectedAnimals .pick-chip').count() == 2)
        page.fill('#insemTouro', 'Trovão')
        page.click('#segMuco button[data-v="Sujo"]')
        page.click('#insemAnimalModal .form-actions .btn-primary'); W(600)
        pid = [p for p in db(page, 'inseminacao_planilhas') if p['name'] == 'Dezembro'][0]['id']
        recs = [r for r in db(page, 'inseminacao_registros') if r['planilha_id'] == pid]
        check('Insem: 2 registros gravados', len(recs) == 2)
        check('Insem: muco e data gravados', all(r['muco'] == 'Sujo' and r['data'] == hoje for r in recs))
        page.evaluate(f"FARM.openInsemDetail('{pid}')"); W()
        check('Insem: detalhe lista 2', page.locator('#insemAnimals .rec-card').count() == 2)
        page.click('#insemAnimals .pill-btn >> nth=0'); W()
        check('Insem: diagnóstico abre com Prenha primeiro', page.inner_text('#parecerOptions .parecer-opt >> nth=0').startswith('✅') or 'Prenha' in page.inner_text('#parecerOptions .parecer-opt >> nth=0'))
        page.click('#parecerOptions >> text=Prenha'); W(600)
        r0 = [r for r in db(page, 'inseminacao_registros') if r['planilha_id'] == pid and r.get('parecer') == 'Prenha']
        check('Insem: diagnóstico gravado', len(r0) == 1)
        if r0:
            ani = [a for a in db(page, 'animais') if a['num'] == r0[0]['num']][0]
            check('Insem: animal ficou Prenha no rebanho', ani['sit'] == 'Prenha')
        page.click('#insemFilter button[data-v="aguardando"]'); W(200)
        check('Insem: filtro Aguardando', page.locator('#insemAnimals .rec-card').count() == 1)
        page.click('#insemFilter button[data-v="all"]'); W(200)
        # editar registro movendo de planilha
        rid = recs[1]['id']
        page.evaluate(f"FARM.openInsemRecActions('{rid}')"); W()
        page.click('#sheetActions >> text=Editar'); W()
        other = [p for p in db(page, 'inseminacao_planilhas') if p['id'] != pid][0]
        page.select_option('#insemPlanSelect', other['id'])
        page.click('#insemAnimalModal .form-actions .btn-primary'); W(600)
        moved = [r for r in db(page, 'inseminacao_registros') if r['id'] == rid][0]
        check('Insem: editar pode trocar de planilha', moved['planilha_id'] == other['id'])
        check('Insem: tela atualizou após mover', page.locator('#insemAnimals .rec-card').count() == 1)
        # excluir planilha pelo menu
        page.evaluate("FARM.openPlanActions()"); W()
        page.click('#sheetActions >> text=Excluir'); W(); page.click('#confirmBtn'); W(600)
        check('Insem: excluir planilha (vai para a lixeira) volta para lista', page.is_visible('#insemList') and not any(p['id'] == pid and not p.get('deleted_at') for p in db(page, 'inseminacao_planilhas')) and not page.evaluate(f"FARM.state.db.inseminacao.some(p => p.id === '{pid}')"))

        # Touros
        page.click('#insemList .head-actions .icon-btn >> nth=0'); W()
        page.fill('#touroNome', 'Relâmpago'); page.fill('#touroRaca', 'Holandês')
        page.click('#touroSaveBtn'); W(500)
        check('Touros: adicionar', any(t['nome'] == 'Relâmpago' for t in db(page, 'touros')))
        tid = [t for t in db(page, 'touros') if t['nome'] == 'Relâmpago'][0]['id']
        page.evaluate(f"FARM.openTouroActions('{tid}')"); W()
        check('Menu de ações aparece por cima da janela de touros', page.evaluate("getComputedStyle(document.getElementById('actionSheet')).zIndex") == '60')
        page.click('#sheetActions >> text=Editar'); W()
        check('Touros: edição carrega e mantém janela', page.input_value('#touroNome') == 'Relâmpago' and page.is_visible('#tourosModal'))
        page.fill('#touroRegistro', 'HOL 777'); page.click('#touroSaveBtn'); W(500)
        check('Touros: editar', [t for t in db(page, 'touros') if t['id'] == tid][0]['registro'] == 'HOL 777')
        page.evaluate("FARM.closeModal('tourosModal')")

        # ---------- Medicação ----------
        page.evaluate("FARM.goPage('pageMedicacao')"); W()
        n_med = len(db(page, 'medicacoes'))
        page.click('#pageMedicacao .add-btn'); W()
        check('Med: início vem com hoje', page.input_value('#medDataIni') == hoje)
        page.click('#segMedTipo button[data-v="Vermífugo"]')
        page.fill('#medMedicamentos .medNomeInput >> nth=0', 'Ivermectina'); page.fill('#medMedicamentos .medDoseInput >> nth=0', '10ml')
        page.click('.add-row-btn'); page.fill('#medMedicamentos .medNomeInput >> nth=1', 'Vitamina')
        page.select_option('#medLoteSelect', index=1); W(200)
        total_lote = page.locator('#medLoteAnimals .check-row').count()
        page.click('#medLoteAnimals .check-row >> nth=0'); W(100)
        check('Med: desmarcar animal do lote', '{} de {}'.format(total_lote - 1, total_lote) in page.inner_text('#medLoteAnimals .check-head'))
        page.fill('#medCarLeite', '3'); W(100)
        check('Med: dica de liberação do leite', 'leite liberado' in page.inner_text('#medCarHint'))
        page.click('#medAnimalModal .form-actions .btn-primary'); W(700)
        meds = db(page, 'medicacoes')
        check('Med: registro gravado', len(meds) == n_med + 1)
        new = [m for m in meds if m['tipo'] == 'Vermífugo'][0]
        ma = [x for x in db(page, 'medicacao_animais') if x['medicacao_id'] == new['id']]
        mm = [x for x in db(page, 'medicacao_medicamentos') if x['medicacao_id'] == new['id']]
        check('Med: animais (menos o desmarcado) e 2 medicamentos', len(ma) == total_lote - 1 and len(mm) == 2, f'{len(ma)} animais, {len(mm)} meds')
        check('Med: card mostra "Em andamento"', 'Em andamento' in page.inner_text('#medDirectList'))
        page.evaluate(f"FARM.openMedActions('{new['id']}')"); W()
        page.click('#sheetActions >> text=Repetir'); W()
        check('Med: repetir abre com animais e data de hoje', page.locator('#medSelectedAnimals .pick-chip').count() == total_lote - 1 and page.input_value('#medDataIni') == hoje)
        page.click('#medAnimalModal .form-actions .btn-primary'); W(700)
        check('Med: repetir cria novo registro', len(db(page, 'medicacoes')) == n_med + 2)
        page.click('#medFilter button[data-v="encerradas"]'); W(200)
        enc = page.locator('#medDirectList .med-card').count()
        page.click('#medFilter button[data-v="all"]'); W(200)
        check('Med: filtro Encerradas', enc == 0, str(enc))
        page.evaluate(f"FARM.openMedActions('{new['id']}')"); W()
        page.click('#sheetActions >> text=Excluir'); W(); page.click('#confirmBtn'); W(500)
        check('Med: excluir (vai para a lixeira)', not any(m['id'] == new['id'] and not m.get('deleted_at') for m in db(page, 'medicacoes')) and not page.evaluate(f"FARM.state.db.medDirect.some(m => m.id === '{new['id']}')"))

        # ---------- Alimentação ----------
        page.evaluate("FARM.goPage('pageAlimentacao')"); W()
        n_ali = len(db(page, 'alimentacoes'))
        page.click('#pageAlimentacao .add-btn'); W()
        page.fill('#aliNomeDieta', 'Teste inverno')
        page.click('#dietaChecks >> text=Silagem'); W(100)
        page.fill('.diet-row[data-tipo="Silagem"] .d-val', '0.40'); page.fill('.diet-row[data-tipo="Silagem"] .d-kg', '20')
        page.click('#dietaChecks >> text=Sal mineral'); W(100)
        check('Ali: marcar outro ingrediente mantém valores digitados', page.input_value('.diet-row[data-tipo="Silagem"] .d-val') == '0.40')
        page.fill('.diet-row[data-tipo="Sal mineral"] .d-val', '2'); page.fill('.diet-row[data-tipo="Sal mineral"] .d-kg', '0.1')
        page.select_option('#aliLoteSelect', index=1); W(200)
        nlote = page.locator('#aliLoteAnimals .check-row').count()
        esperado = (0.40 * 20 + 2 * 0.1) * nlote
        txt = page.inner_text('#aliCostPreview')
        check('Ali: custo calculado ao vivo', ('%.2f' % esperado).replace('.', ',') in txt, txt[:60])
        page.click('#aliAnimalModal .form-actions .btn-primary'); W(700)
        alis = db(page, 'alimentacoes')
        check('Ali: registro gravado', len(alis) == n_ali + 1)
        na = [a for a in alis if a['nome_dieta'] == 'Teste inverno'][0]
        check('Ali: custo gravado correto', abs(float(na['custo_total']) - esperado) < 0.01, str(na['custo_total']))
        check('Ali: custo por ingrediente aparece', 'Sal mineral' in page.inner_text('#aliBreakdown'))
        created_before = page.evaluate(f"state_ali = window.__MOCKDB.alimentacoes.find(a=>a.id==='{na['id']}').created_at")
        page.evaluate(f"FARM.openAliActions('{na['id']}')"); W()
        page.click('#sheetActions >> text=Editar'); W()
        check('Ali: edição carrega ingredientes', page.input_value('.diet-row[data-tipo="Silagem"] .d-kg') == '20')
        page.fill('#aliNomeDieta', 'Teste inverno 2')
        page.click('#aliAnimalModal .form-actions .btn-primary'); W(700)
        check('Ali: edição gravada', any(a['nome_dieta'] == 'Teste inverno 2' for a in db(page, 'alimentacoes')) and len(db(page, 'alimentacoes')) == n_ali + 1)

        # ---------- Relatórios ----------
        page.evaluate("FARM.goPage('pageRelatorios')"); W()
        page.click('#btnSelAllSources'); W(200)
        summ = page.inner_text('#reportSummary')
        check('Relatório: resumo ao vivo', 'registro(s)' in summ and 'fonte' in summ, summ)
        with page.expect_download() as dl:
            page.click('.dl-xls')
        check('Relatório: Excel baixa', dl.value.suggested_filename.startswith('FARM_'))
        page.evaluate("() => { window.__printed = 0; window.print = () => { window.__printed++; }; }")
        page.click('.dl-pdf'); W(300)
        check('Relatório: PDF abre a impressão do navegador', page.evaluate("window.__printed") == 1)
        page.evaluate("() => { window.dispatchEvent(new Event('afterprint')); }")

        # ---------- Config ----------
        page.evaluate("FARM.goPage('pageConfig')"); W()
        check('Config: e-mail exibido', page.inner_text('#profileEmail') == 'teste@farm.local')
        page.click('text=Atualizar dados'); W(900)
        check('Config: atualizar dados', 'atualizados' in page.inner_text('#toast'))
        page.click('.settings-item summary'); W(200)
        check('Config: alterar senha expande', page.is_visible('#cfgOldPass'))

        check('Sem erros de JavaScript', not app.real_errors(), '; '.join(errors))
        app.close()

    print('\n=== Início, Inseminação, Medicação, Alimentação, Relatórios, Config ===')
    ok = sum(1 for r in results if r[0])
    for passed, name, detail in results:
        print(('OK   ' if passed else 'FALHA') + ' ' + name + (f'  [{detail}]' if detail and not passed else ''))
    print(f'{ok}/{len(results)} passaram')
    return ok == len(results)


if __name__ == '__main__':
    import sys
    sys.exit(0 if run() else 1)
