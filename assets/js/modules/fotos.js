// ========== FOTOS (Supabase Storage) ==========
// Substitui o antigo armazenamento em IndexedDB. Cada foto vira um
// arquivo no bucket `animal-photos` (ou `avatars` para o perfil), sempre
// dentro da pasta do próprio usuário (`{uid}/...`), exigida pelas
// políticas de Storage do schema.sql. Como os buckets são privados,
// a exibição é feita por URL assinada (expira em 1h, guardada em cache
// de memória por sessão para não repetir a chamada em toda renderização).
import { supabase } from '../supabaseClient.js';
import { state } from '../state.js';
import { toast } from './ui.js';
import { dbUpdate } from './data.js';

const SIGNED_URL_TTL = 3600; // segundos
const MAX_PHOTO_BYTES = 2 * 1024 * 1024; // teto de 2MB por foto (animal ou avatar)

function uid() { return state.session.user.id; }

function canvasToBlob(canvas, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Falha ao comprimir imagem')), 'image/jpeg', quality);
  });
}

// Reduz qualidade (e, em último caso, resolução) até o Blob caber no teto de tamanho.
// Se a foto já sair pequena na primeira tentativa (caso comum), não mexe em nada.
async function fitUnderMaxBytes(canvas, quality, maxBytes) {
  let q = quality;
  let blob = await canvasToBlob(canvas, q);
  while (blob.size > maxBytes && q > 0.1) {
    q = Math.max(0.1, q - 0.1);
    blob = await canvasToBlob(canvas, q);
  }
  let c = canvas;
  while (blob.size > maxBytes && c.width > 200) {
    const nc = document.createElement('canvas');
    nc.width = Math.round(c.width * 0.8);
    nc.height = Math.round(c.height * 0.8);
    nc.getContext('2d').drawImage(c, 0, 0, nc.width, nc.height);
    c = nc;
    blob = await canvasToBlob(c, q);
  }
  return blob;
}

// Redimensiona/comprime a imagem escolhida e devolve um Blob JPEG que nunca
// ultrapassa maxBytes (padrão 2MB) — se a compressão inicial já ficar abaixo
// do teto, o resultado sai igual; só recomprime se realmente precisar.
export function compressImageToBlob(file, maxSize, quality, maxBytes = MAX_PHOTO_BYTES) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => {
        let w = img.width, h = img.height;
        if (w > h) { if (w > maxSize) { h = Math.round(h * maxSize / w); w = maxSize; } }
        else { if (h > maxSize) { w = Math.round(w * maxSize / h); h = maxSize; } }
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        c.getContext('2d').drawImage(img, 0, 0, w, h);
        fitUnderMaxBytes(c, quality, maxBytes).then(resolve).catch(reject);
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function signedUrl(bucket, path) {
  if (!path) return null;
  const cacheKey = bucket + ':' + path;
  if (state.photoUrlCache.has(cacheKey)) return state.photoUrlCache.get(cacheKey);
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, SIGNED_URL_TTL);
  if (error) return null;
  state.photoUrlCache.set(cacheKey, data.signedUrl);
  return data.signedUrl;
}

// ---------- Foto do animal ----------
export async function uploadAnimalPhoto(animalId, blob) {
  const path = `${uid()}/${animalId}.jpg`;
  const { error } = await supabase.storage.from('animal-photos').upload(path, blob, { upsert: true, contentType: 'image/jpeg' });
  if (error) throw error;
  await dbUpdate('animais', animalId, { photo_path: path });
  state.photoUrlCache.delete('animal-photos:' + path);
  return path;
}
export async function deleteAnimalPhoto(animalId) {
  const path = `${uid()}/${animalId}.jpg`;
  await supabase.storage.from('animal-photos').remove([path]);
  state.photoUrlCache.delete('animal-photos:' + path);
  await dbUpdate('animais', animalId, { photo_path: null });
}
export function getAnimalPhotoUrl(animal) {
  return signedUrl('animal-photos', animal?.photoPath);
}
export function hydrateThumbs() {
  document.querySelectorAll('.ani-thumb[data-aid]:not([data-done])').forEach(async el => {
    el.setAttribute('data-done', '1');
    const aid = el.getAttribute('data-aid');
    const animal = state.db.lotes.flatMap(l => l.animals).find(a => a.id === aid);
    const url = await getAnimalPhotoUrl(animal);
    if (url) { el.textContent = ''; el.style.backgroundImage = `url('${url}')`; }
  });
}

// ---------- Campo de foto no formulário de animal ----------
export function setAnimalPhotoUI(url) {
  const img = document.getElementById('animalPhotoPreview');
  const ph = document.getElementById('animalPhotoPlaceholder');
  const rm = document.getElementById('animalPhotoRemove');
  if (!img) return;
  if (url) { img.src = url; img.style.display = 'block'; if (ph) ph.style.display = 'none'; if (rm) rm.style.display = 'inline-block'; }
  else { img.removeAttribute('src'); img.style.display = 'none'; if (ph) ph.style.display = 'block'; if (rm) rm.style.display = 'none'; }
}
export function resetAnimalPhoto() {
  state.tempAnimalPhoto = undefined;
  const inp = document.getElementById('animalPhotoInput');
  if (inp) inp.value = '';
  setAnimalPhotoUI(null);
}
export function onAnimalPhoto(e) {
  const f = e.target.files[0];
  if (!f) return;
  compressImageToBlob(f, 500, 0.7)
    .then(blob => { state.tempAnimalPhoto = blob; setAnimalPhotoUI(URL.createObjectURL(blob)); })
    .catch(() => toast('Não foi possível ler a imagem', 'error'));
}
export function removeAnimalPhoto() {
  state.tempAnimalPhoto = null; // null = remover foto existente (undefined = não mexeu)
  const inp = document.getElementById('animalPhotoInput');
  if (inp) inp.value = '';
  setAnimalPhotoUI(null);
}

// ---------- Avatar do usuário ----------
export async function uploadAvatar(blob) {
  const path = `${uid()}/avatar.jpg`;
  const { error } = await supabase.storage.from('avatars').upload(path, blob, { upsert: true, contentType: 'image/jpeg' });
  if (error) throw error;
  await dbUpdate('profiles', uid(), { avatar_path: path });
  state.photoUrlCache.delete('avatars:' + path);
  state.db.user.avatarPath = path;
  return path;
}
export function getAvatarUrl() {
  return signedUrl('avatars', state.db?.user?.avatarPath);
}
