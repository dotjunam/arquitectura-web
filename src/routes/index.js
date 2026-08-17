/** Router principal de la API: monta cada recurso bajo su propia ruta. */

import { Router } from 'express';

import { catalogController } from '../controllers/catalog.controller.js';
import { reportController } from '../controllers/report.controller.js';
import { methodNotAllowed } from '../middlewares/method-not-allowed.js';
import { titleRepository } from '../repositories/title.repository.js';
import { titleRoutes } from './title.routes.js';

const router = Router();

const readOnly = methodNotAllowed(['GET']);

/** Chequeo de vida del servicio. */
router.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    uptimeSeconds: Math.round(process.uptime()),
    seededTitles: titleRepository.count(),
  });
});
router.all('/health', readOnly);

router.use('/titles', titleRoutes);

// Generos y directores se derivan de los titulos: por eso son de solo lectura,
// no tienen alta ni baja propia.
router.get('/genres', catalogController.listGenres);
router.all('/genres', readOnly);

router.get('/directors', catalogController.listDirectors);
router.all('/directors', readOnly);

router.get('/reports/watch-stats', reportController.watchStats);
router.all('/reports/watch-stats', readOnly);

router.get('/reports/rating-by-genre', reportController.ratingByGenre);
router.all('/reports/rating-by-genre', readOnly);

export { router as apiRoutes };
