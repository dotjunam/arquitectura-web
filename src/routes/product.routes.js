/**
 * Rutas del recurso Producto.
 *
 * Una sola URL por recurso (`/products` para la coleccion, `/products/:id` para
 * el elemento) y el verbo dice la operacion: eso es el nivel 2 del modelo de
 * madurez de Richardson.
 */

import { Router } from 'express';

import { productController } from '../controllers/product.controller.js';
import { AppError } from '../errors/app-error.js';
import { methodNotAllowed } from '../middlewares/method-not-allowed.js';
import { requireJsonBody } from '../middlewares/require-json-body.js';

const router = Router();

/** El id viaja como texto en la URL: hay que validarlo antes de usarlo. */
function parseProductId(req, res, next) {
  const raw = req.params.id;
  if (!/^\d+$/.test(raw)) {
    return next(AppError.badRequest(`El id '${raw}' no es un numero entero valido.`));
  }
  req.productId = Number(raw);
  return next();
}

// Coleccion
router.get('/', productController.list);
router.post('/', requireJsonBody, productController.create);
router.all('/', methodNotAllowed(['GET', 'POST']));

// Elemento
router.get('/:id', parseProductId, productController.getById);
router.put('/:id', parseProductId, requireJsonBody, productController.replace);
router.patch('/:id', parseProductId, requireJsonBody, productController.update);
router.delete('/:id', parseProductId, productController.remove);
router.all('/:id', parseProductId, methodNotAllowed(['GET', 'PUT', 'PATCH', 'DELETE']));

export { router as productRoutes };
