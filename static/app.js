/* ============================================================
   FIORI - Web App per Onoranze Funebri
   app.js - Vanilla JavaScript SPA
   ============================================================ */

'use strict';

// -------------------------------------------------------
// STATO GLOBALE
// -------------------------------------------------------
const state = {
  view: 'lista',          // 'lista' | 'dettaglio' | 'statistiche'
  defunti: [],
  defuntoCorrente: null,  // oggetto defunto
  fioriCorrente: [],      // fiori del defunto corrente
  filtroFiori: 'tutti',   // 'tutti' | 'pagati' | 'non-pagati'
  mostraArchiviati: false,
  searchQuery: '',
  riepilogo: null,
  selezioneFiori: [],       // [10] batch pagamento
  modalitaSelezione: false, // [10] batch pagamento
};

// -------------------------------------------------------
// UTILITA'
// -------------------------------------------------------

/** Formatta un numero come valuta EUR */
function formatCurrency(value) {
  const n = parseFloat(value) || 0;
  return n.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' });
}

/** Formatta una data ISO in formato italiano */
function formatDate(dateStr) {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
}

/** Escape HTML per prevenire XSS */
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Mostra un toast di notifica */
function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast toast--${type}`;
  toast.setAttribute('role', 'status');
  toast.textContent = message;
  container.appendChild(toast);
  requestAnimationFrame(() => {
    requestAnimationFrame(() => toast.classList.add('toast--visible'));
  });
  setTimeout(() => {
    toast.classList.remove('toast--visible');
    toast.addEventListener('transitionend', () => toast.remove(), { once: true });
  }, 3200);
}

/** Debounce: ritarda l'esecuzione di fn */
function debounce(fn, delay) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

// -------------------------------------------------------
// [6] LOADING STATE
// -------------------------------------------------------

function setLoading(show) {
  const app = document.getElementById('app');
  if (show) {
    app.classList.add('is-loading');
  } else {
    app.classList.remove('is-loading');
  }
}

// -------------------------------------------------------
// GESTIONE MODALI
// -------------------------------------------------------

/** Riferimento all'elemento che aveva focus prima dell'apertura modale [4] */
let _lastFocused = null;

/** Listener corrente per il focus trap [3] */
let _focusTrapListener = null;

/** Intrappola il focus all'interno della modale [3] */
function trapFocus(backdropEl) {
  const FOCUSABLE = 'input:not([type=hidden]):not([hidden]), select, textarea, button:not([hidden])';
  _focusTrapListener = function (e) {
    if (e.key !== 'Tab') return;
    const focusableEls = Array.from(backdropEl.querySelectorAll(FOCUSABLE)).filter(
      el => !el.disabled && el.offsetParent !== null
    );
    if (focusableEls.length === 0) return;
    const first = focusableEls[0];
    const last = focusableEls[focusableEls.length - 1];
    if (e.shiftKey) {
      if (document.activeElement === first) {
        e.preventDefault();
        last.focus();
      }
    } else {
      if (document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  };
  backdropEl.addEventListener('keydown', _focusTrapListener);
}

/** Apre un modal (usa classe is-open su backdrop) */
function openModal(backdropId) {
  _lastFocused = document.activeElement; // [4] salva focus corrente
  const backdrop = document.getElementById(backdropId);
  backdrop.classList.add('is-open');
  document.body.classList.add('modal-open');
  trapFocus(backdrop); // [3] attiva focus trap
  // Focus primo campo interattivo
  const focusable = backdrop.querySelector('input:not([type=hidden]), select, textarea, button.btn-primary');
  if (focusable) setTimeout(() => focusable.focus(), 80);
}

/** Chiude un modal */
function closeModal(backdropId) {
  const backdrop = document.getElementById(backdropId);
  backdrop.classList.remove('is-open');
  // [3] rimuovi focus trap
  if (_focusTrapListener) {
    backdrop.removeEventListener('keydown', _focusTrapListener);
    _focusTrapListener = null;
  }
  // Rimuovi modal-open solo se nessun modal e' aperto
  const openModals = document.querySelectorAll('.modal-backdrop.is-open');
  if (openModals.length === 0) {
    document.body.classList.remove('modal-open');
  }
  // [4] ripristina focus
  if (_lastFocused) {
    _lastFocused.focus();
    _lastFocused = null;
  }
}

/** Mostra una finestra di conferma personalizzata */
function showConfirm(message, onConfirm) {
  document.getElementById('modal-confirm-message').textContent = message;
  openModal('modal-confirm-backdrop');

  const okBtn = document.getElementById('modal-confirm-ok');
  const cancelBtn = document.getElementById('modal-confirm-cancel');
  const backdrop = document.getElementById('modal-confirm-backdrop');

  function cleanup() {
    closeModal('modal-confirm-backdrop');
    okBtn.removeEventListener('click', handleOk);
    cancelBtn.removeEventListener('click', handleCancel);
    backdrop.removeEventListener('click', handleBackdropClick);
  }
  function handleOk() { cleanup(); onConfirm(); }
  function handleCancel() { cleanup(); }
  function handleBackdropClick(e) {
    if (e.target === backdrop) { cleanup(); }
  }

  okBtn.addEventListener('click', handleOk, { once: true });
  cancelBtn.addEventListener('click', handleCancel, { once: true });
  backdrop.addEventListener('click', handleBackdropClick);
}

// -------------------------------------------------------
// API LAYER
// -------------------------------------------------------

async function apiFetch(path, options = {}) {
  let res;
  try { // [5] network error handling
    res = await fetch(path, {
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
      ...options,
    });
  } catch (err) {
    if (err instanceof TypeError) {
      throw new Error('Connessione di rete assente. Controlla la connessione.');
    }
    throw err;
  }
  if (!res.ok) {
    let errMsg = `Errore ${res.status}`;
    try {
      const body = await res.json();
      if (body.error) errMsg = body.error;
    } catch (_) { /* ignore */ }
    throw new Error(errMsg);
  }
  if (res.status === 204) return null;
  return res.json();
}

async function apiGetDefunti(search = '', includeArchived = false) {
  const params = new URLSearchParams();
  if (search) params.set('search', search);
  if (includeArchived) params.set('archived', '1');
  return apiFetch(`/api/defunti?${params}`);
}

async function apiGetDefunto(id) {
  return apiFetch(`/api/defunti/${id}`);
}

async function apiCreateDefunto(data) {
  return apiFetch('/api/defunti', { method: 'POST', body: JSON.stringify(data) });
}

async function apiUpdateDefunto(id, data) {
  return apiFetch(`/api/defunti/${id}`, { method: 'PUT', body: JSON.stringify(data) });
}

async function apiArchiveDefunto(id) {
  return apiFetch(`/api/defunti/${id}`, { method: 'DELETE' });
}

async function apiDeleteDefunto(id) {
  return apiFetch(`/api/defunti/${id}/elimina`, { method: 'DELETE' });
}

/** [8] De-archiviazione */
async function apiRipristinaDefunto(id) {
  return apiFetch(`/api/defunti/${id}/ripristina`, { method: 'PATCH' });
}

async function apiCreateFiore(defuntoId, data) {
  return apiFetch(`/api/defunti/${defuntoId}/fiori`, { method: 'POST', body: JSON.stringify(data) });
}

async function apiUpdateFiore(fioreId, data) {
  return apiFetch(`/api/fiori/${fioreId}`, { method: 'PUT', body: JSON.stringify(data) });
}

async function apiDeleteFiore(fioreId) {
  return apiFetch(`/api/fiori/${fioreId}`, { method: 'DELETE' });
}

async function apiGetRiepilogo(defuntoId) {
  return apiFetch(`/api/defunti/${defuntoId}/riepilogo`);
}

/** [10] Batch pagamento */
async function apiBatchPagamento(ids, pagato, pagato_da) {
  return apiFetch('/api/fiori/batch-pagamento', {
    method: 'PATCH',
    body: JSON.stringify({ ids, pagato: pagato ? 1 : 0, pagato_da: pagato_da || null }),
  });
}

// -------------------------------------------------------
// NAVIGAZIONE SPA
// -------------------------------------------------------

function showView(name) {
  state.view = name;
  document.getElementById('view-lista').hidden = name !== 'lista';
  document.getElementById('view-dettaglio').hidden = name !== 'dettaglio';
  document.getElementById('view-statistiche').hidden = name !== 'statistiche';

  const btnBack = document.getElementById('btn-back');
  const navbarTitle = document.getElementById('navbar-title');
  const fab = document.getElementById('fab');
  const btnArchived = document.getElementById('btn-show-archived');
  const btnStats = document.getElementById('btn-show-stats');

  if (name === 'lista') {
    btnBack.hidden = !state.mostraArchiviati;
    navbarTitle.textContent = state.mostraArchiviati ? 'Archivio' : 'Lista defunti';
    fab.hidden = state.mostraArchiviati;
    fab.setAttribute('aria-label', 'Aggiungi defunto');
    btnArchived.hidden = state.mostraArchiviati;
    btnStats.hidden = state.mostraArchiviati;
    document.querySelector('.search-wrapper').style.display = state.mostraArchiviati ? 'none' : '';
  } else if (name === 'statistiche') {
    btnBack.hidden = false;
    btnArchived.hidden = true;
    btnStats.hidden = true;
    fab.hidden = true;
    navbarTitle.textContent = 'Statistiche';
    document.querySelector('.search-wrapper').style.display = 'none';
  } else {
    // dettaglio
    btnBack.hidden = false;
    btnArchived.hidden = true;
    btnStats.hidden = true;
    fab.setAttribute('aria-label', 'Aggiungi composizione');
    document.querySelector('.search-wrapper').style.display = 'none'; // [7] nascondi search nel dettaglio
  }

  // [12] History API
  history.pushState({ view: name }, '', '');
}

// -------------------------------------------------------
// RENDER: LISTA DEFUNTI
// -------------------------------------------------------

function renderListaDefunti(defunti) {
  const container = document.getElementById('lista-defunti');
  const emptyEl = document.getElementById('lista-empty');

  // Rimuovi cards esistenti
  Array.from(container.children).forEach(child => {
    if (child !== emptyEl) child.remove();
  });

  if (!defunti || defunti.length === 0) {
    if (state.mostraArchiviati) {
      emptyEl.querySelector('.empty-state-title').textContent = 'Nessuna pratica archiviata';
      emptyEl.querySelector('.empty-state-sub').textContent = 'Non ci sono pratiche archiviate.';
    } else {
      emptyEl.querySelector('.empty-state-title').textContent = 'Nessuna pratica registrata';
      emptyEl.querySelector('.empty-state-sub').textContent = 'Clicca il bottone + per iniziare.';
    }
    emptyEl.hidden = false;
    return;
  }
  emptyEl.hidden = true;

  defunti.forEach(def => {
    container.appendChild(createDefuntoCard(def));
  });
}

function createDefuntoCard(def) {
  const card = document.createElement('article');
  card.className = 'card card--defunto';
  if (def.archiviato) card.classList.add('card--archived');
  card.setAttribute('role', 'button');
  card.setAttribute('tabindex', '0');
  card.setAttribute('aria-label', `Apri composizioni di ${def.nome} ${def.cognome}`);

  const archiviato = def.archiviato
    ? '<span class="badge badge--archived">Archiviato</span>'
    : '';

  const totale = def.totale_costi !== undefined && def.totale_costi > 0 ? formatCurrency(def.totale_costi) : '';
  const nFiori = def.num_fiori || 0;

  // Indicatore stato pagamento
  let statoIcon = '';
  if (nFiori > 0 && !def.archiviato) {
    if (def.non_pagati > 0) {
      statoIcon = '<span class="card__stato card__stato--pending" title="Ci sono pagamenti in sospeso">&#9679;</span>';
    } else {
      statoIcon = '<span class="card__stato card__stato--ok" title="Tutto pagato">&#10003;</span>';
    }
  }

  // [8] Se archiviato, mostra bottone Ripristina; altrimenti edit/archivia/elimina
  let azioni = '';
  if (def.archiviato) {
    azioni = `
      <div class="card__actions">
        <button class="btn btn-ghost btn-sm btn-ripristina-card" aria-label="Ripristina ${escapeHtml(def.cognome)} ${escapeHtml(def.nome)}">Ripristina</button>
      </div>
    `;
  } else {
    azioni = `
      <div class="card__actions">
        <button class="btn btn-ghost btn-icon-sm btn-edit-card" aria-label="Modifica ${escapeHtml(def.cognome)} ${escapeHtml(def.nome)}">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
        <button class="btn btn-danger-ghost btn-icon-sm btn-archive-card" aria-label="Archivia ${escapeHtml(def.cognome)} ${escapeHtml(def.nome)}">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg>
        </button>
        <button class="btn btn-danger-ghost btn-icon-sm btn-delete-card" aria-label="Elimina ${escapeHtml(def.cognome)} ${escapeHtml(def.nome)}">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
        </button>
      </div>
    `;
  }

  card.innerHTML = `
    <div class="card__header">
      <div class="card__title-group">
        <h3 class="card__title">${escapeHtml(def.cognome)} ${escapeHtml(def.nome)}</h3>
        ${statoIcon}
        ${archiviato}
      </div>
      <div class="card__right">
        ${totale ? `<span class="card__amount">${totale}</span>` : ''}
        ${azioni}
      </div>
    </div>
    <div class="card__meta">
      ${def.data_decesso ? `<span class="card__date">${formatDate(def.data_decesso)}</span>` : ''}
      ${def.luogo ? `<span class="card__luogo">&bull; ${escapeHtml(def.luogo)}</span>` : ''}
    </div>
    ${nFiori > 0 ? `<p class="card__count text-muted">${nFiori} composizion${nFiori !== 1 ? 'i' : 'e'}</p>` : ''}
  `;

  // Click sulla card (ma non sui bottoni) -> apri composizioni
  card.addEventListener('click', (e) => {
    if (e.target.closest('.card__actions')) return;
    goToDettaglio(def.id);
  });
  card.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); goToDettaglio(def.id); }
  });

  // Bottoni edit/archivia/elimina oppure ripristina
  if (def.archiviato) {
    // [8] Bottone ripristina per le card archiviate
    const btnRipristina = card.querySelector('.btn-ripristina-card');
    if (btnRipristina) {
      btnRipristina.addEventListener('click', (e) => {
        e.stopPropagation();
        ripristinaDefuntoById(def.id, `${def.cognome} ${def.nome}`);
      });
    }
  } else {
    card.querySelector('.btn-edit-card').addEventListener('click', (e) => {
      e.stopPropagation();
      openModalDefunto(def);
    });
    card.querySelector('.btn-archive-card').addEventListener('click', (e) => {
      e.stopPropagation();
      archiviaDefuntoById(def.id, `${def.cognome} ${def.nome}`);
    });
    card.querySelector('.btn-delete-card').addEventListener('click', (e) => {
      e.stopPropagation();
      eliminaDefuntoById(def.id, `${def.cognome} ${def.nome}`);
    });
  }

  return card;
}

// -------------------------------------------------------
// RENDER: DETTAGLIO DEFUNTO
// -------------------------------------------------------

async function goToDettaglio(defuntoId) {
  setLoading(true); // [6]
  try {
    const defunto = await apiGetDefunto(defuntoId);
    state.defuntoCorrente = defunto;
    state.fioriCorrente = defunto.fiori || [];
    state.filtroFiori = 'tutti';
    // [10] Resetta selezione batch
    state.selezioneFiori = [];
    state.modalitaSelezione = false;

    const isArchiviato = !!defunto.archiviato;
    document.getElementById('fab').hidden = isArchiviato;
    document.getElementById('navbar-title').textContent = `${defunto.cognome} ${defunto.nome}`;

    // Reset filtri
    document.querySelectorAll('.filter-tab').forEach(btn => {
      const active = btn.dataset.filter === 'tutti';
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-pressed', String(active));
    });

    showView('dettaglio');
    renderFiori();
    await aggiornareRiepilogo();
  } catch (err) {
    showToast('Errore nel caricamento: ' + err.message, 'error');
  } finally {
    setLoading(false); // [6]
  }
}

// -------------------------------------------------------
// RENDER: FIORI
// -------------------------------------------------------

function renderFiori() {
  const container = document.getElementById('lista-fiori');
  const emptyEl = document.getElementById('fiori-empty');

  Array.from(container.children).forEach(child => {
    if (child !== emptyEl) child.remove();
  });

  let fiori = [...state.fioriCorrente];

  if (state.filtroFiori === 'pagati') {
    fiori = fiori.filter(f => f.pagato || f.tipo === 'Copricassa');
  } else if (state.filtroFiori === 'non-pagati') {
    fiori = fiori.filter(f => !f.pagato && f.tipo !== 'Copricassa');
  }

  if (!fiori || fiori.length === 0) {
    emptyEl.hidden = false;
    return;
  }
  emptyEl.hidden = true;

  const isArchiviato = state.defuntoCorrente && state.defuntoCorrente.archiviato;
  fiori.forEach(fiore => container.appendChild(createFioreEl(fiore, isArchiviato)));

  // [10] Aggiorna UI batch se in modalita' selezione
  aggiornaUIBatchSelezione();
}

function createFioreEl(fiore, isArchiviato) {
  const article = document.createElement('article');
  const isCopricassa = fiore.tipo === 'Copricassa';
  article.className = `fiore-item ${isCopricassa ? 'fiore-item--copricassa' : (fiore.pagato ? 'fiore-item--pagato' : 'fiore-item--non-pagato')}`;
  article.dataset.id = fiore.id;

  let statoHtml = '';
  if (isCopricassa) {
    statoHtml = '<span class="badge badge--neutral">Incluso nel funerale</span>';
  } else {
    const pagatoBadge = fiore.pagato
      ? '<span class="badge badge--success">Pagato</span>'
      : '<span class="badge badge--danger">Non pagato</span>';
    const pagatoDa = fiore.pagato && fiore.pagato_da
      ? `<span class="fiore-item__pagato-da text-muted">con ${escapeHtml(fiore.pagato_da)}</span>`
      : '';
    statoHtml = pagatoBadge + pagatoDa;
  }

  const azioni = isArchiviato ? '' : `
    <div class="fiore-item__actions">
      <button class="btn btn-ghost btn-sm btn-edit-fiore" aria-label="Modifica composizione">Modifica</button>
      <button class="btn btn-danger-ghost btn-sm btn-delete-fiore" aria-label="Elimina composizione">Elimina</button>
    </div>
  `;

  const scrittaFascia = fiore.scritta_fascia
    ? `<span class="fiore-item__fascia text-muted">"${escapeHtml(fiore.scritta_fascia)}"</span>`
    : '';

  // [9] Mostra ordinante sotto la scritta fascia se presente
  const ordinanteHtml = fiore.ordinante_nome
    ? `<span class="fiore-item__ordinante text-muted" style="font-size:var(--font-size-xs)">Ordinante: ${escapeHtml(fiore.ordinante_nome)}${fiore.ordinante_telefono ? ' - ' + escapeHtml(fiore.ordinante_telefono) : ''}</span>`
    : '';

  // [10] Checkbox per selezione batch (nascosta di default, mostrata in modalita' selezione)
  const checkboxHtml = `<label class="fiore-item__select-label" style="display:none"><input type="checkbox" class="fiore-item__select-cb" data-fiore-id="${fiore.id}" /> Seleziona</label>`;

  article.innerHTML = `
    <div class="fiore-item__top">
      <div class="fiore-item__info">
        ${checkboxHtml}
        <span class="badge badge--tipo">${escapeHtml(fiore.tipo)}</span>
        ${fiore.descrizione ? `<span class="fiore-item__desc">${escapeHtml(fiore.descrizione)}</span>` : ''}
        ${scrittaFascia}
        ${ordinanteHtml}
      </div>
      ${isCopricassa ? '' : `<span class="fiore-item__costo">${formatCurrency(fiore.costo)}</span>`}
    </div>
    <div class="fiore-item__bottom">
      <div class="fiore-item__stato">
        ${statoHtml}
      </div>
      ${azioni}
    </div>
  `;

  if (!isArchiviato) {
    const editBtn = article.querySelector('.btn-edit-fiore');
    const deleteBtn = article.querySelector('.btn-delete-fiore');
    if (editBtn) editBtn.addEventListener('click', () => openModalFiore(fiore));
    if (deleteBtn) deleteBtn.addEventListener('click', () => deleteFiore(fiore.id));
  }

  // [10] Listener checkbox batch
  const cb = article.querySelector('.fiore-item__select-cb');
  if (cb) {
    cb.addEventListener('change', () => {
      const fid = parseInt(cb.dataset.fioreId, 10);
      if (cb.checked) {
        if (!state.selezioneFiori.includes(fid)) state.selezioneFiori.push(fid);
      } else {
        state.selezioneFiori = state.selezioneFiori.filter(x => x !== fid);
      }
    });
  }

  return article;
}

// -------------------------------------------------------
// RIEPILOGO
// -------------------------------------------------------

async function aggiornareRiepilogo() {
  if (!state.defuntoCorrente) return;
  try {
    const r = await apiGetRiepilogo(state.defuntoCorrente.id);
    state.riepilogo = r;
    document.getElementById('riepilogo-totale').textContent = formatCurrency(r.totale_costi);
    document.getElementById('riepilogo-pagato').textContent = formatCurrency(r.totale_pagato);
    document.getElementById('riepilogo-da-pagare').textContent = formatCurrency(r.totale_da_pagare);
  } catch (_) { /* non bloccante */ }
}

// -------------------------------------------------------
// CARICAMENTO LISTA DEFUNTI
// -------------------------------------------------------

async function loadDefunti() {
  setLoading(true); // [6]
  try {
    const defunti = await apiGetDefunti(state.searchQuery, state.mostraArchiviati);
    state.defunti = defunti;
    renderListaDefunti(defunti);
  } catch (err) {
    showToast('Errore nel caricamento: ' + err.message, 'error');
  } finally {
    setLoading(false); // [6]
  }
}

// -------------------------------------------------------
// MODAL DEFUNTO
// -------------------------------------------------------

function openModalDefunto(defunto = null) {
  const form = document.getElementById('form-defunto');
  const errEl = document.getElementById('form-defunto-error');
  const title = document.getElementById('modal-defunto-title');

  form.reset();
  errEl.hidden = true;

  if (defunto) {
    title.textContent = 'Modifica Pratica'; // [13] terminologia
    document.getElementById('defunto-id').value = defunto.id;
    document.getElementById('defunto-nome').value = defunto.nome || '';
    document.getElementById('defunto-cognome').value = defunto.cognome || '';
    document.getElementById('defunto-data-decesso').value = defunto.data_decesso || '';
    document.getElementById('defunto-luogo').value = defunto.luogo || '';
    document.getElementById('defunto-note').value = defunto.note || '';
  } else {
    title.textContent = 'Nuova Pratica'; // [13] terminologia
    document.getElementById('defunto-id').value = '';
  }

  openModal('modal-defunto-backdrop');
}

async function submitFormDefunto(e) {
  e.preventDefault();
  const errEl = document.getElementById('form-defunto-error');
  errEl.hidden = true;

  const id = document.getElementById('defunto-id').value;
  const nome = document.getElementById('defunto-nome').value.trim();
  const cognome = document.getElementById('defunto-cognome').value.trim();

  if (!nome || !cognome) {
    errEl.textContent = 'Nome e cognome sono obbligatori.';
    errEl.hidden = false;
    return;
  }

  const payload = {
    nome,
    cognome,
    data_decesso: document.getElementById('defunto-data-decesso').value || null,
    luogo: document.getElementById('defunto-luogo').value.trim() || null,
    note: document.getElementById('defunto-note').value.trim() || null,
  };

  const submitBtn = document.getElementById('modal-defunto-submit');
  submitBtn.disabled = true;

  try {
    if (id) {
      await apiUpdateDefunto(id, payload);
      showToast('Pratica aggiornata.'); // [13]
      closeModal('modal-defunto-backdrop');
    } else {
      await apiCreateDefunto(payload);
      showToast('Pratica aggiunta con successo.'); // [13]
      closeModal('modal-defunto-backdrop');
    }
    await loadDefunti(); // [2] await
  } catch (err) {
    errEl.textContent = err.message;
    errEl.hidden = false;
  } finally {
    submitBtn.disabled = false;
  }
}

// -------------------------------------------------------
// MODAL FIORE
// -------------------------------------------------------

function openModalFiore(fiore = null) {
  const form = document.getElementById('form-fiore');
  const errEl = document.getElementById('form-fiore-error');
  const title = document.getElementById('modal-fiore-title');

  form.reset();
  errEl.hidden = true;
  setPagatoDaVisibility(false);
  setCopricassaMode(false);

  // [9] Prova a popolare i campi ordinante (se esistono nel DOM)
  const ordinanteNomeEl = document.getElementById('fiore-ordinante-nome');
  const ordinanteTelEl = document.getElementById('fiore-ordinante-telefono');

  if (fiore) {
    title.textContent = 'Modifica Composizione';
    document.getElementById('fiore-id').value = fiore.id;
    document.getElementById('fiore-tipo').value = fiore.tipo || '';
    document.getElementById('fiore-descrizione').value = fiore.descrizione || '';
    document.getElementById('fiore-scritta-fascia').value = fiore.scritta_fascia || '';
    document.getElementById('fiore-costo').value = fiore.costo !== undefined ? fiore.costo : '';
    const pagato = !!fiore.pagato;
    document.getElementById('fiore-pagato').checked = pagato;
    document.getElementById('fiore-pagato-da').value = fiore.pagato_da || '';
    setPagatoDaVisibility(pagato);
    setCopricassaMode(fiore.tipo === 'Copricassa');
    // [9] Popola campi ordinante
    if (ordinanteNomeEl) ordinanteNomeEl.value = fiore.ordinante_nome || '';
    if (ordinanteTelEl) ordinanteTelEl.value = fiore.ordinante_telefono || '';
  } else {
    title.textContent = 'Aggiungi Composizione';
    document.getElementById('fiore-id').value = '';
    // [9] Reset campi ordinante
    if (ordinanteNomeEl) ordinanteNomeEl.value = '';
    if (ordinanteTelEl) ordinanteTelEl.value = '';
  }

  openModal('modal-fiore-backdrop');
}

function setPagatoDaVisibility(show) {
  document.getElementById('group-pagato-da').style.display = show ? '' : 'none';
}

function setCopricassaMode(isCopricassa) {
  document.getElementById('group-costo').style.display = isCopricassa ? 'none' : '';
  document.getElementById('group-pagato').style.display = isCopricassa ? 'none' : '';
  if (isCopricassa) {
    document.getElementById('group-pagato-da').style.display = 'none';
    document.getElementById('fiore-costo').removeAttribute('required');
  } else {
    document.getElementById('fiore-costo').setAttribute('required', '');
    setPagatoDaVisibility(document.getElementById('fiore-pagato').checked);
  }
}

async function submitFormFiore(e) {
  e.preventDefault();
  const errEl = document.getElementById('form-fiore-error');
  errEl.hidden = true;

  const id = document.getElementById('fiore-id').value;
  const tipo = document.getElementById('fiore-tipo').value;
  const isCopricassa = tipo === 'Copricassa';

  if (!tipo) {
    errEl.textContent = 'Seleziona un tipo di composizione.';
    errEl.hidden = false;
    return;
  }

  let costo = 0;
  let pagato = false;
  if (!isCopricassa) {
    const costoStr = document.getElementById('fiore-costo').value;
    costo = parseFloat(costoStr);
    if (costoStr === '' || isNaN(costo) || costo < 0) {
      errEl.textContent = 'Inserisci un costo valido (>= 0).';
      errEl.hidden = false;
      return;
    }
    pagato = document.getElementById('fiore-pagato').checked;
  }

  // [9] Leggi campi ordinante se presenti
  const ordinanteNomeEl = document.getElementById('fiore-ordinante-nome');
  const ordinanteTelEl = document.getElementById('fiore-ordinante-telefono');

  const payload = {
    tipo,
    descrizione: document.getElementById('fiore-descrizione').value.trim() || null,
    scritta_fascia: document.getElementById('fiore-scritta-fascia').value.trim() || null,
    costo,
    pagato: pagato ? 1 : 0,
    pagato_da: pagato ? (document.getElementById('fiore-pagato-da').value.trim() || null) : null,
    ordinante_nome: ordinanteNomeEl ? (ordinanteNomeEl.value.trim() || null) : null,         // [9]
    ordinante_telefono: ordinanteTelEl ? (ordinanteTelEl.value.trim() || null) : null,        // [9]
  };

  const submitBtn = document.getElementById('modal-fiore-submit');
  submitBtn.disabled = true;

  try {
    if (id) {
      const updated = await apiUpdateFiore(id, payload);
      state.fioriCorrente = state.fioriCorrente.map(f => f.id === updated.id ? updated : f);
      showToast('Composizione aggiornata.');
    } else {
      const created = await apiCreateFiore(state.defuntoCorrente.id, payload);
      state.fioriCorrente.unshift(created);
      showToast('Composizione aggiunta.');
    }
    closeModal('modal-fiore-backdrop');
    renderFiori();
    await aggiornareRiepilogo(); // [2] await
    await loadDefunti();         // [2] await
  } catch (err) {
    errEl.textContent = err.message;
    errEl.hidden = false;
  } finally {
    submitBtn.disabled = false;
  }
}

// -------------------------------------------------------
// DELETE FIORE
// -------------------------------------------------------

function deleteFiore(fioreId) {
  showConfirm('Eliminare questa composizione? L\'operazione non e\' reversibile.', async () => {
    try {
      await apiDeleteFiore(fioreId);
      state.fioriCorrente = state.fioriCorrente.filter(f => f.id !== fioreId);
      renderFiori();
      await aggiornareRiepilogo(); // [2] await
      await loadDefunti();         // [2] await
      showToast('Composizione eliminata.');
    } catch (err) {
      showToast('Errore: ' + err.message, 'error');
    }
  });
}

// -------------------------------------------------------
// ARCHIVIA / RIPRISTINA / ELIMINA DEFUNTO
// -------------------------------------------------------

function archiviaDefuntoById(id, nomeCompleto) {
  showConfirm(
    `Archiviare la pratica di ${nomeCompleto}? La pratica diventera' di sola lettura.`, // [13]
    async () => {
      try {
        await apiArchiveDefunto(id);
        await loadDefunti(); // [2] await
        showToast('Pratica archiviata.'); // [13]
      } catch (err) {
        showToast('Errore: ' + err.message, 'error');
      }
    }
  );
}

