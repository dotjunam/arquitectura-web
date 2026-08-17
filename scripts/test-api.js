/**
 * Pruebas de los endpoints de la API.
 *
 * Levanta la aplicacion en un puerto libre, le pega con `fetch` y verifica el
 * status code y el cuerpo de cada respuesta. No usa ninguna dependencia
 * externa: alcanza con el runtime de Node.
 *
 * Correr con: npm run test:api
 */

import { createApp } from '../src/app.js';

let passed = 0;
let failed = 0;

function check(description, condition, extra = '') {
  if (condition) {
    passed += 1;
    console.log(`  ok   ${description}`);
  } else {
    failed += 1;
    console.log(`  FALLA ${description}${extra ? ` -> ${extra}` : ''}`);
  }
}

function section(title) {
  console.log(`\n${title}`);
}

const app = createApp();
const server = app.listen(0);
await new Promise((resolve) => server.once('listening', resolve));
const baseUrl = `http://localhost:${server.address().port}`;

/** Envoltorio minimo para no repetir el armado del pedido en cada prueba. */
async function request(method, path, { body, headers = {}, raw } = {}) {
  const init = { method, headers: { ...headers } };
  if (raw !== undefined) {
    init.body = raw;
  } else if (body !== undefined) {
    init.headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(body);
  }
  const response = await fetch(`${baseUrl}${path}`, init);
  const text = await response.text();
  let payload = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = text;
  }
  return { status: response.status, headers: response.headers, payload };
}

const newProduct = {
  code: 'NWTB-900',
  name: 'Northwind Traders Yerba Mate',
  category: 'Beverages',
  quantityPerUnit: '12 paquetes x 500 g',
  listPrice: 24,
  standardCost: 15,
  unitsInStock: 40,
  reorderLevel: 10,
  targetLevel: 60,
  supplierId: 4,
  supplierName: 'Supplier D',
};

section('Indice y estado del servicio');
{
  const root = await request('GET', '/');
  check('GET / responde 200', root.status === 200, `status ${root.status}`);

  const health = await request('GET', '/api/v1/health');
  check('GET /api/v1/health responde 200', health.status === 200, `status ${health.status}`);
  check(
    'el seed cargo los 45 productos del dataset',
    health.payload?.seededProducts === 45,
    `seededProducts ${health.payload?.seededProducts}`,
  );
}

section('Listado de productos: filtros, orden y paginado');
{
  const all = await request('GET', '/api/v1/products');
  check('GET /products responde 200', all.status === 200, `status ${all.status}`);
  check('el total es 45', all.payload?.meta?.total === 45, `total ${all.payload?.meta?.total}`);
  check(
    'pagina de 20 por defecto',
    all.payload?.data?.length === 20,
    `devolvio ${all.payload?.data?.length}`,
  );

  const paged = await request('GET', '/api/v1/products?page=3&limit=20');
  check(
    'la tercera pagina trae los 5 que sobran',
    paged.payload?.data?.length === 5,
    `devolvio ${paged.payload?.data?.length}`,
  );

  const below = await request('GET', '/api/v1/products?belowReorder=true&limit=100');
  check(
    '29 productos por debajo del punto de reposicion',
    below.payload?.meta?.total === 29,
    `total ${below.payload?.meta?.total}`,
  );

  const discontinued = await request('GET', '/api/v1/products?discontinued=true&limit=100');
  check(
    '6 productos discontinuados',
    discontinued.payload?.meta?.total === 6,
    `total ${discontinued.payload?.meta?.total}`,
  );

  const beverages = await request('GET', '/api/v1/products?category=Beverages&limit=100');
  check(
    'el filtro por categoria no distingue mayusculas',
    beverages.status === 200 && beverages.payload?.meta?.total > 0,
    `total ${beverages.payload?.meta?.total}`,
  );

  const sorted = await request('GET', '/api/v1/products?sort=listPrice&order=desc&limit=100');
  const prices = sorted.payload?.data?.map((product) => product.listPrice) ?? [];
  check(
    'el orden por precio descendente se respeta',
    prices.every((price, index) => index === 0 || prices[index - 1] >= price),
    prices.slice(0, 3).join(', '),
  );

  const badSort = await request('GET', '/api/v1/products?sort=color');
  check('un campo de orden invalido devuelve 400', badSort.status === 400, `status ${badSort.status}`);

  const badLimit = await request('GET', '/api/v1/products?limit=abc');
  check('un limit no numerico devuelve 400', badLimit.status === 400, `status ${badLimit.status}`);
}

