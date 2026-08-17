# Documentación de la API

**Actividad individual, módulo 2. Arquitectura Web, Universidad de Palermo, 2do cuatrimestre 2026.**
Alumno: junam · Profesor: Ing. Diego Marafetti

---

## 1. Descripción general del backend

El backend expone una **API REST para administrar el catálogo de productos de una distribuidora mayorista de alimentos**.

El dominio que resuelve es la **gestión de catálogo y control de reposición de stock**. Quien se ocupa de las compras necesita responder tres preguntas antes de emitir una orden a los proveedores: qué productos hay en el catálogo, cuánto stock queda de cada uno, y cuáles ya cayeron por debajo de su punto de reposición. La API expone esa información y permite mantenerla actualizada.

Las operaciones que ofrece son:

- **CRUD completo de productos**: alta, consulta individual, listado, reemplazo total, modificación parcial y baja.
- **Consulta filtrada del catálogo** por categoría, proveedor, estado de discontinuación, nivel de stock y texto libre, con orden y paginado.
- **Consulta de categorías y proveedores**, derivados de los productos cargados.
- **Dos reportes de negocio**: salud del stock y margen de ganancia por categoría.

Los datos iniciales son **45 productos reales del dataset Northwind Traders**, distribuidos en 16 categorías y 10 proveedores. Se cargan automáticamente al iniciar el servidor.

La implementación es Node.js con Express, con persistencia en memoria detrás de un repositorio. El diseño corresponde al **nivel 2 del modelo de madurez de Richardson**: cada recurso tiene su URL, el verbo indica la operación y el status code indica el resultado.

---

## 2. Convenciones generales

**URL base**: `http://localhost:3000`
**Prefijo de la API**: `/api/v1`
**Formato**: JSON (`application/json`) en pedidos y respuestas.

### Estructura de las respuestas

Las respuestas exitosas devuelven el resultado dentro de `data`. Los listados agregan `meta` con la información de paginado.

```json
{
  "data": [ { "id": 1, "code": "NWTB-1", "name": "Northwind Traders Chai" } ],
  "meta": { "total": 45, "page": 1, "limit": 20, "pages": 3 }
}
```

Todos los errores comparten el mismo formato:

```json
{
  "error": {
    "status": 422,
    "code": "UNPROCESSABLE_ENTITY",
    "message": "El costo estandar no puede superar al precio de lista.",
    "details": [ { "field": "standardCost", "message": "no puede ser mayor que listPrice (10)" } ]
  }
}
```

El campo `details` aparece solo cuando hay información por campo.

### Respuestas comunes a todos los endpoints

| Status | Cuándo ocurre |
|---|---|
| `404 Not Found` | La ruta pedida no existe en la API |
| `405 Method Not Allowed` | La ruta existe pero no acepta ese verbo. La respuesta incluye el header `Allow` con los verbos aceptados |
| `413 Payload Too Large` | El cuerpo del pedido supera los 100 kB (solo en endpoints con body) |
| `500 Internal Server Error` | Error inesperado del servidor |

### Orden en que se validan los pedidos

Cuando un pedido tiene más de un problema, el status code que se devuelve es el del primer control que falla. El orden es:

1. **`400`** si el cuerpo no es JSON válido, o **`413`** si supera el tamaño máximo.
2. **`400`** si el `{id}` de la URL no es un número entero.
3. **`415`** si el `Content-Type` no es `application/json`.
4. **`404`** si el producto indicado no existe.
5. **`400`** si algún campo del cuerpo es inválido, falta, o es desconocido.
6. **`409`** si el `code` enviado ya lo usa otro producto.
7. **`422`** si el cuerpo viola una regla de negocio.

---

## 3. El recurso Producto

| Campo | Tipo | Obligatorio | Reglas |
|---|---|---|---|
| `id` | entero | lo asigna el servidor | Enviarlo en el body devuelve `400` |
| `code` | texto | sí | Único. Formato `PREFIJO-NÚMERO`, entre 2 y 8 letras mayúsculas (ej. `NWTB-1`) |
| `name` | texto | sí | Entre 3 y 120 caracteres |
| `category` | texto | sí | Entre 2 y 60 caracteres |
| `quantityPerUnit` | texto | no | Hasta 60 caracteres. Por defecto, cadena vacía |
| `discontinued` | booleano | no | Por defecto `false` |
| `listPrice` | número | sí | Mayor o igual a 0 |
| `standardCost` | número | sí | Mayor o igual a 0, y no mayor que `listPrice` |
| `unitsInStock` | entero | no | Mayor o igual a 0. Por defecto 0 |
| `unitsOnOrder` | entero | no | Mayor o igual a 0. Por defecto 0 |
| `minimumReorderQuantity` | entero | no | Mayor o igual a 0. Por defecto 0 |
| `estimatedMonthlyDemand` | entero o `null` | no | Mayor o igual a 0. Por defecto `null` |
| `reorderLevel` | entero | no | Mayor o igual a 0. Por defecto 0 |
| `targetLevel` | entero | no | Mayor o igual a 0. Por defecto 0 |
| `supplierId` | entero | sí | Mayor o igual a 1 |
| `supplierName` | texto | sí | Entre 2 y 80 caracteres |

