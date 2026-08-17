/**
 * Validacion y normalizacion del cuerpo de un titulo.
 *
 * Devuelve el objeto ya casteado mas la lista de errores, en vez de tirar una
 * excepcion por el primer problema: al cliente le sirve mucho mas recibir los
 * cinco campos mal de una que descubrirlos de a uno.
 *
 * Aca solo se valida la FORMA del cuerpo (tipos, rangos, formatos). Las reglas
 * de negocio, como que una serie tenga temporadas, viven en el servicio y
 * devuelven 422 en vez de 400.
 */

export const TITLE_TYPES = ['movie', 'series'];

const LANGUAGE_PATTERN = /^[a-z]{2}$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** El primer largometraje conocido es de 1888, no tiene sentido admitir menos. */
const FIRST_FILM_YEAR = 1888;

/** Se admiten estrenos ya anunciados, pero no un ano cualquiera del futuro. */
const MAX_YEAR = new Date().getFullYear() + 5;

/** Esquema del recurso Titulo. El `id` no esta: lo asigna el servidor. */
export const TITLE_SCHEMA = {
  title: { type: 'string', required: true, min: 1, max: 200 },
  type: { type: 'enum', required: true, values: TITLE_TYPES },
  director: { type: 'string', required: true, min: 2, max: 120 },
  year: { type: 'integer', required: true, min: FIRST_FILM_YEAR, max: MAX_YEAR },
  genres: { type: 'array', required: true, minItems: 1, maxItems: 5, itemMax: 40 },
  runtimeMinutes: { type: 'integer', required: true, min: 1, max: 1000 },
  seasons: { type: 'integer', required: false, min: 1, max: 100, nullable: true, default: null },
  episodes: { type: 'integer', required: false, min: 1, max: 10000, nullable: true, default: null },
  language: { type: 'string', required: false, pattern: LANGUAGE_PATTERN, default: 'en' },
  watched: { type: 'boolean', required: false, default: false },
  rating: { type: 'integer', required: false, min: 1, max: 10, nullable: true, default: null },
  watchedOn: { type: 'date', required: false, nullable: true, default: null },
};

const FIELD_NAMES = Object.keys(TITLE_SCHEMA);

function checkString(field, rules, raw, errors) {
  if (typeof raw !== 'string') {
    errors.push({ field, message: 'tiene que ser una cadena de texto' });
    return undefined;
  }
  const value = raw.trim();
  if (rules.min !== undefined && value.length < rules.min) {
    errors.push({ field, message: `tiene que tener al menos ${rules.min} caracteres` });
    return undefined;
  }
  if (rules.max !== undefined && value.length > rules.max) {
    errors.push({ field, message: `no puede superar los ${rules.max} caracteres` });
    return undefined;
  }
  if (rules.pattern && !rules.pattern.test(value)) {
    errors.push({ field, message: 'no respeta el formato esperado (codigo ISO de dos letras, ej. es)' });
    return undefined;
  }
  return value;
}

function checkNumber(field, rules, raw, errors) {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) {
    errors.push({ field, message: 'tiene que ser un numero' });
    return undefined;
  }
  if (rules.type === 'integer' && !Number.isInteger(raw)) {
    errors.push({ field, message: 'tiene que ser un numero entero' });
    return undefined;
  }
  if (rules.min !== undefined && raw < rules.min) {
    errors.push({ field, message: `no puede ser menor que ${rules.min}` });
    return undefined;
  }
  if (rules.max !== undefined && raw > rules.max) {
    errors.push({ field, message: `no puede ser mayor que ${rules.max}` });
    return undefined;
  }
  return raw;
}

function checkArray(field, rules, raw, errors) {
  if (!Array.isArray(raw)) {
    errors.push({ field, message: 'tiene que ser una lista' });
    return undefined;
  }
  if (raw.length < rules.minItems) {
    errors.push({ field, message: `tiene que tener al menos ${rules.minItems} elemento(s)` });
    return undefined;
  }
  if (raw.length > rules.maxItems) {
    errors.push({ field, message: `no puede tener mas de ${rules.maxItems} elementos` });
    return undefined;
  }

  const items = [];
  for (const item of raw) {
    if (typeof item !== 'string' || item.trim().length === 0) {
      errors.push({ field, message: 'todos los elementos tienen que ser texto no vacio' });
      return undefined;
    }
    const value = item.trim();
    if (value.length > rules.itemMax) {
      errors.push({ field, message: `ningun elemento puede superar los ${rules.itemMax} caracteres` });
      return undefined;
    }
    items.push(value);
  }

  // Repetir un genero no rompe nada, pero casi siempre es un error de carga.
  if (new Set(items.map((item) => item.toLowerCase())).size !== items.length) {
    errors.push({ field, message: 'no puede tener elementos repetidos' });
    return undefined;
  }

  return items;
}

function checkDate(field, raw, errors) {
  if (typeof raw !== 'string' || !DATE_PATTERN.test(raw)) {
    errors.push({ field, message: 'tiene que ser una fecha con formato AAAA-MM-DD' });
    return undefined;
  }
  // El formato puede ser correcto y la fecha no existir (por ejemplo 2026-02-31).
  const parsed = new Date(`${raw}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== raw) {
    errors.push({ field, message: 'no es una fecha existente del calendario' });
    return undefined;
  }
  return raw;
}

function checkField(field, rules, raw, errors) {
  if (raw === null) {
    if (rules.nullable) return null;
    errors.push({ field, message: 'no admite null' });
    return undefined;
  }

  switch (rules.type) {
    case 'string':
      return checkString(field, rules, raw, errors);
    case 'enum':
      if (!rules.values.includes(raw)) {
        errors.push({ field, message: `solo acepta: ${rules.values.join(', ')}` });
        return undefined;
      }
      return raw;
    case 'boolean':
      if (typeof raw !== 'boolean') {
        errors.push({ field, message: 'tiene que ser true o false' });
        return undefined;
      }
      return raw;
    case 'array':
      return checkArray(field, rules, raw, errors);
    case 'date':
      return checkDate(field, raw, errors);
    default:
      return checkNumber(field, rules, raw, errors);
  }
}

/**
 * @param {object} body cuerpo crudo del pedido
 * @param {{ partial?: boolean }} options `partial: true` para PATCH, donde los
 *   campos requeridos pueden faltar porque solo se manda lo que cambia.
 */
export function validateTitle(body, { partial = false } = {}) {
  const errors = [];

  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    return { value: null, errors: [{ field: 'body', message: 'tiene que ser un objeto JSON' }] };
  }

  // Campos desconocidos: se rechazan en vez de ignorarse en silencio, para que
  // un error de tipeo en el nombre de un campo no pase por exito.
  const unknown = Object.keys(body).filter((key) => !FIELD_NAMES.includes(key));
  for (const field of unknown) {
    const message = field === 'id'
      ? 'el id lo asigna el servidor y no se puede mandar en el body'
      : 'campo desconocido';
    errors.push({ field, message });
  }

  const value = {};

  for (const [field, rules] of Object.entries(TITLE_SCHEMA)) {
    const present = Object.hasOwn(body, field);

    if (!present) {
      if (partial) continue;
      if (rules.required) {
        errors.push({ field, message: 'es obligatorio' });
        continue;
      }
      value[field] = rules.default;
      continue;
    }

    const checked = checkField(field, rules, body[field], errors);
    if (checked !== undefined) value[field] = checked;
  }

  if (partial && Object.keys(value).length === 0 && errors.length === 0) {
    errors.push({ field: 'body', message: 'hay que mandar al menos un campo para modificar' });
  }

  return { value: errors.length === 0 ? value : null, errors };
}
