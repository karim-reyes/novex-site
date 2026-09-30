const icons = {
  home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 10.5 12 3l9 7.5V21h-6v-6H9v6H3z"/></svg>',
  briefcase: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18"/></svg>',
  columns: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="4" width="7" height="16" rx="1"/><rect x="14" y="4" width="7" height="16" rx="1"/></svg>',
  users: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
  calendar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="m9 11 3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>',
  search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg>',
  filter: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 5h16M7 12h10M10 19h4"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>',
  bell: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></svg>',
  x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 6 12 12M18 6 6 18"/></svg>',
  arrow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M5 12h14M13 6l6 6-6 6"/></svg>'
};

const config = window.NOVEX_CONFIG || {};
const initialAuthType = new URLSearchParams(window.location.hash.slice(1)).get('type') || new URLSearchParams(window.location.search).get('type');
const client = window.supabase?.createClient(config.supabaseUrl, config.supabasePublishableKey, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
});
const TZ = 'America/Lima';
const dateFormatter = new Intl.DateTimeFormat('es-PE', { day: '2-digit', month: 'short', year: 'numeric', timeZone: TZ });
const timeFormatter = new Intl.DateTimeFormat('es-PE', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: TZ });
const navItems = [
  ['home', 'Inicio', 'home'], ['vacancies', 'Vacantes', 'briefcase'], ['pipeline', 'Pipeline', 'columns'],
  ['candidates', 'Candidatos', 'users'], ['interviews', 'Entrevistas', 'calendar'], ['tasks', 'Tareas', 'check']
];
const titles = {
  home: ['Resumen', 'Panel de reclutamiento'], vacancies: ['Reclutamiento', 'Vacantes'],
  pipeline: ['Operaciones / Pipeline', 'Pipeline de candidatos'], candidates: ['Base de talento', 'Candidatos'],
  interviews: ['Agenda', 'Entrevistas'], tasks: ['Seguimiento', 'Tareas']
};
const state = {
  view: 'pipeline', vacancyId: null, search: '', filters: { minScore: 0, skill: '', location: '' },
  selected: new Set(), pendingMove: null, hrUser: null, authFlow: initialAuthType, stages: [], vacancies: [], candidates: [],
  interviews: [], tasks: [], loading: false
};
const elements = {
  authShell: document.getElementById('authShell'), appShell: document.getElementById('appShell'),
  authBox: document.getElementById('authBox'), pendingBox: document.getElementById('pendingBox'),
  inviteBox: document.getElementById('inviteBox'), bootBox: document.getElementById('bootBox'), root: document.getElementById('viewRoot'),
  overlay: document.getElementById('overlay'), drawer: document.getElementById('candidateDrawer'),
  moveModal: document.getElementById('moveModal'), compareModal: document.getElementById('compareModal'),
  vacancyModal: document.getElementById('vacancyModal'), filterModal: document.getElementById('filterModal')
};

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char]);
}
function friendlyError(error) {
  const message = error?.message || 'No se pudo completar la operacion.';
  return ({
    'Invalid login credentials': 'El correo o la contrasena no son correctos.',
    'User already registered': 'Ya existe una cuenta con este correo.',
    'Email not confirmed': 'Confirma tu correo antes de ingresar.'
  })[message] || message;
}
function setAuthView(view) {
  document.querySelectorAll('[data-auth-view]').forEach(button => {
    const active = button.dataset.authView === view;
    button.classList.toggle('active', active);
    button.setAttribute('aria-selected', String(active));
  });
  document.getElementById('loginForm').hidden = view !== 'login';
  document.getElementById('registerForm').hidden = view !== 'register';
}
function showAuth(mode, profile = null) {
  elements.authShell.hidden = false;
  elements.appShell.hidden = true;
  elements.authBox.hidden = mode !== 'auth';
  elements.pendingBox.hidden = mode !== 'pending';
  elements.inviteBox.hidden = mode !== 'invite';
  elements.bootBox.hidden = mode !== 'loading';
  if (mode === 'pending' && profile) document.getElementById('pendingCopy').textContent = `${profile.full_name}, tu cuenta (${profile.email}) fue creada. Un administrador debe activar el acceso.`;
}
function showApp() {
  elements.authShell.hidden = true;
  elements.appShell.hidden = false;
  const name = state.hrUser.full_name;
  document.getElementById('userName').textContent = name;
  document.getElementById('userAvatar').textContent = name.split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase();
}
async function resolveAccess() {
  showAuth('loading');
  const { data: { session }, error } = await client.auth.getSession();
  if (error || !session) return showAuth('auth');
  if (state.authFlow === 'invite') return showAuth('invite');
  const { data: profile, error: profileError } = await client.from('hr_users').select('id,full_name,email,is_active').maybeSingle();
  if (profileError) {
    showAuth('auth');
    document.getElementById('loginMessage').textContent = friendlyError(profileError);
    return;
  }
  if (!profile?.is_active) return showAuth('pending', profile || { full_name: 'Tu cuenta', email: session.user.email });
  state.hrUser = profile;
  showApp();
  await loadData();
}
function querySet() {
  return [
    client.from('recruitment_stages').select('*').order('display_order'),
    client.from('vacancies').select('*').order('created_at', { ascending: false }),
    client.from('applications').select('*').order('applied_at', { ascending: false }),
    client.from('candidates').select('*'),
    client.from('candidate_skills').select('candidate_id,skills(name)'),
    client.from('application_notes').select('*').order('created_at', { ascending: false }),
    client.from('application_stage_history').select('*').order('changed_at', { ascending: false }),
    client.from('interviews').select('*').order('starts_at'),
    client.from('interview_participants').select('*'),
    client.from('tasks').select('*').order('due_at', { ascending: true })
  ];
}
async function loadData() {
  state.loading = true;
  elements.root.innerHTML = '<div class="loading-state"><span class="spinner"></span><strong>Cargando datos de reclutamiento</strong></div>';
  try {
    const results = await Promise.all(querySet());
    const failed = results.find(result => result.error);
    if (failed) throw failed.error;
    const [stages, vacancies, applications, people, skills, notes, history, interviews, participants, tasks] = results.map(result => result.data);
    mapData({ stages, vacancies, applications, people, skills, notes, history, interviews, participants, tasks });
    render();
  } catch (error) {
    elements.root.innerHTML = `<div class="error-state"><strong>No pudimos cargar el panel</strong><span>${escapeHtml(friendlyError(error))}</span><button class="btn primary" id="retryData">Reintentar</button></div>`;
    document.getElementById('retryData').onclick = loadData;
  } finally { state.loading = false; }
}
function mapData(data) {
  state.stages = data.stages.map(stage => ({ id: stage.code, label: stage.label, color: stage.color_hex, terminal: stage.is_terminal }));
  const counts = data.applications.reduce((map, application) => { map[application.vacancy_id] = (map[application.vacancy_id] || 0) + 1; return map; }, {});
  state.vacancies = data.vacancies.map(vacancy => ({
    id: vacancy.id, title: vacancy.title, area: vacancy.area, location: vacancy.location_label,
    status: vacancy.status, candidates: counts[vacancy.id] || 0,
    published: vacancy.published_at ? dateFormatter.format(new Date(vacancy.published_at)) : 'Borrador'
  }));
  if (!state.vacancies.some(vacancy => vacancy.id === state.vacancyId)) state.vacancyId = state.vacancies[0]?.id || null;
  const people = new Map(data.people.map(person => [person.id, person]));
  const skills = data.skills.reduce((map, row) => { (map[row.candidate_id] ||= []).push(row.skills?.name); return map; }, {});
  const notes = data.notes.reduce((map, note) => { (map[note.application_id] ||= []).push(note); return map; }, {});
  const history = data.history.reduce((map, item) => { (map[item.application_id] ||= []).push(item); return map; }, {});
  state.candidates = data.applications.map(application => {
    const person = people.get(application.candidate_id) || {};
    return {
      id: person.id, applicationId: application.id, name: person.full_name || 'Sin nombre',
      role: person.professional_headline || 'Sin titular', stage: application.current_stage_code,
      score: application.score || 0, experience: `${person.experience_years || 0} anos`,
      location: person.location_label || 'Sin ubicacion',
      salary: person.expected_salary_amount ? `${person.expected_salary_currency} ${Number(person.expected_salary_amount).toLocaleString('es-PE')}` : 'No indicada',
      availability: person.availability_label || 'No indicada', skills: (skills[person.id] || []).filter(Boolean),
      email: person.email || '', appliedAt: application.applied_at, applied: formatDateTime(application.applied_at),
      note: notes[application.id]?.[0]?.body || '', history: history[application.id] || [],
      summary: person.professional_summary || '', vacancy: application.vacancy_id
    };
  });
  const applications = new Map(state.candidates.map(candidate => [candidate.applicationId, candidate]));
  const participants = data.participants.reduce((map, person) => { (map[person.interview_id] ||= []).push(person.participant_name); return map; }, {});
  state.interviews = data.interviews.map(interview => {
    const candidate = applications.get(interview.application_id);
    return { id: interview.id, candidate: candidate?.name || 'Candidato', role: candidate?.role || '', startsAt: interview.starts_at, endsAt: interview.ends_at, type: stageLabel(interview.interview_stage_code), people: participants[interview.id]?.join(' + ') || 'Participantes pendientes', status: interview.status };
  });
  state.tasks = data.tasks.map(task => ({ id: task.id, title: task.title, dueAt: task.due_at, done: task.status === 'completed', status: task.status }));
}
function formatDateTime(value) { return value ? `${dateFormatter.format(new Date(value))}, ${timeFormatter.format(new Date(value))}` : 'Sin fecha'; }
function stageLabel(id) { return state.stages.find(stage => stage.id === id)?.label || id || 'Inicio'; }
function activeVacancy() { return state.vacancies.find(vacancy => vacancy.id === state.vacancyId) || state.vacancies[0]; }
function displayVacancyStatus(status) { return ({ published: 'Activa', paused: 'Pausada', closed: 'Cerrada', draft: 'Borrador' })[status] || status; }
function vacancyBadge(status) { return status === 'published' ? 'active' : status; }
function filteredCandidates(global = false) {
  const term = state.search.trim().toLowerCase();
  return state.candidates.filter(candidate => {
    if (!global && candidate.vacancy !== state.vacancyId) return false;
    const haystack = [candidate.name, candidate.role, candidate.location, ...candidate.skills].join(' ').toLowerCase();
    return (!term || haystack.includes(term)) && candidate.score >= state.filters.minScore &&
      (!state.filters.skill || candidate.skills.some(skill => skill.toLowerCase().includes(state.filters.skill.toLowerCase()))) &&
      (!state.filters.location || candidate.location.toLowerCase().includes(state.filters.location.toLowerCase()));
  });
}
function renderNav() {
  document.getElementById('mainNav').innerHTML = navItems.map(([id, label, icon]) => `<button class="nav-item ${state.view === id ? 'active' : ''}" data-view="${id}" title="${label}">${icons[icon]}<span class="nav-label">${label}</span></button>`).join('');
}
function render() {
  renderNav();
  const [eyebrow, title] = titles[state.view];
  document.getElementById('pageEyebrow').textContent = eyebrow;
  document.getElementById('pageTitle').textContent = title;
  const action = document.getElementById('primaryAction');
  action.innerHTML = `${icons.plus}<span>Nueva vacante</span>`;
  action.onclick = openVacancyModal;
  ({ home: renderHome, vacancies: renderVacancies, pipeline: renderPipeline, candidates: renderCandidates, interviews: renderInterviews, tasks: renderTasks })[state.view]();
  renderCompareTray();
}
function toolbar(global = false) {
  return `<div class="toolbar"><div class="toolbar-left"><label class="search-box">${icons.search}<input id="candidateSearch" value="${escapeHtml(state.search)}" placeholder="Buscar por nombre, rol o habilidad" aria-label="Buscar candidatos"></label><button class="btn secondary filter-btn" id="filterBtn">${icons.filter}<span>Filtros</span></button></div><div class="toolbar-right"><span class="count-label">${filteredCandidates(global).length} candidatos</span></div></div>`;
}
function bindToolbar(global = false) {
  document.getElementById('candidateSearch')?.addEventListener('input', event => { state.search = event.target.value; global ? renderCandidates() : renderPipeline(); renderCompareTray(); });
  document.getElementById('filterBtn')?.addEventListener('click', openFilterModal);
}
function candidateCard(candidate, color) {
  return `<article class="candidate-card" draggable="true" data-candidate="${candidate.id}" style="--stage-color:${color}" tabindex="0"><div class="card-top"><div><h3 class="candidate-name">${escapeHtml(candidate.name)}</h3><p class="candidate-role">${escapeHtml(candidate.role)}</p></div><input class="compare-check" type="checkbox" data-select="${candidate.id}" ${state.selected.has(candidate.id) ? 'checked' : ''} aria-label="Seleccionar ${escapeHtml(candidate.name)} para comparar"></div><div class="score-row"><span class="score">${candidate.score}/100</span><span class="stars">${candidate.score >= 90 ? '\u2605\u2605\u2605' : candidate.score >= 80 ? '\u2605\u2605\u2606' : '\u2605\u2606\u2606'}</span></div><div class="tags">${candidate.skills.slice(0, 3).map(skill => `<span class="tag">${escapeHtml(skill)}</span>`).join('')}</div><div class="card-foot"><span class="status-note">${escapeHtml(candidate.availability)}</span><span>${escapeHtml(candidate.applied)}</span></div></article>`;
}
function renderPipeline() {
  const vacancy = activeVacancy();
  if (!vacancy) { elements.root.innerHTML = '<div class="empty-state"><strong>No hay vacantes</strong><span>Crea una vacante para iniciar el pipeline.</span></div>'; return; }
  const candidates = filteredCandidates();
  elements.root.innerHTML = `<section class="vacancy-strip"><div><strong>${escapeHtml(vacancy.title)}</strong><div class="vacancy-meta"><span><i class="dot"></i>${displayVacancyStatus(vacancy.status)}</span><span>${escapeHtml(vacancy.location)}</span><span>${vacancy.candidates} postulaciones</span></div></div><select class="vacancy-select" id="vacancySelect" aria-label="Seleccionar vacante">${state.vacancies.map(item => `<option value="${item.id}" ${item.id === state.vacancyId ? 'selected' : ''}>${escapeHtml(item.title)}</option>`).join('')}</select></section>${toolbar()}<section class="kanban" aria-label="Pipeline de candidatos">${state.stages.map(stage => { const items = candidates.filter(candidate => candidate.stage === stage.id); return `<div class="kanban-column" data-stage="${stage.id}" style="--stage-color:${stage.color}"><div class="column-head"><span class="column-title">${escapeHtml(stage.label)}</span><span class="column-count">${items.length}</span></div><div class="card-stack">${items.length ? items.map(candidate => candidateCard(candidate, stage.color)).join('') : '<div class="empty-column">Sin candidatos</div>'}</div></div>`; }).join('')}</section>`;
  document.getElementById('vacancySelect').onchange = event => { state.vacancyId = event.target.value; state.selected.clear(); render(); };
  bindToolbar(); bindCandidateInteractions();
}
function bindCandidateInteractions() {
  document.querySelectorAll('.candidate-card').forEach(card => {
    card.onclick = event => { if (!event.target.matches('.compare-check')) openCandidate(card.dataset.candidate); };
    card.onkeydown = event => { if (event.key === 'Enter') openCandidate(card.dataset.candidate); };
    card.ondragstart = event => { card.classList.add('dragging'); event.dataTransfer.setData('text/plain', card.dataset.candidate); };
    card.ondragend = () => card.classList.remove('dragging');
  });
  document.querySelectorAll('.compare-check').forEach(input => input.onchange = event => { event.target.checked ? state.selected.add(event.target.dataset.select) : state.selected.delete(event.target.dataset.select); renderCompareTray(); });
  document.querySelectorAll('.kanban-column').forEach(column => {
    column.ondragover = event => { event.preventDefault(); column.classList.add('drag-over'); };
    column.ondragleave = () => column.classList.remove('drag-over');
    column.ondrop = event => { event.preventDefault(); column.classList.remove('drag-over'); const candidate = state.candidates.find(item => item.id === event.dataTransfer.getData('text/plain')); if (candidate && candidate.stage !== column.dataset.stage) openMoveModal(candidate.id, column.dataset.stage); };
  });
}
function renderCompareTray() {
  const tray = document.getElementById('compareTray');
  const count = state.selected.size;
  tray.classList.toggle('visible', count > 0);
  tray.innerHTML = `<div><p><strong>${count}</strong> ${count === 1 ? 'candidato seleccionado' : 'candidatos seleccionados'}</p><small>Selecciona al menos 2 perfiles para comparar</small></div><div class="tray-actions"><button class="btn secondary" id="clearCompare">Limpiar</button><button class="btn primary" id="openCompare" ${count < 2 ? 'disabled' : ''}>Comparar</button></div>`;
  document.getElementById('clearCompare')?.addEventListener('click', () => { state.selected.clear(); render(); });
  document.getElementById('openCompare')?.addEventListener('click', openCompareModal);
}
function renderHome() {
  const now = Date.now();
  const active = state.vacancies.filter(vacancy => vacancy.status === 'published').length;
  const upcoming = state.interviews.filter(interview => { const time = new Date(interview.startsAt).getTime(); return time >= now && time <= now + 7 * 86400000 && interview.status === 'scheduled'; }).length;
  const pending = state.tasks.filter(task => !task.done && task.status !== 'cancelled').length;
  elements.root.innerHTML = `<section class="stats-grid"><div class="stat"><span class="stat-label">Vacantes activas</span><div class="stat-value"><strong>${active}</strong><span class="delta">DATOS REALES</span></div></div><div class="stat"><span class="stat-label">Postulaciones</span><div class="stat-value"><strong>${state.candidates.length}</strong><span class="delta">TOTAL</span></div></div><div class="stat"><span class="stat-label">Entrevistas proximas</span><div class="stat-value"><strong>${upcoming}</strong><span class="delta">7 DIAS</span></div></div><div class="stat"><span class="stat-label">Tareas pendientes</span><div class="stat-value"><strong>${pending}</strong><span class="delta">POR RESOLVER</span></div></div></section><div class="split-grid"><div><section class="section-block"><div class="section-head"><h2>Vacantes en curso</h2><button class="text-btn" data-go="vacancies">Ver todas</button></div>${vacancyTable()}</section></div><aside><section class="section-block"><div class="section-head"><h2>Proximas entrevistas</h2><button class="text-btn" data-go="interviews">Agenda</button></div>${interviewList(state.interviews.slice(0, 2))}</section><section class="section-block"><div class="section-head"><h2>Tareas</h2></div>${taskList(state.tasks.slice(0, 3))}</section></aside></div>`;
  bindDashboardLinks(); bindTaskChecks(); bindVacancyRows();
}
function vacancyTable() {
  if (!state.vacancies.length) return '<div class="empty-state"><strong>No hay vacantes</strong><span>Crea el primer borrador.</span></div>';
  return `<div class="table-wrap"><table class="data-table"><thead><tr><th>Vacante</th><th>Estado</th><th>Postulaciones</th><th>Publicada</th></tr></thead><tbody>${state.vacancies.map(vacancy => `<tr data-vacancy="${vacancy.id}"><td><strong>${escapeHtml(vacancy.title)}</strong><br><span class="candidate-role">${escapeHtml(vacancy.area)} / ${escapeHtml(vacancy.location)}</span></td><td><span class="badge ${vacancyBadge(vacancy.status)}">${displayVacancyStatus(vacancy.status)}</span></td><td>${vacancy.candidates}</td><td>${escapeHtml(vacancy.published)}</td></tr>`).join('')}</tbody></table></div>`;
}
function renderVacancies() { elements.root.innerHTML = `<div class="section-head"><div><p class="eyebrow">${state.vacancies.length} registros</p><h2 style="margin:0">Todas las vacantes</h2></div></div>${vacancyTable()}`; bindVacancyRows(); }
function bindVacancyRows() { document.querySelectorAll('[data-vacancy]').forEach(row => row.onclick = () => { state.vacancyId = row.dataset.vacancy; state.view = 'pipeline'; render(); }); }
function renderCandidates() {
  const candidates = filteredCandidates(true);
  elements.root.innerHTML = `${toolbar(true)}<div class="table-wrap"><table class="data-table"><thead><tr><th>Candidato</th><th>Vacante</th><th>Etapa</th><th>Puntuacion</th><th>Ubicacion</th><th>Disponibilidad</th></tr></thead><tbody>${candidates.map(candidate => `<tr data-person="${candidate.id}"><td><strong>${escapeHtml(candidate.name)}</strong><br><span class="candidate-role">${escapeHtml(candidate.role)}</span></td><td>${escapeHtml(state.vacancies.find(vacancy => vacancy.id === candidate.vacancy)?.title || '')}</td><td><span class="badge ${candidate.stage.includes('entrevista') ? 'interview' : candidate.stage}">${escapeHtml(stageLabel(candidate.stage))}</span></td><td><strong>${candidate.score}</strong>/100</td><td>${escapeHtml(candidate.location)}</td><td>${escapeHtml(candidate.availability)}</td></tr>`).join('')}</tbody></table></div>${candidates.length ? '' : '<div class="empty-state"><strong>No encontramos candidatos</strong><span>Ajusta la busqueda o limpia los filtros.</span></div>'}`;
  bindToolbar(true); document.querySelectorAll('[data-person]').forEach(row => row.onclick = () => openCandidate(row.dataset.person));
}
function interviewList(items) {
  if (!items.length) return '<div class="empty-state compact"><strong>Sin entrevistas</strong><span>No hay coordinaciones registradas.</span></div>';
  return `<div class="timeline-list">${items.map(interview => { const date = new Date(interview.startsAt); return `<div class="timeline-item"><div class="date-box"><strong>${new Intl.DateTimeFormat('es-PE', { day: '2-digit', timeZone: TZ }).format(date)}</strong><span>${new Intl.DateTimeFormat('es-PE', { month: 'short', timeZone: TZ }).format(date)}</span></div><div class="item-copy"><strong>${escapeHtml(interview.candidate)}</strong><span>${timeFormatter.format(date)} / ${escapeHtml(interview.type)}</span><span>${escapeHtml(interview.people)} / Sincronizacion externa pendiente</span></div></div>`; }).join('')}</div>`;
}
function renderInterviews() { elements.root.innerHTML = `<div class="section-head"><div><p class="eyebrow">Sincronizacion externa pendiente</p><h2 style="margin:0">Agenda de entrevistas</h2></div><button class="btn dark" id="scheduleBtn">${icons.plus} Agendar entrevista</button></div>${interviewList(state.interviews)}`; document.getElementById('scheduleBtn').onclick = () => showToast('Selecciona un candidato desde su perfil para agendar.'); }
function taskList(items) {
  if (!items.length) return '<div class="empty-state compact"><strong>Sin tareas</strong><span>No hay seguimientos registrados.</span></div>';
  return `<div class="task-list">${items.map(task => `<label class="task-item ${task.done ? 'completed' : ''}"><input class="task-check" type="checkbox" data-task="${task.id}" ${task.done ? 'checked' : ''}><span class="item-copy"><strong>${escapeHtml(task.title)}</strong><span>${task.dueAt ? formatDateTime(task.dueAt) : 'Sin fecha limite'}</span></span></label>`).join('')}</div>`;
}
function renderTasks() { elements.root.innerHTML = `<div class="section-head"><div><p class="eyebrow">${state.tasks.filter(task => !task.done && task.status !== 'cancelled').length} pendientes</p><h2 style="margin:0">Seguimientos del equipo</h2></div></div>${taskList(state.tasks)}`; bindTaskChecks(); }
function bindTaskChecks() {
  document.querySelectorAll('[data-task]').forEach(box => box.onchange = async () => {
    const done = box.checked; box.disabled = true;
    const { error } = await client.from('tasks').update({ status: done ? 'completed' : 'pending', completed_at: done ? new Date().toISOString() : null }).eq('id', box.dataset.task);
    if (error) { box.checked = !done; box.disabled = false; showToast(friendlyError(error), true); return; }
    await loadData(); showToast(done ? 'Tarea completada.' : 'Tarea reabierta.');
  });
}
function bindDashboardLinks() { document.querySelectorAll('[data-go]').forEach(button => button.onclick = () => { state.view = button.dataset.go; render(); }); }
function openCandidate(id) {
  const candidate = state.candidates.find(item => item.id === id); if (!candidate) return;
  const vacancy = state.vacancies.find(item => item.id === candidate.vacancy);
  const history = candidate.history.length ? candidate.history.map(item => `<div class="history-row"><i class="history-dot"></i><span>${escapeHtml(stageLabel(item.from_stage_code))} a ${escapeHtml(stageLabel(item.to_stage_code))}${item.change_reason ? ` / ${escapeHtml(item.change_reason)}` : ''}</span><time>${escapeHtml(dateFormatter.format(new Date(item.changed_at))).toUpperCase()}</time></div>`).join('') : '<div class="empty-state compact"><span>Sin movimientos registrados.</span></div>';
  elements.drawer.innerHTML = `<div class="drawer-head"><div><p class="eyebrow">${escapeHtml(stageLabel(candidate.stage))} / ${escapeHtml(vacancy?.title || '')}</p><h2>${escapeHtml(candidate.name)}</h2></div><button class="icon-btn close-ui" aria-label="Cerrar detalle">${icons.x}</button></div><div class="drawer-body"><div class="profile-summary"><div class="profile-cell"><span>Puntuacion</span><strong>${candidate.score}/100</strong></div><div class="profile-cell"><span>Disponibilidad</span><strong>${escapeHtml(candidate.availability)}</strong></div><div class="profile-cell"><span>Experiencia</span><strong>${escapeHtml(candidate.experience)}</strong></div><div class="profile-cell"><span>Expectativa</span><strong>${escapeHtml(candidate.salary)}</strong></div><div class="profile-cell"><span>Ubicacion</span><strong>${escapeHtml(candidate.location)}</strong></div><div class="profile-cell"><span>Contacto</span><strong>${escapeHtml(candidate.email)}</strong></div></div><section class="profile-section"><h3>Habilidades</h3><div class="tags">${candidate.skills.map(skill => `<span class="tag">${escapeHtml(skill)}</span>`).join('')}</div></section><section class="profile-section"><h3>Resumen profesional</h3><p>${escapeHtml(candidate.summary || `${candidate.role} con ${candidate.experience} de experiencia.`)}</p></section><section class="profile-section"><h3>Notas internas</h3><textarea class="notes-area" id="candidateNote">${escapeHtml(candidate.note)}</textarea><button class="btn secondary" id="saveNote" style="margin-top:9px">Guardar nota</button></section><section class="profile-section"><h3>Historial</h3><div class="history">${history}</div></section><button class="btn dark" id="moveFromDrawer" style="width:100%">Cambiar etapa ${icons.arrow}</button></div>`;
  showLayer(elements.drawer); elements.drawer.querySelector('.close-ui').onclick = closeLayers;
  document.getElementById('saveNote').onclick = () => saveNote(candidate);
  document.getElementById('moveFromDrawer').onclick = () => { closeLayers(); openStagePicker(candidate); };
}
async function saveNote(candidate) {
  const button = document.getElementById('saveNote');
  const body = document.getElementById('candidateNote').value.trim();
  if (!body) return showToast('Escribe una nota antes de guardar.', true);
  button.disabled = true;
  const { error } = await client.from('application_notes').insert({ application_id: candidate.applicationId, author_id: state.hrUser.id, body });
  if (error) { button.disabled = false; showToast(friendlyError(error), true); return; }
  closeLayers(); await loadData(); showToast('Nota guardada en el perfil.');
}
function openStagePicker(candidate) {
  elements.moveModal.innerHTML = `<div class="modal-head"><div><p class="eyebrow">Mover candidato</p><h2 id="moveTitle">Selecciona la nueva etapa</h2></div><button class="icon-btn close-ui" aria-label="Cerrar">${icons.x}</button></div><div class="modal-body"><div class="field"><label for="stagePicker">Etapa de destino</label><select id="stagePicker">${state.stages.filter(stage => stage.id !== candidate.stage).map(stage => `<option value="${stage.id}">${escapeHtml(stage.label)}</option>`).join('')}</select></div></div><div class="modal-foot"><button class="btn secondary close-ui">Cancelar</button><button class="btn primary" id="continueMove">Continuar</button></div>`;
  showLayer(elements.moveModal); bindCloseButtons(); document.getElementById('continueMove').onclick = () => openMoveModal(candidate.id, document.getElementById('stagePicker').value);
}
function openMoveModal(candidateId, nextStage) {
  const candidate = state.candidates.find(item => item.id === candidateId); if (!candidate) return;
  state.pendingMove = { candidateId, nextStage };
  const interview = nextStage.startsWith('entrevista');
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  elements.moveModal.innerHTML = `<div class="modal-head"><div><p class="eyebrow">Confirmar movimiento</p><h2 id="moveTitle">Actualizar a ${escapeHtml(stageLabel(nextStage))}</h2></div><button class="icon-btn close-ui" aria-label="Cerrar">${icons.x}</button></div><div class="modal-body"><div class="move-banner"><div><strong>${escapeHtml(candidate.name)}</strong><span>${escapeHtml(candidate.role)}</span></div><div>${escapeHtml(stageLabel(candidate.stage))} <span class="move-arrow">\u2192</span> ${escapeHtml(stageLabel(nextStage))}</div></div><div class="form-grid"><div class="field full"><label for="moveReason">Motivo o contexto</label><input id="moveReason" placeholder="Opcional"></div><label class="check-row full"><input id="queueEmail" type="checkbox" checked><span><strong>Guardar comunicacion en cola</strong><span>Se registrara como queued; no se enviara correo.</span></span></label><div class="field full"><label for="emailMessage">Mensaje</label><textarea id="emailMessage">Hola ${escapeHtml(candidate.name.split(' ')[0])},\n\nTu postulacion avanzo a la etapa ${escapeHtml(stageLabel(nextStage))}. Pronto recibiras los siguientes detalles.\n\nEquipo de Novex</textarea></div><label class="check-row full"><input id="createTask" type="checkbox" checked><span><strong>Crear tarea de seguimiento</strong><span>Quedara asociada a esta postulacion.</span></span></label>${interview ? `<div class="field"><label for="interviewDate">Fecha</label><input id="interviewDate" type="date" value="${tomorrow}"></div><div class="field"><label for="interviewTime">Hora</label><input id="interviewTime" type="time" value="10:00"></div><label class="check-row full"><input id="scheduleInterview" type="checkbox" checked><span><strong>Registrar entrevista</strong><span>Quedara pendiente de sincronizacion externa.</span></span></label>` : ''}</div></div><div class="modal-foot"><button class="btn secondary close-ui">Cancelar</button><button class="btn primary" id="confirmMove">Confirmar cambio</button></div>`;
  showLayer(elements.moveModal); bindCloseButtons(); document.getElementById('confirmMove').onclick = confirmMove;
}
async function confirmMove() {
  if (!state.pendingMove) return;
  const candidate = state.candidates.find(item => item.id === state.pendingMove.candidateId);
  const button = document.getElementById('confirmMove'); button.disabled = true;
  let startsAt = null;
  if (document.getElementById('scheduleInterview')?.checked) {
    const date = document.getElementById('interviewDate').value;
    const time = document.getElementById('interviewTime').value;
    if (!date || !time) { button.disabled = false; showToast('Selecciona fecha y hora para la entrevista.', true); return; }
    startsAt = new Date(`${date}T${time}:00-05:00`).toISOString();
  }
  const target = state.pendingMove.nextStage;
  const { error } = await client.rpc('process_application_stage_change', {
    p_application_id: candidate.applicationId, p_to_stage_code: target,
    p_change_reason: document.getElementById('moveReason').value || null,
    p_queue_communication: document.getElementById('queueEmail').checked,
    p_message: document.getElementById('emailMessage').value || null,
    p_create_task: document.getElementById('createTask').checked,
    p_interview_starts_at: startsAt, p_interview_duration_minutes: 45
  });
  if (error) { button.disabled = false; showToast(friendlyError(error), true); return; }
  state.pendingMove = null; closeLayers(); await loadData(); showToast(`${candidate.name} fue movido a ${stageLabel(target)}.`);
}
function openCompareModal() {
  const selected = [...state.selected].map(id => state.candidates.find(candidate => candidate.id === id)).filter(Boolean);
  const rows = [['Perfil', ...selected.map(c => c.name)], ['Rol', ...selected.map(c => c.role)], ['Puntuacion', ...selected.map(c => `${c.score}/100`)], ['Experiencia', ...selected.map(c => c.experience)], ['Habilidades', ...selected.map(c => c.skills.join(', '))], ['Ubicacion', ...selected.map(c => c.location)], ['Expectativa', ...selected.map(c => c.salary)], ['Disponibilidad', ...selected.map(c => c.availability)], ['Notas', ...selected.map(c => c.note)]];
  elements.compareModal.innerHTML = `<div class="modal-head"><div><p class="eyebrow">Evaluacion paralela</p><h2 id="compareTitle">Comparar postulantes</h2></div><button class="icon-btn close-ui" aria-label="Cerrar">${icons.x}</button></div><div class="modal-body"><div class="compare-grid" style="--compare-count:${selected.length}">${rows.map(row => `<div class="compare-row">${row.map((cell, index) => `<div class="compare-cell ${index === 0 ? 'label' : ''}">${escapeHtml(cell)}</div>`).join('')}</div>`).join('')}</div></div><div class="modal-foot"><button class="btn dark close-ui">Cerrar comparacion</button></div>`;
  showLayer(elements.compareModal); bindCloseButtons();
}
function openVacancyModal() {
  elements.vacancyModal.innerHTML = `<div class="modal-head"><div><p class="eyebrow">Nueva busqueda</p><h2 id="vacancyTitle">Crear vacante</h2></div><button class="icon-btn close-ui" aria-label="Cerrar">${icons.x}</button></div><form id="vacancyForm"><div class="modal-body"><div class="form-grid"><div class="field full"><label for="vacancyName">Nombre de la vacante</label><input id="vacancyName" required placeholder="Ej. Product Manager"></div><div class="field"><label for="vacancyArea">Area</label><input id="vacancyArea" required placeholder="Producto"></div><div class="field"><label for="vacancyLocation">Ubicacion</label><input id="vacancyLocation" required placeholder="Lima / Hibrido"></div><div class="field full"><label for="vacancyDescription">Descripcion</label><textarea id="vacancyDescription" placeholder="Responsabilidades y perfil esperado"></textarea></div></div></div><div class="modal-foot"><button type="button" class="btn secondary close-ui">Cancelar</button><button class="btn primary" type="submit">Crear borrador</button></div></form>`;
  showLayer(elements.vacancyModal); bindCloseButtons(); document.getElementById('vacancyForm').onsubmit = createVacancy;
}
async function createVacancy(event) {
  event.preventDefault(); const button = event.submitter; button.disabled = true;
  const { error } = await client.from('vacancies').insert({
    id: `vx-${crypto.randomUUID()}`, title: document.getElementById('vacancyName').value.trim(),
    area: document.getElementById('vacancyArea').value.trim(), location_label: document.getElementById('vacancyLocation').value.trim(),
    description: document.getElementById('vacancyDescription').value.trim() || null, status: 'draft', created_by: state.hrUser.id
  });
  if (error) { button.disabled = false; showToast(friendlyError(error), true); return; }
  closeLayers(); state.view = 'vacancies'; await loadData(); showToast('Vacante creada como borrador.');
}
function openFilterModal() {
  elements.filterModal.innerHTML = `<div class="modal-head"><div><p class="eyebrow">Refinar resultados</p><h2 id="filterTitle">Filtros de candidatos</h2></div><button class="icon-btn close-ui" aria-label="Cerrar">${icons.x}</button></div><div class="modal-body"><div class="form-grid"><div class="field"><label for="minScore">Puntuacion minima</label><select id="minScore"><option value="0">Todas</option><option value="70" ${state.filters.minScore === 70 ? 'selected' : ''}>70 o mas</option><option value="80" ${state.filters.minScore === 80 ? 'selected' : ''}>80 o mas</option><option value="90" ${state.filters.minScore === 90 ? 'selected' : ''}>90 o mas</option></select></div><div class="field"><label for="filterLocation">Ubicacion</label><input id="filterLocation" value="${escapeHtml(state.filters.location)}" placeholder="Ej. Lima"></div><div class="field full"><label for="filterSkill">Habilidad</label><input id="filterSkill" value="${escapeHtml(state.filters.skill)}" placeholder="Ej. Figma"></div></div></div><div class="modal-foot"><button class="btn secondary" id="clearFilters">Limpiar</button><button class="btn primary" id="applyFilters">Aplicar filtros</button></div>`;
  showLayer(elements.filterModal); bindCloseButtons();
  document.getElementById('clearFilters').onclick = () => { state.filters = { minScore: 0, skill: '', location: '' }; closeLayers(); render(); };
  document.getElementById('applyFilters').onclick = () => { state.filters = { minScore: Number(document.getElementById('minScore').value), skill: document.getElementById('filterSkill').value, location: document.getElementById('filterLocation').value }; closeLayers(); render(); };
}
function showLayer(element) { closeLayers(); elements.overlay.classList.add('visible'); element.classList.add('visible'); document.body.style.overflow = 'hidden'; setTimeout(() => element.querySelector('button, input, select, textarea')?.focus(), 30); }
function closeLayers() { elements.overlay.classList.remove('visible'); [elements.drawer, elements.moveModal, elements.compareModal, elements.vacancyModal, elements.filterModal].forEach(element => element.classList.remove('visible')); document.body.style.overflow = ''; }
function bindCloseButtons() { document.querySelectorAll('.close-ui').forEach(button => button.onclick = closeLayers); }
function showToast(message, error = false) { const toast = document.getElementById('toast'); toast.textContent = message; toast.classList.toggle('error', error); toast.classList.add('visible'); clearTimeout(showToast.timer); showToast.timer = setTimeout(() => toast.classList.remove('visible'), 3600); }
async function submitLogin(event) {
  event.preventDefault(); const button = event.submitter; button.disabled = true;
  const message = document.getElementById('loginMessage'); message.textContent = '';
  const { error } = await client.auth.signInWithPassword({ email: document.getElementById('loginEmail').value.trim(), password: document.getElementById('loginPassword').value });
  button.disabled = false; if (error) { message.textContent = friendlyError(error); return; } await resolveAccess();
}
async function submitRegistration(event) {
  event.preventDefault(); const button = event.submitter; button.disabled = true;
  const message = document.getElementById('registerMessage'); message.textContent = ''; message.classList.remove('success');
  const { data, error } = await client.auth.signUp({
    email: document.getElementById('registerEmail').value.trim(), password: document.getElementById('registerPassword').value,
    options: { data: { full_name: document.getElementById('registerName').value.trim() }, emailRedirectTo: config.siteUrl }
  });
  button.disabled = false;
  if (error) { message.textContent = friendlyError(error); return; }
  if (!data.session) { message.classList.add('success'); message.textContent = 'Cuenta creada. Revisa tu correo para confirmar la direccion; despues quedara pendiente de aprobacion.'; return; }
  await resolveAccess();
}
async function completeInvitation(event) {
  event.preventDefault();
  const password = document.getElementById('invitePassword').value;
  const confirmation = document.getElementById('invitePasswordConfirm').value;
  const message = document.getElementById('inviteMessage');
  if (password !== confirmation) { message.textContent = 'Las contrasenas no coinciden.'; return; }
  const button = event.submitter; button.disabled = true; message.textContent = '';
  const { error } = await client.auth.updateUser({ password });
  button.disabled = false;
  if (error) { message.textContent = friendlyError(error); return; }
  state.authFlow = null;
  window.history.replaceState({}, document.title, window.location.pathname);
  await resolveAccess();
}
function registerWebMCP() {
  const context = document.modelContext; if (!context?.registerTool) return;
  const tools = [
    { name: 'list_candidates', title: 'Listar candidatos', description: 'Devuelve los candidatos visibles de la vacante actual.', inputSchema: { type: 'object', properties: {}, additionalProperties: false }, annotations: { readOnlyHint: true, untrustedContentHint: false }, execute: async () => filteredCandidates().map(candidate => ({ id: candidate.id, applicationId: candidate.applicationId, name: candidate.name, stage: candidate.stage, score: candidate.score })) },
    { name: 'move_candidate', title: 'Mover candidato', description: 'Persiste el cambio de etapa de un candidato.', inputSchema: { type: 'object', properties: { candidateId: { type: 'string' }, stage: { type: 'string' } }, required: ['candidateId', 'stage'], additionalProperties: false }, annotations: { readOnlyHint: false, untrustedContentHint: false }, execute: async input => { const candidate = state.candidates.find(item => item.id === input.candidateId); if (!candidate || !state.stages.some(stage => stage.id === input.stage)) throw new Error('Candidato o etapa no validos'); const { error } = await client.rpc('process_application_stage_change', { p_application_id: candidate.applicationId, p_to_stage_code: input.stage, p_queue_communication: false, p_create_task: false }); if (error) throw error; await loadData(); return { id: candidate.id, stage: input.stage }; } },
    { name: 'compare_candidates', title: 'Comparar candidatos', description: 'Abre la comparacion de dos o mas candidatos.', inputSchema: { type: 'object', properties: { candidateIds: { type: 'array', minItems: 2, items: { type: 'string' } } }, required: ['candidateIds'], additionalProperties: false }, annotations: { readOnlyHint: true, untrustedContentHint: false }, execute: async input => { const found = input.candidateIds.filter(id => state.candidates.some(candidate => candidate.id === id)); if (found.length < 2) throw new Error('Se requieren dos candidatos validos'); state.selected = new Set(found); renderCompareTray(); openCompareModal(); return { compared: found }; } }
  ];
  tools.forEach(tool => { try { Promise.resolve(context.registerTool(tool)).catch(() => {}); } catch (_) {} });
}

