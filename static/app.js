/* ============================================================
   FIORI - Web App per Onoranze Funebri
   app.js - Vanilla JavaScript SPA
   ============================================================ */

'use strict';

// -------------------------------------------------------
// STATO GLOBALE
// -------------------------------------------------------
const state = {
  view: 'lista',          // 'lista' | 'dettaglio'
  defunti: [],
  defuntoCorrente: null,  // oggetto defunto
  fioriCorrente: [],      // fiori del defunto corrente
  filtroFiori: 'tutti',   // 'tutti' | 'pagati' | 'non-pagati'
  mostraArchiviati: false,
  searchQuery: '',
  riepilogo: null,
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
  // Evita problemi di timezone: la data e' solo una data (YYYY-MM-DD)
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
// GESTIONE MODALI
// -------------------------------------------------------

/** Apre un modal (usa classe is-open su backdrop) */
function openModal(backdropId) {
  const backdrop = document.getElementById(backdropId);
  backdrop.classList.add('is-open');
  document.body.classList.add('modal-open');
  // Focus primo campo interattivo
  const focusable = backdrop.querySelector('input:not([type=hidden]), select, textarea, button.btn-primary');
  if (focusable) setTimeout(() => focusable.focus(), 80);
}

/** Chiude un modal */
function closeModal(backdropId) {
  const backdrop = document.getElementById(backdropId);
  backdrop.classList.remove('is-open');
  // Rimuovi modal-open solo se nessun modal e' aperto
  const openModals = document.querySelectorAll('.modal-backdrop.is-open');
  if (openModals.length === 0) {
    document.body.classList.remove('modal-open');
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
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });
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

// -------------------------------------------------------
// NAVIGAZIONE SPA
// -------------------------------------------------------

function showView(name) {
  state.view = name;
  document.getElementById('view-lista').hidden = name !== 'lista';
  document.getElementById('view-dettaglio').hidden = name !== 'dettaglio';

  const btnBack = document.getElementById('btn-back');
  const navbarTitle = document.getElementById('navbar-title');
  const fab = document.getElementById('fab');
  const btnArchived = document.getElementById('btn-show-archived');

  if (name === 'lista') {
    btnBack.hidden = true;
    navbarTitle.textContent = 'Lista defunti';
    fab.hidden = false;
    fab.setAttribute('aria-label', 'Aggiungi defunto');
    btnArchived.hidden = false;
  } else {
    btnBack.hidden = false;
    btnArchived.hidden = true;
    fab.setAttribute('aria-label', 'Aggiungi composizione');
  }
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

  const azioni = def.archiviato ? '' : `
    <div class="card__actions">
      <button class="btn btn-ghost btn-icon-sm btn-edit-card" aria-label="Modifica ${def.cognome} ${def.nome}">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
      </button>
      <button class="btn btn-danger-ghost btn-icon-sm btn-archive-card" aria-label="Archivia ${def.cognome} ${def.nome}">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg>
      </button>
    </div>
  `;

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
    ${nFiori > 0 ? `<p class="card__count text-muted">${nFiori} composizione${nFiori !== 1 ? 'i' : ''}</p>` : ''}
  `;

  // Click sulla card (ma non sui bottoni) -> apri composizioni
  card.addEventListener('click', (e) => {
    if (e.target.closest('.card__actions')) return;
    goToDettaglio(def.id);
  });
  card.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); goToDettaglio(def.id); }
  });

  // Bottoni edit/archivia
  if (!def.archiviato) {
    card.querySelector('.btn-edit-card').addEventListener('click', (e) => {
      e.stopPropagation();
      openModalDefunto(def);
    });
    card.querySelector('.btn-archive-card').addEventListener('click', (e) => {
      e.stopPropagation();
      archiviaDefuntoById(def.id, `${def.cognome} ${def.nome}`);
    });
  }

  return card;
}

// -------------------------------------------------------
// RENDER: DETTAGLIO DEFUNTO
// -------------------------------------------------------

async function goToDettaglio(defuntoId) {
  try {
    const defunto = await apiGetDefunto(defuntoId);
    state.defuntoCorrente = defunto;
    state.fioriCorrente = defunto.fiori || [];
    state.filtroFiori = 'tutti';

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
    fiori = fiori.filter(f => f.pagato);
  } else if (state.filtroFiori === 'non-pagati') {
    fiori = fiori.filter(f => !f.pagato);
  }

  if (!fiori || fiori.length === 0) {
    emptyEl.hidden = false;
    return;
  }
  emptyEl.hidden = true;

  const isArchiviato = state.defuntoCorrente && state.defuntoCorrente.archiviato;
  fiori.forEach(fiore => container.appendChild(createFioreEl(fiore, isArchiviato)));
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
      ? `<span class="fiore-item__pagato-da text-muted">da ${escapeHtml(fiore.pagato_da)}</span>`
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

  article.innerHTML = `
    <div class="fiore-item__top">
      <div class="fiore-item__info">
        <span class="badge badge--tipo">${escapeHtml(fiore.tipo)}</span>
        ${fiore.descrizione ? `<span class="fiore-item__desc">${escapeHtml(fiore.descrizione)}</span>` : ''}
        ${scrittaFascia}
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
    article.querySelector('.btn-edit-fiore').addEventListener('click', () => openModalFiore(fiore));
    article.querySelector('.btn-delete-fiore').addEventListener('click', () => deleteFiore(fiore.id));
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
  try {
    const defunti = await apiGetDefunti(state.searchQuery, state.mostraArchiviati);
    // Calcola totale_costi e num_fiori dalla lista (il backend li restituisce senza join)
    // Li recuperiamo dal dettaglio solo se presenti, altrimenti mostriamo solo il nome
    state.defunti = defunti;
    renderListaDefunti(defunti);
  } catch (err) {
    showToast('Errore nel caricamento: ' + err.message, 'error');
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
    title.textContent = 'Modifica Defunto';
    document.getElementById('defunto-id').value = defunto.id;
    document.getElementById('defunto-nome').value = defunto.nome || '';
    document.getElementById('defunto-cognome').value = defunto.cognome || '';
    document.getElementById('defunto-data-decesso').value = defunto.data_decesso || '';
    document.getElementById('defunto-luogo').value = defunto.luogo || '';
    document.getElementById('defunto-note').value = defunto.note || '';
  } else {
    title.textContent = 'Nuovo Defunto';
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
      showToast('Defunto aggiornato.');
      closeModal('modal-defunto-backdrop');
    } else {
      await apiCreateDefunto(payload);
      showToast('Defunto aggiunto con successo.');
      closeModal('modal-defunto-backdrop');
    }
    loadDefunti();
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
  } else {
    title.textContent = 'Aggiungi Composizione';
    document.getElementById('fiore-id').value = '';
  }

  openModal('modal-fiore-backdrop');
}

