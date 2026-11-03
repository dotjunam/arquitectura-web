# TP Arquitectura Web: catálogo de películas y series

Repositorio único del **Trabajo Práctico Integrador** de Arquitectura Web (Universidad de Palermo, 2do cuatrimestre 2026). Acá vive todo el código de la cursada: el backend, el frontend y las actividades individuales de cada módulo.

- **Alumno**: Juan Manuel Gonzalez Kapnik
- **Materia**: Arquitectura Web. Prof. Ing. Diego Marafetti
- **Runtime**: Node.js LTS

---

## 1. Descripción del backend

El backend expone una **API REST para administrar un catálogo personal de películas y series**.

El problema que resuelve es el de cualquiera que acumula títulos por ver en cinco plataformas distintas y termina sin saber qué tiene pendiente: la lista vive repartida entre capturas de pantalla, notas sueltas y la memoria. La API centraliza ese catálogo y permite responder **qué hay, qué falta ver, cuánto tiempo lleva lo pendiente y qué géneros son los que uno realmente puntúa mejor**.

La API permite:

- dar de alta, consultar, modificar y dar de baja títulos (**CRUD completo**);
- filtrar el catálogo por tipo, género, director, idioma, estado de visionado, puntaje mínimo y rango de años, con búsqueda por texto, orden y paginado;
- consultar los géneros y los directores presentes en el catálogo;
- obtener dos **reportes**: estadísticas de visionado y puntaje promedio por género.

### El frontend

Una interfaz web servida por el mismo servidor, con dos pantallas:

- **Catálogo**: listado con búsqueda, filtros por tipo, estado y género, orden y paginado. Desde ahí se dan de alta, se editan, se marcan como vistos o pendientes y se eliminan títulos. Los errores de la API (400, 409, 422) se muestran al lado de cada campo del formulario.
- **Reportes**: las estadísticas de visionado (totales, horas, porcentaje completado, desglose por tipo y la lista de pendientes) y el puntaje promedio por género, con barras.

### Modelo del dominio

El recurso central es el **título**, que puede ser una **película** o una **serie**. La distinción no es cosmética: una serie declara temporadas y episodios y una película no, y el reporte de horas los calcula distinto (una serie dura la duración promedio del episodio por la cantidad de episodios). Esa diferencia es la que sostiene las reglas de negocio de la API.

### Datos iniciales

El seed carga **45 títulos: 35 películas y 10 series**, con 16 géneros y 31 directores. De esos, 35 figuran como vistos y puntuados, y 10 quedan pendientes, así que los reportes tienen algo que decir apenas se levanta el servidor.

Los datos son de dominio público (título, director, año, género, duración) y se cargaron a mano. Los valores de visionado (`watched`, `rating`, `watchedOn`) son ficticios: sirven para que los reportes tengan sentido. Puede haber imprecisiones menores en duraciones y cantidades de episodios; no afectan al funcionamiento de la API.

---

## 2. Requisitos

- **Node.js 20 o superior** (versión LTS). Verificar con `node --version`.
- **npm** (viene con Node).

## 3. Instalación

```bash
git clone https://github.com/dotjunam/arquitectura-web.git
cd arquitectura-web
npm install
```

## 4. Ejecución

```bash
npm start
```

El servidor queda escuchando en `http://localhost:3000` y **carga los 45 títulos del seed automáticamente**: no hay que importar nada a mano. El puerto se puede cambiar con la variable de entorno `PORT`.

- **Interfaz web**: abrir `http://localhost:3000` en el navegador.
- **API**: `http://localhost:3000/api/v1`. Un `curl http://localhost:3000/` devuelve el índice de endpoints en JSON.

No hay paso de compilación: el frontend son archivos estáticos que sirve el mismo Express.

Para desarrollo, con recarga automática ante cada cambio de archivo:

```bash
npm run dev
```

### Scripts disponibles

| Script | Qué hace |
|---|---|
| `npm start` | Levanta la aplicación (API e interfaz web) en el puerto 3000 |
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
│   └── data/                  seed de 45 títulos
├── public/                    frontend (archivos estáticos, sin compilación)
│   ├── index.html             la página: catálogo, formulario y reportes
│   ├── css/styles.css         estilos, con modo claro y oscuro
│   └── js/
│       ├── api.js             cliente de la API: único archivo que conoce URLs y verbos
│       ├── app.js             pantalla del catálogo y navegación entre pantallas
│       └── reports.js         pantalla de reportes
├── scripts/
│   └── test-api.js            pruebas de los endpoints
└── docs/
    ├── api.md                 documentación de la API (versión para exportar a PDF)
    └── informe-modulo-1.md    informe de la actividad del módulo 1
