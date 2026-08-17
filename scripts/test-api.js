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
    console.log(`  ok    ${description}`);
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

const newMovie = {
  title: 'Perfect Days',
  type: 'movie',
  director: 'Wim Wenders',
  year: 2023,
  genres: ['Drama'],
  runtimeMinutes: 124,
  language: 'ja',
};

section('Indice y estado del servicio');
{
  const root = await request('GET', '/');
  check('GET / responde 200', root.status === 200, `status ${root.status}`);

  const health = await request('GET', '/api/v1/health');
  check('GET /api/v1/health responde 200', health.status === 200, `status ${health.status}`);
  check(
    'el seed cargo los 45 titulos',
    health.payload?.seededTitles === 45,
    `seededTitles ${health.payload?.seededTitles}`,
  );
}

section('Listado de titulos: filtros, orden y paginado');
{
  const all = await request('GET', '/api/v1/titles');
  check('GET /titles responde 200', all.status === 200, `status ${all.status}`);
  check('el total es 45', all.payload?.meta?.total === 45, `total ${all.payload?.meta?.total}`);
  check(
    'pagina de 20 por defecto',
    all.payload?.data?.length === 20,
    `devolvio ${all.payload?.data?.length}`,
  );

  const paged = await request('GET', '/api/v1/titles?page=3&limit=20');
  check(
    'la tercera pagina trae los 5 que sobran',
    paged.payload?.data?.length === 5,
    `devolvio ${paged.payload?.data?.length}`,
  );

  const series = await request('GET', '/api/v1/titles?type=series&limit=100');
  check('hay 10 series', series.payload?.meta?.total === 10, `total ${series.payload?.meta?.total}`);

  const pending = await request('GET', '/api/v1/titles?watched=false&limit=100');
  check(
    'hay 10 titulos pendientes',
    pending.payload?.meta?.total === 10,
    `total ${pending.payload?.meta?.total}`,
  );

  const drama = await request('GET', '/api/v1/titles?genre=drama&limit=100');
  check(
    '33 titulos de Drama, y el filtro no distingue mayusculas',
    drama.payload?.meta?.total === 33,
    `total ${drama.payload?.meta?.total}`,
  );

  const perfect = await request('GET', '/api/v1/titles?minRating=10&limit=100');
  check(
    '5 titulos con puntaje 10',
    perfect.payload?.meta?.total === 5,
    `total ${perfect.payload?.meta?.total}`,
  );

  const recent = await request('GET', '/api/v1/titles?yearFrom=2020&limit=100');
  check(
    '4 titulos estrenados desde 2020',
    recent.payload?.meta?.total === 4,
    `total ${recent.payload?.meta?.total}`,
  );

  const nolan = await request('GET', '/api/v1/titles?q=nolan&limit=100');
  check(
    'la busqueda por texto encuentra los 3 de Nolan',
    nolan.payload?.meta?.total === 3,
    `total ${nolan.payload?.meta?.total}`,
  );

  const sorted = await request('GET', '/api/v1/titles?sort=year&order=desc&limit=100');
  const years = sorted.payload?.data?.map((title) => title.year) ?? [];
  check(
    'el orden por ano descendente se respeta',
    years.every((year, index) => index === 0 || years[index - 1] >= year),
    years.slice(0, 3).join(', '),
  );

  const byRating = await request('GET', '/api/v1/titles?sort=rating&order=desc&limit=100');
  const ratings = byRating.payload?.data?.map((title) => title.rating) ?? [];
  check(
    'los titulos sin puntaje quedan al final',
    ratings.slice(-10).every((rating) => rating === null),
    `ultimos: ${ratings.slice(-3).join(', ')}`,
  );

  const badSort = await request('GET', '/api/v1/titles?sort=color');
  check('un campo de orden invalido devuelve 400', badSort.status === 400, `status ${badSort.status}`);

  const badLimit = await request('GET', '/api/v1/titles?limit=abc');
  check('un limit no numerico devuelve 400', badLimit.status === 400, `status ${badLimit.status}`);

  const overLimit = await request('GET', '/api/v1/titles?limit=500');
  check('un limit por encima del maximo devuelve 400', overLimit.status === 400, `status ${overLimit.status}`);

  const badType = await request('GET', '/api/v1/titles?type=documental');
  check('un type invalido devuelve 400', badType.status === 400, `status ${badType.status}`);
}

