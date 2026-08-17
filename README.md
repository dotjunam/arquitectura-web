# TP Arquitectura Web: API de catálogo de productos

Repositorio único del **Trabajo Práctico Integrador** de Arquitectura Web (Universidad de Palermo, 2do cuatrimestre 2026). Acá vive todo el código de la cursada: el backend, las actividades individuales de cada módulo y, más adelante, el frontend.

- **Alumno**: junam
- **Materia**: Arquitectura Web. Prof. Ing. Diego Marafetti
- **Runtime**: Node.js LTS

---

## 1. Descripción del backend

El backend expone una **API REST para administrar el catálogo de productos de una distribuidora mayorista de alimentos**.

El problema que resuelve es concreto: quien compra necesita saber **qué productos hay, cuánto stock queda de cada uno y cuáles están por debajo del punto de reposición**, antes de emitir la próxima orden a los proveedores. Hoy esa información vive en una planilla y no se puede consultar desde ningún otro sistema.

La API permite:

- dar de alta, consultar, modificar y dar de baja productos (**CRUD completo**);
- filtrar y ordenar el catálogo por categoría, proveedor, estado de discontinuación y nivel de stock;
- consultar las categorías y los proveedores presentes en el catálogo;
- obtener dos **reportes** de negocio: salud del stock y margen de ganancia por categoría.

### Origen de los datos

El seed carga **45 productos reales** tomados del dataset *Northwind Traders*, la base de ejemplo clásica de una importadora y distribuidora de delicatessen. Son 16 categorías y 10 proveedores.

Al preparar el seed se detectó y corrigió un **defecto de los datos de origen**: dos productos repetían el `product_code` de otro (el id 20 usaba `NWTJP-6` y el id 97 usaba `NWTC-82`). El código sigue el patrón `PREFIJO-<id>` en las 43 filas restantes, y esas dos son las únicas excepciones, así que se trata de un error de carga y no de un código legítimo repetido. Como el modelo declara `code` **único** (devuelve `409 Conflict` ante un duplicado), se normalizaron a `NWTJP-20` y `NWTC-97`. La decisión está acá documentada porque cambia los datos respecto de la fuente.

---

## 2. Requisitos

- **Node.js 20 o superior** (versión LTS). Verificar con `node --version`.
- **npm** (viene con Node).

## 3. Instalación

```bash
git clone https://github.com/<usuario>/tp-arquitectura-web.git
cd tp-arquitectura-web
npm install
```

## 4. Ejecución

```bash
npm start
```

El servidor queda escuchando en `http://localhost:3000` y **carga los 45 productos del seed automáticamente**: no hay que importar nada a mano. El puerto se puede cambiar con la variable de entorno `PORT`.

Para desarrollo, con recarga automática ante cada cambio de archivo:

```bash
npm run dev
```

### Scripts disponibles

| Script | Qué hace |
|---|---|
| `npm start` | Levanta la API en el puerto 3000 |
| `npm run dev` | Igual que `start`, pero reinicia solo al guardar un archivo |
| `npm run modulo1` | Levanta el servidor de la actividad del módulo 1 (módulo nativo `http`) |
| `npm run test:api` | Corre la batería de pruebas de los endpoints |

---

## 5. Estructura del proyecto

```
tp-arquitectura-web/
├── modulo-1/
│   └── server.js              actividad del módulo 1: servidor con el módulo nativo http
├── src/
│   ├── server.js              punto de entrada: pone la app a escuchar
│   ├── app.js                 armado de la app Express y orden de middlewares
│   ├── config/                configuración leída del entorno
│   ├── routes/                qué URL responde a qué verbo
│   ├── controllers/           traducen HTTP a llamadas al servicio
│   ├── services/              reglas de negocio
│   ├── repositories/          acceso a los datos (hoy, en memoria)
│   ├── validators/            validación del cuerpo de los pedidos
│   ├── middlewares/           Content-Type, 404, 405 y manejo de errores
│   ├── errors/                error de aplicación con status HTTP asociado
│   └── data/                  seed de 45 productos
├── scripts/
│   └── test-api.js            pruebas de los endpoints
└── docs/
    ├── api.md                 documentación de la API (versión para exportar a PDF)
    └── informe-modulo-1.md    informe de la actividad del módulo 1
```

## 6. Decisiones de arquitectura

**Separación en capas.** Un pedido atraviesa `ruta → controlador → servicio → repositorio`, y cada capa tiene una sola responsabilidad. El controlador no sabe de reglas de negocio y el servicio no sabe que existe HTTP: recibe datos y devuelve datos o lanza un error de aplicación. La ventaja concreta es que **el status code lo decide la regla de negocio, no el controlador**, y que se puede cambiar el almacenamiento sin tocar nada más.

**Persistencia en memoria detrás de un repositorio.** El TP admite base de datos o memoria. Se eligió memoria por simplicidad, pero el acceso está encapsulado en `product.repository.js`, así que reemplazarlo por una base real es cambiar un archivo. El costo asumido: **los cambios se pierden al reiniciar** y el estado vuelve al seed.

**Nivel 2 del modelo de madurez de Richardson.** Cada recurso tiene su propia URL (`/products` para la colección, `/products/{id}` para el elemento), el verbo dice qué operación es, y el status code dice qué pasó. No se implementó el nivel 3 (HATEOAS): no hay enlaces en las respuestas más allá del índice de la API en `GET /`.

