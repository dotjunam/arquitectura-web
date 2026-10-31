/**
 * Pantalla del catalogo: listado con filtros y paginado, y el ABM de titulos.
 *
 * Los datos siempre se insertan con `textContent` y nunca con `innerHTML`: un
 * titulo cargado como `<img onerror=...>` se tiene que ver como texto, no
 * ejecutarse en el navegador de quien lo mira.
 */

import { api, ApiError } from './api.js';

const PAGE_SIZE = 10;

const TYPE_LABELS = { movie: 'Película', series: 'Serie' };

const state = {
  page: 1,
  pages: 1,
  filters: {},
  // Id del titulo que se esta editando; null cuando el formulario es un alta.
  editingId: null,
};

const $ = (selector) => document.querySelector(selector);

const elements = {
  filters: $('#filters'),
  genreFilter: $('#filters select[name="genre"]'),
  status: $('#status'),
  tbody: $('#titles-body'),
  caption: $('#table-caption'),
  prev: $('#prev-page'),
  next: $('#next-page'),
  pageInfo: $('#page-info'),
  dialog: $('#title-dialog'),
  form: $('#title-form'),
  formTitle: $('#form-title'),
  formError: $('#form-error'),
  seriesFields: $('#series-fields'),
  watchedFields: $('#watched-fields'),
  runtimeLabel: $('#l-runtime'),
};

/** Crea un elemento con texto plano adentro. */
function el(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}

function showStatus(message, kind = 'info') {
  elements.status.textContent = message;
  elements.status.dataset.kind = kind;
}

/** Fecha local en formato AAAA-MM-DD, la que espera la API. */
function today() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function formatDuration(title) {
  if (title.type === 'series') {
    return `${title.seasons} temp. · ${title.episodes} ep. de ${title.runtimeMinutes} min`;
  }
  const hours = Math.floor(title.runtimeMinutes / 60);
  const minutes = title.runtimeMinutes % 60;
  return hours > 0 ? `${hours} h ${minutes} min` : `${minutes} min`;
}

// ---------------------------------------------------------------------------
// Listado
// ---------------------------------------------------------------------------

async function loadGenres() {
  try {
    const { data } = await api.listGenres();
    const current = elements.genreFilter.value;
    elements.genreFilter.replaceChildren(el('option', 'Todos'));
    elements.genreFilter.firstChild.value = '';
    for (const genre of data) {
      const option = el('option', `${genre.name} (${genre.titleCount})`);
      option.value = genre.name;
      elements.genreFilter.append(option);
    }
    elements.genreFilter.value = current;
  } catch {
    // Sin generos el filtro queda en "Todos": el listado sigue funcionando.
  }
}

async function loadTitles() {
  try {
    const { data, meta } = await api.listTitles({
      ...state.filters,
      page: state.page,
      limit: PAGE_SIZE,
    });
    // Si se borro el ultimo titulo de la ultima pagina, retroceder una.
    if (data.length === 0 && state.page > 1) {
      state.page -= 1;
      return loadTitles();
    }
    state.pages = meta.pages;
    renderTable(data);
    renderPagination(meta);
  } catch (error) {
    renderTable([]);
    showStatus(error.message, 'error');
  }
}

function renderTable(titles) {
  if (titles.length === 0) {
    const row = el('tr');
    const cell = el('td', 'No hay títulos que coincidan con los filtros.', 'empty');
    cell.colSpan = 8;
    row.append(cell);
    elements.tbody.replaceChildren(row);
    return;
  }

  elements.tbody.replaceChildren(...titles.map(renderRow));
}

function renderRow(title) {
  const row = el('tr');

  const name = el('th');
  name.scope = 'row';
  name.append(el('span', title.title, 'title-name'), el('span', ` (${title.year})`, 'muted'));

  const watchState = el('td');
  watchState.append(
    el('span', title.watched ? 'Visto' : 'Pendiente', title.watched ? 'badge seen' : 'badge pending'),
  );

  const actions = el('td', undefined, 'row-actions');
  const edit = el('button', 'Editar');
  edit.type = 'button';
  edit.addEventListener('click', () => openEditForm(title.id));

  const toggle = el('button', title.watched ? 'Marcar pendiente' : 'Marcar visto');
  toggle.type = 'button';
  toggle.addEventListener('click', () => toggleWatched(title));

  const remove = el('button', 'Eliminar', 'danger');
  remove.type = 'button';
  remove.addEventListener('click', () => deleteTitle(title));

  actions.append(edit, toggle, remove);

  row.append(
    name,
    el('td', TYPE_LABELS[title.type]),
    el('td', title.director),
    el('td', title.genres.join(', ')),
    el('td', formatDuration(title)),
    watchState,
    el('td', title.rating ?? '—'),
    actions,
  );
  return row;
}

