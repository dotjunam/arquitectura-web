/**
 * Armado de la aplicacion Express.
 *
 * Esta separado de `server.js` a proposito: aca se construye la app y alla se
 * la pone a escuchar. Asi se la puede montar en una prueba sin ocupar un puerto.
 *
 * El orden de los middlewares importa y es este:
 *   1. parseo del body            (para que `req.body` exista)
 *   2. rutas                      (la logica propiamente dicha)
 *   3. 404                        (nadie tomo el pedido)
 *   4. manejador de errores       (siempre ultimo)
 *
 * El control de `Content-Type` no va aca sino en cada ruta que recibe cuerpo:
 * puesto global, un POST contra un recurso de solo lectura respondia 415
 * cuando lo correcto es 405.
 */

import express from 'express';

import { config } from './config/index.js';
import { errorHandler } from './middlewares/error-handler.js';
import { methodNotAllowed } from './middlewares/method-not-allowed.js';
import { notFound } from './middlewares/not-found.js';
import { apiRoutes } from './routes/index.js';

export function createApp() {
  const app = express();

  // No hace falta anunciar con que esta hecho el servidor.
  app.disable('x-powered-by');

  app.use(express.json({ limit: config.bodyLimit }));

  // Indice de la API: punto de entrada para saber que hay, sin leer la doc.
  app.get('/', (req, res) => {
    res.status(200).json({
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
    });
  });
  app.all('/', methodNotAllowed(['GET']));

  app.use(config.apiPrefix, apiRoutes);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