section('Lectura de un titulo');
{
  const found = await request('GET', '/api/v1/titles/1');
  check('GET /titles/1 responde 200', found.status === 200, `status ${found.status}`);
  check(
    'devuelve el titulo correcto',
    found.payload?.data?.title === 'The Shawshank Redemption',
    `title ${found.payload?.data?.title}`,
  );

  const missing = await request('GET', '/api/v1/titles/9999');
  check('un id inexistente devuelve 404', missing.status === 404, `status ${missing.status}`);

  const invalid = await request('GET', '/api/v1/titles/abc');
  check('un id no numerico devuelve 400', invalid.status === 400, `status ${invalid.status}`);
}

section('Alta de un titulo');
let createdId = null;
{
  const created = await request('POST', '/api/v1/titles', { body: newMovie });
  check('POST /titles responde 201', created.status === 201, `status ${created.status}`);
  check(
    'la respuesta trae el header Location',
    created.headers.get('location')?.includes('/api/v1/titles/'),
    created.headers.get('location') ?? 'sin header',
  );
  check(
    'el servidor asigno el id',
    Number.isInteger(created.payload?.data?.id),
    `id ${created.payload?.data?.id}`,
  );
  check(
    'los campos opcionales tomaron su valor por defecto',
    created.payload?.data?.watched === false &&
      created.payload?.data?.rating === null &&
      created.payload?.data?.seasons === null,
    JSON.stringify(created.payload?.data),
  );
  createdId = created.payload?.data?.id;

  const duplicated = await request('POST', '/api/v1/titles', { body: newMovie });
  check(
    'el mismo titulo y ano devuelve 409',
    duplicated.status === 409,
    `status ${duplicated.status}`,
  );

  const incomplete = await request('POST', '/api/v1/titles', { body: { title: 'Sin datos' } });
  check('faltan campos obligatorios: 400', incomplete.status === 400, `status ${incomplete.status}`);
  check(
    'el 400 enumera todos los campos que fallaron',
    (incomplete.payload?.error?.details?.length ?? 0) >= 5,
    `${incomplete.payload?.error?.details?.length} errores`,
  );

  const badGenres = await request('POST', '/api/v1/titles', {
    body: { ...newMovie, title: 'Sin generos', genres: [] },
  });
  check('una lista de generos vacia: 400', badGenres.status === 400, `status ${badGenres.status}`);

  const repeatedGenres = await request('POST', '/api/v1/titles', {
    body: { ...newMovie, title: 'Generos repetidos', genres: ['Drama', 'drama'] },
  });
  check('generos repetidos: 400', repeatedGenres.status === 400, `status ${repeatedGenres.status}`);

  const badEnum = await request('POST', '/api/v1/titles', {
    body: { ...newMovie, title: 'Tipo raro', type: 'documental' },
  });
  check('un type fuera del enum: 400', badEnum.status === 400, `status ${badEnum.status}`);

  const badDate = await request('POST', '/api/v1/titles', {
    body: { ...newMovie, title: 'Fecha imposible', watched: true, watchedOn: '2026-02-31' },
  });
  check('una fecha que no existe en el calendario: 400', badDate.status === 400, `status ${badDate.status}`);

  const movieWithSeasons = await request('POST', '/api/v1/titles', {
    body: { ...newMovie, title: 'Pelicula con temporadas', seasons: 2, episodes: 8 },
  });
  check(
    'una pelicula con temporadas: 422',
    movieWithSeasons.status === 422,
    `status ${movieWithSeasons.status}`,
  );

  const seriesWithoutSeasons = await request('POST', '/api/v1/titles', {
    body: { ...newMovie, title: 'Serie sin temporadas', type: 'series' },
  });
  check(
    'una serie sin temporadas ni episodios: 422',
    seriesWithoutSeasons.status === 422,
    `status ${seriesWithoutSeasons.status}`,
  );

  const ratedButUnwatched = await request('POST', '/api/v1/titles', {
    body: { ...newMovie, title: 'Puntuada sin ver', rating: 9 },
  });
  check(
    'puntuar algo no visto: 422',
    ratedButUnwatched.status === 422,
    `status ${ratedButUnwatched.status}`,
  );

  const wrongType = await request('POST', '/api/v1/titles', {
    raw: 'title=Perfect Days',
    headers: { 'Content-Type': 'text/plain' },
  });
  check('un Content-Type que no es JSON: 415', wrongType.status === 415, `status ${wrongType.status}`);

  const malformed = await request('POST', '/api/v1/titles', {
    raw: '{"title": "Roto",',
    headers: { 'Content-Type': 'application/json' },
  });
  check('un JSON mal formado: 400', malformed.status === 400, `status ${malformed.status}`);

  const withId = await request('POST', '/api/v1/titles', { body: { ...newMovie, id: 500 } });
  check('mandar el id en el body: 400', withId.status === 400, `status ${withId.status}`);
}

