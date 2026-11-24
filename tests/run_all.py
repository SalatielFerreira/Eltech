"""Roda todos os testes automatizados do FARM e sai com erro se algum falhar.

    pip install -r tests/requirements.txt
    python -m playwright install chromium      # só na primeira vez (ou use o Chrome instalado)
    python tests/run_all.py
"""
import os, sys, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import test_rebanho, test_telas, test_v44  # noqa: E402

t0 = time.time()
results = [(m.__name__, m.run()) for m in (test_rebanho, test_telas, test_v44)]
print('\n================ RESUMO ================')
for name, ok in results:
    print(('OK    ' if ok else 'FALHOU') + ' ' + name)
print(f'Tempo: {time.time() - t0:.0f}s')
sys.exit(0 if all(ok for _, ok in results) else 1)