function renderPagination(meta) {
  elements.pageInfo.textContent = `Página ${meta.page} de ${meta.pages}`;
  elements.caption.textContent = `Títulos del catálogo: ${meta.total} en total`;
  elements.prev.disabled = meta.page <= 1;
  elements.next.disabled = meta.page >= meta.pages;
}

function readFilters() {
  const data = new FormData(elements.filters);
  const filters = Object.fromEntries(data.entries());
  filters.q = filters.q.trim();
  return filters;
}

// ---------------------------------------------------------------------------
// Formulario de alta y edicion
// ---------------------------------------------------------------------------

/** Muestra u oculta los campos que dependen del tipo y del estado de visionado. */
function syncConditionalFields() {
  const { type, watched } = elements.form.elements;
  const isSeries = type.value === 'series';
  elements.seriesFields.hidden = !isSeries;
  elements.runtimeLabel.textContent = isSeries
    ? 'Duración promedio del episodio (minutos)'
    : 'Duración (minutos)';
  elements.watchedFields.hidden = !watched.checked;
}

/**
 * La API manda los mensajes en minuscula porque estan pensados para leerse
 * despues del nombre del campo ("rating: no puede ser mayor que 10"). Solos,
 * debajo del campo, son una oracion y van con mayuscula.
 */
function capitalize(text) {
  return text ? text[0].toUpperCase() + text.slice(1) : text;
}

function clearErrors() {
  elements.formError.textContent = '';
  for (const node of elements.form.querySelectorAll('.field-error')) {
    node.textContent = '';
  }
  for (const node of elements.form.querySelectorAll('[aria-invalid]')) {
    node.removeAttribute('aria-invalid');
  }
}

/**
 * Pone cada error que devolvio la API al lado de su campo. Es lo que hace
 * visible la diferencia entre 400 (forma) y 422 (regla de negocio): los dos
 * traen `details` con el campo y el motivo.
 */
