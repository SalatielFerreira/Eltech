"""Testes funcionais do Rebanho / cadastro de animal (Supabase simulado)."""
from playwright.sync_api import sync_playwright
from farm import open_app

results = []


def check(name, cond, detail=''):
    results.append((bool(cond), name, detail))


def db(page, table):
    return page.evaluate(f"window.__MOCKDB['{table}']")


def run():
    with sync_playwright() as pw:
        # ---------------- Banco atualizado ----------------
        app = open_app(pw, '?n=40'); page, errors = app.page, app.errors
        page.evaluate("FARM.goPage('pageRebanho')")
        page.click("text=Todos os animais")
        page.wait_for_timeout(300)
        check('Lista mostra 40 animais', page.locator('#animaisList .ani-card').count() == 40)

        # Filtro por sexo
        page.click('#btnFilterAnimais')
        page.select_option('#fAnSexo', 'Macho')
        page.wait_for_timeout(200)
        machos = sum(1 for a in db(page, 'animais') if a['sexo'] == 'Macho')
        check('Filtro Sexo=Macho', page.locator('#animaisList .ani-card').count() == machos, f'esperado {machos}')
        check('Badge de filtro = 1', page.inner_text('#btnFilterAnimais .fbadge') == '1')
        page.click('.fp-clear >> nth=0')
        page.wait_for_timeout(200)
        check('Limpar filtros volta a 40', page.locator('#animaisList .ani-card').count() == 40)
        page.fill('#searchAnimais', 'Estrela')
        page.wait_for_timeout(200)
        check('Busca por nome', page.locator('#animaisList .ani-card').count() >= 1 and 'Estrela' in page.inner_text('#animaisList'))
        page.fill('#searchAnimais', '')
        page.dispatch_event('#searchAnimais', 'input')

        # Validação: salvar vazio
        n_before = len(db(page, 'animais'))
        page.click('#animaisView .add-btn')
        page.wait_for_timeout(350)
        check('Sugestão de nº aparece', 'Sugestão' in page.inner_text('#numHint'))
        page.click('#animalModal .form-actions .btn-primary')
        page.wait_for_timeout(200)
        inval = page.locator('#animalModal .form-group.invalid').count()
        check('Salvar vazio marca campos obrigatórios', inval >= 3, f'{inval} campos marcados')
        check('Nada gravado ao salvar vazio', len(db(page, 'animais')) == n_before)

        # Nº duplicado e data futura
        page.fill('#animalNum', '100')
        page.wait_for_timeout(100)
        check('Aviso de nº duplicado ao digitar', 'já usado' in page.inner_text('#numHint'))
        page.fill('#animalNome', 'Teste')
        page.select_option('#animalLote', index=1)
        page.fill('#animalDataNasc', '2099-01-01')
        page.click('#animalModal .form-actions .btn-primary')
        page.wait_for_timeout(200)
        err_txt = page.inner_text('#animalModal')
        check('Bloqueia nº duplicado', 'já pertence' in err_txt)
        check('Bloqueia nascimento futuro', 'não pode ser futura' in err_txt)
        check('Ainda nada gravado', len(db(page, 'animais')) == n_before)

        # Cadastro completo (comprado, com campos novos)
        page.fill('#animalNum', '')
        page.click('#numHint .chip-link')
        sugerido = page.input_value('#animalNum')
        page.fill('#animalNome', 'Jabuticaba Nova')
        page.fill('#animalBrinco', 'BR-555')
        page.fill('#animalRegistro', 'GIR 999')
        page.fill('#animalPelagem', 'Vermelha')
        page.fill('#animalDataNasc', '2022-03-10')
        page.click('#segSexo button[data-v="Fêmea"]')
        page.select_option('#animalCat', 'Vaca em lactação')
        page.select_option('#animalSit', 'Prenha')
        page.fill('#animalPrenhaDias', '100')
        page.wait_for_timeout(100)
        check('Dica de parto previsto', 'parto previsto' in page.inner_text('#prenhaHint'))
        check('Dica de idade', 'anos' in page.inner_text('#idadeHint'))
        page.click('#segOrigem button[data-v="Comprado"]')
        page.fill('#animalDataCompra', '2024-05-01')
        page.fill('#animalValorCompra', '8500')
        page.fill('#animalVendedor', 'Fazenda Boa Vista')
        page.fill('#animalPeso', '520')
        page.fill('#animalLeite', '22.5')
        page.fill('#animalUltimoParto', '2026-06-01')
        page.fill('#animalObs', 'Mansa, boa de ordenha')
        page.click('#animalModal .form-actions .btn-primary')
        page.wait_for_timeout(600)
        rows = [a for a in db(page, 'animais') if a['num'] == sugerido]
        check('Animal gravado no banco', len(rows) == 1, f'nº {sugerido}')
        if rows:
            r = rows[0]
            check('Campos novos gravados', r.get('brinco') == 'BR-555' and r.get('pelagem') == 'Vermelha' and str(r.get('valor_compra')) == '8500' and r.get('vendedor') == 'Fazenda Boa Vista' and r.get('obs'))
            check('Prenhez gravada', r.get('sit') == 'Prenha' and r.get('prenha_data'))
            pes = [p for p in db(page, 'animal_pesagens') if p['animal_id'] == r['id']]
            check('Pesagem inicial registrada', len(pes) == 1)
        check('Janela fechou após salvar', not page.is_visible('#animalModal'))
        check('Lista mostra o novo animal', 'Jabuticaba Nova' in page.evaluate("document.getElementById('animaisList').textContent"))

        # Ficha mostra campos novos
        if rows:
            page.evaluate(f"FARM.openFicha('{rows[0]['id']}')")
            page.wait_for_timeout(300)
            ficha = page.inner_text('#fichaContent')
            check('Ficha mostra brinco/registro/procedência', 'BR-555' in ficha and 'GIR 999' in ficha and 'Fazenda Boa Vista' in ficha)
            page.evaluate("FARM.closeModal('fichaModal')")

        # Editar sem mudar peso não cria pesagem nova; muda o nome
        if rows:
            aid = rows[0]['id']
            page.evaluate(f"FARM.editAnimalInLote('{aid}')")
            page.wait_for_timeout(400)
            check('Edição carrega brinco', page.input_value('#animalBrinco') == 'BR-555')
            check('Edição carrega origem Comprado', page.is_visible('#animalDataCompra'))
            check('Edição esconde "Salvar e próximo"', not page.is_visible('#btnSaveAnother'))
            page.fill('#animalNome', 'Jabuticaba Editada')
            page.click('#animalModal .form-actions .btn-primary')
            page.wait_for_timeout(600)
            r = [a for a in db(page, 'animais') if a['id'] == aid][0]
            check('Edição gravada', r['nome'] == 'Jabuticaba Editada')
            pes = [p for p in db(page, 'animal_pesagens') if p['animal_id'] == aid]
            check('Editar sem mudar peso não duplica pesagem', len(pes) == 1, f'{len(pes)} pesagens')

        # Salvar e próximo
        n1 = len(db(page, 'animais'))
        page.click('#animaisView .add-btn')
        page.wait_for_timeout(350)
        page.click('#numHint .chip-link')
        page.fill('#animalNome', 'Sequencia 1')
        page.select_option('#animalLote', index=2)
        lote_sel = page.input_value('#animalLote')
        page.click('#btnSaveAnother')
        page.wait_for_timeout(600)
        check('Salvar e próximo grava', len(db(page, 'animais')) == n1 + 1)
        check('Janela continua aberta', page.is_visible('#animalModal'))
        check('Lote mantido', page.input_value('#animalLote') == lote_sel)
        check('Nº e nome limpos', page.input_value('#animalNum') == '' and page.input_value('#animalNome') == '')
        page.evaluate("FARM.closeModal('animalModal')")

        # Ações: dar baixa e restaurar
        target = [a for a in db(page, 'animais') if a['nome'] == 'Sequencia 1'][0]
        page.evaluate(f"FARM.openAnimalActions('{target['id']}')")
        page.wait_for_timeout(300)
        page.click('#sheetActions >> text=Dar baixa')
        page.wait_for_timeout(300)
        check('Janela de baixa abre pelo menu', page.is_visible('#baixaModal'))
        page.fill('#baixaValor', '3000')
        page.click('#baixaModal .btn-danger')
        page.wait_for_timeout(600)
        check('Baixa remove do rebanho', not any(a['id'] == target['id'] for a in db(page, 'animais')))
        check('Baixa registrada', any(b['nome'] == 'Sequencia 1' for b in db(page, 'baixas')))
        page.evaluate("FARM.openRebanhoView('baixas')")
        page.wait_for_timeout(200)
        bid = [b for b in db(page, 'baixas') if b['nome'] == 'Sequencia 1'][0]['id']
        page.evaluate(f"FARM.openBaixaActions('{bid}')")
        page.wait_for_timeout(300)
        page.click('#sheetActions >> text=Restaurar')
        page.wait_for_timeout(300)
        page.click('#confirmBtn')
        page.wait_for_timeout(600)
        check('Restaurar volta ao rebanho', any(a['nome'] == 'Sequencia 1' for a in db(page, 'animais')))

        # Lote: renomear pelo menu e reordenar
        page.evaluate("FARM.openRebanhoView('lotes')")
        page.wait_for_timeout(200)
        lid = page.evaluate("document.querySelector('[data-lote-id]').dataset.loteId")
        page.evaluate(f"FARM.openLoteActions('{lid}')")
        page.wait_for_timeout(300)
        page.click('#sheetActions >> text=Renomear')
        page.wait_for_timeout(300)
        page.fill('#loteNome', 'Lote Renomeado')
        page.click('#loteModal .btn-primary')
        page.wait_for_timeout(500)
        check('Renomear lote', any(l['name'] == 'Lote Renomeado' for l in db(page, 'lotes')))
        idx = lambda: page.evaluate(f"[...document.querySelectorAll('[data-lote-id]')].findIndex(e => e.dataset.loteId === '{lid}')")
        before = idx()
        page.evaluate(f"FARM.moveLote('{lid}', 1)")
        page.wait_for_timeout(600)
        check('Descer lote', idx() == before + 1, f'{before} -> {idx()}')
        page.evaluate(f"FARM.moveLote('{lid}', -1)")
        page.wait_for_timeout(600)
        check('Subir lote', idx() == before, f'-> {idx()}')
        orders = sorted(l['ordem'] for l in db(page, 'lotes'))
        check('Ordem gravada no banco', orders == list(range(len(orders))), str(orders))

        # Detalhe do lote e voltar
        page.evaluate(f"FARM.openLoteDetail('{lid}')")
        page.wait_for_timeout(300)
        check('Detalhe do lote abre', page.is_visible('#loteDetail') and page.inner_text('#loteDetailTitle') == 'Lote Renomeado')
        page.click('#loteDetail .back-icon')
        page.wait_for_timeout(200)
        check('Voltar do lote vai para Lotes', page.is_visible('#lotesView'))

        # Outras telas continuam funcionando
        for pg in ['pageHome', 'pageInseminacao', 'pageMedicacao', 'pageAlimentacao', 'pageRelatorios', 'pageConfig']:
            page.evaluate(f"FARM.goPage('{pg}')")
            page.wait_for_timeout(150)
        page.evaluate("FARM.goPage('pageMedicacao'); FARM.openModal('medAnimalModal')")
        page.wait_for_timeout(300)
        page.click('#medModeIndiv')
        page.wait_for_timeout(200)
        opts = page.locator('#medAnimalSelect option').count()
        check('Medicação: lista de animais montada', opts == len(db(page, 'animais')) + 1, f'{opts} opções')
        page.evaluate("FARM.closeModal('medAnimalModal')")
        check('Sem erros de JavaScript', not app.real_errors(), '; '.join(errors))
        app.close()

        # ---------------- Banco SEM a migração ----------------
        app = open_app(pw, '?n=10&oldschema=1'); page, errors = app.page, app.errors
        page.evaluate("FARM.goPage('pageRebanho'); FARM.openNewAnimal()")
        page.wait_for_timeout(350)
        page.click('#numHint .chip-link')
        num = page.input_value('#animalNum')
        page.fill('#animalNome', 'Banco Antigo')
        page.select_option('#animalLote', index=1)
        page.fill('#animalBrinco', 'X1')
        page.click('#animalModal .form-actions .btn-primary')
        page.wait_for_timeout(800)
        rows = [a for a in db(page, 'animais') if a['num'] == num]
        check('Banco antigo: animal salvo mesmo sem colunas novas', len(rows) == 1 and 'brinco' not in rows[0])
        check('Banco antigo: aviso exibido', 'atualização' in page.inner_text('#toast'))
        check('Banco antigo: sem erros JS', not app.real_errors(), '; '.join(errors))
        app.close()

    print('\n=== Rebanho e cadastro de animal ===')
    ok = sum(1 for r in results if r[0])
    for passed, name, detail in results:
        print(('OK   ' if passed else 'FALHA') + ' ' + name + (f'  [{detail}]' if detail and not passed else ''))
    print(f'{ok}/{len(results)} passaram')
    return ok == len(results)


if __name__ == '__main__':
    import sys
    sys.exit(0 if run() else 1)
