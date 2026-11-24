// ========== AUTENTICAÇÃO (Supabase Auth) ==========
// Substitui a autenticação caseira do app antigo (múltiplas contas em
// localStorage, senha em hash SHA-256 feita à mão). Login agora é só
// por e-mail (Supabase Auth não suporta login por "nome") e a sessão
// fica persistida automaticamente pelo próprio supabase-js — por isso
// não existe mais o campo "Manter conectado".
import { supabase } from '../supabaseClient.js';
import { state, resetTempSelections } from '../state.js';
import { toast, safeRun, isValidEmail, isValidName, isValidPassword, switchLoginTab, requireOnline, goPage, refreshCurrentPage, refresh } from './ui.js';
import { loadAllData } from './data.js';
import { renderHome } from './dashboard.js';
import { populateTouroOptions } from './touros.js';
import { getAvatarUrl } from './fotos.js';
import { purgeOldTrash } from './lixeira.js';

export async function doLogin() {
  if (!requireOnline()) return;
  const email = document.getElementById('loginEmail').value.trim();
  const pass = document.getElementById('loginPass').value;
  if (!email || !pass) return toast('Preencha todos os campos', 'error');
  await safeRun(async () => {
    const { error } = await supabase.auth.signInWithPassword({ email, password: pass });
    if (error) throw new Error(error.message === 'Invalid login credentials' ? 'E-mail ou senha incorretos' : error.message);
    await enterApp();
  });
}

export async function doRegister() {
  if (!requireOnline()) return;
  const name = document.getElementById('regName').value.trim();
  const email = document.getElementById('regEmail').value.trim();
  const pass = document.getElementById('regPass').value;
  const passConfirm = document.getElementById('regPassConfirm').value;
  if (!name || !email || !pass || !passConfirm) return toast('Preencha todos os campos', 'error');
  if (!isValidName(name)) return toast('Nome: apenas letras, máx. 15 caracteres', 'error');
  if (!isValidEmail(email)) return toast('Email inválido', 'error');
  if (!isValidPassword(pass)) return toast('Senha precisa de: maiúscula, número e caractere especial', 'error');
  if (pass !== passConfirm) return toast('As senhas não coincidem', 'error');

  await safeRun(async () => {
    const { data, error } = await supabase.auth.signUp({ email, password: pass, options: { data: { name } } });
    if (error) throw new Error(error.message === 'User already registered' ? 'Já existe uma conta com este email' : error.message);
    ['regName', 'regEmail', 'regPass', 'regPassConfirm'].forEach(id => { document.getElementById(id).value = ''; });
    if (data.session) {
      // Confirmação de e-mail desativada no projeto: já entra logado.
      await enterApp();
    } else {
      toast('Conta criada! Verifique seu e-mail para confirmar e faça login.');
      switchLoginTab('login');
      document.getElementById('loginEmail').value = email;
    }
  });
}

// Tela de abertura (logo) enquanto a sessão é verificada e os primeiros dados chegam.
export function hideSplash() {
  const sp = document.getElementById('splash');
  if (!sp || sp.classList.contains('out')) return;
  sp.classList.add('out');
  setTimeout(() => sp.remove(), 450);
}

// Depois da fase 2 do carregamento: redesenha a tela aberta com os dados completos.
function afterFullLoad() {
  if (!state.db) return;
  if (state.loadError) toast('Parte dos dados não carregou. Use Configurações → Atualizar dados.', 'error');
  populateTouroOptions();
  const cur = document.querySelector('.page.active')?.id;
  if (cur === 'pageRebanho') refresh('rebanho'); // mantém a sub-tela aberta
  else refreshCurrentPage();
  purgeOldTrash(); // limpa da lixeira o que passou de 30 dias (em segundo plano)
}

export async function enterApp() {
  state.session = (await supabase.auth.getSession()).data.session;
  if (!state.session) return;
  const { phase2 } = await loadAllData();
  document.getElementById('loginPage').classList.add('hidden');
  document.getElementById('mainApp').style.display = 'flex';
  document.getElementById('profileName').value = state.db.user.name || 'Usuário';
  const em = document.getElementById('profileEmail');
  if (em) em.textContent = state.session.user.email || '';
  populateTouroOptions();
  goPage('pageHome', { noAnim: true });
  hideSplash();
  getAvatarUrl().then(avatarUrl => {
    const img = document.getElementById('avatarImg');
    const placeholder = document.getElementById('avatarPlaceholder');
    if (avatarUrl) { img.src = avatarUrl; img.style.display = 'block'; placeholder.style.display = 'none'; }
    else { img.removeAttribute('src'); img.style.display = 'none'; placeholder.style.display = 'block'; }
  });
  phase2.then(afterFullLoad);
  return { phase2 }; // objeto (não a Promise): quem chama espera só a fase 1
}

// Recarrega tudo do Supabase (ex.: dados alterados em outro aparelho) e redesenha a tela atual.
export async function reloadData() {
  if (!requireOnline()) return;
  await safeRun(async () => {
    const { phase2 } = await loadAllData();
    await phase2;
    if (state.loadError) throw state.loadError;
    populateTouroOptions();
    const cur = document.querySelector('.page.active')?.id || 'pageHome';
    goPage(cur, { noAnim: true });
  }, 'Dados atualizados!');
}

export async function doLogout() {
  await supabase.auth.signOut();
  resetTempSelections();
  state.session = null;
  state.db = null;
  state.photoUrlCache.clear();
  document.getElementById('loginPass').value = '';
  document.getElementById('loginPage').classList.remove('hidden');
  document.getElementById('mainApp').style.display = 'none';
}

export async function changePassword() {
  if (!requireOnline()) return;
  const oldPass = document.getElementById('cfgOldPass').value;
  const newPass = document.getElementById('cfgNewPass').value;
  if (!oldPass || !newPass) return toast('Preencha os campos', 'error');
  if (!isValidPassword(newPass)) return toast('Nova senha precisa de: maiúscula, número e caractere especial', 'error');
  await safeRun(async () => {
    const email = state.session.user.email;
    const { error: reauthErr } = await supabase.auth.signInWithPassword({ email, password: oldPass });
    if (reauthErr) throw new Error('Senha atual incorreta');
    const { error } = await supabase.auth.updateUser({ password: newPass });
    if (error) throw error;
    document.getElementById('cfgOldPass').value = '';
    document.getElementById('cfgNewPass').value = '';
  }, 'Senha alterada!');
}

// Restaura sessão já existente (ex.: usuário só recarregou a página).
export async function restoreSessionIfAny() {
  const { data } = await supabase.auth.getSession();
  if (data.session) {
    state.session = data.session;
    try { await enterApp(); } catch (err) { console.error(err); toast(err?.message || 'Erro ao carregar os dados', 'error'); }
  }
  hideSplash();
  supabase.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_OUT') {
      document.getElementById('loginPage').classList.remove('hidden');
      document.getElementById('mainApp').style.display = 'none';
    }
  });
}
