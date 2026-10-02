// Interactive proposal only: all edits stay in this page's memory.
const $ = id => document.getElementById(id);
const icon = id => `<svg class="icon" aria-hidden="true"><use href="#${id}"/></svg>`;
const classData = [
  { id: 'hip', name: 'Hipopótamos', unit: 'Capão da Imbuia', schedule: 'Qua e Sex · 18:00–19:00', count: 24 },
  { id: 'agu', name: 'Águias', unit: 'Centro Esportivo', schedule: 'Ter e Qui · 10:00–11:00', count: 26 },
  { id: 'rap', name: 'Raposas', unit: 'Centro Esportivo', schedule: 'Seg e Qua · 14:00–15:00', count: 22 },
  { id: 'win', name: 'Winx', unit: 'Centro Esportivo', schedule: 'Seg e Qua · 15:00–16:00', count: 20 },
];
const activities = [
  { title: 'Plano da aula registrado', detail: 'Hipopótamos · Recepção e continuidade', time: 'Hoje, 08:30', icon: 'book' },
  { title: 'Chamada concluída', detail: 'Águias · 24 atletas presentes', time: 'Ontem, 11:10', icon: 'users' },
  { title: 'Relatório de treino publicado', detail: 'Raposas · Desenvolvimento do passe', time: '30 set., 15:12', icon: 'edit' },
];
const personalFields = [
  { id: 'name', label: 'Nome completo', type: 'text', autocomplete: 'name' },
  { id: 'phone', label: 'Celular', type: 'tel', placeholder: '(00) 00000-0000' },
  { id: 'birth', label: 'Data de nascimento', type: 'date' },
  { id: 'gender', label: 'Gênero', type: 'text', placeholder: 'Opcional' },
  { id: 'cpf', label: 'CPF', type: 'text', placeholder: '000.000.000-00' },
  { id: 'rg', label: 'RG', type: 'text', placeholder: 'Opcional' },
  { id: 'address', label: 'Endereço', type: 'text', placeholder: 'Opcional' },
];
let person = { name: 'Ana Silva', phone: '', birth: '', gender: '', cpf: '', rg: '', address: '', bio: $('profile-bio').textContent };
let viewer = 'coord', assigned = ['hip', 'agu', 'rap'], permissions = ['Turmas', 'Planejamento', 'Calendário'];
let draftAssigned = [], draftPermissions = [], drawerMode = 'access', accessTab = 'classes', returnFocus = null, toastTimer;
let photoUrl = null, draftPhotoUrl = null, photoReturnFocus = null;

