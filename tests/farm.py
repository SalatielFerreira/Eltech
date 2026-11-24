"""Base dos testes automatizados do FARM.

Serve a pasta do projeto num servidor local, troca o Supabase por um banco falso em
memória (mock_supabase.js) e o config.js por valores falsos, e abre o app num Chrome
sem janela, em tamanho de celular (390x844, toque).

Uso direto (ferramentas extras, fora da suíte):
  python tests/farm.py perf            -> métricas de desempenho (CPU 4x mais lenta, 400 animais)
  python tests/farm.py shots [pasta]   -> screenshots das telas principais
"""
import functools, http.server, json, os, sys, threading
from playwright.sync_api import sync_playwright

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
MOCK = open(os.path.join(HERE, 'mock_supabase.js'), encoding='utf-8').read()
FAKE_CONFIG = "export const SUPABASE_URL='https://teste.supabase.co';export const SUPABASE_ANON_KEY='x';"
# No CI (GitHub Actions) usa o Chromium do Playwright; na máquina, o Chrome instalado.
CHANNEL = None if os.environ.get('CI') else os.environ.get('FARM_TEST_CHANNEL', 'chrome')


class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass


def serve(root=ROOT):
    srv = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(Quiet, directory=root))
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv


class App:
    """App aberto no navegador. Use como `with open_app(pw, '?n=40') as app:`."""

    def __init__(self, pw, query='', cpu=1, viewport=(390, 844), block_fonts=True, wait_full=True):
        self.srv = serve()
        self.browser = pw.chromium.launch(channel=CHANNEL, headless=True)
        self.ctx = self.browser.new_context(viewport={'width': viewport[0], 'height': viewport[1]}, device_scale_factor=2,
                                            is_mobile=True, has_touch=True, service_workers='block', accept_downloads=True)
        self.page = page = self.ctx.new_page()
        page.set_default_timeout(8000)  # falha rápido em vez de esperar 30s
        self.errors = []
        page.on('pageerror', lambda e: self.errors.append('pageerror: ' + str(e)))
        page.on('console', lambda m: self.errors.append('console.' + m.type + ': ' + m.text) if m.type == 'error' else None)
        page.route('https://esm.sh/**', lambda r: r.fulfill(status=200, content_type='text/javascript', body=MOCK))
        page.route('**/assets/js/config.js', lambda r: r.fulfill(status=200, content_type='text/javascript', body=FAKE_CONFIG))
        if block_fonts:
            page.route('https://fonts.googleapis.com/**', lambda r: r.abort())
            page.route('https://fonts.gstatic.com/**', lambda r: r.abort())
        # Registra violações da política de segurança (CSP)
        page.add_init_script("window.__csp=[];document.addEventListener('securitypolicyviolation',e=>window.__csp.push(e.violatedDirective+' '+e.blockedURI))")
        if cpu > 1:
            self.ctx.new_cdp_session(page).send('Emulation.setCPUThrottlingRate', {'rate': cpu})
        page.goto(f'http://127.0.0.1:{self.srv.server_address[1]}/index.html{query}')
        # wait_for_function usa eval, bloqueado pela CSP do app; consulta repetida não é.
        self.wait_js("document.getElementById('mainApp').style.display === 'flex'")
        if wait_full:
            self.wait_js("!!(window.FARM && window.FARM.state.loaded)")
        page.wait_for_timeout(300)

    def wait_js(self, expr, timeout=20):
        import time
        end = time.time() + timeout
        while time.time() < end:
            try:
                if self.page.evaluate(expr):
                    return
            except Exception:
                pass
            self.page.wait_for_timeout(100)
        raise TimeoutError('esperando: ' + expr)

    def js(self, code, arg=None):
        return self.page.evaluate(code, arg) if arg is not None else self.page.evaluate(code)

    def run(self, code):
        """Dispara ações sem esperar terminarem (ex.: as que abrem a confirmação)."""
        self.page.evaluate("() => { " + code + "; }")

    def db(self, table):
        return self.page.evaluate(f"window.__MOCKDB['{table}']")

    def wait(self, ms=350):
        self.page.wait_for_timeout(ms)

    def real_errors(self):
        return [e for e in self.errors if 'fonts.g' not in e and 'ERR_FAILED' not in e]

    def swipe(self, dx, y=420, steps=12, x0=None):
        """Arrasto com o dedo (eventos de toque reais via CDP)."""
        cdp = self.ctx.new_cdp_session(self.page)
        x = x0 if x0 is not None else (300 if dx < 0 else 90)
        cdp.send('Input.dispatchTouchEvent', {'type': 'touchStart', 'touchPoints': [{'x': x, 'y': y}]})
        for i in range(1, steps + 1):
            cdp.send('Input.dispatchTouchEvent', {'type': 'touchMove', 'touchPoints': [{'x': x + dx * i / steps, 'y': y}]})
            self.page.wait_for_timeout(16)
        cdp.send('Input.dispatchTouchEvent', {'type': 'touchEnd', 'touchPoints': []})
        self.page.wait_for_timeout(450)

    def close(self):
        self.browser.close()
        self.srv.shutdown()

    def __enter__(self):
        return self

    def __exit__(self, *a):
        self.close()