/** [8] Ripristina un defunto archiviato */
function ripristinaDefuntoById(id, nomeCompleto) {
  showConfirm(
    `Ripristinare la pratica di ${nomeCompleto}?`,
    async () => {
      try {
        await apiRipristinaDefunto(id);
        await loadDefunti(); // [2] await
        showToast('Pratica ripristinata.'); // [13]
      } catch (err) {
        showToast('Errore: ' + err.message, 'error');
      }
    }
  );
}

function eliminaDefuntoById(id, nomeCompleto) {
  showConfirm(
    `Eliminare definitivamente la pratica di ${nomeCompleto} e tutte le composizioni associate? L'operazione non e' reversibile.`, // [13]
    async () => {
      try {
        await apiDeleteDefunto(id);
        await loadDefunti(); // [2] await
        showToast('Pratica eliminata.'); // [13]
      } catch (err) {
        showToast('Errore: ' + err.message, 'error');
      }
    }
  );
}

// -------------------------------------------------------
// [10] BATCH PAGAMENTO
// -------------------------------------------------------

function toggleModalitaSelezione() {
  state.modalitaSelezione = !state.modalitaSelezione;
  state.selezioneFiori = [];
  aggiornaUIBatchSelezione();
}

function aggiornaUIBatchSelezione() {
  // Mostra/nascondi checkbox sui fiori
  document.querySelectorAll('.fiore-item__select-label').forEach(label => {
    label.style.display = state.modalitaSelezione ? '' : 'none';
  });
  // Deseleziona tutto quando si esce
  if (!state.modalitaSelezione) {
    document.querySelectorAll('.fiore-item__select-cb').forEach(cb => { cb.checked = false; });
    state.selezioneFiori = [];
  }
  // Mostra/nascondi bottone "Segna pagati" fisso in basso
  let batchBar = document.getElementById('batch-bar');
  if (state.modalitaSelezione) {
    if (!batchBar) {
      batchBar = document.createElement('div');
      batchBar.id = 'batch-bar';
      batchBar.style.cssText = 'position:fixed;bottom:0;left:0;right:0;background:var(--color-bg-card);border-top:2px solid var(--color-accent);padding:var(--space-3) var(--space-4);display:flex;align-items:center;justify-content:center;gap:var(--space-3);z-index:400;box-shadow:var(--shadow-lg);';
      batchBar.innerHTML = `
        <select id="batch-pagato-da" class="form-control form-select" style="max-width:160px">
          <option value="">Metodo...</option>
          <option value="Bonifico">Bonifico</option>
          <option value="Contanti">Contanti</option>
          <option value="Assegno">Assegno</option>
        </select>
        <button id="batch-paga-btn" class="btn btn-primary btn-sm">Segna pagati</button>
        <button id="batch-cancel-btn" class="btn btn-ghost btn-sm">Annulla</button>
      `;
      document.body.appendChild(batchBar);
      document.getElementById('batch-paga-btn').addEventListener('click', eseguiBatchPagamento);
      document.getElementById('batch-cancel-btn').addEventListener('click', () => {
        toggleModalitaSelezione();
      });
    }
    batchBar.style.display = 'flex';
  } else {
    if (batchBar) batchBar.style.display = 'none';
  }

  // Aggiorna bottone toggle
  const btnBatch = document.getElementById('btn-batch-select');
  if (btnBatch) {
    btnBatch.textContent = state.modalitaSelezione ? 'Annulla selezione' : 'Selezione multipla';
  }
}