function renderProfile() {
  const current = classData.filter(item => assigned.includes(item.id));
  const rows = current.map(item => `<article class="class-item"><span class="class-icon">${icon('book')}</span><div class="class-info"><h3>${item.name}</h3><p>${item.unit}</p><p>${item.schedule}</p></div><span class="pill">${item.count} atletas</span></article>`).join('');
  $('overview-classes').innerHTML = $('full-classes').innerHTML = rows || '<p class="muted">Nenhuma turma vinculada.</p>';
  $('class-count').textContent = current.length;
  $('athlete-count').textContent = current.reduce((total, item) => total + item.count, 0);
  const events = activities.map(item => `<article class="event"><span class="event-icon">${icon(item.icon)}</span><div><h3>${item.title}</h3><p>${item.detail}</p></div><time>${item.time}</time></article>`).join('');
  $('overview-activity').innerHTML = $('full-activity').innerHTML = events;
  $('profile-name').textContent = person.name;
  $('profile-bio').textContent = person.bio;
  $('avatar-initials').textContent = person.name.trim().split(/\s+/).slice(0, 2).map(word => word[0]).join('').toUpperCase();
  $('profile-photo').hidden = !photoUrl;
  $('avatar-initials').hidden = Boolean(photoUrl);
  if (photoUrl) $('profile-photo').src = photoUrl;
  else $('profile-photo').removeAttribute('src');
}
function selectTab(tab) {
  document.querySelectorAll('.tab').forEach(button => button.setAttribute('aria-selected', String(button.dataset.tab === tab)));
  document.querySelectorAll('.tab-content').forEach(section => section.hidden = section.id !== tab);
}
function changeViewer(mode) {
  closeDrawer(); closePhoto(); viewer = mode;
  const own = mode === 'person';
  $('view-person').setAttribute('aria-pressed', String(own));
  $('view-coord').setAttribute('aria-pressed', String(!own));
  $('main-action').innerHTML = icon(own ? 'edit' : 'shield') + `<span>${own ? 'Editar perfil' : 'Gerenciar acesso'}</span>`;
  $('settings-action').hidden = !own;
  $('photo-badge').hidden = !own;
  $('profile-avatar').setAttribute('aria-label', own ? 'Editar foto do perfil' : 'Ver foto do perfil');
  document.querySelector('.message-button').hidden = own;
  $('breadcrumb-root').textContent = own ? 'Meu perfil' : 'Equipe';
  $('viewer-avatar').textContent = own ? $('avatar-initials').textContent : 'CR';
  $('context-note').textContent = own ? 'Suas informações nesta instituição.' : 'Perfil da profissional nesta instituição.';
}
function notify(text) {
  clearTimeout(toastTimer); $('toast').textContent = text; $('toast').hidden = false;
  toastTimer = setTimeout(() => $('toast').hidden = true, 3000);
}
function openDrawer(mode) {
  if (mode !== 'access' && viewer !== 'person') return;
  if (mode === 'access' && viewer !== 'coord') return;
  returnFocus = document.activeElement; drawerMode = mode;
  draftAssigned = [...assigned]; draftPermissions = [...permissions]; accessTab = 'classes';
  $('drawer-title').textContent = mode === 'access' ? 'Vínculos e acesso' : mode === 'edit' ? 'Editar perfil' : 'Configurações';
  $('drawer-context').textContent = person.name + ' · Rede Esportes Pinhais';
  $('save-drawer').disabled = true; renderDrawer();
  $('shade').hidden = $('drawer').hidden = false;
  document.body.style.overflow = 'hidden'; $('close-drawer').focus();
}
function renderDrawer() {
  const body = $('drawer-body');
  if (drawerMode === 'access') {
    body.innerHTML = `<div class="drawer-tabs" role="tablist"><button role="tab" aria-selected="${accessTab === 'classes'}" data-access="classes">Turmas</button><button role="tab" aria-selected="${accessTab === 'permissions'}" data-access="permissions">Permissões</button></div>` + (accessTab === 'classes'
      ? classData.map(item => `<label class="check-row"><input type="checkbox" value="${item.id}" ${draftAssigned.includes(item.id) ? 'checked' : ''}><span><strong>${item.name}</strong><small>${item.unit} · ${item.schedule}</small></span></label>`).join('')
      : ['Turmas', 'Planejamento', 'Calendário', 'Relatórios', 'Atletas', 'Financeiro', 'Gestão de membros'].map(item => `<label class="check-row"><input type="checkbox" value="${item}" ${draftPermissions.includes(item) ? 'checked' : ''}><span>${item}</span></label>`).join(''));
    body.querySelectorAll('[data-access]').forEach(button => button.onclick = () => { accessTab = button.dataset.access; renderDrawer(); });
    body.querySelectorAll('input').forEach(input => input.onchange = () => {
      const list = accessTab === 'classes' ? draftAssigned : draftPermissions;
      const values = input.checked ? [...list, input.value] : list.filter(value => value !== input.value);
      if (accessTab === 'classes') draftAssigned = values; else draftPermissions = values;
      updateSave();
    });
  } else if (drawerMode === 'edit') {
    body.innerHTML = '<h3 class="form-heading">Dados pessoais</h3><div class="personal-fields">' + personalFields.map(field =>
      `<div class="form-field ${['name', 'phone', 'address'].includes(field.id) ? 'wide' : ''}"><label for="edit-${field.id}">${field.label}</label><div class="field-shell"><input id="edit-${field.id}" type="${field.type}" autocomplete="${field.autocomplete || 'off'}" placeholder="${field.placeholder || ''}"></div></div>`
    ).join('') + '</div><h3 class="form-heading separated">Apresentação</h3><div class="form-field"><label for="edit-bio">Sobre você</label><div class="field-shell"><textarea id="edit-bio" rows="3"></textarea></div></div>';
    [...personalFields, { id: 'bio' }].forEach(field => $('edit-' + field.id).value = person[field.id]);
    body.oninput = () => {
      const draft = readPersonalDraft();
      $('save-drawer').disabled = draft.name.trim().length < 2 || Object.keys(person).every(key => draft[key] === person[key]);
    };
  } else {
    body.innerHTML = '<h3>Conta e preferências</h3><label class="check-row"><input type="checkbox" checked><span>Receber avisos de aulas<small>Preferência da própria pessoa</small></span></label><p class="section-note">Turmas e permissões são administradas pela coordenação.</p>';
    body.querySelector('input').onchange = () => $('save-drawer').disabled = false;
  }
}
function readPersonalDraft() {
  return Object.fromEntries([...personalFields, { id: 'bio' }].map(field => [field.id, $('edit-' + field.id).value]));
}
function updateSave() {
  const same = (a, b) => [...a].sort().join('|') === [...b].sort().join('|');
  $('save-drawer').disabled = same(assigned, draftAssigned) && same(permissions, draftPermissions);
}
function closeDrawer() {
  $('drawer').hidden = $('shade').hidden = true;
  $('drawer-body').oninput = null; document.body.style.overflow = '';
  if (returnFocus?.isConnected) returnFocus.focus();
}

