/**
 * Reglas de negocio de productos.
 *
 * Esta capa no conoce a Express: recibe datos ya parseados y devuelve datos o
 * tira un AppError. Los controladores solo traducen entre HTTP y esto.
 */

import { config } from '../config/index.js';
import { AppError } from '../errors/app-error.js';
import { productRepository } from '../repositories/product.repository.js';
import { validateProduct } from '../validators/product.validator.js';

const SORTABLE_FIELDS = ['id', 'code', 'name', 'category', 'listPrice', 'unitsInStock'];

function parseBoolean(raw, field) {
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  throw AppError.badRequest(`El parametro '${field}' solo acepta true o false.`);
}

function parsePositiveInteger(raw, field, { max } = {}) {
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1) {
    throw AppError.badRequest(`El parametro '${field}' tiene que ser un entero mayor a cero.`);
  }
  if (max && value > max) {
    throw AppError.badRequest(`El parametro '${field}' no puede superar ${max}.`);
  }
  return value;
}

/**
 * Regla de negocio: nadie vende por debajo del costo. Es distinto de un error
 * de forma, por eso devuelve 422 y no 400.
 */
function assertPriceCoversCost(product) {
  if (product.standardCost > product.listPrice) {
    throw AppError.unprocessableEntity(
      'El costo estandar no puede superar al precio de lista.',
      [{ field: 'standardCost', message: `no puede ser mayor que listPrice (${product.listPrice})` }],
    );
  }
}

/** El codigo identifica al producto para el negocio, asi que no se puede repetir. */
function assertCodeIsFree(code, { excludeId } = {}) {
  const existing = productRepository.findByCode(code);
  if (existing && existing.id !== excludeId) {
    throw AppError.conflict(
      `Ya existe un producto con el codigo '${code}'.`,
      [{ field: 'code', conflictsWith: existing.id }],
    );
  }
}

function requireProduct(id) {
  const product = productRepository.findById(id);
  if (!product) throw AppError.notFound(`No existe un producto con id ${id}.`);
  return product;
}

function runValidation(body, options) {
  const { value, errors } = validateProduct(body, options);
  if (errors.length > 0) {
    throw AppError.badRequest('El cuerpo del pedido tiene campos invalidos.', errors);
  }
  return value;
}

export const productService = {
  /** Listado con filtros, orden y paginado, todos opcionales. */
  list(query = {}) {
    let products = productRepository.findAll();

    if (query.category !== undefined) {
      const category = String(query.category).toLowerCase();
      products = products.filter((product) => product.category.toLowerCase() === category);
    }

    if (query.supplierId !== undefined) {
      const supplierId = parsePositiveInteger(query.supplierId, 'supplierId');
      products = products.filter((product) => product.supplierId === supplierId);
    }

    if (query.discontinued !== undefined) {
      const discontinued = parseBoolean(query.discontinued, 'discontinued');
      products = products.filter((product) => product.discontinued === discontinued);
    }

    // Filtro propio del dominio: los productos que quedaron por debajo del
    // punto de reposicion son justo los que le interesan a quien compra.
    if (query.belowReorder !== undefined) {
      const belowReorder = parseBoolean(query.belowReorder, 'belowReorder');
      products = products.filter(
        (product) => (product.unitsInStock < product.reorderLevel) === belowReorder,
      );
    }

    if (query.q !== undefined) {
      const term = String(query.q).trim().toLowerCase();
      if (term.length < 2) {
        throw AppError.badRequest("El parametro 'q' necesita al menos 2 caracteres.");
      }
      products = products.filter(
        (product) =>
          product.name.toLowerCase().includes(term) || product.code.toLowerCase().includes(term),
      );
    }

    const sortBy = query.sort ?? 'id';
    if (!SORTABLE_FIELDS.includes(sortBy)) {
      throw AppError.badRequest(
        `El parametro 'sort' solo acepta: ${SORTABLE_FIELDS.join(', ')}.`,
      );
    }
    const order = query.order ?? 'asc';
    if (order !== 'asc' && order !== 'desc') {
      throw AppError.badRequest("El parametro 'order' solo acepta asc o desc.");
    }

    const direction = order === 'asc' ? 1 : -1;
    products.sort((a, b) => {
      const left = a[sortBy];
      const right = b[sortBy];
      if (typeof left === 'string') return left.localeCompare(right) * direction;
      return (left - right) * direction;
    });

    const page = query.page === undefined ? 1 : parsePositiveInteger(query.page, 'page');
    const limit =
      query.limit === undefined
        ? config.pagination.defaultLimit
        : parsePositiveInteger(query.limit, 'limit', { max: config.pagination.maxLimit });

    const total = products.length;
    const start = (page - 1) * limit;

    return {
      data: products.slice(start, start + limit),
      meta: { total, page, limit, pages: Math.max(1, Math.ceil(total / limit)) },
    };
  },

  getById(id) {
    return requireProduct(id);
  },

  create(body) {
    const value = runValidation(body);
    assertCodeIsFree(value.code);
    assertPriceCoversCost(value);
    return productRepository.create(value);
  },

  /** PUT: reemplazo completo, hay que mandar el recurso entero. */
  replace(id, body) {
    const current = requireProduct(id);
    const value = runValidation(body);
    assertCodeIsFree(value.code, { excludeId: current.id });
    assertPriceCoversCost(value);
    return productRepository.save({ id: current.id, ...value });
  },

  /** PATCH: modificacion parcial, solo viajan los campos que cambian. */
  update(id, body) {
    const current = requireProduct(id);
    const value = runValidation(body, { partial: true });
    const merged = { ...current, ...value };
    if (value.code !== undefined) assertCodeIsFree(value.code, { excludeId: current.id });
    assertPriceCoversCost(merged);
    return productRepository.save(merged);
  },

  remove(id) {
    requireProduct(id);
    productRepository.remove(id);
  },

  /** Categorias derivadas de los productos cargados, con su conteo. */
  listCategories() {
    const counts = new Map();
    for (const product of productRepository.findAll()) {
      counts.set(product.category, (counts.get(product.category) ?? 0) + 1);
    }
    return [...counts.entries()]
      .map(([name, productCount]) => ({ name, productCount }))
      .sort((a, b) => a.name.localeCompare(b.name));
  },

  /** Proveedores derivados de los productos cargados. */
  listSuppliers() {
    const suppliers = new Map();
    for (const product of productRepository.findAll()) {
      const entry = suppliers.get(product.supplierId) ?? {
        id: product.supplierId,
        name: product.supplierName,
        productCount: 0,
      };
      entry.productCount += 1;
      suppliers.set(product.supplierId, entry);
    }
    return [...suppliers.values()].sort((a, b) => a.id - b.id);
  },
};