function showErrors(error) {
  elements.formError.textContent = error.message;
  for (const detail of error.details) {
    // `genres[2]` se muestra en el campo `genres`.
    const field = String(detail.field ?? '').split(/[.[]/)[0];
    const holder = elements.form.querySelector(`.field[data-field="${field}"]`);
    if (!holder) {
      elements.formError.textContent += ` ${detail.field}: ${detail.message}.`;
      continue;
    }
    holder.querySelector('.field-error').textContent = capitalize(detail.message);
    holder.querySelector('input, select')?.setAttribute('aria-invalid', 'true');
  }
  elements.form.querySelector('[aria-invalid="true"]')?.focus();
}

function fillForm(title) {
  const fields = elements.form.elements;
  fields.title.value = title?.title ?? '';
  fields.type.value = title?.type ?? 'movie';
  fields.director.value = title?.director ?? '';
  fields.year.value = title?.year ?? '';
  fields.genres.value = title?.genres.join(', ') ?? '';
  fields.runtimeMinutes.value = title?.runtimeMinutes ?? '';
  fields.language.value = title?.language ?? 'en';
  fields.seasons.value = title?.seasons ?? '';
  fields.episodes.value = title?.episodes ?? '';
  fields.watched.checked = title?.watched ?? false;
  fields.rating.value = title?.rating ?? '';
  fields.watchedOn.value = title?.watchedOn ?? '';
  syncConditionalFields();
}

/** Convierte un campo numerico: vacio es null, y lo que no es numero viaja tal cual para que la API lo rechace. */
function numberOrNull(raw) {
  const text = raw.trim();
  if (text === '') return null;
  const value = Number(text);
  return Number.isNaN(value) ? text : value;
}

/**
 * Arma el recurso completo a partir del formulario. Los campos obligatorios
 * vacios no se mandan, asi la API responde "es obligatorio" en vez de un error
 * de tipo. Los campos que no aplican (temporadas en una pelicula, puntaje en
 * algo no visto) viajan como null, que es su valor "no tiene".
 */
function readForm() {
  const fields = elements.form.elements;
  const body = {};

  const text = (name) => fields[name].value.trim();
  for (const name of ['title', 'director']) {
    if (text(name) !== '') body[name] = text(name);
  }
  body.type = fields.type.value;

  for (const name of ['year', 'runtimeMinutes']) {
    const value = numberOrNull(fields[name].value);
    if (value !== null) body[name] = value;
  }

  const genres = text('genres')
    .split(',')
    .map((genre) => genre.trim())
    .filter(Boolean);
  if (genres.length > 0) body.genres = genres;

  if (text('language') !== '') body.language = text('language');

  const isSeries = body.type === 'series';
  body.seasons = isSeries ? numberOrNull(fields.seasons.value) : null;
  body.episodes = isSeries ? numberOrNull(fields.episodes.value) : null;

  body.watched = fields.watched.checked;
  body.rating = body.watched ? numberOrNull(fields.rating.value) : null;
  body.watchedOn = body.watched && text('watchedOn') !== '' ? text('watchedOn') : null;

  return body;
}

function openCreateForm() {
  state.editingId = null;
  elements.formTitle.textContent = 'Nuevo título';
  clearErrors();
  fillForm(null);
  elements.dialog.showModal();
}

async function openEditForm(id) {
  try {
    // Se pide el titulo de nuevo en vez de usar la fila: puede haber cambiado.
    const { data } = await api.getTitle(id);
    state.editingId = id;
    elements.formTitle.textContent = `Editar: ${data.title}`;
    clearErrors();
    fillForm(data);
    elements.dialog.showModal();
  } catch (error) {
    showStatus(error.message, 'error');
    if (error instanceof ApiError && error.status === 404) loadTitles();
  }
}

async function submitForm(event) {
  event.preventDefault();
  clearErrors();
  const body = readForm();

  try {
    // El formulario tiene el recurso entero, asi que la edicion es un PUT
    // (reemplazo completo). El PATCH queda para cambios puntuales, como
    // marcar un titulo como visto desde la tabla.
    if (state.editingId === null) {
      const { data } = await api.createTitle(body);
      showStatus(`Se agregó "${data.title}" al catálogo.`, 'success');
    } else {
      const { data } = await api.replaceTitle(state.editingId, body);
      showStatus(`Se guardaron los cambios de "${data.title}".`, 'success');
    }
    elements.dialog.close();
    await Promise.all([loadTitles(), loadGenres()]);
  } catch (error) {
    if (error instanceof ApiError) {
      showErrors(error);
    } else {
      elements.formError.textContent = 'No se pudo conectar con el servidor.';
    }
  }
}

// ---------------------------------------------------------------------------
// Acciones de cada fila
// ---------------------------------------------------------------------------

async function toggleWatched(title) {
  // Desmarcar tambien borra puntaje y fecha: la API no admite un titulo
  // puntuado que no se vio (422).
  const changes = title.watched
    ? { watched: false, rating: null, watchedOn: null }
    : { watched: true, watchedOn: today() };
  try {
    await api.updateTitle(title.id, changes);
    showStatus(
      title.watched ? `"${title.title}" volvió a pendientes.` : `"${title.title}" quedó como visto.`,
      'success',
    );
    await loadTitles();
  } catch (error) {
    showStatus(error.message, 'error');
  }
}

async function deleteTitle(title) {
  if (!window.confirm(`¿Eliminar "${title.title}" (${title.year}) del catálogo?`)) {
    return;
  }
  try {
    await api.deleteTitle(title.id);
    showStatus(`Se eliminó "${title.title}".`, 'success');
  } catch (error) {
    showStatus(error.message, 'error');
  }
  await Promise.all([loadTitles(), loadGenres()]);
}

// ---------------------------------------------------------------------------
// Eventos
// ---------------------------------------------------------------------------

elements.filters.addEventListener('submit', (event) => {
  event.preventDefault();
  state.filters = readFilters();
  state.page = 1;
  showStatus('');
  loadTitles();
});

// Los selects filtran apenas cambian; la busqueda espera al boton o al Enter.
elements.filters.addEventListener('change', (event) => {
  if (event.target.tagName === 'SELECT') {
    elements.filters.requestSubmit();
  }
});

elements.filters.addEventListener('reset', () => {
  // El reset limpia los campos despues de este evento: se espera un ciclo.
  setTimeout(() => elements.filters.requestSubmit());
});

elements.prev.addEventListener('click', () => {
  state.page -= 1;
  loadTitles();
});

elements.next.addEventListener('click', () => {
  state.page += 1;
  loadTitles();
});

$('#new-title').addEventListener('click', openCreateForm);
$('#cancel-form').addEventListener('click', () => elements.dialog.close());
elements.form.addEventListener('submit', submitForm);
elements.form.elements.type.addEventListener('change', syncConditionalFields);
elements.form.elements.watched.addEventListener('change', syncConditionalFields);

loadGenres();
loadTitles();