document.querySelectorAll('[data-auth-view]').forEach(button => button.onclick = () => setAuthView(button.dataset.authView));
document.getElementById('loginForm').onsubmit = submitLogin;
document.getElementById('registerForm').onsubmit = submitRegistration;
document.getElementById('inviteForm').onsubmit = completeInvitation;
document.getElementById('retryAccess').onclick = resolveAccess;
document.getElementById('pendingLogout').onclick = () => client.auth.signOut();
document.getElementById('logoutBtn').onclick = () => client.auth.signOut();
document.getElementById('mainNav').onclick = event => { const button = event.target.closest('[data-view]'); if (!button) return; state.view = button.dataset.view; state.search = ''; render(); };
document.getElementById('notificationsBtn').innerHTML = icons.bell;
document.getElementById('notificationsBtn').onclick = () => showToast(`${state.tasks.filter(task => !task.done).length} tareas pendientes y ${state.interviews.filter(interview => interview.status === 'scheduled').length} entrevistas programadas.`);
elements.overlay.onclick = closeLayers;
document.addEventListener('keydown', event => { if (event.key === 'Escape') closeLayers(); });

if (!client) {
  showAuth('auth'); document.getElementById('loginMessage').textContent = 'No se pudo iniciar el cliente de Supabase.';
} else {
  client.auth.onAuthStateChange(event => { if (event === 'SIGNED_OUT') { state.hrUser = null; showAuth('auth'); } });
  resolveAccess(); registerWebMCP();
}