section('Lectura de un producto');
{
  const found = await request('GET', '/api/v1/products/1');
  check('GET /products/1 responde 200', found.status === 200, `status ${found.status}`);
  check(
    'devuelve el producto correcto',
    found.payload?.data?.code === 'NWTB-1',
    `code ${found.payload?.data?.code}`,
  );

  const missing = await request('GET', '/api/v1/products/9999');
  check('un id inexistente devuelve 404', missing.status === 404, `status ${missing.status}`);

  const invalid = await request('GET', '/api/v1/products/abc');
  check('un id no numerico devuelve 400', invalid.status === 400, `status ${invalid.status}`);
}

section('Alta de un producto');
let createdId = null;
{
  const created = await request('POST', '/api/v1/products', { body: newProduct });
  check('POST /products responde 201', created.status === 201, `status ${created.status}`);
  check(
    'la respuesta trae el header Location',
    created.headers.get('location')?.includes('/api/v1/products/'),
    created.headers.get('location') ?? 'sin header',
  );
  check(
    'el servidor asigno el id',
    Number.isInteger(created.payload?.data?.id),
    `id ${created.payload?.data?.id}`,
  );
  createdId = created.payload?.data?.id;

  const duplicated = await request('POST', '/api/v1/products', { body: newProduct });
  check('un codigo repetido devuelve 409', duplicated.status === 409, `status ${duplicated.status}`);

  const incomplete = await request('POST', '/api/v1/products', { body: { name: 'Sin datos' } });
  check('faltan campos obligatorios: 400', incomplete.status === 400, `status ${incomplete.status}`);
  check(
    'el 400 enumera todos los campos que fallaron',
    (incomplete.payload?.error?.details?.length ?? 0) >= 5,
    `${incomplete.payload?.error?.details?.length} errores`,
  );

  const costOverPrice = await request('POST', '/api/v1/products', {
    body: { ...newProduct, code: 'NWTB-901', listPrice: 10, standardCost: 30 },
  });
  check(
    'costo mayor al precio de lista: 422',
    costOverPrice.status === 422,
    `status ${costOverPrice.status}`,
  );

  const wrongType = await request('POST', '/api/v1/products', {
    raw: 'code=NWTB-902',
    headers: { 'Content-Type': 'text/plain' },
  });
  check('un Content-Type que no es JSON: 415', wrongType.status === 415, `status ${wrongType.status}`);

  const malformed = await request('POST', '/api/v1/products', {
    raw: '{"code": "NWTB-903",',
    headers: { 'Content-Type': 'application/json' },
  });
  check('un JSON mal formado: 400', malformed.status === 400, `status ${malformed.status}`);

  const withId = await request('POST', '/api/v1/products', { body: { ...newProduct, id: 500 } });
  check('mandar el id en el body: 400', withId.status === 400, `status ${withId.status}`);
}

section('Modificacion de un producto');
{
  const replaced = await request('PUT', `/api/v1/products/${createdId}`, {
    body: { ...newProduct, unitsInStock: 5 },
  });
  check('PUT responde 200', replaced.status === 200, `status ${replaced.status}`);
  check(
    'el reemplazo aplico el cambio',
    replaced.payload?.data?.unitsInStock === 5,
    `unitsInStock ${replaced.payload?.data?.unitsInStock}`,
  );

  const replacedMissing = await request('PUT', '/api/v1/products/9999', { body: newProduct });
  check('PUT sobre un id inexistente: 404', replacedMissing.status === 404, `status ${replacedMissing.status}`);

  const patched = await request('PATCH', `/api/v1/products/${createdId}`, {
    body: { unitsInStock: 77 },
  });
  check('PATCH responde 200', patched.status === 200, `status ${patched.status}`);
  check(
    'el PATCH cambio solo el campo enviado',
    patched.payload?.data?.unitsInStock === 77 && patched.payload?.data?.name === newProduct.name,
    JSON.stringify({
      unitsInStock: patched.payload?.data?.unitsInStock,
      name: patched.payload?.data?.name,
    }),
  );

  const emptyPatch = await request('PATCH', `/api/v1/products/${createdId}`, { body: {} });
  check('un PATCH vacio devuelve 400', emptyPatch.status === 400, `status ${emptyPatch.status}`);

  const patchToExistingCode = await request('PATCH', `/api/v1/products/${createdId}`, {
    body: { code: 'NWTB-1' },
  });
  check(
    'pisar el codigo de otro producto: 409',
    patchToExistingCode.status === 409,
    `status ${patchToExistingCode.status}`,
  );
}

