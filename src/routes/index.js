/** Router principal de la API: monta cada recurso bajo su propia ruta. */

import { Router } from 'express';

import { catalogController } from '../controllers/catalog.controller.js';
import { reportController } from '../controllers/report.controller.js';
import { methodNotAllowed } from '../middlewares/method-not-allowed.js';
import { productRepository } from '../repositories/product.repository.js';
import { productRoutes } from './product.routes.js';

const router = Router();

const readOnly = methodNotAllowed(['GET']);

/** Chequeo de vida del servicio. */
router.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    uptimeSeconds: Math.round(process.uptime()),
    seededProducts: productRepository.count(),
  });
});
router.all('/health', readOnly);

router.use('/products', productRoutes);

// Categorias y proveedores se derivan de los productos: por eso son de solo
// lectura, no tienen alta ni baja propia.
router.get('/categories', catalogController.listCategories);
router.all('/categories', readOnly);

router.get('/suppliers', catalogController.listSuppliers);
router.all('/suppliers', readOnly);

router.get('/reports/stock-health', reportController.stockHealth);
router.all('/reports/stock-health', readOnly);

router.get('/reports/margin-by-category', reportController.marginByCategory);
router.all('/reports/margin-by-category', readOnly);

export { router as apiRoutes };