Ejemplo de un producto completo:

```json
{
  "id": 1,
  "code": "NWTB-1",
  "name": "Northwind Traders Chai",
  "category": "Beverages",
  "quantityPerUnit": "10 boxes x 20 bags",
  "discontinued": false,
  "listPrice": 18,
  "standardCost": 13.5,
  "unitsInStock": 39,
  "unitsOnOrder": 0,
  "minimumReorderQuantity": 10,
  "estimatedMonthlyDemand": 20,
  "reorderLevel": 10,
  "targetLevel": 40,
  "supplierId": 4,
  "supplierName": "Supplier D"
}
```

---

## 4. Endpoints

### 4.1. `GET /`

**Propósito**: índice de la API. Devuelve el nombre, la versión y la lista de rutas disponibles, para que un cliente pueda descubrir el resto sin leer la documentación.

| Status | Cuándo ocurre |
|---|---|
| `200 OK` | Siempre |
| `405 Method Not Allowed` | Cualquier verbo que no sea `GET`. Header `Allow: GET` |

---

### 4.2. `GET /api/v1/health`

**Propósito**: verificar que el servicio está vivo. Informa hace cuántos segundos está corriendo y cuántos productos cargó el seed.

Respuesta:

```json
{ "status": "ok", "uptimeSeconds": 12, "seededProducts": 45 }
```

| Status | Cuándo ocurre |
|---|---|
| `200 OK` | El servicio responde |
| `405 Method Not Allowed` | Cualquier verbo que no sea `GET`. Header `Allow: GET` |

---

### 4.3. `GET /api/v1/products`

**Propósito**: listar los productos del catálogo. Acepta filtros, orden y paginado, todos opcionales y combinables entre sí.

**Parámetros de consulta** (query string):

| Parámetro | Valores | Por defecto | Qué hace |
|---|---|---|---|
| `category` | texto | — | Filtra por categoría exacta, sin distinguir mayúsculas |
| `supplierId` | entero ≥ 1 | — | Filtra por proveedor |
| `discontinued` | `true` / `false` | — | Filtra por productos discontinuados o vigentes |
| `belowReorder` | `true` / `false` | — | Filtra los que están por debajo (o no) de su punto de reposición |
| `q` | texto, mínimo 2 caracteres | — | Busca el texto en el nombre o en el código |
| `sort` | `id`, `code`, `name`, `category`, `listPrice`, `unitsInStock` | `id` | Campo por el que se ordena |
| `order` | `asc` / `desc` | `asc` | Sentido del orden |
| `page` | entero ≥ 1 | `1` | Página a devolver |
| `limit` | entero entre 1 y 100 | `20` | Cantidad de productos por página |

Ejemplo: `GET /api/v1/products?belowReorder=true&sort=unitsInStock&limit=50`

| Status | Cuándo ocurre |
|---|---|
| `200 OK` | El listado se resolvió, aun si ningún producto coincide (en ese caso `data` es un arreglo vacío y `meta.total` es 0) |
| `400 Bad Request` | Un parámetro tiene un valor inválido: `sort` con un campo que no existe, `order` distinto de `asc`/`desc`, `page` o `limit` no enteros o fuera de rango, `discontinued` o `belowReorder` distintos de `true`/`false`, o `q` con menos de 2 caracteres |
| `405 Method Not Allowed` | Verbos distintos de `GET` y `POST`. Header `Allow: GET, POST` |

---

### 4.4. `POST /api/v1/products`

**Propósito**: crear un producto nuevo en el catálogo. El servidor asigna el `id` y devuelve el recurso creado junto con su ubicación en el header `Location`.

**Cuerpo esperado** (los campos opcionales se pueden omitir y toman su valor por defecto):

```json
{
  "code": "NWTB-900",
  "name": "Northwind Traders Yerba Mate",
  "category": "Beverages",
  "quantityPerUnit": "12 paquetes x 500 g",
  "listPrice": 24,
  "standardCost": 15,
  "unitsInStock": 40,
  "reorderLevel": 10,
  "targetLevel": 60,
  "supplierId": 4,
  "supplierName": "Supplier D"
}
```