**Manejo de errores centralizado.** Un único middleware arma todas las respuestas de error, así que el formato es siempre el mismo y ningún error inesperado se escapa filtrando un stack trace al cliente.

**Validación estricta del cuerpo.** Los campos desconocidos se rechazan en vez de ignorarse, para que un error de tipeo en el nombre de un campo no se confunda con un éxito. El `id` mandado en el body también se rechaza: lo asigna el servidor.

**400 y 422 son cosas distintas.** `400` es un problema de forma (falta un campo, el tipo no corresponde, el JSON está roto). `422` es un cuerpo bien formado que viola una regla de negocio, como un costo mayor al precio de lista.

**405 en lugar de 404 cuando el recurso existe.** Un `DELETE /products` responde `405 Method Not Allowed` con el header `Allow: GET, POST`, y no `404`. El 404 diría que ahí no hay nada, y sí hay: lo que no se puede es hacerle eso.

### Limitaciones conocidas

- No hay autenticación (el TP la declara opcional).
- No hay frontend todavía: es la etapa siguiente del TP.
- El estado se pierde al reiniciar, por la persistencia en memoria.

---

## 7. Documentación de la API

Versión lista para exportar a PDF: [`docs/api.md`](docs/api.md).

**URL base**: `http://localhost:3000`  ·  **Prefijo**: `/api/v1`  ·  **Formato**: JSON (`application/json`)

### Formato de las respuestas

Las respuestas exitosas envuelven el resultado en `data`, y las de listado agregan `meta` con el paginado:

```json
{
  "data": [ { "id": 1, "code": "NWTB-1", "name": "Northwind Traders Chai" } ],
  "meta": { "total": 45, "page": 1, "limit": 20, "pages": 3 }
}
```

Los errores usan siempre la misma forma:

```json
{
  "error": {
    "status": 400,
    "code": "BAD_REQUEST",
    "message": "El cuerpo del pedido tiene campos invalidos.",
    "details": [ { "field": "listPrice", "message": "es obligatorio" } ]
  }
}
```

### El recurso Producto

| Campo | Tipo | Obligatorio | Reglas |
|---|---|---|---|
| `id` | entero | lo asigna el servidor | no se puede mandar en el body |
| `code` | texto | sí | único, formato `PREFIJO-NÚMERO` (ej. `NWTB-1`) |
| `name` | texto | sí | entre 3 y 120 caracteres |
| `category` | texto | sí | entre 2 y 60 caracteres |
| `quantityPerUnit` | texto | no | hasta 60 caracteres. Por defecto, vacío |
| `discontinued` | booleano | no | por defecto `false` |
| `listPrice` | número | sí | ≥ 0 |
| `standardCost` | número | sí | ≥ 0 y no mayor que `listPrice` |
| `unitsInStock` | entero | no | ≥ 0. Por defecto 0 |
| `unitsOnOrder` | entero | no | ≥ 0. Por defecto 0 |
| `minimumReorderQuantity` | entero | no | ≥ 0. Por defecto 0 |
| `estimatedMonthlyDemand` | entero o `null` | no | ≥ 0. Por defecto `null` |
| `reorderLevel` | entero | no | ≥ 0. Por defecto 0 |
| `targetLevel` | entero | no | ≥ 0. Por defecto 0 |
| `supplierId` | entero | sí | ≥ 1 |
| `supplierName` | texto | sí | entre 2 y 80 caracteres |

### Índice de endpoints

| # | Verbo | Ruta | Propósito |
|---|---|---|---|
| 1 | `GET` | `/` | Índice de la API |
| 2 | `GET` | `/api/v1/health` | Estado del servicio |
| 3 | `GET` | `/api/v1/products` | Listar productos con filtros, orden y paginado |
| 4 | `POST` | `/api/v1/products` | Crear un producto |
| 5 | `GET` | `/api/v1/products/{id}` | Obtener un producto |
| 6 | `PUT` | `/api/v1/products/{id}` | Reemplazar un producto completo |
| 7 | `PATCH` | `/api/v1/products/{id}` | Modificar parcialmente un producto |
| 8 | `DELETE` | `/api/v1/products/{id}` | Eliminar un producto |
| 9 | `GET` | `/api/v1/categories` | Listar categorías con su cantidad de productos |
| 10 | `GET` | `/api/v1/suppliers` | Listar proveedores con su cantidad de productos |
| 11 | `GET` | `/api/v1/reports/stock-health` | Reporte de salud del stock |
| 12 | `GET` | `/api/v1/reports/margin-by-category` | Reporte de margen por categoría |

El detalle completo de cada uno, con parámetros, ejemplos de body y todos los status codes posibles, está en [`docs/api.md`](docs/api.md).

---

## 8. Pruebas

```bash
npm run test:api
```

Levanta la aplicación en un puerto libre y verifica el status code y el cuerpo de cada endpoint, incluidos los casos de error (400, 404, 405, 409, 415 y 422). No usa dependencias externas: alcanza con el runtime de Node.

También se puede probar a mano con `curl` mientras el servidor corre:

```bash
curl http://localhost:3000/api/v1/products?limit=3
```

---

## 9. Actividades individuales de la cursada

| Módulo | Actividad | Dónde está |
|---|---|---|
| 1 | Servidor HTTP con el módulo nativo `http` | [`modulo-1/server.js`](modulo-1/server.js) y el informe en [`docs/informe-modulo-1.md`](docs/informe-modulo-1.md) |
| 2 | Documentación de la API | Sección 7 de este README y [`docs/api.md`](docs/api.md) |