section('Modificacion de un titulo');
{
  const replaced = await request('PUT', `/api/v1/titles/${createdId}`, {
    body: { ...newMovie, watched: true, rating: 8, watchedOn: '2026-08-01' },
  });
  check('PUT responde 200', replaced.status === 200, `status ${replaced.status}`);
  check(
    'el reemplazo aplico los cambios',
    replaced.payload?.data?.watched === true && replaced.payload?.data?.rating === 8,
    JSON.stringify(replaced.payload?.data),
  );

  const replacedMissing = await request('PUT', '/api/v1/titles/9999', { body: newMovie });
  check('PUT sobre un id inexistente: 404', replacedMissing.status === 404, `status ${replacedMissing.status}`);

  const patched = await request('PATCH', `/api/v1/titles/${createdId}`, { body: { rating: 7 } });
  check('PATCH responde 200', patched.status === 200, `status ${patched.status}`);
  check(
    'el PATCH cambio solo el campo enviado',
    patched.payload?.data?.rating === 7 && patched.payload?.data?.title === newMovie.title,
    JSON.stringify({
      rating: patched.payload?.data?.rating,
      title: patched.payload?.data?.title,
    }),
  );

  const emptyPatch = await request('PATCH', `/api/v1/titles/${createdId}`, { body: {} });
  check('un PATCH vacio devuelve 400', emptyPatch.status === 400, `status ${emptyPatch.status}`);

  const patchToExisting = await request('PATCH', `/api/v1/titles/${createdId}`, {
    body: { title: 'Inception', year: 2010 },
  });
  check(
    'pisar el titulo y ano de otro: 409',
    patchToExisting.status === 409,
    `status ${patchToExisting.status}`,
  );

  const unwatchWhileRated = await request('PATCH', `/api/v1/titles/${createdId}`, {
    body: { watched: false },
  });
  check(
    'marcar como no visto algo que tiene puntaje: 422',
    unwatchWhileRated.status === 422,
    `status ${unwatchWhileRated.status}`,
  );
}

section('Baja de un titulo e idempotencia');
{
  const removed = await request('DELETE', `/api/v1/titles/${createdId}`);
  check('DELETE responde 204', removed.status === 204, `status ${removed.status}`);
  check('el 204 no trae cuerpo', removed.payload === null, JSON.stringify(removed.payload));

  const removedAgain = await request('DELETE', `/api/v1/titles/${createdId}`);
  check(
    'repetir el DELETE devuelve 404 y el estado sigue siendo el mismo',
    removedAgain.status === 404,
    `status ${removedAgain.status}`,
  );

  const afterDelete = await request('GET', '/api/v1/titles?limit=100');
  check(
    'el catalogo volvio a tener 45 titulos',
    afterDelete.payload?.meta?.total === 45,
    `total ${afterDelete.payload?.meta?.total}`,
  );
}