section('Baja de un producto e idempotencia');
{
  const removed = await request('DELETE', `/api/v1/products/${createdId}`);
  check('DELETE responde 204', removed.status === 204, `status ${removed.status}`);
  check('el 204 no trae cuerpo', removed.payload === null, JSON.stringify(removed.payload));

  const removedAgain = await request('DELETE', `/api/v1/products/${createdId}`);
  check(
    'repetir el DELETE devuelve 404 y el estado sigue siendo el mismo',
    removedAgain.status === 404,
    `status ${removedAgain.status}`,
  );

  const afterDelete = await request('GET', '/api/v1/products?limit=100');
  check(
    'el catalogo volvio a tener 45 productos',
    afterDelete.payload?.meta?.total === 45,
    `total ${afterDelete.payload?.meta?.total}`,
  );
}

section('Categorias, proveedores y reportes');
{
  const categories = await request('GET', '/api/v1/categories');
  check('GET /categories responde 200', categories.status === 200, `status ${categories.status}`);
  check(
    'hay 16 categorias',
    categories.payload?.data?.length === 16,
    `${categories.payload?.data?.length} categorias`,
  );

  const suppliers = await request('GET', '/api/v1/suppliers');
  check(
    'hay 10 proveedores',
    suppliers.payload?.data?.length === 10,
    `${suppliers.payload?.data?.length} proveedores`,
  );

  const stock = await request('GET', '/api/v1/reports/stock-health');
  check('GET /reports/stock-health responde 200', stock.status === 200, `status ${stock.status}`);
  check(
    '11 productos en stock cero',
    stock.payload?.data?.summary?.outOfStock === 11,
    `${stock.payload?.data?.summary?.outOfStock}`,
  );
  check(
    'los 11 en cero no tienen nada pedido',
    stock.payload?.data?.summary?.outOfStockWithoutOrder === 11,
    `${stock.payload?.data?.summary?.outOfStockWithoutOrder}`,
  );
  check(
    '3 discontinuados conservan stock',
    stock.payload?.data?.summary?.discontinuedWithStock === 3,
    `${stock.payload?.data?.summary?.discontinuedWithStock}`,
  );

  const margin = await request('GET', '/api/v1/reports/margin-by-category');
  check('GET /reports/margin-by-category responde 200', margin.status === 200, `status ${margin.status}`);
  check(
    'el margen general reproduce el 26,2737 % calculado en el dataset',
    Math.abs((margin.payload?.data?.summary?.overallMarginPct ?? 0) - 26.2737) < 0.001,
    `${margin.payload?.data?.summary?.overallMarginPct}`,
  );
}

section('Rutas y metodos no contemplados');
{
  const nowhere = await request('GET', '/api/v1/no-existe');
  check('una ruta inexistente devuelve 404', nowhere.status === 404, `status ${nowhere.status}`);
  check(
    'el 404 viene en el formato de error de la API',
    nowhere.payload?.error?.code === 'NOT_FOUND',
    JSON.stringify(nowhere.payload),
  );

  const wrongMethod = await request('DELETE', '/api/v1/products');
  check(
    'un metodo no permitido sobre la coleccion devuelve 405',
    wrongMethod.status === 405,
    `status ${wrongMethod.status}`,
  );
  check(
    'el 405 informa los metodos aceptados en el header Allow',
    wrongMethod.headers.get('allow') === 'GET, POST',
    wrongMethod.headers.get('allow') ?? 'sin header',
  );

  const wrongMethodOnReport = await request('POST', '/api/v1/reports/stock-health', { body: {} });
  check(
    'un POST contra un reporte de solo lectura devuelve 405',
    wrongMethodOnReport.status === 405,
    `status ${wrongMethodOnReport.status}`,
  );
}

console.log(`\nResultado: ${passed} pruebas ok, ${failed} fallidas.`);
server.close();
process.exit(failed === 0 ? 0 : 1);
