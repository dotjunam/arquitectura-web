/**
 * Validacion y normalizacion del cuerpo de un producto.
 *
 * Devuelve el objeto ya casteado mas la lista de errores, en vez de tirar una
 * excepcion por el primer problema: al cliente le sirve mucho mas recibir los
 * cinco campos mal de una que descubrirlos de a uno.
 */

const CODE_PATTERN = /^[A-Z]{2,8}-\d+$/;

/** Esquema del recurso Producto. El `id` no esta: lo asigna el servidor. */
export const PRODUCT_SCHEMA = {
  code: { type: 'string', required: true, pattern: CODE_PATTERN },
  name: { type: 'string', required: true, min: 3, max: 120 },
  category: { type: 'string', required: true, min: 2, max: 60 },
  quantityPerUnit: { type: 'string', required: false, max: 60, default: '' },
  discontinued: { type: 'boolean', required: false, default: false },
  listPrice: { type: 'number', required: true, min: 0 },
  standardCost: { type: 'number', required: true, min: 0 },
  unitsInStock: { type: 'integer', required: false, min: 0, default: 0 },
  unitsOnOrder: { type: 'integer', required: false, min: 0, default: 0 },
  minimumReorderQuantity: { type: 'integer', required: false, min: 0, default: 0 },
  estimatedMonthlyDemand: {
    type: 'integer',
    required: false,
    min: 0,
    nullable: true,
    default: null,
  },
  reorderLevel: { type: 'integer', required: false, min: 0, default: 0 },
  targetLevel: { type: 'integer', required: false, min: 0, default: 0 },
  supplierId: { type: 'integer', required: true, min: 1 },
  supplierName: { type: 'string', required: true, min: 2, max: 80 },
};

const FIELD_NAMES = Object.keys(PRODUCT_SCHEMA);

function checkField(field, rules, raw, errors) {
  if (raw === null) {
    if (rules.nullable) return null;
    errors.push({ field, message: 'no admite null' });
    return undefined;
  }

  if (rules.type === 'string') {
    if (typeof raw !== 'string') {
      errors.push({ field, message: 'tiene que ser una cadena de texto' });
      return undefined;
    }
    const value = raw.trim();
    if (rules.min && value.length < rules.min) {
      errors.push({ field, message: `tiene que tener al menos ${rules.min} caracteres` });
      return undefined;
    }
    if (rules.max && value.length > rules.max) {
      errors.push({ field, message: `no puede superar los ${rules.max} caracteres` });
      return undefined;
    }
    if (rules.pattern && !rules.pattern.test(value)) {
      errors.push({ field, message: 'no respeta el formato esperado (ejemplo: NWTB-1)' });
      return undefined;
    }
    return value;
  }

  if (rules.type === 'boolean') {
    if (typeof raw !== 'boolean') {
      errors.push({ field, message: 'tiene que ser true o false' });
      return undefined;
    }
    return raw;
  }

  // number e integer
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
  return raw;
}

/**
 * @param {object} body cuerpo crudo del pedido
 * @param {{ partial?: boolean }} options `partial: true` para PATCH, donde los
 *   campos requeridos pueden faltar porque solo se manda lo que cambia.
 */
export function validateProduct(body, { partial = false } = {}) {
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

  for (const [field, rules] of Object.entries(PRODUCT_SCHEMA)) {
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