function setPagatoDaVisibility(show) {
  document.getElementById('group-pagato-da').style.display = show ? '' : 'none';
}

function setCopricassaMode(isCopricassa) {
  document.getElementById('group-costo').style.display = isCopricassa ? 'none' : '';
  document.getElementById('group-pagato').style.display = isCopricassa ? 'none' : '';
  document.getElementById('group-pagato-da').style.display = isCopricassa ? 'none' : '';
  if (isCopricassa) {
    document.getElementById('fiore-costo').removeAttribute('required');
  } else {
    document.getElementById('fiore-costo').setAttribute('required', '');
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

  const payload = {
    tipo,
    descrizione: document.getElementById('fiore-descrizione').value.trim() || null,
    scritta_fascia: document.getElementById('fiore-scritta-fascia').value.trim() || null,
    costo,
    pagato: pagato ? 1 : 0,
    pagato_da: pagato ? (document.getElementById('fiore-pagato-da').value.trim() || null) : null,
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
    aggiornareRiepilogo();
    loadDefunti();
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
      aggiornareRiepilogo();
      loadDefunti();
      showToast('Composizione eliminata.');
    } catch (err) {
      showToast('Errore: ' + err.message, 'error');
    }
  });
}

// -------------------------------------------------------
// ARCHIVIA DEFUNTO
// -------------------------------------------------------

function archiviaDefuntoById(id, nomeCompleto) {
  showConfirm(
    `Archiviare la pratica di ${nomeCompleto}? La scheda diventera' di sola lettura.`,
    async () => {
      try {
        await apiArchiveDefunto(id);
        loadDefunti();
        showToast('Pratica archiviata.');
      } catch (err) {
        showToast('Errore: ' + err.message, 'error');
      }
    }
  );
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
    showView('lista');
    loadDefunti();
  });

  // --- Mostra archiviati ---
  const btnArchived = document.getElementById('btn-show-archived');
  btnArchived.addEventListener('click', () => {
    state.mostraArchiviati = !state.mostraArchiviati;
    btnArchived.setAttribute('aria-pressed', String(state.mostraArchiviati));
    btnArchived.textContent = state.mostraArchiviati ? 'Attivi' : 'Archivio';
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

  // --- Avvio ---
  showView('lista');
  loadDefunti();
});