| Status | Cuándo ocurre |
|---|---|
| `201 Created` | El producto se creó. Devuelve el recurso completo y el header `Location` con su URL |
| `400 Bad Request` | El JSON está mal formado, falta un campo obligatorio, un tipo no corresponde, hay un campo desconocido, o se envió `id` en el cuerpo |
| `405 Method Not Allowed` | Verbos distintos de `GET` y `POST`. Header `Allow: GET, POST` |
| `409 Conflict` | Ya existe otro producto con ese `code` |
| `413 Payload Too Large` | El cuerpo supera los 100 kB |
| `415 Unsupported Media Type` | El `Content-Type` no es `application/json` |
| `422 Unprocessable Entity` | El cuerpo es válido en su forma pero viola una regla de negocio: `standardCost` mayor que `listPrice` |

**No es idempotente**: dos pedidos idénticos crean dos productos, salvo que el `code` repetido lo impida con un `409`.

---

### 4.5. `GET /api/v1/products/{id}`

**Propósito**: obtener un producto puntual por su identificador.

| Status | Cuándo ocurre |
|---|---|
| `200 OK` | El producto existe. Devuelve el recurso completo |
| `400 Bad Request` | El `{id}` de la URL no es un número entero (ej. `/products/abc`) |
| `404 Not Found` | No existe ningún producto con ese id |
| `405 Method Not Allowed` | Verbos distintos de `GET`, `PUT`, `PATCH` y `DELETE`. Header `Allow: GET, PUT, PATCH, DELETE` |

---

### 4.6. `PUT /api/v1/products/{id}`

**Propósito**: reemplazar un producto completo. Hay que enviar el recurso entero: los campos opcionales que se omitan **vuelven a su valor por defecto**, no conservan el valor anterior. Para cambiar solo algunos campos, usar `PATCH`.

**Cuerpo esperado**: el mismo del `POST`, sin el `id` (viaja en la URL).

| Status | Cuándo ocurre |
|---|---|
| `200 OK` | El producto se reemplazó. Devuelve el recurso actualizado |
| `400 Bad Request` | El `{id}` no es un entero, el JSON está mal formado, falta un campo obligatorio, un tipo no corresponde, hay un campo desconocido, o se envió `id` en el cuerpo |
| `404 Not Found` | No existe ningún producto con ese id. **No crea el recurso**: los identificadores los asigna el servidor |
| `405 Method Not Allowed` | Verbos distintos de `GET`, `PUT`, `PATCH` y `DELETE`. Header `Allow: GET, PUT, PATCH, DELETE` |
| `409 Conflict` | El `code` enviado ya lo usa otro producto |
| `413 Payload Too Large` | El cuerpo supera los 100 kB |
| `415 Unsupported Media Type` | El `Content-Type` no es `application/json` |
| `422 Unprocessable Entity` | `standardCost` mayor que `listPrice` |

**Es idempotente**: repetir el mismo pedido deja el recurso en el mismo estado.

---

### 4.7. `PATCH /api/v1/products/{id}`

**Propósito**: modificar parcialmente un producto. Solo viajan los campos que cambian; el resto queda como estaba.

**Cuerpo esperado**: un objeto con al menos un campo del recurso.

```json
{ "unitsInStock": 77, "unitsOnOrder": 20 }
```

| Status | Cuándo ocurre |
|---|---|
| `200 OK` | El producto se modificó. Devuelve el recurso actualizado completo |
| `400 Bad Request` | El `{id}` no es un entero, el JSON está mal formado, el cuerpo está vacío, un tipo no corresponde, hay un campo desconocido, o se envió `id` en el cuerpo |
| `404 Not Found` | No existe ningún producto con ese id |
| `405 Method Not Allowed` | Verbos distintos de `GET`, `PUT`, `PATCH` y `DELETE`. Header `Allow: GET, PUT, PATCH, DELETE` |
| `409 Conflict` | El `code` enviado ya lo usa otro producto |
| `413 Payload Too Large` | El cuerpo supera los 100 kB |
| `415 Unsupported Media Type` | El `Content-Type` no es `application/json` |
| `422 Unprocessable Entity` | El resultado de aplicar el cambio deja `standardCost` mayor que `listPrice` |

---

### 4.8. `DELETE /api/v1/products/{id}`

**Propósito**: eliminar un producto del catálogo.