def open_app(pw, query='', **kw):
    return App(pw, query, **kw)


class Results:
    def __init__(self, suite):
        self.suite, self.items = suite, []

    def check(self, name, cond, detail=''):
        self.items.append((bool(cond), name, detail))
        if os.environ.get('FARM_TEST_VERBOSE'):
            print(('  ok ' if cond else '  XX ') + name + ('' if cond else f'  [{detail}]'), flush=True)

    def report(self):
        ok = sum(1 for r in self.items if r[0])
        print(f'\n=== {self.suite} ===')
        for passed, name, detail in self.items:
            print(('OK   ' if passed else 'FALHA') + ' ' + name + (f'  [{detail}]' if detail and not passed else ''))
        print(f'{ok}/{len(self.items)} passaram')
        return ok == len(self.items)


# ---------------- Ferramentas extras ----------------
MEASURE_JS = """() => { window.__measure = (fn, ms) => new Promise(res => {
  const t0 = performance.now(); fn(); const sync = performance.now() - t0;
  const gaps = []; let last = t0;
  function tick(t) { gaps.push(t - last); last = t; if (t - t0 < ms) requestAnimationFrame(tick); else res({ sync, maxGap: Math.max(...gaps), longFrames: gaps.filter(g => g > 50).length }); }
  requestAnimationFrame(tick);
}); }"""


def perf():
    with sync_playwright() as pw, open_app(pw, '?n=400&hist=6', cpu=4) as app:
        app.js(MEASURE_JS)
        res = {}
        def m(name, code, ms=700, reps=3):
            vals = [app.js(f"__measure(() => {{ {code} }}, {ms})") for _ in range(reps)]
            res[name] = {k: round(sum(v[k] for v in vals) / reps, 1) for k in ('sync', 'maxGap', 'longFrames')}
        for pg in ['pageRebanho', 'pageInseminacao', 'pageMedicacao']:
            m('goPage ' + pg, f"FARM.goPage('{pg}')"); app.js("FARM.goPage('pageHome')")
        app.js("FARM.goPage('pageRebanho')")
        m('Todos os animais (400)', "FARM.openRebanhoView('animais')", ms=900, reps=2)
        m('Janela Adicionar animal', "FARM.openModal('animalModal')", ms=600, reps=1); app.js("FARM.closeModal('animalModal')")
        m('Janela Medicação', "FARM.openModal('medAnimalModal')", ms=600, reps=1); app.js("FARM.closeModal('medAnimalModal')")
        print(json.dumps(res, ensure_ascii=False, indent=1))


def shots(out):
    os.makedirs(out, exist_ok=True)
    with sync_playwright() as pw, open_app(pw, '?n=40', block_fonts=False) as app:
        def snap(name):
            app.wait(450)
            app.page.screenshot(path=os.path.join(out, name + '.png'))
        for pg in ['pageHome', 'pageRebanho', 'pageInseminacao', 'pageMedicacao', 'pageAlimentacao', 'pageRelatorios', 'pageConfig']:
            app.js(f"FARM.goPage('{pg}')"); snap(pg)
        print('screenshots em', out, '| erros:', app.real_errors())


if __name__ == '__main__':
    if sys.argv[1:2] == ['perf']:
        perf()
    elif sys.argv[1:2] == ['shots']:
        shots(sys.argv[2] if len(sys.argv) > 2 else os.path.join(HERE, 'shots'))
    else:
        print(__doc__)
