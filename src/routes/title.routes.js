/**
 * Rutas del recurso Titulo.
 *
 * Una sola URL por recurso (`/titles` para la coleccion, `/titles/:id` para el
 * elemento) y el verbo dice la operacion: eso es el nivel 2 del modelo de
 * madurez de Richardson.
 */

import { Router } from 'express';

import { titleController } from '../controllers/title.controller.js';
import { AppError } from '../errors/app-error.js';
import { methodNotAllowed } from '../middlewares/method-not-allowed.js';
import { requireJsonBody } from '../middlewares/require-json-body.js';

const router = Router();

/** El id viaja como texto en la URL: hay que validarlo antes de usarlo. */
function parseTitleId(req, res, next) {
  const raw = req.params.id;
  if (!/^\d+$/.test(raw)) {
    return next(AppError.badRequest(`El id '${raw}' no es un numero entero valido.`));
  }
  req.titleId = Number(raw);
  return next();
}

// Coleccion
router.get('/', titleController.list);
router.post('/', requireJsonBody, titleController.create);
router.all('/', methodNotAllowed(['GET', 'POST']));

// Elemento
router.get('/:id', parseTitleId, titleController.getById);
router.put('/:id', parseTitleId, requireJsonBody, titleController.replace);
router.patch('/:id', parseTitleId, requireJsonBody, titleController.update);
router.delete('/:id', parseTitleId, titleController.remove);
router.all('/:id', parseTitleId, methodNotAllowed(['GET', 'PUT', 'PATCH', 'DELETE']));

export { router as titleRoutes };