async function eseguiBatchPagamento() {
  if (state.selezioneFiori.length === 0) {
    showToast('Seleziona almeno una composizione.', 'error');
    return;
  }
  const pagatoDaEl = document.getElementById('batch-pagato-da');
  const pagatoDa = pagatoDaEl ? pagatoDaEl.value : null;

  try {
    await apiBatchPagamento(state.selezioneFiori, true, pagatoDa);
    showToast(`${state.selezioneFiori.length} composizioni segnate come pagate.`);
    // Ricarica dettaglio
    state.modalitaSelezione = false;
    state.selezioneFiori = [];
    if (state.defuntoCorrente) {
      await goToDettaglio(state.defuntoCorrente.id);
    }
  } catch (err) {
    showToast('Errore: ' + err.message, 'error');
  }
}

// -------------------------------------------------------
// [11] EXPORT / STAMPA RIEPILOGO
// -------------------------------------------------------

function esportaRiepilogo() {
  if (!state.defuntoCorrente) return;
  const def = state.defuntoCorrente;
  const fiori = state.fioriCorrente || [];
  const riepilogo = state.riepilogo || {};

  let csv = 'Riepilogo Pratica\n';
  csv += `Nome defunto:,${def.cognome} ${def.nome}\n`;
  if (def.data_decesso) csv += `Data decesso:,${formatDate(def.data_decesso)}\n`;
  if (def.luogo) csv += `Luogo:,${def.luogo}\n`;
  csv += '\n';

  csv += 'Tipo,Descrizione,Scritta Fascia,Ordinante,Telefono Ordinante,Costo,Stato,Metodo Pagamento\n';
  fiori.forEach(f => {
    const stato = f.tipo === 'Copricassa' ? 'Incluso' : (f.pagato ? 'Pagato' : 'Non pagato');
    const metodo = f.pagato && f.pagato_da ? f.pagato_da : '';
    const costoStr = f.tipo === 'Copricassa' ? '0' : (f.costo || 0);
    const desc = (f.descrizione || '').replace(/,/g, ';');
    const fascia = (f.scritta_fascia || '').replace(/,/g, ';');
    const ordNome = (f.ordinante_nome || '').replace(/,/g, ';');
    const ordTel = (f.ordinante_telefono || '').replace(/,/g, ';');
    csv += `${f.tipo},${desc},${fascia},${ordNome},${ordTel},${costoStr},${stato},${metodo}\n`;
  });

  csv += '\n';
  csv += `Totale:,${riepilogo.totale_costi || 0}\n`;
  csv += `Pagato:,${riepilogo.totale_pagato || 0}\n`;
  csv += `Da pagare:,${riepilogo.totale_da_pagare || 0}\n`;

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `riepilogo_${def.cognome}_${def.nome}.csv`.replace(/\s+/g, '_');
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('Riepilogo esportato.');
}