section('Generos, directores y reportes');
{
  const genres = await request('GET', '/api/v1/genres');
  check('GET /genres responde 200', genres.status === 200, `status ${genres.status}`);
  check(
    'hay 16 generos',
    genres.payload?.data?.length === 16,
    `${genres.payload?.data?.length} generos`,
  );
  check(
    'Drama es el genero mas frecuente, con 33 titulos',
    genres.payload?.data?.[0]?.name === 'Drama' && genres.payload?.data?.[0]?.titleCount === 33,
    JSON.stringify(genres.payload?.data?.[0]),
  );

  const directors = await request('GET', '/api/v1/directors');
  check(
    'hay 31 directores',
    directors.payload?.data?.length === 31,
    `${directors.payload?.data?.length} directores`,
  );

  const stats = await request('GET', '/api/v1/reports/watch-stats');
  check('GET /reports/watch-stats responde 200', stats.status === 200, `status ${stats.status}`);
  check(
    '35 vistos y 10 pendientes',
    stats.payload?.data?.summary?.watched === 35 && stats.payload?.data?.summary?.pending === 10,
    JSON.stringify(stats.payload?.data?.summary),
  );
  check(
    '235,9 horas vistas (las series cuentan por episodio)',
    Math.abs((stats.payload?.data?.summary?.watchedHours ?? 0) - 235.9) < 0.01,
    `${stats.payload?.data?.summary?.watchedHours}`,
  );
  check(
    'el porcentaje de completado es 77,78 %',
    Math.abs((stats.payload?.data?.summary?.completionPct ?? 0) - 77.78) < 0.01,
    `${stats.payload?.data?.summary?.completionPct}`,
  );
  check(
    'el puntaje promedio es 8,71',
    Math.abs((stats.payload?.data?.summary?.averageRating ?? 0) - 8.71) < 0.01,
    `${stats.payload?.data?.summary?.averageRating}`,
  );
  check(
    'quedan 180,58 horas pendientes',
    Math.abs((stats.payload?.data?.summary?.pendingHours ?? 0) - 180.58) < 0.01,
    `${stats.payload?.data?.summary?.pendingHours}`,
  );
  check(
    'el desglose separa peliculas de series',
    stats.payload?.data?.byType?.length === 2 &&
      stats.payload?.data?.byType?.[0]?.total === 35 &&
      stats.payload?.data?.byType?.[1]?.total === 10,
    JSON.stringify(stats.payload?.data?.byType),
  );
  check(
    'las 10 series aportan mas horas vistas que las 35 peliculas',
    stats.payload?.data?.byType?.[1]?.watchedHours >
      stats.payload?.data?.byType?.[0]?.watchedHours,
    JSON.stringify(stats.payload?.data?.byType?.map((item) => item.watchedHours)),
  );
  check(
    'el pendiente mas corto encabeza la lista',
    stats.payload?.data?.pending?.[0]?.totalMinutes === 114,
    `${stats.payload?.data?.pending?.[0]?.totalMinutes}`,
  );

  const byGenre = await request('GET', '/api/v1/reports/rating-by-genre');
  check('GET /reports/rating-by-genre responde 200', byGenre.status === 200, `status ${byGenre.status}`);
  check(
    'el reporte cubre los 16 generos',
    byGenre.payload?.data?.summary?.genres === 16,
    `${byGenre.payload?.data?.summary?.genres}`,
  );
  check(
    'las 115 asignaciones de genero superan a los 45 titulos',
    byGenre.payload?.data?.summary?.genreAssignments === 115,
    `${byGenre.payload?.data?.summary?.genreAssignments}`,
  );
  check(
    'los generos sin ningun titulo puntuado quedan al final',
    byGenre.payload?.data?.genres?.every(
      (genre, index, list) =>
        index === 0 || list[index - 1].averageRating !== null || genre.averageRating === null,
    ),
    JSON.stringify(byGenre.payload?.data?.genres?.map((genre) => genre.averageRating)),
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

  const wrongMethod = await request('DELETE', '/api/v1/titles');
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

  const wrongMethodOnReport = await request('POST', '/api/v1/reports/watch-stats', { body: {} });
  check(
    'un POST contra un reporte de solo lectura devuelve 405',
    wrongMethodOnReport.status === 405,
    `status ${wrongMethodOnReport.status}`,
  );
}

console.log(`\nResultado: ${passed} pruebas ok, ${failed} fallidas.`);
server.close();
process.exit(failed === 0 ? 0 : 1);
