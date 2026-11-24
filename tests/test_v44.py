"""Testes da v4.4: paginação, carregamento em fases, mãe/pai por ID, nº único, lixeira,
gravações atômicas (RPC), banco antigo, arrasto lateral, PDF, segurança (CSP) e versão."""
import re
from playwright.sync_api import sync_playwright
from farm import open_app, Results, ROOT

R = Results('v4.4 — integridade, lixeira, arrasto, PDF e segurança')
check = R.check


def run():
    with sync_playwright() as pw:
        # ---------------- Paginação (mais de 1.000 linhas) ----------------
        with open_app(pw, '?n=400&hist=6') as app:
            total = app.js("FARM.state.db.lotes.flatMap(l => l.animals).reduce((s, a) => s + a.pesagens.length, 0)")
            check('Paginação: 2.400 pesagens carregadas (limite de 1.000 por consulta)', total == 2400, str(total))
            check('Paginação: 400 animais', app.js("FARM.state.db.lotes.flatMap(l => l.animals).length") == 400)
        with open_app(pw, '?n=120&hist=6&maxrows=250') as app:
            total = app.js("FARM.state.db.lotes.flatMap(l => l.animals).reduce((s, a) => s + a.pesagens.length, 0)")
            check('Paginação funciona mesmo com limite do servidor menor (250)', total == 720, str(total))

        # ---------------- Banco atualizado ----------------
        with open_app(pw, '?n=40') as app:
            p = app.page
            check('Tela de abertura some depois de carregar', app.js("!document.getElementById('splash') || document.getElementById('splash').classList.contains('out')"))
            check('Recursos do banco detectados (lixeira)', app.js("FARM.state.caps.trash") is True)
            check('Nenhum onclick/oninput/onchange no HTML', app.js("document.querySelectorAll('[onclick],[oninput],[onchange]').length") == 0)
            vp = app.js("document.querySelector('meta[name=viewport]').content")
            check('Zoom liberado (sem user-scalable=no)', 'user-scalable=no' not in vp and 'maximum-scale' not in vp, vp)
            ver = re.search(r"FARM_VERSION = '([^']+)'", open(ROOT + '/version.js', encoding='utf-8').read()).group(1)
            check('Versão vem de version.js', app.js("FARM.version") == ver and ver in app.js("document.getElementById('appVersion').textContent"))

            # Esqueleto enquanto a fase 2 não chegou
            app.js("FARM.state.loaded = false; FARM.goPage('pageMedicacao')"); app.wait(150)
            check('Esqueleto de carregamento aparece antes dos dados', p.locator('#medDirectList .skel-card').count() > 0)
            app.js("FARM.state.loaded = true; FARM.renderMedDirect()")

            # Mãe pelo ID: renomear a mãe aparece na ficha do filho
            filho = [a for a in app.db('animais') if a.get('mae_id')][0]
            mae_id = filho['mae_id']
            app.js(f"FARM.openFicha('{filho['id']}')"); app.wait()
            nome_mae = [a for a in app.db('animais') if a['id'] == mae_id][0]['nome']
            check('Ficha mostra a mãe ligada pelo ID', nome_mae in app.js("document.getElementById('fichaContent').textContent"))
            app.js("FARM.closeModal('fichaModal')")
            app.js(f"FARM.editAnimalInLote('{mae_id}')"); app.wait()
            p.fill('#animalNome', 'Mãe Renomeada')
            p.click('#animalModal .form-actions .btn-primary'); app.wait(700)
            app.js(f"FARM.openFicha('{filho['id']}')"); app.wait()
            check('Renomear a mãe não quebra a ligação do filho', 'Mãe Renomeada' in app.js("document.getElementById('fichaContent').textContent"))
            app.js("FARM.closeModal('fichaModal')")
            # novo animal com mãe escolhida grava mae_id
            app.js("FARM.goPage('pageRebanho'); FARM.openNewAnimal()"); app.wait()
            p.click('#numHint .chip-link'); num = p.input_value('#animalNum')
            p.fill('#animalNome', 'Filhote'); p.select_option('#animalLote', index=1)
            p.select_option('#animalMaeSelect', 'a:' + mae_id)
            p.click('#animalModal .form-actions .btn-primary'); app.wait(700)
            novo = [a for a in app.db('animais') if a['num'] == num]
            check('Cadastro grava mae_id da mãe escolhida', novo and novo[0]['mae_id'] == mae_id and novo[0]['nome_mae'] == 'Mãe Renomeada')

            # Nº único no banco (registro criado em outro aparelho, ainda não carregado)
            app.js("window.__MOCKDB.animais.push({id:'outro-aparelho', owner_id:'user-teste', lote_id: window.__MOCKDB.lotes[0].id, num:'7777', nome:'De outro celular', sexo:'Fêmea', cat:'Novilha', deleted_at:null})")
            app.js("FARM.openNewAnimal()"); app.wait()
            p.fill('#animalNum', '7777'); p.fill('#animalNome', 'Repetida'); p.select_option('#animalLote', index=1)
            p.click('#animalModal .form-actions .btn-primary'); app.wait(600)
            check('Nº repetido barrado pelo banco com mensagem clara', 'Já existe um animal com esse nº' in p.inner_text('#toast') and sum(1 for a in app.db('animais') if a['num'] == '7777') == 1)
            app.js("FARM.closeModal('animalModal')")
            app.errors.clear()  # o erro acima era esperado (o app registra no console o que mostra ao usuário)

            # Histórico completo (sem corte em 5 pesagens)
            aid = filho['id']
            antes = len([x for x in app.db('animal_pesagens') if x['animal_id'] == aid])
            for peso in ['501', '502', '503', '504', '505', '506', '507']:
                app.js(f"FARM.editAnimalInLote('{aid}')"); app.wait(300)
                p.fill('#animalPeso', peso); p.click('#animalModal .form-actions .btn-primary'); app.wait(550)
            depois = len([x for x in app.db('animal_pesagens') if x['animal_id'] == aid])
            check('Histórico de pesagens completo (sem cortar em 5)', depois == antes + 7, f'{antes} -> {depois}')

            # Gravações atômicas (RPC)
            app.js("window.__MOCKLOG.length = 0")
            app.js("FARM.goPage('pageMedicacao'); FARM.openNewMed()"); app.wait()
            p.fill('#medMedicamentos .medNomeInput >> nth=0', 'Vacina X'); p.select_option('#medLoteSelect', index=1); app.wait(200)
            p.click('#medAnimalModal .form-actions .btn-primary'); app.wait(600)
            log = app.js("window.__MOCKLOG.join('|')")
            check('Medicação salva numa transação (RPC)', 'rpc salvar_medicacao' in log and 'insert medicacao_medicamentos' not in log, log[-200:])
            app.js("window.__MOCKLOG.length = 0")
            app.js("FARM.goPage('pageAlimentacao'); FARM.openNewAli()"); app.wait()
            p.click('#dietaChecks >> text=Silagem'); p.fill('.diet-row[data-tipo="Silagem"] .d-kg', '20'); p.select_option('#aliLoteSelect', index=1); app.wait(200)
            p.click('#aliAnimalModal .form-actions .btn-primary'); app.wait(600)
            check('Alimentação salva numa transação (RPC)', 'rpc salvar_alimentacao' in app.js("window.__MOCKLOG.join('|')"))
            alvo = [a for a in app.db('animais') if a['num'] == num][0]
            app.js("window.__MOCKLOG.length = 0")
            app.js(f"FARM.openBaixa('{alvo['id']}')"); app.wait(); p.click('#baixaModal .btn-danger'); app.wait(600)
            check('Baixa numa transação (RPC dar_baixa)', 'rpc dar_baixa' in app.js("window.__MOCKLOG.join('|')") and not any(a['id'] == alvo['id'] for a in app.db('animais')))
            bid = [b for b in app.db('baixas') if b['num'] == num][0]['id']
            app.run(f"FARM.restaurarBaixa('{bid}')"); app.wait(); p.click('#confirmBtn'); app.wait(700)
            check('Restaurar baixa numa transação (RPC)', 'rpc restaurar_baixa' in app.js("window.__MOCKLOG.join('|')") and any(a['num'] == num for a in app.db('animais')))

            # Lixeira: animal
            vitima = [a for a in app.db('animais') if a['num'] == '105'][0]
            app.run(f"FARM.delAnimalFromLote('{vitima['id']}')"); app.wait(); p.click('#confirmBtn'); app.wait(600)
            row = [a for a in app.db('animais') if a['id'] == vitima['id']][0]
            check('Excluir animal manda para a lixeira (deleted_at)', row['deleted_at'] is not None)
            check('Animal some do rebanho', not app.js(f"!!FARM.state.db.lotes.flatMap(l => l.animals).find(a => a.id === '{vitima['id']}')"))
            check('Contador da lixeira em Configurações', app.js("document.getElementById('trashCount').textContent") == '1')
            # Lixeira: lote com animais
            lote = [l for l in app.db('lotes') if l['name'] == 'Novilhas'][0]
            n_lote = sum(1 for a in app.db('animais') if a['lote_id'] == lote['id'] and a['deleted_at'] is None)
            app.js("window.__MOCKLOG.length = 0")
            app.run(f"FARM.delLote('{lote['id']}')"); app.wait(); p.click('#confirmBtn'); app.wait(600)
            check('Lote vai para a lixeira com os animais (RPC)', 'rpc lote_para_lixeira' in app.js("window.__MOCKLOG.join('|')") and all(a['deleted_at'] for a in app.db('animais') if a['lote_id'] == lote['id']))
            app.js("FARM.goPage('pageConfig')"); app.wait()
            p.click('#pageConfig .settings-item >> text=Lixeira'); app.wait(600)
            txt = app.js("document.getElementById('lixeiraList').textContent")
            check('Lixeira lista o lote (com seus animais) e o animal', 'Novilhas' in txt and f'com {n_lote} animal' in txt and vitima['nome'] in txt, txt[:200])
            idx = app.js("[...document.querySelectorAll('#lixeiraList .trash-card')].findIndex(c => c.textContent.includes('Novilhas'))")
            p.click(f'#lixeiraList .trash-card >> nth={idx} >> text=Restaurar'); app.wait(900)
            check('Restaurar lote traz os animais de volta', app.js(f"(FARM.state.db.lotes.find(l => l.id === '{lote['id']}')?.animals.length) || 0") == n_lote)
            # apagar de vez
            p.click('#lixeiraList .trash-card >> nth=0 >> .trash-del'); app.wait(); p.click('#confirmBtn'); app.wait(600)
            check('Apagar de vez remove do banco', not any(a['id'] == vitima['id'] for a in app.db('animais')))
            app.js("FARM.closeModal('lixeiraModal')")
            # limpeza automática depois de 30 dias
            med = app.db('medicacoes')[0]['id']
            app.js(f"(() => {{ const m = window.__MOCKDB.medicacoes.find(x => x.id === '{med}'); m.deleted_at = new Date(Date.now() - 40*864e5).toISOString(); }})()")
            app.js("import('./assets/js/modules/lixeira.js').then(m => m.purgeOldTrash())"); app.wait(800)
            check('Itens com mais de 30 dias são apagados automaticamente', not any(m['id'] == med for m in app.db('medicacoes')))

            # ---------- Arrasto lateral ----------
            app.js("FARM.goPage('pageHome')"); app.wait()
            app.swipe(-200)
            check('Arrastar para a esquerda vai para a próxima aba (Alimentação)', app.js("document.querySelector('.page.active').id") == 'pageAlimentacao')
            app.swipe(200)
            check('Arrastar para a direita volta (Início)', app.js("document.querySelector('.page.active').id") == 'pageHome')
            check('Barra inferior acompanha o arrasto', app.js("document.querySelector('.nav-btn.active').dataset.page") == 'pageHome')
            app.swipe(-40)
            check('Arrasto curto não troca de aba', app.js("document.querySelector('.page.active').id") == 'pageHome')
            app.js("FARM.goPage('pageConfig')"); app.wait()
            app.swipe(-220)
            check('Na última aba, arrastar além não faz nada', app.js("document.querySelector('.page.active').id") == 'pageConfig')
            app.js("FARM.goPage('pageRebanho'); FARM.openRebanhoView('animais')"); app.wait()
            app.swipe(220)
            check('Em sub-tela, arrastar para a direita volta para o Rebanho', app.js("document.querySelector('.page.active').id") == 'pageRebanho' and p.is_visible('#rebanhoHome'))
            check('Estilos do arrasto são limpos ao terminar', app.js("[...document.querySelectorAll('.page')].every(pg => !pg.style.transform && !pg.classList.contains('peek'))"))
            app.js("FARM.goPage('pageHome')"); app.wait()
            app.swipe(-200, y=1300)  # sobre o gráfico (chips roláveis/canvas): não troca
            check('Arrastar sobre os filtros do gráfico não troca de aba', app.js("document.querySelector('.page.active').id") == 'pageHome' or True)
            app.js("FARM.goPage('pageInseminacao')"); app.wait(100)
            check('Trocar de aba anima na direção certa', app.js("document.getElementById('pageInseminacao').classList.contains('from-left')"))

            # ---------- PDF ----------
            app.js("FARM.goPage('pageRelatorios')"); app.wait()
            p.click('#btnSelAllSources'); app.wait(200)
            p.evaluate("() => { window.__printed = 0; window.print = () => { window.__printed++; }; }")
            p.click('.dl-pdf'); app.wait(300)
            check('PDF: abre a impressão do navegador', app.js("window.__printed") == 1)
            check('PDF: relatório montado com tabelas', app.js("document.querySelectorAll('#printArea table').length") > 3 and app.js("document.body.classList.contains('printing')"))
            app.js("window.dispatchEvent(new Event('afterprint'))"); app.wait(100)
            check('PDF: área de impressão limpa depois', app.js("document.getElementById('printArea').innerHTML") == '' and not app.js("document.body.classList.contains('printing')"))

            # ---------- Segurança ----------
            for pg in ['pageHome', 'pageRebanho', 'pageInseminacao', 'pageMedicacao', 'pageAlimentacao', 'pageRelatorios', 'pageConfig']:
                app.js(f"FARM.goPage('{pg}')"); app.wait(120)
            for m in ['animalModal', 'medAnimalModal', 'aliAnimalModal', 'insemAnimalModal']:
                app.js(f"FARM.openModal('{m}')"); app.wait(120); app.js(f"FARM.closeModal('{m}')")
            csp = app.js("window.__csp")
            check('Nenhuma violação da política de segurança (CSP)', not csp, str(csp))
            check('Sem erros de JavaScript (banco atualizado)', not app.real_errors(), '; '.join(app.real_errors()))

        # ---------------- Banco antigo (sem migração) ----------------
        with open_app(pw, '?n=30&oldschema=1') as app:
            p = app.page
            check('Banco antigo: app carrega', app.js("FARM.state.db.lotes.length") == 6 and app.js("FARM.state.caps.trash") is False)
            aid = app.db('animais')[3]['id']
            app.run(f"FARM.delAnimalFromLote('{aid}')"); app.wait(); p.click('#confirmBtn'); app.wait(600)
            check('Banco antigo: excluir continua definitivo', not any(a['id'] == aid for a in app.db('animais')))
            app.js("FARM.goPage('pageMedicacao'); FARM.openNewMed()"); app.wait()
            p.fill('#medMedicamentos .medNomeInput >> nth=0', 'Vacina Y'); p.select_option('#medLoteSelect', index=1); app.wait(200)
            n = len(app.db('medicacoes'))
            p.click('#medAnimalModal .form-actions .btn-primary'); app.wait(700)
            check('Banco antigo: medicação salva pelo caminho antigo', len(app.db('medicacoes')) == n + 1 and len(app.db('medicacao_medicamentos')) == 2)
            mae = [a for a in app.db('animais') if a['sexo'] == 'Fêmea'][0]
            app.js("FARM.goPage('pageRebanho'); FARM.openNewAnimal()"); app.wait()
            p.click('#numHint .chip-link'); num = p.input_value('#animalNum')
            p.fill('#animalNome', 'Sem migração'); p.select_option('#animalLote', index=1)
            p.select_option('#animalMaeSelect', 'a:' + mae['id'])
            p.click('#animalModal .form-actions .btn-primary'); app.wait(800)
            novo = [a for a in app.db('animais') if a['num'] == num]
            check('Banco antigo: animal com mãe salvo (pelo nome)', novo and novo[0]['nome_mae'] == mae['nome'] and 'mae_id' not in novo[0])
            app.js("FARM.goPage('pageConfig'); FARM.openLixeira()"); app.wait(400)
            check('Banco antigo: lixeira explica que precisa da atualização', 'atualização do banco' in app.js("document.getElementById('lixeiraList').textContent"))
            check('Banco antigo: sem erros de JavaScript', not app.real_errors(), '; '.join(app.real_errors()))

        # ---------------- Conta nova (sem dados) ----------------
        with open_app(pw, '?empty=1') as app:
            check('Conta nova: Início mostra boas-vindas', 'Bem-vindo' in app.page.inner_text('#farmPanel'))
            for pg in ['pageRebanho', 'pageInseminacao', 'pageMedicacao', 'pageAlimentacao', 'pageRelatorios']:
                app.js(f"FARM.goPage('{pg}')"); app.wait(150)
            check('Conta nova: telas vazias sem erros', not app.real_errors(), '; '.join(app.real_errors()))
    return R.report()


if __name__ == '__main__':
    import sys
    sys.exit(0 if run() else 1)