```

## 6. Decisiones de arquitectura

**Separación en capas.** Un pedido atraviesa `ruta → controlador → servicio → repositorio`, y cada capa tiene una sola responsabilidad. El controlador no sabe de reglas de negocio y el servicio no sabe que existe HTTP: recibe datos y devuelve datos o lanza un error de aplicación. La ventaja concreta es que **el status code lo decide la regla de negocio, no el controlador**, y que se puede cambiar el almacenamiento sin tocar nada más.

**Persistencia en memoria detrás de un repositorio.** El TP admite base de datos o memoria. Se eligió memoria por simplicidad, pero el acceso está encapsulado en `title.repository.js`, así que reemplazarlo por una base real es cambiar un archivo. El costo asumido: **los cambios se pierden al reiniciar** y el estado vuelve al seed.

**Nivel 2 del modelo de madurez de Richardson.** Cada recurso tiene su propia URL (`/titles` para la colección, `/titles/{id}` para el elemento), el verbo dice qué operación es, y el status code dice qué pasó. No se implementó el nivel 3 (HATEOAS): no hay enlaces en las respuestas más allá del índice de la API en `GET /`.

**Manejo de errores centralizado.** Un único middleware arma todas las respuestas de error, así que el formato es siempre el mismo y ningún error inesperado se escapa filtrando un stack trace al cliente.

**Validación estricta del cuerpo.** Los campos desconocidos se rechazan en vez de ignorarse, para que un error de tipeo en el nombre de un campo no se confunda con un éxito. El `id` mandado en el body también se rechaza: lo asigna el servidor.

**400 y 422 son cosas distintas, y acá la diferencia se ve.** `400` es un problema de forma: falta un campo, el tipo no corresponde, el JSON está roto, `2026-02-31` no existe en el calendario. `422` es un cuerpo perfectamente legible que dice algo que el dominio no admite: una película con temporadas, una serie sin episodios, un título puntuado que todavía no se vio.

**405 en lugar de 404 cuando el recurso existe.** Un `DELETE /titles` responde `405 Method Not Allowed` con el header `Allow: GET, POST`, y no `404`. El 404 diría que ahí no hay nada, y sí hay: lo que no se puede es hacerle eso.

**El control de `Content-Type` va por ruta, no global.** Puesto como middleware global, un `POST` contra un reporte de solo lectura respondía `415` cuando lo correcto es `405`. Se aplica solo en las rutas que reciben cuerpo.

### Decisiones del frontend

**Vanilla JS servido por el mismo Express.** Para un ABM y dos reportes no hace falta un framework ni un paso de compilación. Al salir del mismo servidor, la interfaz y la API comparten origen, así que no hay que configurar CORS, y un solo `npm start` levanta todo.

**`GET /` con negociación de contenido.** La misma URL entrega la interfaz a un navegador (que pide `text/html`) y el índice JSON a un cliente de la API. Se resuelve con el header `Accept`, y la respuesta declara `Vary: Accept`. Así no cambió ningún contrato de la API.

**Las capas también del lado del cliente.** `public/js/api.js` es el único archivo que conoce URLs, verbos y status codes. Las pantallas llaman a funciones con nombre de dominio (`createTitle`, `watchStats`) y reciben datos o un error con los `details` de la API.

**La validación que vale es la del servidor.** El formulario tiene `novalidate`: no bloquea el envío en el navegador, y los errores que devuelve la API se muestran campo por campo. Ahí se ve en pantalla la diferencia entre un 400 y un 422.

**PUT para editar, PATCH para cambios puntuales.** El formulario de edición manda el recurso entero (reemplazo). El botón "Marcar visto" de la tabla manda solo los campos que cambian.

**Los datos se insertan como texto, nunca como HTML.** Todo lo que viene de la API se escribe con `textContent`: un título que contenga HTML se muestra tal cual y no se ejecuta.

**Navegación por fragmento de URL.** Cada pantalla es una sección del mismo HTML y se elige con `#/catalogo` o `#/reportes`, sin recargar la página. Los botones Atrás y Adelante del navegador funcionan.

### Limitaciones conocidas

- No hay autenticación (el TP la declara opcional).
- El estado se pierde al reiniciar, por la persistencia en memoria.
- Los géneros son texto libre validado por forma, no un catálogo cerrado: nada impide cargar `Sci-Fi` y `Ciencia ficción` como géneros distintos.

---

## 7. Documentación de la API

El documento vive en tres formatos, todos con el mismo contenido:

| Archivo | Para qué |
|---|---|
| [`docs/api.md`](docs/api.md) | fuente, la versión que se edita |
| [`docs/api.html`](docs/api.html) | versión con estilos de impresión (A4, tablas que no se cortan entre páginas) |
| [`docs/api.pdf`](docs/api.pdf) | **el entregable** de la actividad del módulo 2, actualizado con el frontend. 12 páginas |