| Status | Cuándo ocurre |
|---|---|
| `204 No Content` | El producto se eliminó. La respuesta no tiene cuerpo |
| `400 Bad Request` | El `{id}` de la URL no es un número entero |
| `404 Not Found` | No existe ningún producto con ese id, incluido el caso de repetir un `DELETE` ya efectuado |
| `405 Method Not Allowed` | Verbos distintos de `GET`, `PUT`, `PATCH` y `DELETE`. Header `Allow: GET, PUT, PATCH, DELETE` |

**Es idempotente, aunque el segundo pedido devuelva `404`.** La idempotencia se define sobre el estado del sistema, no sobre el status code: después del primer `DELETE` el producto ya no está, y repetirlo no cambia nada.

---

### 4.9. `GET /api/v1/categories`

**Propósito**: listar las categorías presentes en el catálogo con la cantidad de productos de cada una. Se derivan de los productos cargados, por eso el recurso es de solo lectura.

```json
{ "data": [ { "name": "Beverages", "productCount": 6 } ] }
```

| Status | Cuándo ocurre |
|---|---|
| `200 OK` | Siempre |
| `405 Method Not Allowed` | Cualquier verbo que no sea `GET`. Header `Allow: GET` |

---

### 4.10. `GET /api/v1/suppliers`

**Propósito**: listar los proveedores presentes en el catálogo con la cantidad de productos que provee cada uno. También se derivan de los productos.

```json
{ "data": [ { "id": 1, "name": "Supplier A", "productCount": 4 } ] }
```

| Status | Cuándo ocurre |
|---|---|
| `200 OK` | Siempre |
| `405 Method Not Allowed` | Cualquier verbo que no sea `GET`. Header `Allow: GET` |

---

### 4.11. `GET /api/v1/reports/stock-health`

**Propósito**: reporte de salud del stock. Identifica los productos que necesitan reposición, separando tres situaciones distintas: los que cayeron por debajo del punto de reposición, los que están en cero y no tienen nada pedido (los críticos), y los discontinuados que todavía conservan unidades.

```json
{
  "data": {
    "summary": {
      "totalProducts": 45,
      "belowReorderLevel": 29,
      "outOfStock": 11,
      "outOfStockWithoutOrder": 11,
      "discontinuedWithStock": 3
    },
    "critical": [],
    "belowReorderLevel": [],
    "discontinuedWithStock": []
  }
}
```

| Status | Cuándo ocurre |
|---|---|
| `200 OK` | Siempre |
| `405 Method Not Allowed` | Cualquier verbo que no sea `GET`. Header `Allow: GET` |

---

### 4.12. `GET /api/v1/reports/margin-by-category`

**Propósito**: reporte de margen de ganancia por categoría, ordenado de mayor a menor margen. El margen se calcula sobre los totales de la categoría, no como promedio de los márgenes individuales, para que un producto caro pese más que uno barato.

```json
{
  "data": {
    "summary": { "totalProducts": 45, "categories": 16, "overallMarginPct": 26.2737 },
    "categories": [
      { "category": "Canned Fish", "productCount": 1, "totalListPrice": 46, "totalStandardCost": 11.5, "marginPct": 75 }
    ]
  }
}
```

| Status | Cuándo ocurre |
|---|---|
| `200 OK` | Siempre |
| `405 Method Not Allowed` | Cualquier verbo que no sea `GET`. Header `Allow: GET` |

---

## 5. Tabla resumen

| Verbo | Ruta | Propósito | Status codes posibles |
|---|---|---|---|
| `GET` | `/` | Índice de la API | 200, 405 |
| `GET` | `/api/v1/health` | Estado del servicio | 200, 405 |
| `GET` | `/api/v1/products` | Listar productos | 200, 400, 405 |
| `POST` | `/api/v1/products` | Crear un producto | 201, 400, 405, 409, 413, 415, 422 |
| `GET` | `/api/v1/products/{id}` | Obtener un producto | 200, 400, 404, 405 |
| `PUT` | `/api/v1/products/{id}` | Reemplazar un producto | 200, 400, 404, 405, 409, 413, 415, 422 |
| `PATCH` | `/api/v1/products/{id}` | Modificar parcialmente | 200, 400, 404, 405, 409, 413, 415, 422 |
| `DELETE` | `/api/v1/products/{id}` | Eliminar un producto | 204, 400, 404, 405 |
| `GET` | `/api/v1/categories` | Listar categorías | 200, 405 |
| `GET` | `/api/v1/suppliers` | Listar proveedores | 200, 405 |
| `GET` | `/api/v1/reports/stock-health` | Reporte de salud del stock | 200, 405 |
| `GET` | `/api/v1/reports/margin-by-category` | Reporte de margen por categoría | 200, 405 |

Cualquier ruta no listada devuelve `404 Not Found`, y cualquier error inesperado devuelve `500 Internal Server Error`.
