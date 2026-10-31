/**
 * Reglas de negocio de titulos.
 *
 * Esta capa no conoce a Express: recibe datos ya parseados y devuelve datos o
 * tira un AppError. Los controladores solo traducen entre HTTP y esto.
 */

import { config } from '../config/index.js';
import { AppError } from '../errors/app-error.js';
import { titleRepository } from '../repositories/title.repository.js';
import { validateTitle } from '../validators/title.validator.js';

const SORTABLE_FIELDS = ['id', 'title', 'year', 'rating', 'runtimeMinutes'];

function parseBoolean(raw, field) {
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  throw AppError.badRequest(`El parámetro '${field}' solo acepta true o false.`);
}

function parseInteger(raw, field, { min, max } = {}) {
  const value = Number(raw);
  if (!Number.isInteger(value)) {
    throw AppError.badRequest(`El parámetro '${field}' tiene que ser un número entero.`);
  }
  if (min !== undefined && value < min) {
    throw AppError.badRequest(`El parámetro '${field}' no puede ser menor que ${min}.`);
  }
  if (max !== undefined && value > max) {
    throw AppError.badRequest(`El parámetro '${field}' no puede ser mayor que ${max}.`);
  }
  return value;
}

/**
 * Reglas de negocio. Son distintas de la validacion de forma: el cuerpo se
 * entiende perfectamente, lo que no cierra es lo que dice. Por eso 422 y no 400.
 */
function assertBusinessRules(title) {
  const details = [];

  if (title.type === 'series') {
    if (title.seasons === null) {
      details.push({ field: 'seasons', message: 'una serie tiene que declarar sus temporadas' });
    }
    if (title.episodes === null) {
      details.push({ field: 'episodes', message: 'una serie tiene que declarar sus episodios' });
    }
  } else {
    if (title.seasons !== null) {
      details.push({ field: 'seasons', message: 'una película no tiene temporadas' });
    }
    if (title.episodes !== null) {
      details.push({ field: 'episodes', message: 'una película no tiene episodios' });
    }
  }

  // No se puede puntuar ni fechar algo que todavia no se vio.
  if (title.rating !== null && !title.watched) {
    details.push({ field: 'rating', message: 'no se puede puntuar un título no visto' });
  }
  if (title.watchedOn !== null && !title.watched) {
    details.push({ field: 'watchedOn', message: 'no se puede fechar un título no visto' });
  }
  if (title.watchedOn !== null && title.watchedOn > new Date().toISOString().slice(0, 10)) {
    details.push({ field: 'watchedOn', message: 'no puede ser una fecha futura' });
  }

  if (details.length > 0) {
    throw AppError.unprocessableEntity(
      'El título no cumple las reglas del catálogo.',
      details,
    );
  }
}

/** Un mismo titulo estrenado el mismo ano no puede estar dos veces. */
function assertTitleIsFree(title, year, { excludeId } = {}) {
  const existing = titleRepository.findByTitleAndYear(title, year);
  if (existing && existing.id !== excludeId) {
    throw AppError.conflict(
      `Ya existe '${title}' (${year}) en el catálogo.`,
      [{ field: 'title', conflictsWith: existing.id }],
    );
  }
}

function requireTitle(id) {
  const title = titleRepository.findById(id);
  if (!title) throw AppError.notFound(`No existe un título con id ${id}.`);
  return title;
}

function runValidation(body, options) {
  const { value, errors } = validateTitle(body, options);
  if (errors.length > 0) {
    throw AppError.badRequest('El cuerpo del pedido tiene campos inválidos.', errors);
  }
  return value;
}