function openPhoto() {
  photoReturnFocus = document.activeElement;
  draftPhotoUrl = photoUrl;
  $('photo-options').hidden = viewer !== 'person';
  $('photo-save').hidden = true;
  $('photo-remove').hidden = !photoUrl;
  $('photo-dialog').hidden = $('photo-shade').hidden = false;
  renderPhotoPreview(); document.body.style.overflow = 'hidden'; $('photo-close').focus();
}
function renderPhotoPreview() {
  $('photo-preview-image').hidden = !draftPhotoUrl;
  $('photo-preview-initials').hidden = Boolean(draftPhotoUrl);
  $('photo-preview-initials').textContent = $('avatar-initials').textContent;
  if (draftPhotoUrl) $('photo-preview-image').src = draftPhotoUrl;
  else $('photo-preview-image').removeAttribute('src');
}
function closePhoto() {
  if (draftPhotoUrl && draftPhotoUrl !== photoUrl) URL.revokeObjectURL(draftPhotoUrl);
  draftPhotoUrl = photoUrl;
  $('photo-dialog').hidden = $('photo-shade').hidden = true;
  $('photo-remove-confirm').hidden = true;
  document.body.style.overflow = '';
  if (photoReturnFocus?.isConnected) photoReturnFocus.focus();
}
function choosePhoto(source) {
  if (viewer !== 'person') return;
  const input = $(source === 'camera' ? 'camera-file' : 'gallery-file');
  input.value = ''; input.click();
}
async function previewPickedPhoto(event) {
  const file = event.target.files?.[0];
  if (!file || viewer !== 'person') return;
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 10 * 1024 * 1024) {
    notify('Escolha uma imagem JPG, PNG ou WebP de até 10 MB.'); return;
  }
  const url = URL.createObjectURL(file);
  const image = new Image(); image.src = url;
  try { await image.decode(); } catch { URL.revokeObjectURL(url); notify('Não foi possível abrir essa imagem.'); return; }
  if ($('photo-dialog').hidden || viewer !== 'person') { URL.revokeObjectURL(url); return; }
  if (draftPhotoUrl && draftPhotoUrl !== photoUrl) URL.revokeObjectURL(draftPhotoUrl);
  draftPhotoUrl = url; renderPhotoPreview(); $('photo-save').hidden = false;
}
function trapFocus(event, root) {
  const controls = [...root.querySelectorAll('button:not(:disabled),input,textarea')].filter(el => el.getClientRects().length);
  const first = controls[0], last = controls.at(-1);
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
}
$('main-action').onclick = () => openDrawer(viewer === 'coord' ? 'access' : 'edit');
$('settings-action').onclick = () => openDrawer('settings');
$('view-person').onclick = () => changeViewer('person');
$('view-coord').onclick = () => changeViewer('coord');
document.querySelectorAll('.tab').forEach(button => button.onclick = () => selectTab(button.dataset.tab));
$('close-drawer').onclick = $('cancel-drawer').onclick = $('shade').onclick = closeDrawer;
$('save-drawer').onclick = () => {
  if (drawerMode === 'access') { assigned = [...draftAssigned]; permissions = [...draftPermissions]; }
  else if (drawerMode === 'edit') { person = readPersonalDraft(); person.name = person.name.trim(); }
  renderProfile(); closeDrawer(); notify('Prévia atualizada apenas neste mockup.');
};
$('profile-avatar').onclick = openPhoto;
$('photo-close').onclick = $('photo-shade').onclick = closePhoto;
$('photo-camera').onclick = () => choosePhoto('camera');
$('photo-gallery').onclick = () => choosePhoto('gallery');
$('camera-file').onchange = $('gallery-file').onchange = previewPickedPhoto;
$('photo-save').onclick = () => {
  if (viewer !== 'person') return;
  if (photoUrl && photoUrl !== draftPhotoUrl) URL.revokeObjectURL(photoUrl);
  photoUrl = draftPhotoUrl; renderProfile(); closePhoto(); notify('Foto atualizada apenas neste mockup.');
};
$('photo-remove').onclick = () => { $('photo-remove-confirm').hidden = false; $('photo-confirm-cancel').focus(); };
$('photo-confirm-cancel').onclick = () => $('photo-remove-confirm').hidden = true;
$('photo-confirm-remove').onclick = () => {
  if (viewer !== 'person') return;
  if (photoUrl) URL.revokeObjectURL(photoUrl);
  photoUrl = null; renderProfile(); closePhoto(); notify('Foto removida apenas neste mockup.');
};
document.addEventListener('keydown', event => {
  if (event.key === 'Escape') { if (!$('photo-dialog').hidden) closePhoto(); else closeDrawer(); }
  if (event.key === 'Tab') {
    if (!$('photo-dialog').hidden) trapFocus(event, $('photo-dialog'));
    else if (!$('drawer').hidden) trapFocus(event, $('drawer'));
  }
});
renderProfile(); changeViewer('person');
