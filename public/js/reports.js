/**
 * Pantalla de reportes.
 *
 * No calcula nada: muestra lo que devuelven los dos endpoints de reportes. Se
 * piden de nuevo cada vez que se entra a la pantalla, asi reflejan los cambios
 * hechos en el catalogo.
 */

import { api } from './api.js';

const TYPE_LABELS = { movie: 'Películas', series: 'Series' };

const $ = (selector) => document.querySelector(selector);

/** Crea un elemento con texto plano adentro (nunca innerHTML con datos). */
function el(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}

const numberFormat = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 1 });
const format = (value) => (value === null ? '—' : numberFormat.format(value));

function formatMinutes(minutes) {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest} min`;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}

/** Celda numerica: alineada a la derecha para que las cifras se comparen de un vistazo. */
function numCell(value) {
  return el('td', format(value), 'num');
}

function renderWatchStats({ summary, byType, pending }) {
  const kpis = [
    ['Títulos', format(summary.totalTitles)],
    ['Vistos', format(summary.watched)],
    ['Pendientes', format(summary.pending)],
    ['Completado', `${format(summary.completionPct)} %`],
    ['Horas vistas', format(summary.watchedHours)],
    ['Horas pendientes', format(summary.pendingHours)],
    ['Puntaje promedio', format(summary.averageRating)],
  ];
  $('#watch-summary').replaceChildren(
    ...kpis.map(([label, value]) => {
      const item = el('div', undefined, 'kpi');
      item.append(el('dt', label), el('dd', value));
      return item;
    }),
  );

  $('#completion-bar').style.width = `${summary.completionPct}%`;

  $('#by-type-body').replaceChildren(
    ...byType.map((row) => {
      const tr = el('tr');
      const name = el('th', TYPE_LABELS[row.type]);
      name.scope = 'row';
      tr.append(name, numCell(row.total), numCell(row.watched), numCell(row.pending), numCell(row.watchedHours));
      return tr;
    }),
  );

  const list = $('#pending-list');
  if (pending.length === 0) {
    list.replaceChildren(el('li', 'No queda nada pendiente.'));
    return;
  }
  list.replaceChildren(
    ...pending.map((title) => {
      const item = el('li');
      item.append(
        el('span', `${title.title} (${title.year})`),
        el('span', `${title.type === 'series' ? 'Serie' : 'Película'} · ${formatMinutes(title.totalMinutes)}`, 'muted'),
      );
      return item;
    }),
  );
}

function renderRatingByGenre({ summary, genres }) {
  // Un titulo con varios generos suma en todos: se aclara para que no parezca un error.
  $('#rating-note').textContent =
    `${summary.genres} géneros. Un título con varios géneros cuenta en cada uno, ` +
    `por eso la columna "Títulos" suma ${summary.genreAssignments} y no ${summary.totalTitles}.`;

  $('#rating-body').replaceChildren(
    ...genres.map((genre) => {
      const tr = el('tr');
      const name = el('th', genre.genre);
      name.scope = 'row';

      // La barra es solo visual: el riel representa la escala entera, de 0 a
      // 10, asi un 7 se ve como el 70 % de un 10. El numero queda escrito al lado.
      const ratingCell = el('td');
      const row = el('div', undefined, 'bar-row');
      const track = el('span', undefined, 'bar-track');
      const bar = el('span', undefined, 'bar');
      bar.style.width = `${((genre.averageRating ?? 0) / 10) * 100}%`;
      track.setAttribute('aria-hidden', 'true');
      track.append(bar);
      row.append(el('span', format(genre.averageRating), 'bar-value'), track);
      ratingCell.append(row);

      tr.append(name, numCell(genre.titleCount), numCell(genre.ratedCount), ratingCell);
      return tr;
    }),
  );
}

export async function loadReports() {
  const status = $('#reports-status');
  status.textContent = '';
  try {
    // Los dos pedidos son independientes: se hacen en paralelo.
    const [watchStats, ratingByGenre] = await Promise.all([api.watchStats(), api.ratingByGenre()]);
    renderWatchStats(watchStats.data);
    renderRatingByGenre(ratingByGenre.data);
  } catch (error) {
    status.textContent = error.message;
    status.dataset.kind = 'error';
  }
}