export const titleService = {
  /** Listado con filtros, orden y paginado, todos opcionales. */
  list(query = {}) {
    let titles = titleRepository.findAll();

    if (query.type !== undefined) {
      const type = String(query.type);
      if (type !== 'movie' && type !== 'series') {
        throw AppError.badRequest("El parámetro 'type' solo acepta movie o series.");
      }
      titles = titles.filter((title) => title.type === type);
    }

    if (query.genre !== undefined) {
      const genre = String(query.genre).toLowerCase();
      titles = titles.filter((title) =>
        title.genres.some((item) => item.toLowerCase() === genre),
      );
    }

    if (query.director !== undefined) {
      const director = String(query.director).toLowerCase();
      titles = titles.filter((title) => title.director.toLowerCase().includes(director));
    }

    if (query.language !== undefined) {
      const language = String(query.language).toLowerCase();
      titles = titles.filter((title) => title.language === language);
    }

    if (query.watched !== undefined) {
      const watched = parseBoolean(query.watched, 'watched');
      titles = titles.filter((title) => title.watched === watched);
    }

    if (query.minRating !== undefined) {
      const minRating = parseInteger(query.minRating, 'minRating', { min: 1, max: 10 });
      // Un titulo sin puntaje no llega a ningun minimo: queda afuera.
      titles = titles.filter((title) => title.rating !== null && title.rating >= minRating);
    }

    if (query.yearFrom !== undefined) {
      const yearFrom = parseInteger(query.yearFrom, 'yearFrom', { min: 1888 });
      titles = titles.filter((title) => title.year >= yearFrom);
    }

    if (query.yearTo !== undefined) {
      const yearTo = parseInteger(query.yearTo, 'yearTo', { min: 1888 });
      titles = titles.filter((title) => title.year <= yearTo);
    }

    if (query.q !== undefined) {
      const term = String(query.q).trim().toLowerCase();
      if (term.length < 2) {
        throw AppError.badRequest("El parámetro 'q' necesita al menos 2 caracteres.");
      }
      titles = titles.filter(
        (title) =>
          title.title.toLowerCase().includes(term) ||
          title.director.toLowerCase().includes(term),
      );
    }

    const sortBy = query.sort ?? 'id';
    if (!SORTABLE_FIELDS.includes(sortBy)) {
      throw AppError.badRequest(`El parámetro 'sort' solo acepta: ${SORTABLE_FIELDS.join(', ')}.`);
    }
    const order = query.order ?? 'asc';
    if (order !== 'asc' && order !== 'desc') {
      throw AppError.badRequest("El parámetro 'order' solo acepta asc o desc.");
    }

    const direction = order === 'asc' ? 1 : -1;
    titles.sort((a, b) => {
      const left = a[sortBy];
      const right = b[sortBy];
      // Los titulos sin puntaje van siempre al final, ordene como ordene.
      if (left === null && right === null) return 0;
      if (left === null) return 1;
      if (right === null) return -1;
      if (typeof left === 'string') return left.localeCompare(right) * direction;
      return (left - right) * direction;
    });

    const page = query.page === undefined ? 1 : parseInteger(query.page, 'page', { min: 1 });
    const limit =
      query.limit === undefined
        ? config.pagination.defaultLimit
        : parseInteger(query.limit, 'limit', { min: 1, max: config.pagination.maxLimit });

    const total = titles.length;
    const start = (page - 1) * limit;

    return {
      data: titles.slice(start, start + limit),
      meta: { total, page, limit, pages: Math.max(1, Math.ceil(total / limit)) },
    };
  },

  getById(id) {
    return requireTitle(id);
  },

  create(body) {
    const value = runValidation(body);
    assertTitleIsFree(value.title, value.year);
    assertBusinessRules(value);
    return titleRepository.create(value);
  },

  /** PUT: reemplazo completo, hay que mandar el recurso entero. */
  replace(id, body) {
    const current = requireTitle(id);
    const value = runValidation(body);
    assertTitleIsFree(value.title, value.year, { excludeId: current.id });
    assertBusinessRules(value);
    return titleRepository.save({ id: current.id, ...value });
  },

  /** PATCH: modificacion parcial, solo viajan los campos que cambian. */
  update(id, body) {
    const current = requireTitle(id);
    const value = runValidation(body, { partial: true });
    const merged = { ...current, ...value };
    if (value.title !== undefined || value.year !== undefined) {
      assertTitleIsFree(merged.title, merged.year, { excludeId: current.id });
    }
    assertBusinessRules(merged);
    return titleRepository.save(merged);
  },

  remove(id) {
    requireTitle(id);
    titleRepository.remove(id);
  },

  /** Generos derivados de los titulos cargados, con su conteo. */
  listGenres() {
    const counts = new Map();
    for (const title of titleRepository.findAll()) {
      for (const genre of title.genres) {
        counts.set(genre, (counts.get(genre) ?? 0) + 1);
      }
    }
    return [...counts.entries()]
      .map(([name, titleCount]) => ({ name, titleCount }))
      .sort((a, b) => b.titleCount - a.titleCount || a.name.localeCompare(b.name));
  },

  /** Directores derivados de los titulos cargados, con su conteo. */
  listDirectors() {
    const counts = new Map();
    for (const title of titleRepository.findAll()) {
      counts.set(title.director, (counts.get(title.director) ?? 0) + 1);
    }
    return [...counts.entries()]
      .map(([name, titleCount]) => ({ name, titleCount }))
      .sort((a, b) => b.titleCount - a.titleCount || a.name.localeCompare(b.name));
  },
};
