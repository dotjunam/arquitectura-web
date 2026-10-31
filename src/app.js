/**
 * Armado de la aplicacion Express.
 *
 * Esta separado de `server.js` a proposito: aca se construye la app y alla se
 * la pone a escuchar. Asi se la puede montar en una prueba sin ocupar un puerto.
 *
 * El orden de los middlewares importa y es este:
 *   1. parseo del body            (para que `req.body` exista)
 *   2. archivos del frontend      (HTML, CSS y JS de `public/`)
 *   3. rutas                      (la logica propiamente dicha)
 *   4. 404                        (nadie tomo el pedido)
 *   5. manejador de errores       (siempre ultimo)
 *
 * El control de `Content-Type` no va aca sino en cada ruta que recibe cuerpo:
 * puesto global, un POST contra un recurso de solo lectura respondia 415
 * cuando lo correcto es 405.
 */

import { fileURLToPath } from 'node:url';

import express from 'express';

import { config } from './config/index.js';
import { errorHandler } from './middlewares/error-handler.js';
import { methodNotAllowed } from './middlewares/method-not-allowed.js';
import { notFound } from './middlewares/not-found.js';
import { apiRoutes } from './routes/index.js';

/** Carpeta del frontend: se resuelve desde este archivo, no desde donde se lanzo node. */
const publicDir = fileURLToPath(new URL('../public', import.meta.url));

export function createApp() {
  const app = express();

  // No hace falta anunciar con que esta hecho el servidor.
  app.disable('x-powered-by');

  app.use(express.json({ limit: config.bodyLimit }));

  // El frontend se sirve desde el mismo proceso: mismo origen que la API, asi
  // que no hace falta CORS. `index: false` porque `/` lo resuelve la ruta de abajo.
  app.use(express.static(publicDir, { index: false }));

  const apiIndex = {
    name: 'TP Arquitectura Web - API de catalogo de peliculas y series',
    version: '1.0.0',
    documentation: 'docs/api.md',
    endpoints: {
      health: `${config.apiPrefix}/health`,
      titles: `${config.apiPrefix}/titles`,
      genres: `${config.apiPrefix}/genres`,
      directors: `${config.apiPrefix}/directors`,
      watchStatsReport: `${config.apiPrefix}/reports/watch-stats`,
      ratingByGenreReport: `${config.apiPrefix}/reports/rating-by-genre`,
    },
  };

  // `/` tiene dos representaciones y se elige por negociacion de contenido
  // (header `Accept`): un navegador pide HTML y recibe la interfaz; un cliente
  // de la API recibe el indice en JSON. `res.format` agrega `Vary: Accept` y
  // responde 406 si no puede ofrecer ninguna de las dos.
  app.get('/', (req, res) => {
    res.format({
      json: () => res.status(200).json(apiIndex),
      html: () => res.sendFile('index.html', { root: publicDir }),
    });
  });
  app.all('/', methodNotAllowed(['GET']));

  app.use(config.apiPrefix, apiRoutes);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