El PDF se regenera imprimiendo el HTML con Chrome sin interfaz (en Windows, desde `cmd` y en la raíz del repo):

```bat
"C:\Program Files\Google\Chrome\Application\chrome.exe" --headless=new --no-pdf-header-footer --print-to-pdf="%CD%\docs\api.pdf" "%CD%\docs\api.html"
```

**URL base**: `http://localhost:3000`  ·  **Prefijo**: `/api/v1`  ·  **Formato**: JSON (`application/json`)

### Formato de las respuestas

Las respuestas exitosas envuelven el resultado en `data`, y las de listado agregan `meta` con el paginado:

```json
{
  "data": [ { "id": 5, "title": "Inception", "type": "movie", "year": 2010 } ],
  "meta": { "total": 45, "page": 1, "limit": 20, "pages": 3 }
}
```

Los errores usan siempre la misma forma:

```json
{
  "error": {
    "status": 422,
    "code": "UNPROCESSABLE_ENTITY",
    "message": "El título no cumple las reglas del catálogo.",
    "details": [ { "field": "seasons", "message": "una película no tiene temporadas" } ]
  }
}
```

### El recurso Título

| Campo | Tipo | Obligatorio | Reglas |
|---|---|---|---|
| `id` | entero | lo asigna el servidor | no se puede mandar en el body |
| `title` | texto | sí | entre 1 y 200 caracteres. Junto con `year` no se puede repetir |
| `type` | texto | sí | `movie` o `series` |
| `director` | texto | sí | entre 2 y 120 caracteres |
| `year` | entero | sí | entre 1888 y el año actual más 5 |
| `genres` | lista de texto | sí | entre 1 y 5 géneros, sin repetir, hasta 40 caracteres cada uno |
| `runtimeMinutes` | entero | sí | entre 1 y 1000. En una serie es la duración promedio del episodio |
| `seasons` | entero o `null` | no | entre 1 y 100. Obligatorio en series, prohibido en películas |
| `episodes` | entero o `null` | no | entre 1 y 10000. Obligatorio en series, prohibido en películas |
| `language` | texto | no | código ISO de dos letras minúsculas (ej. `es`). Por defecto `en` |
| `watched` | booleano | no | por defecto `false` |
| `rating` | entero o `null` | no | entre 1 y 10. Exige `watched: true`. Por defecto `null` |
| `watchedOn` | texto o `null` | no | fecha `AAAA-MM-DD`, no futura. Exige `watched: true`. Por defecto `null` |

### Índice de endpoints

| # | Verbo | Ruta | Propósito |
|---|---|---|---|
| 1 | `GET` | `/` | Índice de la API (JSON) o interfaz web (HTML), según `Accept` |
| 2 | `GET` | `/api/v1/health` | Estado del servicio |
| 3 | `GET` | `/api/v1/titles` | Listar títulos con filtros, orden y paginado |
| 4 | `POST` | `/api/v1/titles` | Crear un título |
| 5 | `GET` | `/api/v1/titles/{id}` | Obtener un título |
| 6 | `PUT` | `/api/v1/titles/{id}` | Reemplazar un título completo |
| 7 | `PATCH` | `/api/v1/titles/{id}` | Modificar parcialmente un título |
| 8 | `DELETE` | `/api/v1/titles/{id}` | Eliminar un título |
| 9 | `GET` | `/api/v1/genres` | Listar géneros con su cantidad de títulos |
| 10 | `GET` | `/api/v1/directors` | Listar directores con su cantidad de títulos |
| 11 | `GET` | `/api/v1/reports/watch-stats` | Reporte de estadísticas de visionado |
| 12 | `GET` | `/api/v1/reports/rating-by-genre` | Reporte de puntaje promedio por género |

El detalle completo de cada uno, con parámetros, ejemplos de body y todos los status codes posibles, está en [`docs/api.md`](docs/api.md).

---

## 8. Pruebas

```bash
npm run test:api
```

Levanta la aplicación en un puerto libre y verifica el status code y el cuerpo de cada endpoint, incluidos los casos de error (400, 404, 405, 406, 409, 415 y 422). Son 78 pruebas. No usa dependencias externas: alcanza con el runtime de Node.

También se puede probar a mano con `curl` mientras el servidor corre:

```bash
curl "http://localhost:3000/api/v1/titles?watched=false&limit=5"
```

---

## 9. Actividades individuales de la cursada

| Módulo | Actividad | Dónde está |
|---|---|---|
| 1 | Servidor HTTP con el módulo nativo `http` | [`modulo-1/server.js`](modulo-1/server.js) y el informe en [`docs/informe-modulo-1.pdf`](docs/informe-modulo-1.pdf) |
| 2 | Documentación de la API | Sección 7 de este README y [`docs/api.pdf`](docs/api.pdf) |
