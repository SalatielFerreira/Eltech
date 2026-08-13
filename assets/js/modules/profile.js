// ========== PERFIL (nome e avatar) ==========
import { state } from '../state.js';
import { safeRun, requireOnline } from './ui.js';
import { dbUpdate } from './data.js';
import { compressImageToBlob, uploadAvatar, getAvatarUrl } from './fotos.js';

export async function setAvatar(e) {
  const f = e.target.files[0];
  if (!f) return;
  if (!requireOnline()) return;
  await safeRun(async () => {
    const blob = await compressImageToBlob(f, 400, 0.8);
    await uploadAvatar(blob);
    const url = await getAvatarUrl();
    const img = document.getElementById('avatarImg');
    const placeholder = document.getElementById('avatarPlaceholder');
    img.src = url;
    img.style.display = 'block';
    placeholder.style.display = 'none';
  }, 'Foto atualizada!');
}

export function initProfileNameListener() {
  document.getElementById('profileName').addEventListener('change', async function () {
    if (!requireOnline()) return;
    const name = this.value;
    await safeRun(async () => {
      await dbUpdate('profiles', state.session.user.id, { name });
      state.db.user.name = name;
    }, 'Nome salvo!');
  });
}