// -------------------------------------------------------
// STATISTICHE
// -------------------------------------------------------

const MESI_IT = ['', 'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
  'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];

function formatMese(meseStr) {
  if (!meseStr) return '';
  const parts = meseStr.split('-');
  if (parts.length === 2) {
    const m = parseInt(parts[1], 10);
    return `${MESI_IT[m] || parts[1]} ${parts[0]}`;
  }
  return meseStr;
}

async function apiGetStatistiche(anno) {
  const params = anno ? `?anno=${anno}` : '';
  return apiFetch(`/api/statistiche${params}`);
}

/** [1] XSS fix: escape valori raw, lascia formattati quelli con format custom */
function buildTable(headers, rows) {
  if (!rows || rows.length === 0) {
    return '<p class="text-muted stats-no-data">Nessun dato disponibile</p>';
  }
  let html = '<table class="stats-table"><thead><tr>';
  headers.forEach(h => { html += `<th>${escapeHtml(h.label)}</th>`; });
  html += '</tr></thead><tbody>';
  rows.forEach(row => {
    html += '<tr>';
    headers.forEach(h => {
      const val = h.format ? h.format(row[h.key]) : escapeHtml(String(row[h.key] ?? '')); // [1] XSS fix
      const cls = h.align === 'right' ? ' class="text-right"' : '';
      html += `<td${cls}>${val}</td>`;
    });
    html += '</tr>';
  });
  html += '</tbody></table>';
  return html;
}

async function loadStatistiche(anno) {
  setLoading(true); // [6]
  try {
    const s = await apiGetStatistiche(anno);

    // Popola select anni
    const select = document.getElementById('stats-anno');
    const currentVal = select.value;
    select.innerHTML = '<option value="">Tutti gli anni</option>';
    (s.anni || []).forEach(a => {
      const opt = document.createElement('option');
      opt.value = a;
      opt.textContent = a;
      select.appendChild(opt);
    });
    select.value = anno || currentVal || '';

    // Panoramica
    document.getElementById('stats-pratiche-totali').textContent = s.pratiche_totali;
    document.getElementById('stats-pratiche-attive').textContent = s.pratiche_attive;
    document.getElementById('stats-pratiche-archiviate').textContent = s.pratiche_archiviate;
    document.getElementById('stats-composizioni-totali').textContent = s.composizioni_totali;

    // Economico
    document.getElementById('stats-fatturato').textContent = formatCurrency(s.fatturato);
    document.getElementById('stats-incassato').textContent = formatCurrency(s.incassato);
    document.getElementById('stats-da-incassare').textContent = formatCurrency(s.da_incassare);
    document.getElementById('stats-costo-medio-pratica').textContent = formatCurrency(s.costo_medio_pratica);
    document.getElementById('stats-costo-medio-comp').textContent = formatCurrency(s.costo_medio_comp);
    document.getElementById('stats-comp-media-pratica').textContent = s.comp_media_pratica;

    // Per tipo
    document.getElementById('stats-per-tipo').innerHTML = buildTable(
      [
        { label: 'Tipo', key: 'tipo' },
        { label: 'Quantita\'', key: 'quantita', align: 'right' },
        { label: 'Totale', key: 'totale', align: 'right', format: formatCurrency },
        { label: 'Media', key: 'media', align: 'right', format: formatCurrency },
      ],
      s.per_tipo
    );

    // Per metodo
    document.getElementById('stats-per-metodo').innerHTML = buildTable(
      [
        { label: 'Metodo', key: 'metodo' },
        { label: 'Quantita\'', key: 'quantita', align: 'right' },
        { label: 'Totale', key: 'totale', align: 'right', format: formatCurrency },
      ],
      s.per_metodo
    );

    // Per mese
    document.getElementById('stats-per-mese').innerHTML = buildTable(
      [
        { label: 'Mese', key: 'mese', format: formatMese },
        { label: 'Pratiche', key: 'pratiche', align: 'right' },
        { label: 'Composizioni', key: 'composizioni', align: 'right' },
        { label: 'Totale', key: 'totale', align: 'right', format: formatCurrency },
      ],
      s.per_mese
    );

    // Top pratiche
    document.getElementById('stats-top-pratiche').innerHTML = buildTable(
      [
        { label: 'Defunto', key: 'nome' },
        { label: 'Composizioni', key: 'num_composizioni', align: 'right' },
        { label: 'Totale', key: 'totale', align: 'right', format: formatCurrency },
      ],
      s.top_pratiche
    );

  } catch (err) {
    showToast('Errore caricamento statistiche: ' + err.message, 'error');
  } finally {
    setLoading(false); // [6]
  }
}

// -------------------------------------------------------
// EVENT LISTENERS
// -------------------------------------------------------

document.addEventListener('DOMContentLoaded', () => {

  // --- FAB ---
  document.getElementById('fab').addEventListener('click', () => {
    if (state.view === 'lista') {
      openModalDefunto();
    } else {
      openModalFiore();
    }
  });

  // --- Back button ---
  document.getElementById('btn-back').addEventListener('click', () => {
    if (state.view === 'statistiche') {
      showView('lista');
    } else if (state.view === 'dettaglio') {
      // [10] Disattiva selezione batch se attiva
      if (state.modalitaSelezione) {
        toggleModalitaSelezione();
      }
      showView('lista');
      loadDefunti();
    } else if (state.mostraArchiviati) {
      state.mostraArchiviati = false;
      showView('lista');
      loadDefunti();
    }
  });

  // --- Statistiche ---
  document.getElementById('btn-show-stats').addEventListener('click', () => {
    showView('statistiche');
    loadStatistiche('');
  });
  document.getElementById('stats-anno').addEventListener('change', (e) => {
    loadStatistiche(e.target.value);
  });

  // --- Mostra archiviati ---
  const btnArchived = document.getElementById('btn-show-archived');
  btnArchived.addEventListener('click', () => {
    state.mostraArchiviati = true;
    showView('lista');
    loadDefunti();
  });

  // --- Ricerca ---
  document.getElementById('input-search').addEventListener('input', debounce(e => {
    state.searchQuery = e.target.value.trim();
    loadDefunti();
  }, 250));

  // --- Form defunto ---
  document.getElementById('form-defunto').addEventListener('submit', submitFormDefunto);
  document.getElementById('modal-defunto-cancel').addEventListener('click', () => closeModal('modal-defunto-backdrop'));
  document.getElementById('modal-defunto-close').addEventListener('click', () => closeModal('modal-defunto-backdrop'));
  document.getElementById('modal-defunto-backdrop').addEventListener('click', e => {
    if (e.target === document.getElementById('modal-defunto-backdrop')) closeModal('modal-defunto-backdrop');
  });

  // --- Form fiore ---
  document.getElementById('form-fiore').addEventListener('submit', submitFormFiore);
  document.getElementById('modal-fiore-cancel').addEventListener('click', () => closeModal('modal-fiore-backdrop'));
  document.getElementById('modal-fiore-close').addEventListener('click', () => closeModal('modal-fiore-backdrop'));
  document.getElementById('modal-fiore-backdrop').addEventListener('click', e => {
    if (e.target === document.getElementById('modal-fiore-backdrop')) closeModal('modal-fiore-backdrop');
  });

  // --- Toggle pagato-da ---
  document.getElementById('fiore-pagato').addEventListener('change', e => {
    setPagatoDaVisibility(e.target.checked);
  });

  // --- Toggle campi per Copricassa ---
  document.getElementById('fiore-tipo').addEventListener('change', e => {
    const isCopricassa = e.target.value === 'Copricassa';
    setCopricassaMode(isCopricassa);
  });

  // --- Filtri fiori ---
  document.querySelectorAll('.filter-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-tab').forEach(b => {
        b.classList.remove('active');
        b.setAttribute('aria-pressed', 'false');
      });
      btn.classList.add('active');
      btn.setAttribute('aria-pressed', 'true');
      state.filtroFiori = btn.dataset.filter;
      renderFiori();
    });
  });

  // --- ESC per chiudere modali ---
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      const openBackdrops = document.querySelectorAll('.modal-backdrop.is-open');
      if (openBackdrops.length > 0) {
        closeModal(openBackdrops[openBackdrops.length - 1].id);
      }
    }
  });

  // --- [10] Bottone batch select (se esiste nel DOM, aggiunto da altro agente) ---
  const btnBatchSelect = document.getElementById('btn-batch-select');
  if (btnBatchSelect) {
    btnBatchSelect.addEventListener('click', toggleModalitaSelezione);
  }

  // --- [11] Bottone export (se esiste nel DOM, aggiunto da altro agente) ---
  const btnExport = document.getElementById('btn-export');
  if (btnExport) {
    btnExport.addEventListener('click', esportaRiepilogo);
  }

  // --- [12] History API: popstate ---
  window.addEventListener('popstate', (e) => {
    if (e.state && e.state.view) {
      if (e.state.view === 'dettaglio' && state.view !== 'lista') {
        // Se torniamo indietro da dettaglio, vai a lista
        showView('lista');
        loadDefunti();
      } else if (e.state.view === 'lista') {
        if (state.view === 'dettaglio' || state.view === 'statistiche') {
          showView('lista');
          loadDefunti();
        }
      }
    } else {
      // Se non c'e' stato, torna alla lista
      if (state.view !== 'lista') {
        state.mostraArchiviati = false;
        showView('lista');
        loadDefunti();
      }
    }
  });

  // --- Avvio ---
  showView('lista');
  loadDefunti();
});
