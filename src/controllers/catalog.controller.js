/** Controladores de los recursos derivados del catalogo: categorias y proveedores. */

import { productService } from '../services/product.service.js';

export const catalogController = {
  listCategories(req, res) {
    res.status(200).json({ data: productService.listCategories() });
  },

  listSuppliers(req, res) {
    res.status(200).json({ data: productService.listSuppliers() });
  },
};
