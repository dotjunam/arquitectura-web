/**
 * Cliente de la API.
 *
 * Es el unico archivo del frontend que sabe de URLs, verbos y status codes. El
 * resto de la interfaz llama a funciones con nombre de dominio (`createTitle`)
 * y recibe datos o un `ApiError`: la misma separacion en capas que el backend.
 */

const BASE_URL = '/api/v1';

/** Error de la API con el status y el cuerpo de error que mando el servidor. */
export class ApiError extends Error {
  constructor(status, error) {
    super(error?.message ?? `El servidor respondio ${status}.`);
    this.status = status;
    this.code = error?.code ?? null;
    this.details = error?.details ?? [];
  }
}

async function request(method, path, body) {
  const init = { method, headers: { Accept: 'application/json' } };
  if (body !== undefined) {
    init.headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(body);
  }

  const response = await fetch(`${BASE_URL}${path}`, init);

  // 204 No Content: la baja salio bien y no hay cuerpo que leer.
  if (response.status === 204) {
    return null;
  }

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new ApiError(response.status, payload?.error);
  }
  return payload;
}

/** Arma la query string salteando los filtros vacios. */
function toQuery(params) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== '' && value !== undefined && value !== null) {
      query.set(key, value);
    }
  }
  const text = query.toString();
  return text ? `?${text}` : '';
}

export const api = {
  listTitles: (params) => request('GET', `/titles${toQuery(params)}`),
  getTitle: (id) => request('GET', `/titles/${id}`),
  createTitle: (title) => request('POST', '/titles', title),
  replaceTitle: (id, title) => request('PUT', `/titles/${id}`, title),
  updateTitle: (id, changes) => request('PATCH', `/titles/${id}`, changes),
  deleteTitle: (id) => request('DELETE', `/titles/${id}`),
  listGenres: () => request('GET', '/genres'),
  watchStats: () => request('GET', '/reports/watch-stats'),
  ratingByGenre: () => request('GET', '/reports/rating-by-genre'),
};
